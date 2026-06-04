// src/meteorClient.js
import simpleDDP from 'simpleddp';
import { simpleddpCore } from 'simpleddp-core';

// Dev: 'ws://localhost:3000/websocket'
// Prod: 'wss://your-meteor-backend-domain.com/websocket'
export const METEOR_WS_ENDPOINT = 'ws://localhost:3000/websocket'; 

export const meteorConnection = new simpleDDP({
    endpoint: METEOR_WS_ENDPOINT,
    SocketConstructor: WebSocket,
    reconnectInterval: 5000 // Auto-reconnect loop
}, simpleddpCore);

meteorConnection.on('connected', () => {
    console.log('✅ Success: Standalone React App connected to Meteor DDP Server!');
});

meteorConnection.on('disconnected', () => {
    console.warn('❌ Warning: Lost connection to Meteor Server. Attempting reconnect...');
});

meteorConnection.on('error', (error) => {
    console.error('🔥 DDP Connection Error:', error);
});