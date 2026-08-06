import { supabase } from '@/lib/supabase';

export type SioeEvidenciaCallbackResult = {
  ok: boolean;
  skipped?: boolean;
  idempotent?: boolean;
  mocked?: boolean;
  ci?: string;
  error?: string;
  /** Payload que seria/foi enviado (útil quando endpoint SIOE ainda não existe). */
  payload?: Record<string, unknown>;
};

/**
 * Notifica o SIOE (financeiro-bp) da decisão de evidência FATAL.
 * Não deve bloquear a resolução do ticket — falhas ficam em evidencia_sioe_erro.
 */
export async function notifySioeEvidenciaDecisao(
  ticketId: string,
  evidenciaEnviada: boolean,
): Promise<SioeEvidenciaCallbackResult> {
  try {
    const { data, error } = await supabase.functions.invoke('sioe-evidencia-callback', {
      body: { ticketId, evidenciaEnviada },
    });

    if (error) {
      console.warn('[sioeEvidencia] falha ao invocar edge function:', error.message);
      return { ok: false, error: error.message || 'Falha ao chamar sioe-evidencia-callback' };
    }

    const result = data as SioeEvidenciaCallbackResult | null;
    if (!result) {
      return { ok: false, error: 'Resposta vazia do callback SIOE' };
    }

    if (result.error && !result.ok) {
      console.warn('[sioeEvidencia] callback SIOE:', result.error, result);
    } else {
      console.log('[sioeEvidencia] callback SIOE ok/idempotent:', result);
    }

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[sioeEvidencia] erro inesperado:', message);
    return { ok: false, error: message };
  }
}
