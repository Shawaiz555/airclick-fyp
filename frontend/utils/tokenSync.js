/**
 * Token Sync Utility
 * Saves authentication token to a file that Electron overlay can read
 */

export const saveTokenForElectron = async (token) => {
  try {
    // Save to localStorage first (for web app)
    localStorage.setItem('token', token);

    // Try to save to file for Electron overlay
    if (typeof window !== 'undefined' && window.electronAPI) {
      // If running in Electron renderer
      window.electronAPI.send('save-token', token);
    } else {
      // If running in browser, call a backend endpoint to save it
      await fetch('http://localhost:8000/api/auth/save-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ token })
      }).catch(err => {
        console.warn('Failed to save token for Electron:', err);
      });
    }
  } catch (error) {
    console.error('Error saving token:', error);
  }
};

export const getToken = () => {
  return localStorage.getItem('token');
};
