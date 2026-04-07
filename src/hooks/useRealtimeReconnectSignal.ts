import { useEffect, useState } from 'react';

const MIN_RECONNECT_INTERVAL_MS = 4000;

export const useRealtimeReconnectSignal = () => {
  const [signal, setSignal] = useState(0);

  useEffect(() => {
    let lastSignalAt = 0;

    const emitSignal = (reason: 'online' | 'focus') => {
      const now = Date.now();
      if (now - lastSignalAt < MIN_RECONNECT_INTERVAL_MS) return;
      lastSignalAt = now;
      console.info(`[realtime] reconnect signal (${reason})`);
      setSignal((prev) => prev + 1);
    };

    const handleOnline = () => emitSignal('online');
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        emitSignal('focus');
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return signal;
};
