
const path = require('path');
const { exec, spawn } = require('child_process');
const WebSocket = require('ws');
const os = require('os');

// const config = {
//   wsUrl: "ws://localhost:3000/ws",
//   labId: "6898c77f123d30902a948c0c"
// };
const config = {
  wsUrl: "wss://certauraserver.onrender.com/ws",
  labId: "6898c77f123d30902a948c0c"
};

let blockProcess = null;

function connectWebSocket() {
  const ws = new WebSocket(config.wsUrl);

  ws.on('open', () => {
    console.log('✅ WebSocket connected! Registering agent...');

    const registerPayload = {
      type: 'REGISTER',
      deviceId: os.hostname(),
      labId: config.labId,
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

        if (!blockProcess) {
          const autoHotkeyPath = path.join(__dirname, 'resources', 'tools', 'AutoHotkey64.exe');
          const scriptPath = path.join(__dirname, 'resources', 'scripts', 'Block.ahk');

          blockProcess = spawn(autoHotkeyPath, [scriptPath]);

          blockProcess.stdout.on('data', (data) => {
            console.log(`AHK stdout: ${data.toString()}`);
          });
          blockProcess.stderr.on('data', (data) => {
            console.error(`AHK stderr: ${data.toString()}`);
          });
          blockProcess.on('error', (err) => {
            console.error(`AHK error: ${err.message}`);
          });
          blockProcess.on('close', (code) => {
            console.log(`AHK process exited with code ${code}`);
            blockProcess = null;
          });

          console.log('🔒 Key blocking script started');
        }

        exec(`start msedge --kiosk ${cmd.url}`);
      }

      if (cmd.type === 'STOP_EXAM') {
        console.log(`🛑 Stopping exam`);

        if (blockProcess) {
          blockProcess.kill();
          blockProcess = null;
          console.log('🔓 Key blocking script stopped');
        }

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
