import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, handleCors } from "./_shared/cors.ts";
import {
  assertGraphConfig,
  getGraphAccessToken,
  getGraphConfig,
  listAllItems,
  listSiteUsers,
} from "./_shared/graph.ts";
import {
  appendPresencaBlock,
  buildNameDirectory,
  descriptionAlreadyHasPresenca,
  extractTicketIdFromDescription,
  invertLookupMap,
  isPresencaDue,
  isSameTreinamento,
  resolveColaboradorName,
  todayIsoSaoPaulo,
} from "./_shared/presencaText.ts";

const DEFAULT_DESIGNER_CONFIG_KEY = "orquestrai_config";

type MarketingCard = {
  id: string;
  title: string;
  description: string | null;
  deadline: string | null;
  request_type: string | null;
};

function parseJsonValue(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "string" && raw.trim()) {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  return null;
}

async function isAuthorized(req: Request, admin: SupabaseClient): Promise<boolean> {
  const serviceRole = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  const cronSecret = (Deno.env.get("ORQUESTRAI_PRESENCA_CRON_SECRET") ?? "").trim();
  const anonKey = (Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();
  const auth = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  const apikey = req.headers.get("apikey")?.trim() ?? "";
  if (serviceRole && (auth === serviceRole || apikey === serviceRole)) return true;
  if (cronSecret && (auth === cronSecret || apikey === cronSecret)) return true;
  // O botão "Buscar presença" do ORQESTRAI manda a chave publishable do projeto.
  if (anonKey && (auth === anonKey || apikey === anonKey)) return true;
  // O cron diário manda um token próprio do Vault, conferido no banco
  // (migration 20261021120000_orquestrai_presenca_cron_token.sql).
  const cronToken = req.headers.get("x-cron-token")?.trim() ?? "";
  if (cronToken) {
    const { data } = await admin.rpc("helpdesk_verify_orquestrai_presenca_token", {
      p_token: cronToken,
    });
    if (data === true) return true;
  }
  return false;
}

function parseTicketIdFromBody(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const ticketId = (raw as { ticketId?: unknown }).ticketId;
  if (typeof ticketId !== "string") return "";
  const trimmed = ticketId.trim();
  return /^[0-9a-f-]{36}$/i.test(trimmed) ? trimmed : "";
}

async function resolveOrquestrai(admin: SupabaseClient) {
  const fromEnvUrl = Deno.env.get("ORQESTRAI_SUPABASE_URL")?.trim();
  const fromEnvKey = Deno.env.get("ORQESTRAI_SERVICE_ROLE_KEY")?.trim();
  if (fromEnvUrl && fromEnvKey) {
    return {
      supabaseUrl: fromEnvUrl.replace(/\/$/, ""),
      serviceRoleKey: fromEnvKey,
    };
  }

  const { data } = await admin
    .from("app_c009c0e4f1_integration_settings")
    .select("value")
    .eq("key", DEFAULT_DESIGNER_CONFIG_KEY)
    .maybeSingle();
  const value = parseJsonValue(data?.value);
  const supabaseUrl = String(value?.supabaseUrl ?? "").trim().replace(/\/$/, "");
  const serviceRoleKey = String(value?.serviceRoleKey ?? "").trim();
  if (!supabaseUrl || !serviceRoleKey) return null;
  return { supabaseUrl, serviceRoleKey };
}

function parseLookupMap(raw: unknown): Record<string, string> {
  let current: unknown = raw;
  for (let i = 0; i < 2; i++) {
    if (typeof current === "string") {
      const parsed = parseJsonValue(current);
      current = parsed ?? current;
    }
  }
  if (!current || typeof current !== "object") return {};
  const map: Record<string, string> = {};
  for (const [email, lookupId] of Object.entries(current as Record<string, unknown>)) {
    if (lookupId == null || typeof lookupId === "object") continue;
    map[email.trim().toLowerCase()] = String(lookupId);
  }
  return map;
}

function itemMentionsTicket(fields: Record<string, unknown>, ticketId: string): boolean {
  const blob = JSON.stringify(fields);
  return blob.includes(ticketId);
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  if (!(await isAuthorized(req, admin))) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let requestBody: unknown = {};
  try {
    requestBody = await req.json();
  } catch {
    requestBody = {};
  }
  const onlyTicketId = parseTicketIdFromBody(requestBody);

  try {
    let graphConfig = getGraphConfig();
    if (assertGraphConfig(graphConfig)) {
      const { data: graphRow } = await admin
        .from("app_c009c0e4f1_integration_settings")
        .select("value")
        .eq("key", "sharepoint_graph_config")
        .maybeSingle();
      const parsed = parseJsonValue(graphRow?.value);
      if (parsed) {
        graphConfig = {
          tenantId: String(parsed.tenantId ?? graphConfig.tenantId).trim(),
          clientId: String(parsed.clientId ?? graphConfig.clientId).trim(),
          clientSecret: String(parsed.clientSecret ?? graphConfig.clientSecret).trim(),
          siteId: String(parsed.siteId ?? graphConfig.siteId).trim(),
          treinamentosListId: String(
            parsed.listId ?? parsed.treinamentosListId ?? graphConfig.treinamentosListId,
          ).trim(),
          presencaListId: graphConfig.presencaListId,
        };
      }
    }
    const graphError = assertGraphConfig(graphConfig);
    if (graphError) {
      return new Response(JSON.stringify({ error: graphError }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orquestraiCfg = await resolveOrquestrai(admin);
    if (!orquestraiCfg) {
      return new Response(JSON.stringify({ error: "ORQESTRAI não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orquestrai = createClient(orquestraiCfg.supabaseUrl, orquestraiCfg.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const today = todayIsoSaoPaulo();
    let cardsQuery = orquestrai
      .from("marketing_requests")
      .select("id, title, description, deadline, request_type")
      .eq("request_type", "Certificados")
      .ilike("description", "%Origem: Responsum%");
    cardsQuery = onlyTicketId
      ? cardsQuery.ilike("description", `%Ticket ID: ${onlyTicketId}%`)
      : cardsQuery.lt("deadline", today);

    const { data: cards, error: cardsError } = await cardsQuery;

    if (cardsError) throw new Error(cardsError.message);

    const pending = ((cards ?? []) as MarketingCard[]).filter((card) => {
      // O pedido manual (botão no card) sempre consulta de novo: a presença pode
      // ter sido preenchida depois de uma consulta que deu "não preenchida".
      if (onlyTicketId) return true;
      const description = card.description ?? "";
      if (descriptionAlreadyHasPresenca(description)) return false;
      const deadline = String(card.deadline ?? "").slice(0, 10);
      return isPresencaDue(deadline, today);
    });

    if (pending.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, today, processed: 0, skipped: 0, failed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const [{ data: lookupRow }, { data: users }, { data: orquestraiUsers }] = await Promise.all([
      admin
        .from("app_c009c0e4f1_integration_settings")
        .select("value")
        .eq("key", "sharepoint_person_lookups")
        .maybeSingle(),
      admin.from("app_c009c0e4f1_users").select("name, email"),
      orquestrai.from("users").select("name, email"),
    ]);

    const token = await getGraphAccessToken(graphConfig);
    // Sem a lista de usuários do site, ainda dá para usar o mapa antigo e o
    // autor do item; não vale perder a sincronização inteira por isso.
    const siteUsers = await listSiteUsers(graphConfig.siteId, token).catch((error) => {
      console.error("orquestrai-certificados-presenca: lista de usuários do site", error);
      return {};
    });
    const directory = {
      siteUsers,
      lookupIdToEmail: invertLookupMap(parseLookupMap(lookupRow?.value)),
      // O cadastro do ORQESTRAI vem primeiro: é o nome que vai no certificado.
      namesByLocalPart: buildNameDirectory(orquestraiUsers ?? [], users ?? []),
    };

    const treinamentos = await listAllItems(
      graphConfig.siteId,
      graphConfig.treinamentosListId,
      token,
    );
    const presencas = await listAllItems(
      graphConfig.siteId,
      graphConfig.presencaListId,
      token,
    );

    let processed = 0;
    let skipped = 0;
    let failed = 0;
    const details: Array<{ id: string; status: string; names?: number }> = [];

    for (const card of pending) {
      const ticketId = extractTicketIdFromDescription(card.description ?? "");
      if (!ticketId) {
        skipped += 1;
        details.push({ id: card.id, status: "sem_ticket_id" });
        continue;
      }

      const treinamento = treinamentos.find((item) =>
        itemMentionsTicket(item.fields ?? {}, ticketId),
      );
      if (!treinamento) {
        failed += 1;
        details.push({ id: card.id, status: "treinamento_nao_encontrado" });
        continue;
      }

      const treinamentoIds = new Set(
        treinamentos
          .filter((item) =>
            item.id === treinamento.id || isSameTreinamento(item.fields, treinamento.fields)
          )
          .map((item) => String(item.id)),
      );
      const attendance = presencas.filter((item) =>
        treinamentoIds.has(String(item.fields?.NomedoTreinamento0LookupId ?? ""))
      );

      const names = attendance
        .map((item) =>
          resolveColaboradorName(
            String(item.fields?.ColaboradorLookupId ?? ""),
            directory,
            item.createdBy?.user?.displayName,
            item.createdBy?.user?.email,
          ),
        )
        .filter((name): name is string => Boolean(name));

      const nextDescription = appendPresencaBlock(card.description ?? "", names);
      const { error: updateError } = await orquestrai
        .from("marketing_requests")
        .update({ description: nextDescription })
        .eq("id", card.id);

      if (updateError) {
        failed += 1;
        details.push({ id: card.id, status: "update_failed" });
        continue;
      }

      processed += 1;
      details.push({
        id: card.id,
        status: names.length ? "preenchida" : "nao_preenchida",
        names: names.length,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, today, processed, skipped, failed, details }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("orquestrai-certificados-presenca error:", error);
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
