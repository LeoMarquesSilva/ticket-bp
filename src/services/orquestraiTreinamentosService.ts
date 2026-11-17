import { supabase } from '@/lib/supabase';
import type { SharepointTreinamentoPayload } from '@/utils/desenvolvimentoContinuoForm';
import type { OrquestraiEnvioStatus } from '@/utils/orquestraiEnvioStatus';

function buildTicketAppUrl(ticketId: string): string | undefined {
  const fromEnv = import.meta.env.VITE_SITE_URL?.trim();
  const base = (fromEnv || (typeof window !== 'undefined' ? window.location.origin : '')).replace(
    /\/$/,
    '',
  );
  return base ? `${base}/tickets/${ticketId}` : undefined;
}

/** O supabase-js não preenche `data` em respostas non-2xx; a mensagem real fica no Response. */
async function extractFunctionErrorMessage(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (!ctx || typeof ctx.json !== 'function') return null;
  try {
    const parsed = await ctx.clone().json();
    if (parsed && typeof parsed.error === 'string' && parsed.error.length > 0) {
      return parsed.error;
    }
  } catch {
    // corpo não era JSON
  }
  return null;
}

export type OrquestraiSubmitCardResult = {
  requestType: string;
  created: boolean;
  marketingRequestId: string;
  /** Preenchido quando este tipo falhou (no modo misto o outro pode ter dado certo). */
  error?: string;
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
      action: 'send',
      ticketId,
      payload,
      sendMode: payload.sendMode ?? 'certificados',
      ticketAppUrl: ticketAppUrl ?? buildTicketAppUrl(ticketId),
    },
  });

  if (error) {
    const message = await extractFunctionErrorMessage(error);
    return {
      ok: false,
      error: message || error.message || 'Falha ao chamar orquestrai-treinamento',
    };
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
    return { ok: false, error: result.error, results: result.results };
  }

  return {
    ok: true,
    created: result?.created,
    marketingRequestId: result?.marketingRequestId,
    results: result?.results,
    skipped: result?.skipped,
  };
}

/** Situação do ticket no ORQESTRAI: cards existentes + histórico de envios. */
export async function fetchOrquestraiEnvioStatus(
  ticketId: string,
): Promise<OrquestraiEnvioStatus> {
  const { data, error } = await supabase.functions.invoke('orquestrai-treinamento', {
    body: { action: 'status', ticketId },
  });

  if (error) {
    const message = await extractFunctionErrorMessage(error);
    throw new Error(message || error.message || 'Falha ao consultar o ORQESTRAI');
  }

  const result = data as Partial<OrquestraiEnvioStatus> & { error?: string; skipped?: boolean } | null;
  if (result?.error) throw new Error(result.error);
  if (result?.skipped) {
    return { cards: [], cardsError: null, envios: [], enviosError: null };
  }
  if (!result || !Array.isArray(result.cards) || !Array.isArray(result.envios)) {
    throw new Error('Resposta inesperada ao consultar o status do envio');
  }

  return {
    cards: result.cards,
    cardsError: result.cardsError ?? null,
    envios: result.envios,
    enviosError: result.enviosError ?? null,
  };
}
