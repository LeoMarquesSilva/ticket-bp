import { supabase } from '@/lib/supabase';
import type { SharepointTreinamentoPayload } from '@/utils/desenvolvimentoContinuoForm';

function buildTicketAppUrl(ticketId: string): string | undefined {
  const fromEnv = import.meta.env.VITE_SITE_URL?.trim();
  const base = (fromEnv || (typeof window !== 'undefined' ? window.location.origin : '')).replace(
    /\/$/,
    '',
  );
  return base ? `${base}/tickets/${ticketId}` : undefined;
}

export async function submitSharepointTreinamento(
  ticketId: string,
  payload: SharepointTreinamentoPayload,
  ticketAppUrl?: string,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke('sharepoint-treinamentos', {
    body: {
      ticketId,
      payload,
      ticketAppUrl: ticketAppUrl ?? buildTicketAppUrl(ticketId),
    },
  });

  if (error) {
    console.warn('sharepoint-treinamentos:', error.message);
    return;
  }

  const result = data as {
    error?: string;
    skipped?: boolean;
    unmappedDisplays?: string[];
    missingFromList?: string[];
  } | null;

  if (result?.error) {
    console.warn('sharepoint-treinamentos:', result.error);
    return;
  }

  if (result?.unmappedDisplays?.length) {
    console.info(
      'SharePoint: colunas da lista sem mapeamento automático:',
      result.unmappedDisplays,
    );
  }
}

export async function listSharepointTreinamentosColumns(): Promise<
  Array<{ name: string; displayName: string; readOnly?: boolean }>
> {
  const { data, error } = await supabase.functions.invoke('sharepoint-treinamentos', {
    body: { action: 'listColumns' },
  });
  if (error) throw new Error(error.message);
  const result = data as { error?: string; columns?: Array<{ name: string; displayName: string; readOnly?: boolean }> };
  if (result?.error) throw new Error(result.error);
  return result.columns ?? [];
}
