import { supabase } from '@/lib/supabase';
import type { TicketCommunicationType } from '@/services/ticketCommunicationSettingsService';

export type TicketCommunicationQueueItem = {
  ticketId: string;
  ticketTitle: string;
  requesterId?: string;
  requesterName: string;
  requesterEmail: string;
  notificationType: TicketCommunicationType;
  channel: 'email' | 'teams';
  cycleKey: string;
  status: 'pending' | 'processing' | 'failed' | 'sent';
  sentAt: string | null;
  lastError: string | null;
};

export type TicketCommunicationQueue = {
  nextRunAt: string | null;
  next: TicketCommunicationQueueItem[];
  sent: TicketCommunicationQueueItem[];
  counts: { next: number; sent: number };
};

function invokeError(error: unknown, body: { error?: string } | null, fallback: string) {
  if (error || !body || body.error) throw new Error(fallback);
}

export async function getTicketCommunicationQueue(): Promise<TicketCommunicationQueue> {
  const { data, error } = await supabase.functions.invoke('notify-ticket-communications', {
    body: { action: 'queue_status' },
  });
  const body = data as (TicketCommunicationQueue & { ok?: boolean; error?: string }) | null;
  invokeError(error, body, 'Não foi possível carregar a fila de avisos.');
  if (!body || !Array.isArray(body.next) || !Array.isArray(body.sent) || !body.counts) {
    throw new Error('Não foi possível carregar a fila de avisos.');
  }
  return {
    nextRunAt: typeof body.nextRunAt === 'string' ? body.nextRunAt : null,
    next: body.next,
    sent: body.sent,
    counts: {
      next: Number(body.counts.next) || 0,
      sent: Number(body.counts.sent) || 0,
    },
  };
}

export async function retryTicketCommunication(input: {
  ticketId: string;
  notificationType: TicketCommunicationType;
  channel: 'email' | 'teams';
  cycleKey: string;
}): Promise<{
  prepared: number;
  sent: number;
  failed: number;
}> {
  const { data, error } = await supabase.functions.invoke('notify-ticket-communications', {
    body: { action: 'retry_delivery', ...input },
  });
  const body = data as { ok?: boolean; prepared?: number; sent?: number; failed?: number; error?: string } | null;
  invokeError(error, body, 'Não foi possível reenviar este aviso.');
  return {
    prepared: Number(body?.prepared) || 0,
    sent: Number(body?.sent) || 0,
    failed: Number(body?.failed) || 0,
  };
}

export async function runPendingTicketCommunications(): Promise<{
  prepared: number;
  sent: number;
  failed: number;
}> {
  const { data, error } = await supabase.functions.invoke('notify-ticket-communications', {
    body: { action: 'run_pending' },
  });
  const body = data as { ok?: boolean; prepared?: number; sent?: number; failed?: number; error?: string } | null;
  invokeError(error, body, 'Não foi possível enviar os avisos pendentes.');
  return {
    prepared: Number(body?.prepared) || 0,
    sent: Number(body?.sent) || 0,
    failed: Number(body?.failed) || 0,
  };
}

export async function notifyTicketResolved(ticketId: string): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('notify-ticket-communications', {
      body: { action: 'ticket_resolved', ticketId },
    });

    if (error || (data as { error?: string } | null)?.error) {
      console.warn('[ticket-communications] convite pendente para retry', { ticketId });
    }
  } catch {
    console.warn('[ticket-communications] convite pendente para retry', { ticketId });
  }
}
