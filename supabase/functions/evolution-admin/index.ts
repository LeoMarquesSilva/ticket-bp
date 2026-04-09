import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, handleCors } from "./_shared/cors.ts";
import {
  getBearerClient,
  userHasManageCategories,
} from "./_shared/evolutionAuth.ts";

const SETTINGS_KEY = "evolution_instance_name";

function evoBase(): string {
  const u = (Deno.env.get("EVOLUTION_BASE_URL") ?? "").replace(/\/$/, "");
  return u;
}

function evoHeaders(): HeadersInit {
  return {
    apikey: Deno.env.get("EVOLUTION_API_KEY") ?? "",
    "Content-Type": "application/json",
  };
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

function getRequestedInstanceName(body: unknown): string {
  const raw = (body as { instanceName?: unknown } | null)?.instanceName;
  return typeof raw === "string" ? raw.trim() : "";
}

function normalizeEvolutionInstances(raw: unknown): Array<{
  name: string;
  state: string | null;
}> {
  const arr = Array.isArray(raw)
    ? raw
    : (raw as { instances?: unknown[]; data?: unknown[] } | null)?.instances ??
      (raw as { instances?: unknown[]; data?: unknown[] } | null)?.data ??
      [];
  return (arr as Array<Record<string, unknown>>).map((it) => {
    const maybeNested = (it.instance as Record<string, unknown> | undefined) ?? {};
    const name = String(
      it.instanceName ??
        it.name ??
        it.instance ??
        maybeNested.instanceName ??
        maybeNested.name ??
        "",
    ).trim();
    const state = String(
      it.state ??
        it.status ??
        it.connectionStatus ??
        maybeNested.state ??
        maybeNested.status ??
        maybeNested.connectionStatus ??
        "",
    ).trim();
    return { name, state: state || null };
  }).filter((it) => it.name.length > 0);
}

async function evoFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = evoBase();
  if (!base) {
    return new Response(
      JSON.stringify({ error: "EVOLUTION_BASE_URL não configurada" }),
      { status: 500 },
    );
  }
  const url = `${base}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      ...evoHeaders(),
      ...(init?.headers ?? {}),
    },
  });
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(supabaseUrl, serviceKey);

    const allowed = await userHasManageCategories(admin, authUserId);
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "Sem permissão para gerenciar categorias" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = req.method === "POST" || req.method === "PUT"
      ? await req.json().catch(() => ({}))
      : {};

    const action = (body as { action?: string }).action;

    if (action === "getInstanceName") {
      const instance = await getInstanceName(admin);
      return new Response(JSON.stringify({ instanceName: instance || "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "saveInstanceName") {
      const name = String((body as { instanceName?: string }).instanceName ?? "")
        .trim();
      if (!name) {
        return new Response(
          JSON.stringify({ error: "Nome da instância obrigatório" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const { error: upErr } = await admin.from(
        "app_c009c0e4f1_integration_settings",
      ).upsert({
        key: SETTINGS_KEY,
        value: name,
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });
      if (upErr) {
        return new Response(JSON.stringify({ error: upErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true, instanceName: name }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "createInstance") {
      const name = String((body as { instanceName?: string }).instanceName ?? "")
        .trim();
      if (!name) {
        return new Response(
          JSON.stringify({ error: "Nome da instância obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const res = await evoFetch("/instance/create", {
        method: "POST",
        body: JSON.stringify({
          instanceName: name,
          integration: "WHATSAPP-BAILEYS",
          qrcode: false,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return new Response(
          JSON.stringify({
            error: "Falha ao criar instância na Evolution",
            details: json,
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      await admin.from("app_c009c0e4f1_integration_settings").upsert({
        key: SETTINGS_KEY,
        value: name,
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });
      return new Response(JSON.stringify({ ok: true, evolution: json }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestedInstance = getRequestedInstanceName(body);
    const instance = requestedInstance || await getInstanceName(admin);
    if (!instance) {
      return new Response(
        JSON.stringify({
          error:
            "Nome da instância não configurado. Informe e salve na tela de categorias.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (action === "connectionState") {
      const res = await evoFetch(
        `/instance/connectionState/${encodeURIComponent(instance)}`,
        { method: "GET" },
      );
      const json = await res.json().catch(() => ({}));
      return new Response(JSON.stringify(json), {
        status: res.ok ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "getQr") {
      const res = await evoFetch(
        `/instance/connect/${encodeURIComponent(instance)}`,
        { method: "GET" },
      );
      const json = await res.json().catch(() => ({}));
      return new Response(JSON.stringify(json), {
        status: res.ok ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "listChats") {
      const res = await evoFetch(
        `/chat/findChats/${encodeURIComponent(instance)}`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );
      const raw = await res.json().catch(() => ({}));
      const list = Array.isArray(raw)
        ? raw
        : (raw as { chats?: unknown[] }).chats ??
          (raw as { response?: unknown[] }).response ??
          [];

      const chats = (list as Record<string, unknown>[]).map((c) => {
        const jid = String(
          c.remoteJid ?? c.id ?? (c.key as Record<string, string>)?.remoteJid ??
            "",
        );
        const name = String(
          c.pushName ?? c.name ?? c.subject ?? jid ?? "Chat",
        );
        return { jid, name };
      }).filter((c) => c.jid);

      return new Response(JSON.stringify({ chats, raw }), {
        status: res.ok ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "listInstances") {
      const candidates = [
        { path: "/instance/fetchInstances", method: "GET" as const },
        { path: "/instance/list", method: "GET" as const },
        { path: "/instance/findInstances", method: "GET" as const },
      ];
      let lastBody: unknown = null;
      let lastStatus = 502;

      for (const candidate of candidates) {
        const res = await evoFetch(candidate.path, { method: candidate.method });
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          const instances = normalizeEvolutionInstances(json);
          return new Response(JSON.stringify({ instances, raw: json }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        lastBody = json;
        lastStatus = res.status || 502;
      }

      return new Response(
        JSON.stringify({
          error: "Falha ao listar instâncias na Evolution",
          details: lastBody,
        }),
        {
          status: lastStatus >= 400 ? lastStatus : 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        error: "action inválida",
        valid: [
          "getInstanceName",
          "connectionState",
          "getQr",
          "listChats",
          "listInstances",
          "saveInstanceName",
          "createInstance",
        ],
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
