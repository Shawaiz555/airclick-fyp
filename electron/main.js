/**
 * AirClick - Electron Main Process
 * ==================================
 *
 * Creates a transparent, always-on-top overlay window that shows:
 * - Hand detection status
 * - Recording progress
 * - Gesture match results
 * - Performance metrics
 *
 * The overlay is visible across ALL applications (PowerPoint, Word, etc.)
 *
 * Author: Muhammad Shawaiz
 * Project: AirClick FYP
 */

const { app, BrowserWindow, Tray, Menu, ipcMain, screen } = require('electron');
const path = require('path');

let overlayWindow = null;
let tray = null;
let overlayEnabled = true;

// ==================== CREATE OVERLAY WINDOW ====================

function createOverlay() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  overlayWindow = new BrowserWindow({
    width: 320,
    height: 160,
    x: width - 340, // 20px from right edge
    y: 20, // 20px from top
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    minimizable: false,
    maximizable: false,
    show: false, // Start hidden, show after ready
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  // Make window ignore mouse events (click-through)
  // But still show visual feedback
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  // Load the overlay HTML
  overlayWindow.loadFile(path.join(__dirname, 'overlay.html'));

  // Show window when ready
  overlayWindow.once('ready-to-show', () => {
    if (overlayEnabled) {
      overlayWindow.show();
    }
  });

  // Keep window always on top
  overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Optional: Open DevTools for debugging
  // overlayWindow.webContents.openDevTools({ mode: 'detach' });

  console.log('✅ Overlay window created');
}

// ==================== CREATE SYSTEM TRAY ====================

function createTray() {
  // Create tray icon (you'll need to add an icon file)
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');

  try {
    tray = new Tray(iconPath);
  } catch (error) {
    console.log('⚠ Tray icon not found, using default');
    // Fallback: create empty tray without icon
    tray = new Tray(require('electron').nativeImage.createEmpty());
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'AirClick Gesture Control',
      enabled: false
    },
    { type: 'separator' },
    {
      label: overlayEnabled ? '✓ Overlay Enabled' : 'Overlay Disabled',
      click: toggleOverlay
    },
    { type: 'separator' },
    {
      label: 'Open Dashboard',
      click: () => {
        // Open Next.js app in browser
        require('electron').shell.openExternal('http://localhost:3000/User/home');
      }
    },
    {
      label: 'Settings',
      click: () => {
        require('electron').shell.openExternal('http://localhost:3000/User/settings');
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setToolTip('AirClick - Gesture Control');
  tray.setContextMenu(contextMenu);

  // Update tray on click
  tray.on('click', () => {
    toggleOverlay();
  });

  console.log('✅ System tray created');
}

// ==================== TOGGLE OVERLAY ====================

function toggleOverlay() {
  overlayEnabled = !overlayEnabled;

  if (overlayEnabled) {
    if (!overlayWindow) {
      createOverlay();
    } else {
      overlayWindow.show();
    }
  } else {
    if (overlayWindow) {
      overlayWindow.hide();
    }
  }

  // Update tray menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'AirClick Gesture Control',
      enabled: false
    },
    { type: 'separator' },
    {
      label: overlayEnabled ? '✓ Overlay Enabled' : 'Overlay Disabled',
      click: toggleOverlay
    },
    { type: 'separator' },
    {
      label: 'Open Dashboard',
      click: () => {
        require('electron').shell.openExternal('http://localhost:3000/User/home');
      }
    },
    {
      label: 'Settings',
      click: () => {
        require('electron').shell.openExternal('http://localhost:3000/User/settings');
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  console.log(`✅ Overlay ${overlayEnabled ? 'enabled' : 'disabled'}`);
}

// ==================== IPC HANDLERS ====================

// Receive updates from renderer process
ipcMain.on('overlay-update', (event, data) => {
  // Forward to overlay window
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('update-overlay', data);
  }
});

// Handle overlay position change
ipcMain.on('set-overlay-position', (event, { x, y }) => {
  if (overlayWindow) {
    overlayWindow.setPosition(x, y);
  }
});

// ==================== APP LIFECYCLE ====================

app.whenReady().then(() => {
  console.log('🚀 AirClick Electron App Starting...');

  createOverlay();
  createTray();

  console.log('✅ AirClick Electron App Ready');
  console.log('📍 Overlay position: Top-right corner');
  console.log('🎯 Use system tray to toggle overlay');
});

// Prevent app from closing when all windows are closed (keep in tray)
app.on('window-all-closed', (e) => {
  e.preventDefault();
  // Don't quit on macOS
  if (process.platform !== 'darwin') {
    // Keep running in background
  }
});

app.on('activate', () => {
  // Re-create overlay if it was closed
  if (overlayWindow === null) {
    createOverlay();
  }
});

// Cleanup on quit
app.on('before-quit', () => {
  if (tray) {
    tray.destroy();
  }
});

console.log('✅ Electron main process initialized');
