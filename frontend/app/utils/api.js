// API utility for making backend requests

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// Helper function to get auth token
function getAuthToken() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
}

// Helper function to handle API responses
async function handleResponse(response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'An error occurred' }));
    throw new Error(error.detail || 'Request failed');
  }
  return response.json();
}

// Auth API
export const authAPI = {
  async register(email, password, role = 'USER') {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, role }),
    });
    return handleResponse(response);
  },

  async login(email, password) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(response);
  },
};

// Gestures API
export const gesturesAPI = {
  async record(gestureData) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/gestures/record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(gestureData),
    });
    return handleResponse(response);
  },

  async getAll() {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/gestures/`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  async delete(gestureId) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/gestures/${gestureId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error('Failed to delete gesture');
    }
    return true;
  },
};

// Settings API
export const settingsAPI = {
  async getSettings() {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/settings`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  async updateSettings(settings) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(settings),
    });
    return handleResponse(response);
  },

  async resetSettings() {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/settings/reset`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  async applySettings() {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/settings/apply`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },
};

// Admin API
export const adminAPI = {
  async getOverviewStats() {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/admin/overview-stats`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  async getMonthlyUserGrowth(months = 6) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/admin/monthly-user-growth?months=${months}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  async getMonthlyGestureAccuracy(months = 6) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/admin/monthly-gesture-accuracy?months=${months}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  async getRecentActivity(limit = 50) {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/admin/recent-activity?limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  async getAllUsers(params = {}) {
    const token = getAuthToken();
    const queryParams = new URLSearchParams(params);
    const response = await fetch(`${API_BASE_URL}/admin/users?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },
};
