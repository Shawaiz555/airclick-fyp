/**
 * Token Helper for Electron Overlay
 * Reads the authentication token from browser's localStorage
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TOKEN_FILE = path.join(os.homedir(), '.airclick-token');
const HYBRID_MODE_FILE = path.join(os.homedir(), '.airclick-hybridmode');

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
  } else if (req.method === 'POST' && req.url === '/clear-token') {
    try {
      // Delete token file if it exists
      if (fs.existsSync(TOKEN_FILE)) {
        fs.unlinkSync(TOKEN_FILE);
        console.log('🗑️  Token file deleted successfully');
      } else {
        console.log('⚠️  Token file does not exist');
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (error) {
      console.error('Error clearing token:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  } else if (req.method === 'POST' && req.url === '/save-hybrid-mode') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const { hybridMode } = JSON.parse(body);

        if (hybridMode !== undefined) {
          // Save hybrid mode to file
          fs.writeFileSync(HYBRID_MODE_FILE, hybridMode.toString(), 'utf8');
          console.log(`💾 Hybrid mode saved: ${hybridMode}`);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No hybridMode provided' }));
        }
      } catch (error) {
        console.error('Error saving hybrid mode:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/get-hybrid-mode') {
    try {
      // Read hybrid mode from file
      if (fs.existsSync(HYBRID_MODE_FILE)) {
        const hybridMode = fs.readFileSync(HYBRID_MODE_FILE, 'utf8').trim();
        console.log(`📖 Hybrid mode read: ${hybridMode}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ hybridMode: hybridMode === 'true' }));
      } else {
        // Default to true if file doesn't exist
        console.log('📄 Hybrid mode file does not exist, returning default: true');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ hybridMode: true }));
      }
    } catch (error) {
      console.error('Error reading hybrid mode:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
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
