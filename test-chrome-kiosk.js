const { exec } = require("child_process");
const fs = require("fs");

const chromePaths = [
  `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"`,
  `"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"`
];

function getChromePath() {
  for (const p of chromePaths) {
    if (fs.existsSync(p.replace(/"/g, ""))) return p;
  }
  return null;
}

const chromePath = getChromePath();
const testUrl = "https://www.google.com";

if (chromePath) {
  console.log("🌐 Closing Chrome...");
  exec(`taskkill /F /IM chrome.exe`, () => {
    console.log("🌐 Launching Chrome normally...");
    exec(`start "" ${chromePath} "${testUrl}" --disable-infobars --noerrdialogs --disable-translate --overscroll-history-navigation=0`);
  });
} else {
  console.log("⚠️ Chrome not found on this system.");
}
