import { supabase, TABLES } from '@/lib/supabase';

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getNotificationPermission(): NotificationPermission {
  if (typeof Notification === 'undefined') return 'denied';
  return Notification.permission;
}

/** Converte a chave VAPID pública (base64 URL-safe) para Uint8Array para o PushManager */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/**
 * Registra o Service Worker e retorna o Registration.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return reg;
  } catch (e) {
    console.error('Erro ao registrar Service Worker:', e);
    return null;
  }
}

/**
 * Inscreve o usuário no Push (pede permissão se necessário) e salva a subscription no Supabase.
 * userId = id do usuário na tabela app_c009c0e4f1_users.
 */
export async function subscribeUserToPush(userId: string): Promise<{ ok: boolean; error?: string }> {
  if (!VAPID_PUBLIC?.trim()) {
    return { ok: false, error: 'VITE_VAPID_PUBLIC_KEY não configurada' };
  }
  if (!isPushSupported()) {
    return { ok: false, error: 'Navegador não suporta notificações push' };
  }

  try {
    let permission = getNotificationPermission();
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
      return { ok: false, error: 'Permissão de notificação negada' };
    }

    const registration = await navigator.serviceWorker.ready;
    const key = urlBase64ToUint8Array(VAPID_PUBLIC);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    });

    const subscriptionJson = subscription.toJSON();
    const { error } = await supabase.from(TABLES.PUSH_SUBSCRIPTIONS).upsert(
      { user_id: userId, subscription: subscriptionJson },
      { onConflict: 'user_id' }
    );

    if (error) {
      console.error('Erro ao salvar inscrição push:', error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Erro ao inscrever push:', e);
    return { ok: false, error: msg };
  }
}

/**
 * Remove a inscrição de push do usuário no Supabase.
 */
export async function unsubscribeUserFromPush(userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase.from(TABLES.PUSH_SUBSCRIPTIONS).delete().eq('user_id', userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
