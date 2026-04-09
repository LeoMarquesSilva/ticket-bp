import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, handleCors } from "./_shared/cors.ts";
import {
  getBearerClient,
  canInvokeTicketNotify,
} from "./_shared/evolutionAuth.ts";

const SETTINGS_KEY = "evolution_instance_name";

function evoBase(): string {
  return (Deno.env.get("EVOLUTION_BASE_URL") ?? "").replace(/\/$/, "");
}

function evoHeaders(): HeadersInit {
  return {
    apikey: Deno.env.get("EVOLUTION_API_KEY") ?? "",
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

function interpolate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
}

function formatRequestedAtLocal(raw: string): string {
  if (!raw) return "";
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return raw;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(dt);
}

async function getInstanceName(
  admin: ReturnType<typeof createClient>,
): Promise<string> {
  const { data } = await admin
    .from("app_c009c0e4f1_integration_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  const fromDb = data?.value?.trim();
  if (fromDb) return fromDb;
  return (Deno.env.get("EVOLUTION_INSTANCE_NAME") ?? "").trim();
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { error: authErr, authUserId } = await getBearerClient(req);
    if (authErr || !authUserId) {
      return new Response(JSON.stringify({ error: authErr ?? "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { ticketId } = await req.json().catch(() => ({ ticketId: "" })) as {
      ticketId?: string;
    };
    if (!ticketId) {
      return new Response(JSON.stringify({ error: "ticketId obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: ticket, error: tErr } = await admin
      .from("app_c009c0e4f1_tickets")
      .select(
        "id, title, description, category, subcategory, created_by, created_by_name, priority, created_at",
      )
      .eq("id", ticketId)
      .maybeSingle();

    if (tErr || !ticket) {
      return new Response(JSON.stringify({ error: "Ticket não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const can = await canInvokeTicketNotify(
      admin,
      authUserId,
      ticket.created_by as string,
    );
    if (!can) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const catKey = String(ticket.category ?? "");
    const subKey = String(ticket.subcategory ?? "");

    const { data: categoryRow } = await admin
      .from("app_c009c0e4f1_categories")
      .select("id, label")
      .eq("key", catKey)
      .maybeSingle();

    if (!categoryRow || !subKey) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_category" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subRow } = await admin
      .from("app_c009c0e4f1_subcategories")
      .select(
        "label, whatsapp_notify_enabled, whatsapp_message_template, whatsapp_recipient",
      )
      .eq("category_id", categoryRow.id)
      .eq("key", subKey)
      .maybeSingle();

    if (
      !subRow?.whatsapp_notify_enabled ||
      !subRow.whatsapp_message_template?.trim() ||
      !subRow.whatsapp_recipient?.trim()
    ) {
      return new Response(JSON.stringify({ skipped: true, reason: "whatsapp_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const instance = await getInstanceName(admin);
    if (!instance) {
      return new Response(JSON.stringify({ error: "Instância Evolution não configurada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const base = evoBase();
    if (!base) {
      return new Response(JSON.stringify({ error: "EVOLUTION_BASE_URL ausente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vars: Record<string, string> = {
      id: String(ticket.id),
      title: String(ticket.title ?? ""),
      description: String(ticket.description ?? ""),
      category: catKey,
      subcategory: subKey,
      categoryLabel: String(categoryRow.label ?? catKey),
      subcategoryLabel: String(subRow.label ?? subKey),
      createdByName: String(ticket.created_by_name ?? ""),
      requester: String(ticket.created_by_name ?? ""),
      priority: String(ticket.priority ?? ""),
      createdAt: String(ticket.created_at ?? ""),
      requestedAt: String(ticket.created_at ?? ""),
      requestedAtLocal: formatRequestedAtLocal(String(ticket.created_at ?? "")),
    };

    const text = interpolate(subRow.whatsapp_message_template, vars);
    const number = normalizeSendNumber(subRow.whatsapp_recipient);

    const sendRes = await fetch(
      `${base}/message/sendText/${encodeURIComponent(instance)}`,
      {
        method: "POST",
        headers: evoHeaders(),
        body: JSON.stringify({ number, text }),
      },
    );

    const sendJson = await sendRes.json().catch(() => ({}));
    if (!sendRes.ok) {
      return new Response(
        JSON.stringify({
          error: "Evolution sendText falhou",
          status: sendRes.status,
          details: sendJson,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ ok: true, evolution: sendJson }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
