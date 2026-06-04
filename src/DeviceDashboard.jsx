// src/DeviceDashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import simpleDDP from 'simpleddp';
import { simpleddpCore } from 'simpleddp-core';
import { METEOR_WS_ENDPOINT } from './meteorClient';
import moment from 'moment';
import RealTimeClock from './RealTimeClock';

export const DeviceDashboard = () => {
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const alertedDevicesRef = useRef(new Set());

  useEffect(() => {
    // 1. Force a completely clean local connection context
    const clientConnection = new simpleDDP({
        endpoint: METEOR_WS_ENDPOINT,
        SocketConstructor: WebSocket,
        reconnectInterval: 5000
    }, simpleddpCore);

    const targetCollection = clientConnection.collection('device_connections');
    let subscription = null;
    let changeListener = null;

    const syncCollectionData = () => {
      const rawRecords = targetCollection.fetch() || [];
      const sortedRecords = [...rawRecords].sort((a, b) => {
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (a.status !== 'online' && b.status === 'online') return 1;
        return new Date(b.lastSeen) - new Date(a.lastSeen);
      });
      setDevices(sortedRecords);
    };

    // 2. CRITICAL: Wait for connection acknowledgment before firing subscription commands
    clientConnection.on('connected', () => {
      console.log("🚀 DDP Connection verified. Sending unique subscription frame...");
      
      const uniqueSubId = 'sub_' + Math.random().toString(36).substring(2, 11);
      
      // Fire subscription using a completely custom instance ID slot
      subscription = clientConnection.subscribe('admin.deviceStatuses', [], uniqueSubId);
      changeListener = targetCollection.onChange(syncCollectionData);

      subscription.ready().then(() => {
        setIsLoading(false);
        syncCollectionData();
      });
    });

    // Background Interval: Checks every 10s if any offline device crossed the 60-min threshold
    const alertInterval = setInterval(() => {
        const alertMinutes = Number(import.meta.env.VITE_REACT_ALERT_MINUTES);
      const currentDevicesList = targetCollection.fetch() || [];
      const alertThreshold = new Date(Date.now() - alertMinutes * 60 * 1000);

      currentDevicesList.forEach(device => {
        if (device.status === 'offline' && device.lastSeen) {
          const lastSeenDate = new Date(device.lastSeen);
          if (lastSeenDate < alertThreshold  && !alertedDevicesRef.current.has(device._id)) {
            alertedDevicesRef.current.add(device._id);
            alert(`⚠️ WARNING: Device [${device.deviceUuid ? device.deviceUuid.substring(0, 8) : 'Unknown'}] has been OFFLINE for over ${alertMinutes} minutes!`);
          }
        } else if (device.status === 'online') {
          alertedDevicesRef.current.delete(device._id);
        }
      });
    }, 10000);

    // 3. Clean unmount hook teardown
    return () => {
      clearInterval(alertInterval);
      if (subscription) subscription.stop();
      if (changeListener) changeListener.stop();
      clientConnection.disconnect();
    };
  }, []);

  const totalOnline = devices.filter(d => d.status === 'online').length;

  if (isLoading) {
    return <div style={styles.loading}>Connecting to live backend network mapping...</div>;
  }
const totalDevicesCount = devices.length;
const onlineCount = devices.filter(d => d.status === 'online').length;
const offlineCount = totalDevicesCount - onlineCount;



// Helper function to safely calculate raw percentages
const getRawPercentage = (count, total) => {
  if (total === 0) return 0;
  return (count / total) * 100;
};

const onlinePercentRaw = getRawPercentage(onlineCount, totalDevicesCount);
const offlinePercentRaw = getRawPercentage(offlineCount, totalDevicesCount);

const calculatePercentageLabel = (count, total) => {
  if (total === 0) return '0%';
  return `${Math.round((count / total) * 100)}%`;
};






  return (
    <div style={styles.container}>
<header style={styles.header}>
    
      <div>
        <h1 style={styles.headerTitle}>Tablet Status Monitor</h1>
        {/* <p style={styles.headerSubtitle}>Real-time Cordova Handset Synchronization Grid</p> */}
      </div>
      
      {/* Container for Stats Row and the New Progress Bar */}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
        <RealTimeClock/>
        
      <div style={styles.statsPanel}>
       
        <div style={styles.statsRow}>
          {/* Column 1: Total Volume */}
          <div style={styles.statColumn}>
            <span style={styles.statLabel}>Total Tablets</span>
            <span style={{ ...styles.statNumber, color: '#1F2937' }}>
              {totalDevicesCount}
            </span>
            <span style={styles.statPercentageFallback}>100% Total</span>
          </div>
          
          {/* Column 2: Active Nodes */}
          <div style={{ ...styles.statColumn, ...styles.statBorder }}>
            <span style={styles.statLabel}>
              <span style={{ ...styles.indicatorDot, backgroundColor: '#10B981' }} />
              Online
            </span>
            <span style={{ ...styles.statNumber, color: '#10B981' }}>
              {onlineCount}
            </span>
            <span style={{ ...styles.statPercentage, color: '#059669' }}>
              {calculatePercentageLabel(onlineCount, totalDevicesCount)}
            </span>
          </div>
          
          {/* Column 3: Inactive Nodes */}
          <div style={styles.statColumn}>
            <span style={styles.statLabel}>
              <span style={{ ...styles.indicatorDot, backgroundColor: '#EF4444' }} />
              Offline
            </span>
            <span style={{ ...styles.statNumber, color: '#EF4444' }}>
              {offlineCount}
            </span>
            <span style={{ ...styles.statPercentage, color: '#DC2626' }}>
              {calculatePercentageLabel(offlineCount, totalDevicesCount)}
            </span>
          </div>
        </div>

        {/* --- NEW VISUAL PERCENTAGE SEGMENTATION BAR --- */}
        <div style={styles.progressBarTrack}>
          {totalDevicesCount === 0 ? (
            // Empty placeholder state when no tablets are tracking yet
            <div style={{ ...styles.progressSegment, width: '100%', backgroundColor: '#E5E7EB' }} />
          ) : (
            <>
              {/* Online Segment */}
              <div 
                style={{ 
                  ...styles.progressSegment, 
                  width: `${onlinePercentRaw}%`, 
                  backgroundColor: '#10B981',
                  borderRadius: offlinePercentRaw === 0 ? '6px' : '6px 0 0 6px'
                }} 
                title={`Online: ${calculatePercentageLabel(onlineCount, totalDevicesCount)}`}
              />
              {/* Offline Segment */}
              <div 
                style={{ 
                  ...styles.progressSegment, 
                  width: `${offlinePercentRaw}%`, 
                  backgroundColor: '#EF4444',
                  borderRadius: onlinePercentRaw === 0 ? '6px' : '0 6px 6px 0'
                }} 
                title={`Offline: ${calculatePercentageLabel(offlineCount, totalDevicesCount)}`}
              />
            </>
          )}
        </div>
      </div>
      </div>
    </header>

      <div style={styles.grid}>
        {devices.map((device, index) => {
          const isOnline = device.status === 'online';
          const lastSeenDate = device.lastSeen ? new Date(device.lastSeen) : null;
          
          return (
            <div 
              key={device._id || `device-${index}`} 
              style={{ 
                ...styles.card, 
                borderTop: isOnline ? '4px solid #10B981' : '4px solid #EF4444', 
                backgroundColor: isOnline ? '#F0FDF4' : '#FEF2F2' 
              }}
            >
              <div style={styles.cardHeader}>
                <span style={{ ...styles.statusDot, backgroundColor: isOnline ? '#10B981' : '#EF4444' }} />
                <span style={{ ...styles.statusText, color: isOnline ? '#065F46' : '#991B1B' }}>
                  {isOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
              <span style={{ display: 'block', fontSize: '5rem', textAlign: 'center', margin: '20px 20px' }}>
                📱
                </span>
              <h3 style={styles.uuidText} title={device.deviceUuid}>
                
                UUID: {device.deviceUuid ? device.deviceUuid : 'N/A'}
              </h3>
              
              <div style={styles.body}>
                <div style={styles.dataRow}>
                  <span style={styles.label}>Network IP:</span>
                  <span style={styles.value}>{device.ipAddress || 'Internal Loopback'}</span>
                </div>
                
                {!isOnline && lastSeenDate && (
                  <div style={styles.offlineTraceBlock}>
                    <span style={styles.offlineLabel}>Last Online:</span>
                    <span style={styles.offlineValue}>
                        {moment(lastSeenDate).format('MMM D, YYYY, h:mm A')}
                      {/* {lastSeenDate   .toLocaleDateString()} {lastSeenDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} */}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        
        {devices.length === 0 && (
          <div key="empty-grid-notice" style={styles.emptyNotice}>No hardware connection instances currently tracking in database.</div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: { padding: '32px', fontFamily: '-apple-system, system-ui, sans-serif', backgroundColor: '#F3F4F6', minHeight: '100vh' },
  loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#4B5563', fontSize: '1.1rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', paddingBottom: '16px', borderBottom: '1px solid #E5E7EB' },
  headerTitle: { margin: 0, fontSize: '1.6rem', color: '#111827', fontWeight: 700 },
  headerSubtitle: { margin: '4px 0 0 0', color: '#6B7280', fontSize: '0.85rem' },
  badgeContainer: { display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#FFFFFF', padding: '8px 16px', borderRadius: '24px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', fontSize: '0.9rem', color: '#374151', fontWeight: 500 },
  badgePulse: { width: '8px', height: '8px', backgroundColor: '#10B981', borderRadius: '50%' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' },
  card: { borderRadius: '12px', padding: '18px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '10px' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '6px' },
  statusDot: { width: '6px', height: '6px', borderRadius: '50%' },
  statusText: { fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' },
  uuidText: { fontSize: '1rem', margin: 0, color: '#1F2937', fontWeight: 600, wordBreak: 'break-all' },
  body: { fontSize: '0.85rem', borderTop: '1px solid #E5E7EB', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' },
  dataRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: '#6B7280' },
  value: { color: '#111827', fontWeight: 500 },
  offlineTraceBlock: { marginTop: '4px', borderTop: '1px dashed #FCA5A5', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  offlineLabel: { color: '#DC2626', fontWeight: 600 },
  offlineValue: { color: '#991B1B', fontWeight: 600 },
  emptyNotice: { gridColumn: '1 / -1', textAlign: 'center', color: '#6B7280', padding: '48px 0', fontSize: '0.95rem' },
  // Place these right inside your styles config object
  statsRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: '12px 24px',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
    gap: '24px'
  },
  statColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '90px'
  },
  statBorder: {
    borderLeft: '1px solid #E5E7EB',
    borderRight: '1px solid #E5E7EB',
    paddingLeft: '24px',
    paddingRight: '24px'
  },
  statLabel: {
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    fontWeight: 600,
    color: '#6B7280',
    letterSpacing: '0.05em',
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  statNumber: {
    fontSize: '1.4rem',
    fontWeight: 700,
    lineHeight: '1'
  },
  indicatorDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    display: 'inline-block'
  },
  // Place these right inside your existing styles config object
  statPercentage: {
    fontSize: '0.75rem',
    fontWeight: 600,
    marginTop: '2px',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    padding: '1px 6px',
    borderRadius: '4px'
  },
  statPercentageFallback: {
    fontSize: '0.75rem',
    fontWeight: 500,
    marginTop: '2px',
    color: '#9CA3AF',
    padding: '1px 6px'
  },
  // Place these properties right inside your existing styles config object
  statsPanel: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
    padding: '16px'
  },
  // We shifted the panel background styles from statsRow to statsPanel
  statsRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '24px',
    paddingBottom: '12px'
  },
  progressBarTrack: {
    display: 'flex',
    height: '8px',
    width: '100%',
    backgroundColor: '#F3F4F6',
    borderRadius: '6px',
    overflow: 'hidden',
    marginTop: '4px'
  },
  progressSegment: {
    height: '100%',
    transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' // Smooth resizing animation
  },
};