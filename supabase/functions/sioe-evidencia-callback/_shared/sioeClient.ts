export type SioeEvidenciaPayload = {
  ticket_id: string;
  ci: string;
  evidencia_enviada: boolean;
  decisao: "excludente_mantida" | "incluido_no_fatal";
  decidido_em: string;
  decidido_por: { id: string; name: string };
  category: string;
  subcategory: string;
  ano?: number;
  mes?: number;
};

export type SioeConfig = {
  callbackUrl: string;
  serviceRoleKey: string;
};

/**
 * Resolve URL do callback SIOE.
 * Preferência:
 * 1) SIOE_EVIDENCIA_CALLBACK_URL (URL completa da Edge Function)
 * 2) SIOE_SUPABASE_URL + path /functions/v1/receber-decisao-evidencia-fatal
 * Auth: SIOE_SERVICE_ROLE_KEY (Bearer)
 */
export function resolveSioeConfig(): SioeConfig | null {
  const serviceRoleKey = (Deno.env.get("SIOE_SERVICE_ROLE_KEY") ?? "").trim();
  if (!serviceRoleKey) return null;

  const explicitUrl = (Deno.env.get("SIOE_EVIDENCIA_CALLBACK_URL") ?? "").trim();
  if (explicitUrl) {
    return { callbackUrl: explicitUrl.replace(/\/$/, ""), serviceRoleKey };
  }

  const base = (Deno.env.get("SIOE_SUPABASE_URL") ?? "").trim().replace(/\/$/, "");
  if (!base) return null;

  return {
    callbackUrl: `${base}/functions/v1/receber-decisao-evidencia-fatal`,
    serviceRoleKey,
  };
}

export type SioeNotifyResult = {
  ok: boolean;
  status: number;
  mocked?: boolean;
  body?: string;
  error?: string;
};

/**
 * POST para o SIOE. Se o endpoint ainda não existir (404/5xx/network),
 * retorna ok=false com detalhe — o caller grava erro no ticket sem rollback.
 */
export async function notifySioeEvidenciaDecisao(
  config: SioeConfig,
  payload: SioeEvidenciaPayload,
): Promise<SioeNotifyResult> {
  try {
    const res = await fetch(config.callbackUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.serviceRoleKey}`,
        apikey: config.serviceRoleKey,
      },
      body: JSON.stringify(payload),
    });

    const body = await res.text().catch(() => "");

    if (res.ok) {
      return { ok: true, status: res.status, body: body.slice(0, 2000) };
    }

    // Endpoint ainda não criado no financeiro-bp: tratar como mock/log.
    const notReady = res.status === 404 || res.status === 501;
    console.warn(
      "[sioe-evidencia-callback] SIOE respondeu",
      res.status,
      notReady ? "(endpoint provavelmente ainda não existe — mock/log)" : "",
      body.slice(0, 500),
    );

    return {
      ok: false,
      status: res.status,
      mocked: notReady,
      body: body.slice(0, 2000),
      error: `SIOE HTTP ${res.status}${notReady ? " (endpoint pendente)" : ""}: ${
        body.slice(0, 300) || res.statusText
      }`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[sioe-evidencia-callback] falha de rede ao chamar SIOE:", message);
    return {
      ok: false,
      status: 0,
      mocked: true,
      error: `Falha de rede ao chamar SIOE: ${message}`,
    };
  }
}

export function extractCi(title?: string | null, description?: string | null): string | null {
  const pattern = /CI\s+(\S+)/i;
  for (const text of [title, description]) {
    if (!text) continue;
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].replace(/[.,;:!?)]+$/, "");
    }
  }
  return null;
}

export function inferAnoMes(iso?: string | null): { ano?: number; mes?: number } {
  if (!iso) return {};
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return {};
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}
