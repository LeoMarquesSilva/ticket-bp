import { useCallback } from 'react';
import { useTabVisibility } from './useTabVisibility';
import { useChatContext } from '@/contexts/ChatContext';

export const useNotificationSound = () => {
  const isTabVisible = useTabVisibility();
  const { activeChatId } = useChatContext();
  
  const playNotificationSound = useCallback((ticketId?: string) => {
    // Só reproduz o som se:
    // 1. A aba não estiver visível OU
    // 2. A aba estiver visível mas o chat específico não estiver aberto
    const shouldPlaySound = !isTabVisible || (ticketId && activeChatId !== ticketId);
    
    if (shouldPlaySound) {
      console.log(`🔊 Reproduzindo som - Aba visível: ${isTabVisible}, Chat ativo: ${activeChatId}, Ticket da mensagem: ${ticketId}`);
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.5; // Volume mais baixo para ser menos intrusivo
      audio.play().catch(err => console.error('Erro ao reproduzir som:', err));
    } else {
      console.log(`🔇 Som suprimido - Aba visível: ${isTabVisible}, Chat ativo: ${activeChatId}, Ticket da mensagem: ${ticketId}`);
    }
  }, [isTabVisible, activeChatId]);
  
  return { 
    playNotificationSound, 
    isTabVisible, 
    activeChatId 
  };
};