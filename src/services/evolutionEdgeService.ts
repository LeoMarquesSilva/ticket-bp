import { supabase } from '@/lib/supabase';

function unwrapFunctionError(data: unknown): void {
  const d = data as { error?: string } | null;
  if (d && typeof d.error === 'string' && d.error.length > 0) {
    throw new Error(d.error);
  }
}

export type EvolutionChatOption = { jid: string; name: string };

/** Admin-only (manage_categories), via Edge Function — não expõe API key ao browser. */
export async function evolutionAdminInvoke<T = unknown>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('evolution-admin', {
    body,
  });
  if (error) {
    const maybeData = data as { error?: unknown; details?: unknown } | null;
    if (maybeData && typeof maybeData.error === 'string' && maybeData.error.length > 0) {
      throw new Error(maybeData.error);
    }
    throw new Error(error.message);
  }
  unwrapFunctionError(data);
  return data as T;
}

export async function notifyTicketWhatsApp(ticketId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke(
    'notify-ticket-whatsapp',
    {
      body: { ticketId },
    },
  );
  if (error) {
    console.warn('notify-ticket-whatsapp:', error.message);
    return;
  }
  const d = data as { error?: string; skipped?: boolean } | null;
  if (d?.error) {
    console.warn('notify-ticket-whatsapp:', d.error);
  }
}
