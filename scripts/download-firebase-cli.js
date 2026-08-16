const fs = require('fs');
const path = require('path');
const https = require('https');

const toolsDir = path.join(__dirname, '..', 'tools');
if (!fs.existsSync(toolsDir)) fs.mkdirSync(toolsDir, { recursive: true });
const targetFile = path.join(toolsDir, 'firebase.exe');

function download(url) {
  console.log(`Downloading Firebase CLI from ${url}...`);
  https.get(url, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      console.log(`Redirecting to ${res.headers.location}...`);
      return download(res.headers.location);
    }
    if (res.statusCode !== 200) {
      console.error(`HTTP error ${res.statusCode}`);
      process.exit(1);
    }

    const fileStream = fs.createWriteStream(targetFile);
    res.pipe(fileStream);

    fileStream.on('finish', () => {
      fileStream.close();
      console.log('✅ Firebase CLI downloaded successfully to tools/firebase.exe');
    });
  }).on('error', (err) => {
    console.error('Download error:', err.message);
  });
}

download('https://firebase.tools/bin/win/instant');
