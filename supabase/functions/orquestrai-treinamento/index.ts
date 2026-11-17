import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, handleCors } from "./_shared/cors.ts";
import {
  createMarketingRequestForTreinamento,
  createOrquestraiAdmin,
  listTicketCards,
  normalizeSendMode,
  resolveOrquestraiConfig,
  sendModesFor,
  type OrquestraiCardResult,
  type OrquestraiSendMode,
  type OrquestraiTreinamentoPayload,
} from "./_shared/orquestraiClient.ts";
import { summarizeCard } from "./_shared/envioStatus.ts";

const DC_CATEGORY = "desenvolvimento_continuo_equipe";
const ENVIOS_TABLE = "app_c009c0e4f1_orquestrai_envios";

/** Leonardo e Valentina (MKT) — únicos com botão "Enviar para ORQESTRAI" no front. */
const ORQESTRAI_SENDER_EMAILS = new Set([
  "leonardo.marques@bismarchipires.com.br",
  "valentina.iacovacci@bismarchipires.com.br",
]);

type SenderProfile = { id: string; name: string | null };

type EnvioOutcome = "created" | "already_existed" | "failed";

type EnvioRow = {
  ticket_id: string;
  request_type: string;
  send_mode: OrquestraiSendMode;
  outcome: EnvioOutcome;
  marketing_request_id: string | null;
  error_message: string | null;
  sent_by: string | null;
  sent_by_name: string | null;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "Erro interno");
}

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

/** Perfil de quem está enviando, se for um dos autorizados. */
async function resolveSender(
  admin: SupabaseClient,
  authUserId: string,
): Promise<SenderProfile | null> {
  const { data: profile } = await admin
    .from("app_c009c0e4f1_users")
    .select("id, name, email")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (!profile) return null;

  const email = String(profile.email ?? "").trim().toLowerCase();
  if (!email || !ORQESTRAI_SENDER_EMAILS.has(email)) return null;
  return {
    id: String(profile.id),
    name: String(profile.name ?? "").trim() || null,
  };
}

function outcomeOf(result: OrquestraiCardResult): EnvioOutcome {
  if (result.error) return "failed";
  return result.created ? "created" : "already_existed";
}

/** O histórico é complementar: se não gravar (ex.: migration pendente), o envio segue. */
async function recordEnvios(admin: SupabaseClient, rows: EnvioRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await admin.from(ENVIOS_TABLE).insert(rows);
  if (error) {
    console.error("orquestrai-treinamento: histórico de envio não gravado:", error.message);
  }
}

async function loadEnvios(admin: SupabaseClient, ticketId: string) {
  const { data, error } = await admin
    .from(ENVIOS_TABLE)
    .select(
      "id, request_type, send_mode, outcome, marketing_request_id, error_message, sent_by, sent_by_name, created_at",
    )
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    requestType: String(row.request_type),
    sendMode: String(row.send_mode),
    outcome: String(row.outcome),
    marketingRequestId: row.marketing_request_id ? String(row.marketing_request_id) : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    sentBy: row.sent_by ? String(row.sent_by) : null,
    sentByName: row.sent_by_name ? String(row.sent_by_name) : null,
    createdAt: String(row.created_at),
  }));
}

/**
 * Situação do ticket no ORQESTRAI: os cards que existem lá (fonte da verdade,
 * cobre envios anteriores ao histórico) e o histórico de tentativas daqui.
 * Uma fonte falhar não derruba a outra.
 */
