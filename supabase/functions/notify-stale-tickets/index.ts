import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, handleCors } from "./_shared/cors.ts";
import {
  getBearerClient,
  userHasManageCategories,
} from "./_shared/evolutionAuth.ts";

const SETTINGS_INSTANCE_KEY = "evolution_instance_name";
const SETTINGS_STALE_INSTANCE_KEY = "stale_ticket_evolution_instance_name";
const SETTINGS_RECIPIENT_KEY = "stale_ticket_whatsapp_recipient";
const SETTINGS_DAYS_KEY = "stale_ticket_whatsapp_days";
const SETTINGS_TEMPLATE_KEY = "stale_ticket_whatsapp_template";
const DEFAULT_DAYS = 3;
const DEFAULT_TEMPLATE =
  "⚠️ *TICKET PARADO — sem resposta há {days} dia(s)*\n\n" +
  "*Título:* {title}\n" +
  "*Solicitante:* {createdByName}\n" +
  "*Responsável:* {assignedToName}\n\n" +
  "*Categoria:* {categoryLabel}\n" +
  "*Subcategoria:* {subcategoryLabel}\n\n" +
  "*Aberto em:* {createdAtLocal}\n\n" +
  "Por favor, verifique este chamado.";

function evoBase(): string {
  return (Deno.env.get("EVOLUTION_BASE_URL") ?? "").replace(/\/$/, "");
}

/** A instância dedicada de "tickets parados" tem sua própria API key do Evolution API, diferente da instância padrão usada para os outros avisos de WhatsApp. */
function evoHeaders(): HeadersInit {
  const staleKey = (Deno.env.get("STALE_TICKET_EVOLUTION_API_KEY") ?? "").trim();
  return {
    apikey: staleKey || (Deno.env.get("EVOLUTION_API_KEY") ?? ""),
    "Content-Type": "application/json",
  };
}

function normalizeSendNumber(recipient: string): string {
  const t = recipient.trim();
  if (t.includes("@g.us")) return t;
  if (t.includes("@")) {
    const prefix = t.split("@")[0]?.replace(/\D/g, "") ?? "";
    return prefix || t;
  }
  return t.replace(/\D/g, "") || t;
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
}

async function sendEvolutionText(
  base: string,
  instance: string,
  number: string,
  text: string,
): Promise<Response> {
  const url = `${base}/message/sendText/${encodeURIComponent(instance)}`;
  const plainRes = await fetch(url, {
    method: "POST",
    headers: evoHeaders(),
    body: JSON.stringify({ number, text }),
  });

  if (plainRes.ok) return plainRes;

  return fetch(url, {
    method: "POST",
    headers: evoHeaders(),
    body: JSON.stringify({
      number,
      textMessage: { text },
    }),
  });
}

