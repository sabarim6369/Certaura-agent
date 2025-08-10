const WebSocket = require('ws');
const os = require('os');
const { exec } = require('child_process');

const config = {
  wsUrl: "ws://localhost:3000/ws", 
  labId: "6898c77f123d30902a948c0c" 
};

const systemName = os.hostname();

function connectWebSocket() {
  const ws = new WebSocket(config.wsUrl);

  ws.on('open', () => {
    console.log('✅ WebSocket connected! Registering agent...');

     const registerPayload = {
    type: 'REGISTER',
    deviceId: os.hostname(), 
    labId: '6898c77f123d30902a948c0c',
    hostname: os.hostname(),
    ip: '192.168.x.x'
  };
  ws.send(JSON.stringify(registerPayload));

  });

  ws.on('message', (message) => {
    try {
      const cmd = JSON.parse(message);
      console.log('📩 Received command:', cmd);

      if (cmd.type === 'START_EXAM' && cmd.url) {
        console.log(`🚀 Starting exam: ${cmd.url}`);
        exec(`start msedge --kiosk ${cmd.url}`);
      }

      if (cmd.type === 'STOP_EXAM') {
        console.log(`🛑 Stopping exam`);
        exec(`taskkill /F /IM msedge.exe`);
      }
    } catch (err) {
      console.error('❌ Invalid WS message:', message);
    }
  });

  ws.on('close', () => {
    console.log('⚠️ WebSocket disconnected, retrying in 5s...');
    setTimeout(connectWebSocket, 5000);
  });

  ws.on('error', (err) => {
    console.error('❌ WS Error:', err.message);
  });
}

connectWebSocket();
