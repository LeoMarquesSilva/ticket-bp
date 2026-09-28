import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface TeamPresenceContextType {
  connectedUserIds: ReadonlySet<string>;
  ready: boolean;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

const TeamPresenceContext = createContext<TeamPresenceContextType>({
  connectedUserIds: EMPTY_SET,
  ready: false,
});

export const TeamPresenceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [connectedUserIds, setConnectedUserIds] = useState<ReadonlySet<string>>(EMPTY_SET);
  const [ready, setReady] = useState(false);
  const shouldTrack = Boolean(user?.id) && user?.role !== 'user';

  useEffect(() => {
    if (!user?.id) {
      setConnectedUserIds(EMPTY_SET);
      setReady(false);
      return;
    }

    const channel = supabase.channel('online-users', {
      config: { presence: { key: user.id } },
    });

    channel.on('presence', { event: 'sync' }, () => {
      setConnectedUserIds(new Set(Object.keys(channel.presenceState() || {})));
      setReady(true);
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED' && shouldTrack) {
        void channel.track({
          id: user.id,
          name: user.name,
          role: user.role,
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, user?.name, user?.role, shouldTrack]);

  return (
    <TeamPresenceContext.Provider value={{ connectedUserIds, ready }}>
      {children}
    </TeamPresenceContext.Provider>
  );
};

export const useTeamPresence = () => useContext(TeamPresenceContext);
