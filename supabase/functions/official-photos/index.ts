import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, handleCors } from "./_shared/cors.ts";

const DEFAULT_ORQESTRAI_PHOTOS_URL =
  "https://qwihfvagemzlyypeohpc.supabase.co/functions/v1/official-photos-api";

type OfficialPhoto = {
  externalUserId: string | null;
  userId: string;
  name: string;
  email: string | null;
  photoUrl: string | null;
  source: "selected" | "legacy_avatar" | "none";
  version: string;
  updatedAt: string;
};

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function getBearerUserId(req: Request): Promise<string | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  return user?.id ?? null;
}

function normalizeIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean))];
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const apiKey = Deno.env.get("OFFICIAL_PHOTOS_API_KEY")?.trim();
    const base = (Deno.env.get("ORQESTRAI_PHOTOS_URL")?.trim() || DEFAULT_ORQESTRAI_PHOTOS_URL).replace(/\/$/, "");

    if (!apiKey) {
      return json(503, {
        unavailable: true,
        error: "OFFICIAL_PHOTOS_API_KEY não configurada.",
        data: [],
        notFound: [],
      });
    }

    const authUserId = await getBearerUserId(req);
    if (!authUserId) {
      return json(401, { error: "Não autorizado" });
    }

    if (req.method === "GET") {
      const health = await fetch(`${base}/health`, { cache: "no-store" });
      if (!health.ok) {
        return json(503, { unavailable: true, error: `Health ORQESTRAI: HTTP ${health.status}` });
      }
      return json(200, await health.json());
    }

    if (req.method !== "POST") {
      return json(405, { error: "Método não permitido" });
    }

    const body = (await req.json().catch(() => ({}))) as {
      externalUserId?: unknown;
      externalUserIds?: unknown;
    };

    const ids = normalizeIds([
      ...(Array.isArray(body.externalUserIds) ? body.externalUserIds : []),
      body.externalUserId,
    ]);

    if (ids.length === 0) {
      return json(200, { data: [], notFound: [] });
    }

    const data: OfficialPhoto[] = [];
    const notFound: string[] = [];

    for (const group of chunk(ids, 100)) {
      const response = await fetch(`${base}/v1/photos/batch`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ externalUserIds: group }),
        cache: "no-store",
      });

      if (response.status === 429) {
        return json(429, { unavailable: true, error: "Rate limit da API de fotos.", data, notFound: ids });
      }
      if (response.status >= 500) {
        return json(503, { unavailable: true, error: `Fotos oficiais: HTTP ${response.status}`, data, notFound: ids });
      }
      if (!response.ok) {
        return json(502, { unavailable: true, error: `Fotos oficiais: HTTP ${response.status}`, data, notFound: ids });
      }

      const payload = (await response.json()) as {
        data?: OfficialPhoto[];
        notFound?: string[];
      };
      if (Array.isArray(payload.data)) data.push(...payload.data);
      if (Array.isArray(payload.notFound)) notFound.push(...payload.notFound);
    }

    return json(200, { data, notFound });
  } catch (error) {
    console.error("[official-photos]", error instanceof Error ? error.message : error);
    return json(503, {
      unavailable: true,
      error: "Falha ao consultar fotos oficiais.",
      data: [],
      notFound: [],
    });
  }
});
