import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, handleCors } from "./_shared/cors.ts";
import {
  assertGraphConfig,
  getGraphAccessToken,
  resolveGraphConfig,
} from "./_shared/graphClient.ts";
import {
  createTreinamentosListItem,
  listTreinamentosColumns,
  type SharepointTreinamentoInput,
} from "./_shared/treinamentosList.ts";

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

async function canSubmitTreinamento(
  admin: ReturnType<typeof createClient>,
  authUserId: string,
  ticketCreatedBy: string,
): Promise<boolean> {
  const { data: profile } = await admin
    .from("app_c009c0e4f1_users")
    .select("id, role")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (!profile) return false;
  if (profile.id === ticketCreatedBy) return true;
  const role = String(profile.role ?? "").toLowerCase();
  return ["admin", "support", "lawyer"].includes(role);
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const graphConfig = await resolveGraphConfig(admin);
    const configError = assertGraphConfig(graphConfig);
    if (configError) {
      return new Response(JSON.stringify({ error: configError }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authUserId = await getBearerUserId(req);
    if (!authUserId) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({})) as {
      action?: string;
      ticketId?: string;
      ticketAppUrl?: string;
      payload?: SharepointTreinamentoInput;
    };

    if (body.action === "listColumns") {
      await getGraphAccessToken(graphConfig);
      const columns = await listTreinamentosColumns();
      return new Response(JSON.stringify({ ok: true, columns }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { ticketId, payload } = body;
    if (!ticketId || !payload?.tema) {
      return new Response(JSON.stringify({ error: "ticketId e payload obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ticket } = await admin
      .from("app_c009c0e4f1_tickets")
      .select("id, created_by, category")
      .eq("id", ticketId)
      .maybeSingle();

    if (!ticket) {
      return new Response(JSON.stringify({ error: "Ticket não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (ticket.category !== "desenvolvimento_continuo_equipe") {
      return new Response(JSON.stringify({ skipped: true, reason: "wrong_category" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowed = await canSubmitTreinamento(
      admin,
      authUserId,
      String(ticket.created_by),
    );
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await createTreinamentosListItem({
      ...payload,
      ticketId,
      ticketAppUrl: body.ticketAppUrl?.trim() || payload.ticketAppUrl,
    }, admin);

    return new Response(JSON.stringify({ ok: true, ...result }), {
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