function formatDateLocal(raw: string): string {
  if (!raw) return "";
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return raw;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(dt);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getSetting(
  admin: ReturnType<typeof createClient>,
  key: string,
): Promise<string> {
  const { data } = await admin
    .from("app_c009c0e4f1_integration_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value?.trim() ?? "";
}

/** Envia o alerta de "ticket parado" para um único ticket já carregado do banco. */
async function sendAlertForTicket(
  admin: ReturnType<typeof createClient>,
  ticket: Record<string, unknown>,
  opts: { template: string; recipient: string; instance: string; base: string; days: number },
): Promise<{ id: string; ok: boolean; details?: unknown }> {
  const catKey = String(ticket.category ?? "");
  const subKey = String(ticket.subcategory ?? "");

  let categoryLabel = catKey;
  let subcategoryLabel = subKey;

  if (catKey) {
    const { data: categoryRow } = await admin
      .from("app_c009c0e4f1_categories")
      .select("id, label")
      .eq("key", catKey)
      .maybeSingle();
    if (categoryRow?.label) categoryLabel = String(categoryRow.label);

    if (categoryRow && subKey) {
      const { data: subRow } = await admin
        .from("app_c009c0e4f1_subcategories")
        .select("label")
        .eq("category_id", categoryRow.id)
        .eq("key", subKey)
        .maybeSingle();
      if (subRow?.label) subcategoryLabel = String(subRow.label);
    }
  }

  const vars: Record<string, string> = {
    id: String(ticket.id),
    title: String(ticket.title ?? ""),
    createdByName: String(ticket.created_by_name ?? ""),
    assignedToName: String(ticket.assigned_to_name ?? "Não atribuído"),
    category: catKey,
    subcategory: subKey,
    categoryLabel,
    subcategoryLabel,
    priority: String(ticket.priority ?? ""),
    createdAt: String(ticket.created_at ?? ""),
    createdAtLocal: formatDateLocal(String(ticket.created_at ?? "")),
    days: String(opts.days),
  };

  const text = interpolate(opts.template, vars);
  const number = normalizeSendNumber(opts.recipient);

  const sendRes = await sendEvolutionText(opts.base, opts.instance, number, text);

  if (sendRes.ok) {
    await admin
      .from("app_c009c0e4f1_tickets")
      .update({ stale_whatsapp_notified_at: new Date().toISOString() })
      .eq("id", ticket.id as string);
    return { id: String(ticket.id), ok: true };
  }

  const details = await sendRes.json().catch(() => ({}));
  return { id: String(ticket.id), ok: false, details };
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({})) as { ticketId?: unknown };
    const ticketId = typeof body?.ticketId === "string" ? body.ticketId.trim() : "";

    const recipient = await getSetting(admin, SETTINGS_RECIPIENT_KEY);
    if (!recipient) {
      return json({ skipped: true, reason: "no_recipient_configured" });
    }

    const daysRaw = await getSetting(admin, SETTINGS_DAYS_KEY);
    const parsedDays = Number.parseInt(daysRaw, 10);
    const days = Number.isFinite(parsedDays) && parsedDays >= 0
      ? parsedDays
      : DEFAULT_DAYS;

    const template = (await getSetting(admin, SETTINGS_TEMPLATE_KEY)) ||
      DEFAULT_TEMPLATE;

    const instance = (await getSetting(admin, SETTINGS_STALE_INSTANCE_KEY)) ||
      (await getSetting(admin, SETTINGS_INSTANCE_KEY)) ||
      (Deno.env.get("EVOLUTION_INSTANCE_NAME") ?? "").trim();
    if (!instance) {
      return json({ error: "Instância Evolution não configurada" }, 400);
    }

    const base = evoBase();
    if (!base) {
      return json({ error: "EVOLUTION_BASE_URL ausente" }, 500);
    }

    // Envio manual de um ticket específico (disparado por um admin pela tela, não pelo agendamento automático)
    if (ticketId) {
      const { error: authErr, authUserId } = await getBearerClient(req);
      if (authErr || !authUserId) {
        return json({ error: authErr ?? "Não autorizado" }, 401);
      }
      const allowed = await userHasManageCategories(admin, authUserId);
      if (!allowed) {
        return json({ error: "Sem permissão para gerenciar categorias" }, 403);
      }

      const { data: ticket, error: tErr } = await admin
        .from("app_c009c0e4f1_tickets")
        .select("*")
        .eq("id", ticketId)
        .maybeSingle();
      if (tErr || !ticket) {
        return json({ error: "Ticket não encontrado" }, 404);
      }
      if (ticket.status === "resolved") {
        return json({ error: "Este ticket já foi resolvido" }, 400);
      }

      const result = await sendAlertForTicket(admin, ticket, { template, recipient, instance, base, days });
      if (!result.ok) {
        return json({ error: "Falha ao enviar via Evolution API", details: result.details }, 502);
      }
      return json({ ok: true, manual: true, result });
    }

    // Envio em lote (chamado pelo agendamento automático diário)
    const { data: staleTickets, error: rpcErr } = await admin.rpc(
      "helpdesk_get_stale_tickets",
      { p_days: days },
    );
    if (rpcErr) {
      return json({ error: rpcErr.message }, 500);
    }

    const tickets = (staleTickets ?? []) as Array<Record<string, unknown>>;
    const results: Array<{ id: string; ok: boolean; details?: unknown }> = [];

    for (const ticket of tickets) {
      const result = await sendAlertForTicket(admin, ticket, { template, recipient, instance, base, days });
      results.push(result);
    }

    return json({ ok: true, checked: tickets.length, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});
