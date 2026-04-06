'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const MaintenanceContext = createContext({ isMaintenanceMode: false });

export function MaintenanceProvider({ children }) {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);

  const checkMaintenance = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:8000/api/admin/maintenance-status');
      if (res.ok) {
        const data = await res.json();
        setIsMaintenanceMode(!!data.maintenance_mode);
      }
    } catch {
      // Backend unreachable — leave current state unchanged
    }
  }, []);

  useEffect(() => {
    checkMaintenance();
    // Poll every 30 seconds so the banner appears/disappears without a page reload
    const interval = setInterval(checkMaintenance, 30000);
    return () => clearInterval(interval);
  }, [checkMaintenance]);

  return (
    <MaintenanceContext.Provider value={{ isMaintenanceMode }}>
      {children}
    </MaintenanceContext.Provider>
  );
}

export function useMaintenance() {
  return useContext(MaintenanceContext);
}
