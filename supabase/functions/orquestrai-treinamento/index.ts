import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, handleCors } from "./_shared/cors.ts";
import {
  createMarketingRequestForTreinamento,
  createOrquestraiAdmin,
  resolveOrquestraiConfig,
  type OrquestraiTreinamentoPayload,
} from "./_shared/orquestraiClient.ts";

const DC_CATEGORY = "desenvolvimento_continuo_equipe";

/** Leonardo e Valentina (MKT) — únicos com botão "Enviar para ORQESTRAI" no front. */
const ORQESTRAI_SENDER_EMAILS = new Set([
  "leonardo.marques@bismarchipires.com.br",
  "valentina.iacovacci@bismarchipires.com.br",
]);

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

async function canSubmit(
  admin: ReturnType<typeof createClient>,
  authUserId: string,
  _ticketCreatedBy: string,
): Promise<boolean> {
  const { data: profile } = await admin
    .from("app_c009c0e4f1_users")
    .select("id, email")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (!profile) return false;

  const email = String(profile.email ?? "").trim().toLowerCase();
  return Boolean(email && ORQESTRAI_SENDER_EMAILS.has(email));
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const config = await resolveOrquestraiConfig(admin);
    if (!config) {
      return new Response(
        JSON.stringify({
          error:
            "ORQESTRAI não configurado. Defina ORQESTRAI_SUPABASE_URL + ORQESTRAI_SERVICE_ROLE_KEY nos secrets ou rode o seed orquestrai_config.",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const authUserId = await getBearerUserId(req);
    if (!authUserId) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({})) as {
      ticketId?: string;
      ticketAppUrl?: string;
      sendMode?: "ppt" | "certificados" | "ppt_e_certificados";
      payload?: OrquestraiTreinamentoPayload;
    };

    if (!body.ticketId || !body.payload?.tema) {
      return new Response(
        JSON.stringify({ error: "ticketId e payload.tema são obrigatórios" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: ticket, error: ticketError } = await admin
      .from("app_c009c0e4f1_tickets")
      .select("id, category, created_by")
      .eq("id", body.ticketId)
      .maybeSingle();

    if (ticketError || !ticket) {
      return new Response(JSON.stringify({ error: "Ticket não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (ticket.category !== DC_CATEGORY) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Categoria não é Desenvolvimento Contínuo" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const allowed = await canSubmit(admin, authUserId, ticket.created_by);
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orquestrai = createOrquestraiAdmin(config);
    const result = await createMarketingRequestForTreinamento(orquestrai, config, {
      ticketId: body.ticketId,
      ticketAppUrl: body.ticketAppUrl,
      payload: body.payload,
      sendMode: body.sendMode ?? body.payload.sendMode,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        created: result.created,
        marketingRequestId: result.marketingRequestId,
        results: result.results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("orquestrai-treinamento error:", error);
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
