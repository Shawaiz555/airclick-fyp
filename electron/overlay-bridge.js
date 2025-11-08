/**
 * AirClick - Overlay Bridge
 * ==========================
 *
 * This script can be included in the Next.js app to send updates
 * to the Electron overlay window.
 *
 * Usage in React component:
 *
 * import { sendOverlayUpdate } from '../path/to/overlay-bridge';
 *
 * sendOverlayUpdate({
 *   handDetected: true,
 *   recording: true,
 *   recordingProgress: 45,
 *   gestureMatch: { matched: true, name: 'Thumbs Up', similarity: 85 }
 * });
 *
 * Author: Muhammad Shawaiz
 * Project: AirClick FYP
 */

// Check if running in Electron
const isElectron = () => {
  return typeof window !== 'undefined' &&
         window.process &&
         window.process.type === 'renderer';
};

/**
 * Send update to overlay window
 * @param {Object} data - Overlay data
 */
export function sendOverlayUpdate(data) {
  if (isElectron()) {
    // Running in Electron - use IPC
    const { ipcRenderer } = window.require('electron');
    ipcRenderer.send('overlay-update', data);
  } else {
    // Running in browser - use WebSocket (optional)
    // You could set up a WebSocket server to communicate with Electron
    console.log('[Overlay Bridge] Not in Electron, skipping overlay update');
  }
}

/**
 * Send hand detection status
 */
export function sendHandStatus(detected) {
  sendOverlayUpdate({ handDetected: detected });
}

/**
 * Send recording progress
 */
export function sendRecordingProgress(frameCount) {
  sendOverlayUpdate({
    recording: frameCount > 0,
    recordingProgress: frameCount
  });
}

/**
 * Send gesture match result
 */
export function sendGestureMatch(matched, gestureName = '', similarity = 0) {
  sendOverlayUpdate({
    gestureMatch: {
      matched,
      name: gestureName,
      similarity
    }
  });
}

/**
 * Send performance metrics
 */
export function sendPerformanceMetrics(fps, latency) {
  sendOverlayUpdate({
    fps,
    latency
  });
}

export default {
  sendOverlayUpdate,
  sendHandStatus,
  sendRecordingProgress,
  sendGestureMatch,
  sendPerformanceMetrics,
  isElectron
};
