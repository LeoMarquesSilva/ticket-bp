import { useCallback, useEffect, useRef } from 'react';
import { useTabVisibility } from './useTabVisibility';
import { useChatContext } from '@/contexts/ChatContext';

type NotificationSoundType = 'message' | 'new_ticket' | 'generic';

type PlaySoundOptions = {
  forceWhenHidden?: boolean;
  soundType?: NotificationSoundType;
};

type PlaySoundResult = {
  played: boolean;
  reason: string;
};

export const useNotificationSound = () => {
  const isTabVisible = useTabVisibility();
  const { activeChatId } = useChatContext();
  const audioRef = useRef<Record<NotificationSoundType, HTMLAudioElement | null>>({
    message: null,
    new_ticket: null,
    generic: null,
  });
  const audioUnlockedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const baseUrl = import.meta.env.BASE_URL || '/';
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const soundUrlMap: Record<NotificationSoundType, string> = {
    message: `${normalizedBaseUrl}notification.mp3`,
    new_ticket: `${normalizedBaseUrl}som-novo-ticket.mp3`,
    generic: `${normalizedBaseUrl}notification.mp3`,
  };

  useEffect(() => {
    const windowWithWebkit = window as Window & { webkitAudioContext?: typeof AudioContext };
    const Ctx = window.AudioContext || windowWithWebkit.webkitAudioContext;
    if (Ctx && !audioContextRef.current) {
      audioContextRef.current = new Ctx();
    }

    const ensureAudio = (soundType: NotificationSoundType) => {
      if (!audioRef.current[soundType]) {
        const audio = new Audio(soundUrlMap[soundType]);
        audio.preload = 'auto';
        audio.volume = 0.7;
        audioRef.current[soundType] = audio;
      }
    };

    const warmupAudio = async () => {
      try {
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        ensureAudio('message');
        ensureAudio('new_ticket');
        audioRef.current.generic = audioRef.current.message;

        // Desbloqueio explícito do <audio> via gesto de usuário (Edge/Chrome autoplay policy).
        if (!audioUnlockedRef.current) {
          const audioCandidates = [audioRef.current.message, audioRef.current.new_ticket].filter(Boolean);
          if (audioCandidates.length > 0) {
            const audio = audioCandidates[0] as HTMLAudioElement;
            const previousMuted = audio.muted;
            try {
              audio.muted = true;
              audio.currentTime = 0;
              await audio.play();
              audio.pause();
              audio.currentTime = 0;
            } finally {
              // Garante restauração mesmo se play() falhar (evita áudio “mudo” em tentativas futuras).
              audio.muted = previousMuted;
            }
            audioUnlockedRef.current = true;
            console.info('[notify:sound] audio unlocked by user gesture');
          }
        }
      } catch {
        // Ignora falha de warmup; tentaremos novamente na próxima interação.
      }
    };

    ensureAudio('message');
    ensureAudio('new_ticket');
    audioRef.current.generic = audioRef.current.message;

    const userEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart'];
    userEvents.forEach((eventName) => window.addEventListener(eventName, warmupAudio, { passive: true }));

    return () => {
      userEvents.forEach((eventName) => window.removeEventListener(eventName, warmupAudio));
    };
  }, [soundUrlMap.message, soundUrlMap.new_ticket]);

  const playFallbackBeep = useCallback(async (): Promise<boolean> => {
    const context = audioContextRef.current;
    if (!context) return false;

    try {
      if (context.state === 'suspended') {
        await context.resume();
      }

      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gainNode.gain.value = 0.0001;

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      const now = context.currentTime;
      gainNode.gain.exponentialRampToValueAtTime(0.09, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      oscillator.start(now);
      oscillator.stop(now + 0.23);
      return true;
    } catch (error) {
      console.error('[notify:sound] fallback beep failed', error);
      return false;
    }
  }, []);
  
  const playNotificationSound = useCallback(async (ticketId?: string, options?: PlaySoundOptions): Promise<PlaySoundResult> => {
    const soundType = options?.soundType ?? 'generic';
    const soundUrl = soundUrlMap[soundType];
    const isCurrentChat = Boolean(ticketId) && activeChatId === ticketId;
    const shouldPlaySound = !isTabVisible || !isCurrentChat || Boolean(options?.forceWhenHidden && !isTabVisible);

    if (!shouldPlaySound) {
      console.log(`[notify:sound] suppressed (visible/current-chat) source=${soundType} ticket=${ticketId ?? 'none'} activeChat=${activeChatId ?? 'none'}`);
      return { played: false, reason: 'visible_current_chat' };
    }

    try {
      if (!audioRef.current[soundType]) {
        const audio = new Audio(soundUrl);
        audio.preload = 'auto';
        audio.volume = 0.7;
        audioRef.current[soundType] = audio;
      }

      const audio = audioRef.current[soundType];
      if (audio) {
        audio.muted = false;
        audio.currentTime = 0;
        try {
          await audio.play();
        } catch {
          // Fallback: nova instância evita estado interno travado do elemento reutilizado.
          const oneShot = new Audio(soundUrl);
          oneShot.volume = 0.7;
          oneShot.muted = false;
          await oneShot.play();
        }
        console.log(`[notify:sound] played source=${soundType} visible=${isTabVisible} ticket=${ticketId ?? 'none'}`);
        return { played: true, reason: 'played_file' };
      }

      const fallbackPlayed = await playFallbackBeep();
      if (fallbackPlayed) {
        console.log(`[notify:sound] played fallback source=${soundType} visible=${isTabVisible} ticket=${ticketId ?? 'none'}`);
        return { played: true, reason: 'played_fallback' };
      }

      return { played: false, reason: 'no_audio_source' };
    } catch (err) {
      console.error('[notify:sound] failed', err);
      const fallbackPlayed = await playFallbackBeep();
      if (fallbackPlayed) {
        return { played: true, reason: 'played_fallback_after_error' };
      }
      if (!audioUnlockedRef.current) {
        console.warn('[notify:sound] áudio bloqueado por autoplay. Faça um clique na página para desbloquear o som.');
      }
      return { played: false, reason: 'audio_play_failed' };
    }
  }, [isTabVisible, activeChatId, playFallbackBeep, soundUrlMap]);
  
  return { 
    playNotificationSound, 
    isTabVisible, 
    activeChatId 
  };
};