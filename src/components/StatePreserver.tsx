import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface StatePreserverProps {
  children: React.ReactNode;
}

export const StatePreserver: React.FC<StatePreserverProps> = ({ children }) => {
  const location = useLocation();

  useEffect(() => {
    // Salvar estado da rota atual
    const currentState = {
      pathname: location.pathname,
      search: location.search,
      timestamp: Date.now()
    };
    
    sessionStorage.setItem('app_current_route', JSON.stringify(currentState));
  }, [location]);

  useEffect(() => {
    // Prevenir recarregamento desnecessário
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Salvar estado antes de sair
      const appState = {
        timestamp: Date.now(),
        route: location.pathname + location.search
      };
      sessionStorage.setItem('app_state_backup', JSON.stringify(appState));
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [location]);

  return <>{children}</>;
};