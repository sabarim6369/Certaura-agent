const path = require('path');
const { exec, spawn } = require('child_process');
const WebSocket = require('ws');
const os = require('os');
const fs = require('fs');

let app;
let isElectron = false;

// Detect if running inside Electron
try {
  app = require('electron').app;
  isElectron = true;
} catch (e) {
  isElectron = false;
}

// Helper: read labId from config file
function getLabIdFromConfig() {
  const configPath = path.join(os.homedir(), '.certauraagent', 'config.json');
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const json = JSON.parse(raw);
    return json.labId || null;
  } catch (err) {
    console.error('Failed to read labId from config:', err.message);
    return null;
  }
}

// Get labId from CLI args or fallback to config file
const args = process.argv.slice(2);
let labId = null;
for (const arg of args) {
  if (arg.startsWith("--labId=")) {
    labId = arg.split("=")[1];
  }
}

if (!labId) {
  labId = getLabIdFromConfig();
}

if (!labId) {
  console.error("❌ labId argument is missing and no config found. Usage: node agent.js --labId=YOUR_LAB_ID or put labId in config file");
  process.exit(1);
}

// Resolve paths for AutoHotkey and script depending on environment
function getAhkPaths() {
  if (isElectron && app) {
    // When packaged by electron-builder, extraResources are unpacked next to executable in 'resources' folder
    // app.getAppPath() points inside app.asar or unpacked app folder
    // So go one level up to 'resources' folder
    const basePath = path.resolve(app.getAppPath(), '..'); 

    const autoHotkeyPath = path.join(basePath, 'tools', 'AutoHotkey64.exe');
    const scriptPath = path.join(basePath, 'scripts', 'Block.ahk');
    return { autoHotkeyPath, scriptPath };
  } else {
    // Running locally: files relative to current script dir
    const autoHotkeyPath = path.join(__dirname, 'resources', 'tools', 'AutoHotkey64.exe');
    const scriptPath = path.join(__dirname, 'resources', 'scripts', 'Block.ahk');
    return { autoHotkeyPath, scriptPath };
  }
}

const config = {
  // wsUrl: "wss://certauraserver.onrender.com/ws",
  wsUrl: "ws://localhost:3000/ws",
  labId: labId
  // labId: "6898c77f123d30902a948c0c"
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
      ip: '192.168.x.x' // Improve this to get actual IP if needed
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
          const { autoHotkeyPath, scriptPath } = getAhkPaths();

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