async function handleStatus(admin: SupabaseClient, ticketId: string): Promise<Response> {
  const config = await resolveOrquestraiConfig(admin);

  const [envios, cards] = await Promise.all([
    loadEnvios(admin, ticketId).then(
      (items) => ({ items, error: null as string | null }),
      (error) => ({ items: [], error: errorMessage(error) }),
    ),
    config
      ? listTicketCards(createOrquestraiAdmin(config), ticketId).then(
        (rows) => ({ items: rows.map(summarizeCard), error: null as string | null }),
        (error) => ({ items: [], error: errorMessage(error) }),
      )
      : Promise.resolve({ items: [], error: "ORQESTRAI não configurado" }),
  ]);

  if (envios.error) console.error("orquestrai-treinamento status: histórico:", envios.error);
  if (cards.error) console.error("orquestrai-treinamento status: cards:", cards.error);

  return json({
    ok: true,
    cards: cards.items,
    cardsError: cards.error,
    envios: envios.items,
    enviosError: envios.error,
  });
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authUserId = await getBearerUserId(req);
    if (!authUserId) return json({ error: "Não autorizado" }, 401);

    const body = await req.json().catch(() => ({})) as {
      action?: "send" | "status";
      ticketId?: string;
      ticketAppUrl?: string;
      sendMode?: OrquestraiSendMode;
      payload?: OrquestraiTreinamentoPayload;
    };
    const action = body.action === "status" ? "status" : "send";

    if (!body.ticketId) return json({ error: "ticketId é obrigatório" }, 400);
    if (action === "send" && !body.payload?.tema) {
      return json({ error: "ticketId e payload.tema são obrigatórios" }, 400);
    }

    const { data: ticket, error: ticketError } = await admin
      .from("app_c009c0e4f1_tickets")
      .select("id, category, created_by")
      .eq("id", body.ticketId)
      .maybeSingle();

    if (ticketError || !ticket) return json({ error: "Ticket não encontrado" }, 404);

    if (ticket.category !== DC_CATEGORY) {
      return json({ skipped: true, reason: "Categoria não é Desenvolvimento Contínuo" });
    }

    const sender = await resolveSender(admin, authUserId);
    if (!sender) return json({ error: "Sem permissão" }, 403);

    if (action === "status") return await handleStatus(admin, body.ticketId);

    const payload = body.payload as OrquestraiTreinamentoPayload;
    const sendMode = normalizeSendMode(
      body.sendMode ?? payload.sendMode,
      payload.precisaAjustePpt,
    );
    const baseRow = {
      ticket_id: body.ticketId,
      send_mode: sendMode,
      sent_by: sender.id,
      sent_by_name: sender.name,
    };

    const config = await resolveOrquestraiConfig(admin);
    if (!config) {
      const message =
        "ORQESTRAI não configurado. Defina ORQESTRAI_SUPABASE_URL + ORQESTRAI_SERVICE_ROLE_KEY nos secrets ou rode o seed orquestrai_config.";
      await recordEnvios(
        admin,
        sendModesFor(sendMode).map((requestType) => ({
          ...baseRow,
          request_type: requestType,
          outcome: "failed",
          marketing_request_id: null,
          error_message: message,
        })),
      );
      return json({ error: message }, 500);
    }

    let result: Awaited<ReturnType<typeof createMarketingRequestForTreinamento>>;
    try {
      result = await createMarketingRequestForTreinamento(createOrquestraiAdmin(config), config, {
        ticketId: body.ticketId,
        ticketAppUrl: body.ticketAppUrl,
        payload,
        sendMode,
      });
    } catch (error) {
      // Falha antes de chegar aos cards (ex.: ORQESTRAI fora do ar).
      const message = errorMessage(error);
      console.error("orquestrai-treinamento send error:", error);
      await recordEnvios(
        admin,
        sendModesFor(sendMode).map((requestType) => ({
          ...baseRow,
          request_type: requestType,
          outcome: "failed",
          marketing_request_id: null,
          error_message: message,
        })),
      );
      return json({ error: message }, 500);
    }

    await recordEnvios(
      admin,
      result.results.map((item) => ({
        ...baseRow,
        request_type: item.requestType,
        outcome: outcomeOf(item),
        marketing_request_id: item.marketingRequestId || null,
        error_message: item.error ?? null,
      })),
    );

    const failures = result.results.filter((item) => item.error);
    const allFailed = failures.length > 0 && failures.length === result.results.length;

    return json({
      ok: !allFailed,
      created: result.created,
      marketingRequestId: result.marketingRequestId,
      results: result.results,
      error: allFailed
        ? failures.map((item) => `${item.requestType}: ${item.error}`).join(" · ")
        : undefined,
    });
  } catch (error) {
    console.error("orquestrai-treinamento error:", error);
    return json({ error: errorMessage(error) }, 500);
  }
});
