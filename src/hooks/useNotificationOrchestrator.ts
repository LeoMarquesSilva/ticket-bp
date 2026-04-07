import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';
import { useNotificationSound } from './useNotificationSound';

type RealtimeNotificationType = 'ticket_created' | 'ticket_assigned' | 'message_received';

type RealtimeNotifyInput = {
  type: RealtimeNotificationType;
  dedupeKey: string;
  title: string;
  description?: string;
  ticketId?: string;
  onOpen?: () => void;
};

const DEDUPE_WINDOW_MS = 2500;

export const useNotificationOrchestrator = () => {
  const location = useLocation();
  const recentEventsRef = useRef<Map<string, number>>(new Map());
  const { playNotificationSound, isTabVisible, activeChatId } = useNotificationSound();

  const notifyRealtimeEvent = useCallback(async (input: RealtimeNotifyInput) => {
    const now = Date.now();
    const previousAt = recentEventsRef.current.get(input.dedupeKey);
    if (previousAt && now - previousAt < DEDUPE_WINDOW_MS) {
      console.info(`[notify] deduped key=${input.dedupeKey}`);
      return;
    }

    recentEventsRef.current.set(input.dedupeKey, now);
    // Limpeza leve para evitar crescimento indefinido do map
    recentEventsRef.current.forEach((timestamp, key) => {
      if (now - timestamp > DEDUPE_WINDOW_MS * 8) {
        recentEventsRef.current.delete(key);
      }
    });

    const sameOpenChat = Boolean(input.ticketId) &&
      activeChatId === input.ticketId &&
      location.pathname.startsWith('/tickets');

    const shouldShowToast = !(isTabVisible && sameOpenChat);
    const soundResult = await playNotificationSound(input.ticketId, {
      forceWhenHidden: true,
      soundType: input.type === 'message_received' ? 'message' : 'new_ticket',
    });

    if (shouldShowToast) {
      toast.info(input.title, {
        description: input.description,
        duration: 8000,
        action: input.onOpen
          ? {
              label: 'Ver',
              onClick: input.onOpen,
            }
          : undefined,
      });
    }

    // Fallback para segundo plano: notificação nativa do navegador
    if (!isTabVisible && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(input.title, {
          body: input.description,
          tag: input.dedupeKey,
          renotify: false,
        });
      } catch (error) {
        console.warn('[notify] browser notification failed', error);
      }
    }

    console.info(
      `[notify] type=${input.type} visible=${isTabVisible} activeChat=${activeChatId ?? 'none'} sound=${soundResult.played ? 'played' : soundResult.reason} toast=${shouldShowToast}`
    );
  }, [activeChatId, isTabVisible, location.pathname, playNotificationSound]);

  return { notifyRealtimeEvent };
};
