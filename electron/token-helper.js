/**
 * Token Helper for Electron Overlay
 * Reads the authentication token from browser's localStorage
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TOKEN_FILE = path.join(os.homedir(), '.airclick-token');

// Simple HTTP server to receive token from browser
const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/save-token') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const { token } = JSON.parse(body);

        if (token) {
          // Save token to file
          fs.writeFileSync(TOKEN_FILE, token, 'utf8');
          console.log('✅ Token saved successfully');

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No token provided' }));
        }
      } catch (error) {
        console.error('Error saving token:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

const PORT = 3001;

server.listen(PORT, () => {
  console.log(`📡 Token helper server running on port ${PORT}`);
});

module.exports = server;
