import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos

export const InactivityDetector = () => {
  const { logout } = useAuth();
  const [lastActivity, setLastActivity] = useState(Date.now());
  
  const updateActivity = () => {
    setLastActivity(Date.now());
  };
  
  useEffect(() => {
    // Adicionar listeners para eventos de atividade
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      window.addEventListener(event, updateActivity);
    });
    
    // Verificar inatividade periodicamente
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastActivity > INACTIVITY_TIMEOUT) {
        console.log('Inatividade detectada, fazendo logout');
        logout();
      }
    }, 60000); // Verificar a cada minuto
    
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
      clearInterval(interval);
    };
  }, [lastActivity, logout]);
  
  return null; // Componente sem renderização
};

export default InactivityDetector;