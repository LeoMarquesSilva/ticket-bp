import { supabase } from '@/lib/supabase';

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
