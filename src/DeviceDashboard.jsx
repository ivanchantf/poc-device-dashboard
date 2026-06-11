// src/DeviceDashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import simpleDDP from 'simpleddp';
import { simpleddpCore } from 'simpleddp-core';
import { METEOR_WS_ENDPOINT } from './meteorClient';
import moment from 'moment';
import RealTimeClock from './RealTimeClock';

// --- DEFINED STATIONARY ROOM OPTIONS (Room 1 to Room 14) ---
const STATIC_ROOMS = Array.from({ length: 14 }, (_, i) => `Room ${i + 1}`);

export const DeviceDashboard = () => {
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const alertedDevicesRef = useRef(new Set());

  // --- NEW STATES FOR ROOM MAPPING MANAGEMENT ---
  const [activeSettingsDeviceId, setActiveSettingsDeviceId] = useState(null);
  const [newRoomInput, setNewRoomInput] = useState('');
  const [clientConnInstance, setClientConnInstance] = useState(null);

  useEffect(() => {
    // 1. Force a completely clean local connection context
    const clientConnection = new simpleDDP({
        endpoint: METEOR_WS_ENDPOINT,
        SocketConstructor: WebSocket,
        reconnectInterval: 5000
    }, simpleddpCore);

    setClientConnInstance(clientConnection);

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
      console.log("🔄 Synced device_connections collection data:", sortedRecords);
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
      const alertMinutes = Number(import.meta.env.VITE_REACT_ALERT_MINUTES) || 60;
      const currentDevicesList = targetCollection.fetch() || [];
      const alertThreshold = new Date(Date.now() - alertMinutes * 60 * 1000);

      currentDevicesList.forEach(device => {
        if (device.status === 'offline' && device.lastSeen) {
          const lastSeenDate = new Date(device.lastSeen);
          if (lastSeenDate < alertThreshold  && !alertedDevicesRef.current.has(device.id)) {
            alertedDevicesRef.current.add(device.id);
            alert(`⚠️ WARNING: Device [${device.deviceUuid ? device.deviceUuid.substring(0, 8) : 'Unknown'}] has been OFFLINE for over ${alertMinutes} minutes!`);
          }
        } else if (device.status === 'online') {
          alertedDevicesRef.current.delete(device.id);
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

  // --- NEW MUTATION FUNCTIONS FOR DDP CALLS ---
  const handleAddRoom = async (deviceId, existingRooms = [], valueToAdd) => {
    const targetRoom = valueToAdd || newRoomInput;
    if (!targetRoom.trim() || !clientConnInstance) return;
    
    const cleanedRoom = targetRoom.trim();
    if (existingRooms.includes(cleanedRoom)) {
      alert("This room is already assigned to this device!");
      return;
    }

    const updatedRooms = [...existingRooms, cleanedRoom];

    try {
      // Calls a Meteor backend method via DDP RPC
      await clientConnInstance.call('deviceConnections.updateRooms', deviceId, updatedRooms);
      setNewRoomInput('');
    } catch (err) {
      console.error("Failed to update rooms:", err);
      alert("Failed to save room setting mapping to server.");
    }
  };

  const handleRemoveRoom = async (deviceId, roomToRemove, existingRooms = []) => {
    if (!clientConnInstance) return;
    const updatedRooms = existingRooms.filter(room => room !== roomToRemove);

    try {
      await clientConnInstance.call('deviceConnections.updateRooms', deviceId, updatedRooms);
    } catch (err) {
      console.error("Failed to delete room mapping:", err);
    }
  };

  const totalDevicesCount = devices.length;
  const onlineCount = devices.filter(d => d.status === 'online').length;
  const offlineCount = totalDevicesCount - onlineCount;

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
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
          <RealTimeClock/>
          
          <div style={styles.statsPanel}>
            <div style={styles.statsRow}>
              <div style={styles.statColumn}>
                <span style={styles.statLabel}>Total Tablets</span>
                <span style={{ ...styles.statNumber, color: '#1F2937' }}>{totalDevicesCount}</span>
                <span style={styles.statPercentageFallback}>100% Total</span>
              </div>
              
              <div style={{ ...styles.statColumn, ...styles.statBorder }}>
                <span style={styles.statLabel}>
                  <span style={{ ...styles.indicatorDot, backgroundColor: '#10B981' }} />
                  Online
                </span>
                <span style={{ ...styles.statNumber, color: '#10B981' }}>{onlineCount}</span>
                <span style={{ ...styles.statPercentage, color: '#059669' }}>
                  {calculatePercentageLabel(onlineCount, totalDevicesCount)}
                </span>
              </div>
              
              <div style={styles.statColumn}>
                <span style={styles.statLabel}>
                  <span style={{ ...styles.indicatorDot, backgroundColor: '#EF4444' }} />
                  Offline
                </span>
                <span style={{ ...styles.statNumber, color: '#EF4444' }}>{offlineCount}</span>
                <span style={{ ...styles.statPercentage, color: '#DC2626' }}>
                  {calculatePercentageLabel(offlineCount, totalDevicesCount)}
                </span>
              </div>
            </div>

            <div style={styles.progressBarTrack}>
              {totalDevicesCount === 0 ? (
                <div style={{ ...styles.progressSegment, width: '100%', backgroundColor: '#E5E7EB' }} />
              ) : (
                <>
                  <div 
                    style={{ 
                      ...styles.progressSegment, 
                      width: `${onlinePercentRaw}%`, 
                      backgroundColor: '#10B981',
                      borderRadius: offlinePercentRaw === 0 ? '6px' : '6px 0 0 6px'
                    }} 
                    title={`Online: ${calculatePercentageLabel(onlineCount, totalDevicesCount)}`}
                  />
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

      {/* --- LIVE HARDWARE DEVICES GRID --- */}
      <div style={styles.grid}>
        {devices.map((device, index) => {
          const isOnline = device.status === 'online';
          const lastSeenDate = device.lastSeen ? new Date(device.lastSeen) : null;
          const assignedRooms = device.rooms || []; 
          const isSettingsOpen = activeSettingsDeviceId === device.id;
          
          // ⚡ FILTER ENGINE: Filter out rooms that are already assigned to this specific device
          const availableRooms = STATIC_ROOMS.filter(room => !assignedRooms.includes(room));
          
          return (
            <div 
              key={device.id || `device-${index}`} 
              style={{ 
                ...styles.card, 
                borderTop: isOnline ? '4px solid #10B981' : '4px solid #EF4444', 
                backgroundColor: isOnline ? '#F0FDF4' : '#FEF2F2' 
              }}
            >
              {/* Card Header Block */}
              <div style={styles.cardHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexGrow: 1 }}>
                  <span style={{ ...styles.statusDot, backgroundColor: isOnline ? '#10B981' : '#EF4444' }} />
                  <span style={{ ...styles.statusText, color: isOnline ? '#065F46' : '#991B1B' }}>
                    {isOnline ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
                
                {/* --- CONFIGURATION GEAR / SETTINGS BUTTON --- */}
                <button 
                  onClick={() => {
                    const nextOpenState = !isSettingsOpen;
                    setActiveSettingsDeviceId(nextOpenState ? device.id : null);
                    
                    // Pre-select the first remaining unassigned room option dynamically when opened
                    if (nextOpenState) {
                      const dynamicAvailable = STATIC_ROOMS.filter(r => !assignedRooms.includes(r));
                      setNewRoomInput(dynamicAvailable.length > 0 ? dynamicAvailable[0] : '');
                    } else {
                      setNewRoomInput('');
                    }
                  }}
                  style={styles.settingsBtn}
                  title="Configure Room Layout Mappings"
                >
                  ⚙️
                </button>
              </div>

              {/* --- DROPDOWN SELECTION ARCHITECTURE CONTAINER --- */}
              {isSettingsOpen && (
                <div style={styles.settingsDropdown}>
                  <h4 style={styles.dropdownTitle}>Assign Rooms</h4>
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                    
                    {availableRooms.length === 0 ? (
                      <span style={{ ...styles.noRoomsLabel, padding: '4px 0' }}>All rooms assigned</span>
                    ) : (
                      <>
                        {/* Native Form Selection Element Dropdown */}
                        <select 
                          value={newRoomInput || availableRooms[0]}
                          onChange={(e) => setNewRoomInput(e.target.value)}
                          style={styles.dropdownInput}
                        >
                          {availableRooms.map((roomName) => (
                            <option key={roomName} value={roomName}>
                              {roomName}
                            </option>
                          ))}
                        </select>

                        <button 
                          onClick={() => {
                            // Fallback to first available item if state isn't explicitly changed yet
                            const finalSelectedRoom = newRoomInput || availableRooms[0];
                            handleAddRoom(device.id, assignedRooms, finalSelectedRoom);
                          }} 
                          style={styles.dropdownAddBtn}
                        >
                          Add
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              <span style={{ display: 'block', fontSize: '5rem', textAlign: 'center', margin: '10px 20px' }}>
                <div className={`device-status ${isOnline ? 'online' : 'offline'}`}>
                  <svg className="tablet-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" style={{ width: '65px', height: '65px' }}>
                    <rect className="bezel" x="15" y="5" width="70" height="90" rx="8" ry="8" fill="#374151" />
                    <rect className="screen" x="20" y="12" width="60" height="70" rx="2" ry="2" fill={isOnline ? '#E8F5E9' : '#FFEBEE'} />
                    <circle className="camera" cx="50" cy="8.5" r="1.5" fill="#9CA3AF" />
                    <circle className="home-button" cx="50" cy="89" r="3" fill="#9CA3AF" />
                    <circle className="status-dot" cx="74" cy="18" r="4" fill={isOnline ? '#10B981' : '#EF4444'} />
                  </svg>
                </div>
              </span>

              <h3 style={styles.uuidText} title={device.deviceUuid}>
                UUID: {device.deviceUuid ? device.deviceUuid : 'N/A'}
              </h3>
              <h6 style={styles.modelText} title={device.model}>
                {device.manufacturer.toUpperCase() + ' ' + device.model || ''}
              </h6>
      
              {/* --- ROOMS DISPLAY LAYER --- */}
              <div style={styles.roomsWrapper}>
                {assignedRooms.length === 0 ? (
                  <span style={styles.noRoomsLabel}>No assigned locations</span>
                ) : ( 
                  assignedRooms.map((room, rIdx) => (
                    <span key={`${room}-${rIdx}`} style={styles.roomTag}>
                      {room}
                      <button 
                        style={styles.removeRoomTagBtn} 
                        onClick={() => handleRemoveRoom(device.id, room, assignedRooms)}
                      >
                        &times;
                      </button>
                    </span>
                  ))
                )}
              </div>
              
              <div style={styles.body}>
                {/* <div style={styles.dataRow}>
                  <span style={styles.label}>Model:</span>
                  <span style={styles.value}>{device.manufacturer.toUpperCase() + ' ' + device.model || ''}</span>
                </div> */}
                {/* <div style={styles.dataRow}>
                  <span style={styles.label}>Platform:</span>
                  <span style={styles.value}>{`${device.platform} ${device.version || ''} [SDK:${device.sdkVersion || ''}]`  || ''}</span>
                </div> */}


                <div style={styles.dataRow}>
                  <span style={styles.label}>Network IP:</span>
                  <span style={styles.value}>{device.ipAddress || 'Internal Loopback'}</span>
                </div>
                
                {!isOnline && lastSeenDate && (
                  <div style={styles.offlineTraceBlock}>
                    <span style={styles.offlineLabel}>Last Online:</span>
                    <span style={styles.offlineValue}>
                      {moment(lastSeenDate).format('MMM D, YYYY, h:mm A')}
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
  container: { padding: '0px', fontFamily: '-apple-system, system-ui, sans-serif', backgroundColor: '#F3F4F6', minHeight: '100vh' },
  loading: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#4B5563', fontSize: '1.1rem' },
  header: { backgroundColor: '#e4eaf3ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '5px 20px', borderBottom: '1px solid #E5E7EB' },
  headerTitle: { margin: 0, fontSize: '1.6rem', color: '#111827', fontWeight: 700 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px', padding:'0px 20px' },
  card: { position: 'relative', borderRadius: '12px', padding: '18px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '10px' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '6px' },
  statusDot: { width: '6px', height: '6px', borderRadius: '50%' },
  statusText: { fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' },
  uuidText: { fontSize: '1rem', margin: 0, color: '#1F2937', fontWeight: 600, wordBreak: 'break-all' },
  modelText: { fontSize: '1rem', margin: 0, color: '#696969ff', fontWeight: 600, wordBreak: 'break-all' },
  body: { fontSize: '0.85rem', borderTop: '1px solid #E5E7EB', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' },
  dataRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: '#6B7280' },
  value: { color: '#111827', fontWeight: 500 },
  offlineTraceBlock: { marginTop: '4px', borderTop: '1px dashed #FCA5A5', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  offlineLabel: { color: '#DC2626', fontWeight: 600 },
  offlineValue: { color: '#991B1B', fontWeight: 600 },
  emptyNotice: { gridColumn: '1 / -1', textAlign: 'center', color: '#6B7280', padding: '48px 0', fontSize: '0.95rem' },
  statsPanel: { display: 'flex', flexDirection: 'column', backgroundColor: '#FFFFFF', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)', padding: '16px' },
  statsRow: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '24px', paddingBottom: '12px' },
  statColumn: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '90px' },
  statBorder: { borderLeft: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB', paddingLeft: '24px', paddingRight: '24px' },
  statLabel: { fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, color: '#6B7280', letterSpacing: '0.05em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' },
  statNumber: { fontSize: '1.4rem', fontWeight: 700, lineHeight: '1' },
  indicatorDot: { width: '6px', height: '6px', borderRadius: '50%', display: 'inline-block' },
  statPercentage: { fontSize: '0.75rem', fontWeight: 600, marginTop: '2px', backgroundColor: 'rgba(255, 255, 255, 0.5)', padding: '1px 6px', borderRadius: '4px' },
  statPercentageFallback: { fontSize: '0.75rem', fontWeight: 500, marginTop: '2px', color: '#9CA3AF', padding: '1px 6px' },
  progressBarTrack: { display: 'flex', height: '8px', width: '100%', backgroundColor: '#F3F4F6', borderRadius: '6px', overflow: 'hidden', marginTop: '4px' },
  progressSegment: { height: '100%', transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' },

  settingsBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: '2px', opacity: 0.7, transition: 'transform 0.2s', '&:hover': { transform: 'rotate(45deg)', opacity: 1 } },
  settingsDropdown: { backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '10px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '6px', margin: '4px 0 10px 0' },
  dropdownTitle: { margin: '0 0 4px 0', fontSize: '0.8rem', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' },
  dropdownInput: { 
    flexGrow: 1, 
    padding: '4px 8px', 
    borderRadius: '4px', 
    border: '1px solid #D1D5DB', 
    fontSize: '0.8rem', 
    backgroundColor: '#FFFFFF', 
    color: '#111827', 
    outline: 'none' 
  },
  dropdownAddBtn: { backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 },
  roomsWrapper: { display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '4px 0' },
  noRoomsLabel: { fontSize: '0.75rem', color: '#9CA3AF', fontStyle: 'italic' },
  roomTag: { display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#E0F2FE', color: '#0369A1', fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', border: '1px solid #BAE6FD' },
  removeRoomTagBtn: { background: 'none', border: 'none', color: '#0284C7', cursor: 'pointer', fontSize: '0.9rem', padding: '0 0 0 2px', lineHeight: 1 }
};