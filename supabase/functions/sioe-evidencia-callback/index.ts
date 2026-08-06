import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, handleCors } from "./_shared/cors.ts";
import {
  extractCi,
  inferAnoMes,
  notifySioeEvidenciaDecisao,
  resolveSioeConfig,
  type SioeEvidenciaPayload,
} from "./_shared/sioeClient.ts";

const EVIDENCIA_CATEGORY = "validacao_de_indicadores";
const EVIDENCIA_SUBCATEGORY = "auditoria_de_excludentes_envio_de_evidencia";

async function getBearerUserId(req: Request): Promise<string | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  return user?.id ?? null;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authUserId = await getBearerUserId(req);
    if (!authUserId) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({})) as {
      ticketId?: string;
      /** Se omitido, usa evidencia_enviada já persistida no ticket. */
      evidenciaEnviada?: boolean;
    };

    if (!body.ticketId) {
      return new Response(JSON.stringify({ error: "ticketId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ticket, error: ticketError } = await admin
      .from("app_c009c0e4f1_tickets")
      .select(
        "id, title, description, category, subcategory, status, created_at, resolved_at, evidencia_enviada, evidencia_decidido_em, evidencia_decidido_por, evidencia_sioe_notificado_em",
      )
      .eq("id", body.ticketId)
      .maybeSingle();

    if (ticketError || !ticket) {
      return new Response(JSON.stringify({ error: "Ticket não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (
      ticket.category !== EVIDENCIA_CATEGORY ||
      ticket.subcategory !== EVIDENCIA_SUBCATEGORY
    ) {
      return new Response(
        JSON.stringify({
          skipped: true,
          reason: "Ticket não é auditoria de evidência FATAL",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const evidenciaEnviada =
      typeof body.evidenciaEnviada === "boolean"
        ? body.evidenciaEnviada
        : ticket.evidencia_enviada;

    if (typeof evidenciaEnviada !== "boolean") {
      return new Response(
        JSON.stringify({ error: "Decisão de evidência ainda não gravada no ticket" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const ci = extractCi(ticket.title, ticket.description);
    if (!ci) {
      return new Response(
        JSON.stringify({
          error:
            "CI não encontrado no título/descrição (esperado padrão: CI <valor>). Finalização bloqueada no cliente.",
        }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Idempotência: se já notificou SIOE com sucesso, não reenvia efeito duplicado.
    if (ticket.evidencia_sioe_notificado_em) {
      return new Response(
        JSON.stringify({
          ok: true,
          idempotent: true,
          skipped: true,
          reason: "SIOE já notificado para este ticket",
          ci,
          evidencia_enviada: evidenciaEnviada,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: profile } = await admin
      .from("app_c009c0e4f1_users")
      .select("id, name")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    const decididoPorId =
      ticket.evidencia_decidido_por || profile?.id || authUserId;
    const decididoPorName = profile?.name || "Usuário RESPONSUM";
    const decididoEm =
      ticket.evidencia_decidido_em || new Date().toISOString();
    const { ano, mes } = inferAnoMes(ticket.resolved_at || ticket.created_at);

    const payload: SioeEvidenciaPayload = {
      ticket_id: ticket.id,
      ci,
      evidencia_enviada: evidenciaEnviada,
      decisao: evidenciaEnviada ? "excludente_mantida" : "incluido_no_fatal",
      decidido_em: decididoEm,
      decidido_por: { id: decididoPorId, name: decididoPorName },
      category: EVIDENCIA_CATEGORY,
      subcategory: EVIDENCIA_SUBCATEGORY,
      ...(ano != null ? { ano } : {}),
      ...(mes != null ? { mes } : {}),
    };

    const config = resolveSioeConfig();
    if (!config) {
      const missingMsg =
        "SIOE não configurado. Defina SIOE_SUPABASE_URL + SIOE_SERVICE_ROLE_KEY (ou SIOE_EVIDENCIA_CALLBACK_URL) nos secrets da Edge Function.";
      console.warn("[sioe-evidencia-callback]", missingMsg, payload);

      await admin
        .from("app_c009c0e4f1_tickets")
        .update({
          evidencia_sioe_erro: missingMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticket.id);

      // Não falha o fluxo do ticket: decisão já está no RESPONSUM.
      return new Response(
        JSON.stringify({
          ok: false,
          mocked: true,
          error: missingMsg,
          payload,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      "[sioe-evidencia-callback] notificando SIOE",
      config.callbackUrl,
      { ticket_id: payload.ticket_id, ci: payload.ci, decisao: payload.decisao },
    );

    const result = await notifySioeEvidenciaDecisao(config, payload);

    if (result.ok) {
      await admin
        .from("app_c009c0e4f1_tickets")
        .update({
          evidencia_sioe_notificado_em: new Date().toISOString(),
          evidencia_sioe_erro: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticket.id);

      return new Response(
        JSON.stringify({ ok: true, ci, evidencia_enviada: evidenciaEnviada }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    await admin
      .from("app_c009c0e4f1_tickets")
      .update({
        evidencia_sioe_erro: result.error ?? "Erro desconhecido no callback SIOE",
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticket.id);

    // Política: decisão local + resolved já gravados; callback falhou → log/retry depois.
    return new Response(
      JSON.stringify({
        ok: false,
        mocked: result.mocked ?? false,
        error: result.error,
        status: result.status,
        payload,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("sioe-evidencia-callback error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro interno",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
