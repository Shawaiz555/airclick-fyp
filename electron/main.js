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

// Enable remote module for renderer process (needed for drag functionality)
require('@electron/remote/main').initialize();

// Start token helper server
const tokenHelper = require('./token-helper.js');

let overlayWindow = null;
let tray = null;
let overlayEnabled = true;

// ==================== CREATE OVERLAY WINDOW ====================

function createOverlay() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  // Larger overlay for hand skeleton visualization
  const overlayWidth = 480;
  const overlayHeight = 580;

  overlayWindow = new BrowserWindow({
    width: overlayWidth,
    height: overlayHeight,
    x: 20, // Top-left corner (20px from left)
    y: 20, // Top-left corner (20px from top)
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: true, // Enabled for dragging - auto-blur implemented in overlay.html
    minimizable: false,
    maximizable: false,
    show: false, // Start hidden, show after ready
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  // Enable remote module for this window
  require('@electron/remote/main').enable(overlayWindow.webContents);

  // Note: Click-through behavior is now managed in overlay.html
  // It automatically enables/disables based on whether cursor is over header

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
  overlayWindow.webContents.openDevTools({ mode: 'detach' });

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

// ==================== APP LIFECYCLE ====================

app.whenReady().then(() => {
  console.log('🚀 AirClick Electron App Starting...');

  createOverlay();
  createTray();

  // ==================== IPC HANDLERS ====================
  // Setup IPC handlers AFTER app is ready

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
