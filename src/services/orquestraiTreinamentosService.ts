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

export type OrquestraiSubmitCardResult = {
  requestType: string;
  created: boolean;
  marketingRequestId: string;
};

export type OrquestraiSubmitResult = {
  ok: boolean;
  created?: boolean;
  marketingRequestId?: string;
  results?: OrquestraiSubmitCardResult[];
  skipped?: boolean;
  error?: string;
};

/** Cria card no Planner do ORQESTRAI a partir do payload de Desenvolvimento Contínuo. */
export async function submitOrquestraiTreinamento(
  ticketId: string,
  payload: SharepointTreinamentoPayload,
  ticketAppUrl?: string,
): Promise<OrquestraiSubmitResult> {
  const { data, error } = await supabase.functions.invoke('orquestrai-treinamento', {
    body: {
      ticketId,
      payload,
      sendMode: payload.sendMode ?? 'certificados',
      ticketAppUrl: ticketAppUrl ?? buildTicketAppUrl(ticketId),
    },
  });

  if (error) {
    return { ok: false, error: error.message || 'Falha ao chamar orquestrai-treinamento' };
  }

  const result = data as {
    error?: string;
    skipped?: boolean;
    created?: boolean;
    marketingRequestId?: string;
    results?: OrquestraiSubmitCardResult[];
    ok?: boolean;
  } | null;

  if (result?.error) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    created: result?.created,
    marketingRequestId: result?.marketingRequestId,
    results: result?.results,
    skipped: result?.skipped,
  };
}
