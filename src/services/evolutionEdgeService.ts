import { supabase } from '@/lib/supabase';

function unwrapFunctionError(data: unknown): void {
  const d = data as { error?: string } | null;
  if (d && typeof d.error === 'string' && d.error.length > 0) {
    throw new Error(d.error);
  }
}

export type EvolutionChatOption = { jid: string; name: string };

/** Tenta extrair a mensagem de erro real do corpo da resposta HTTP da Edge Function.
 * O supabase-js nem sempre popula `data` quando o status é non-2xx, então lemos
 * o Response bruto disponível em `error.context`. */
async function extractFunctionErrorMessage(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (!ctx || typeof ctx.json !== 'function') return null;
  try {
    const parsed = await ctx.clone().json();
    if (parsed && typeof parsed.error === 'string' && parsed.error.length > 0) {
      return parsed.error;
    }
  } catch {
    // corpo não era JSON válido; ignora e cai no fallback
  }
  return null;
}

/** Admin-only (manage_categories), via Edge Function — não expõe API key ao browser. */
export async function evolutionAdminInvoke<T = unknown>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('evolution-admin', {
    body,
  });
  if (error) {
    const realMessage = await extractFunctionErrorMessage(error);
    if (realMessage) {
      throw new Error(realMessage);
    }
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
