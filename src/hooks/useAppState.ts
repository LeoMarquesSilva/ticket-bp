import { useState, useEffect, useRef } from 'react';

interface AppState {
  isTabActive: boolean;
  isOnline: boolean;
  lastActivity: number;
}

export const useAppState = () => {
  const [appState, setAppState] = useState<AppState>({
    isTabActive: document.visibilityState === 'visible',
    isOnline: navigator.onLine,
    lastActivity: Date.now()
  });

  const stateRef = useRef(appState);
  stateRef.current = appState;

  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      
      setAppState(prev => ({
        ...prev,
        isTabActive: isVisible,
        lastActivity: isVisible ? Date.now() : prev.lastActivity
      }));
    };

    const handleOnlineStatus = () => {
      setAppState(prev => ({
        ...prev,
        isOnline: navigator.onLine
      }));
    };

    const handleActivity = () => {
      if (stateRef.current.isTabActive) {
        setAppState(prev => ({
          ...prev,
          lastActivity: Date.now()
        }));
      }
    };

    // Event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    // Activity tracking
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
      
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, []);

  return appState;
};