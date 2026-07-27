import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type OrquestraiConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  defaultDesignerName: string;
};

export type OrquestraiTreinamentoPayload = {
  tema: string;
  facilitador: string;
  responsavelEmail: string;
  responsavelName: string;
  dataRealizacao: string;
  area: string;
  subcategory: string;
  duracaoMinutos: string;
  precisaAjustePpt: boolean;
  linkPpt?: string;
};

const DEFAULT_DESIGNER = "Valentina Iacovacci";

export async function resolveOrquestraiConfig(
  admin: SupabaseClient,
): Promise<OrquestraiConfig | null> {
  const fromEnvUrl = Deno.env.get("ORQESTRAI_SUPABASE_URL")?.trim();
  const fromEnvKey = Deno.env.get("ORQESTRAI_SERVICE_ROLE_KEY")?.trim();
  const fromEnvDesigner = Deno.env.get("ORQESTRAI_DEFAULT_DESIGNER")?.trim();

  if (fromEnvUrl && fromEnvKey) {
    return {
      supabaseUrl: fromEnvUrl.replace(/\/$/, ""),
      serviceRoleKey: fromEnvKey,
      defaultDesignerName: fromEnvDesigner || DEFAULT_DESIGNER,
    };
  }

  const { data } = await admin
    .from("app_c009c0e4f1_integration_settings")
    .select("value")
    .eq("key", "orquestrai_config")
    .maybeSingle();

  let value: Record<string, unknown> | null = null;
  const raw = data?.value;
  if (typeof raw === "string" && raw.trim()) {
    try {
      value = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      value = null;
    }
  } else if (raw && typeof raw === "object") {
    value = raw as Record<string, unknown>;
  }

  const supabaseUrl = String(value?.supabaseUrl ?? "").trim();
  const serviceRoleKey = String(value?.serviceRoleKey ?? "").trim();
  const defaultDesignerName =
    String(value?.defaultDesignerName ?? "").trim() || DEFAULT_DESIGNER;

  if (!supabaseUrl || !serviceRoleKey) return null;

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    serviceRoleKey,
    defaultDesignerName,
  };
}

export function createOrquestraiAdmin(config: OrquestraiConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Converte DD/MM/AAAA → YYYY-MM-DD (deadline do Planner). */
export function brDateToIsoDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

export function buildMarketingDescription(
  payload: OrquestraiTreinamentoPayload,
  ticketId: string,
  ticketAppUrl?: string,
): string {
  const lines = [
    "Origem: Responsum — Desenvolvimento Contínuo da Equipe",
    `Ticket ID: ${ticketId}`,
    ticketAppUrl ? `Ticket: ${ticketAppUrl}` : null,
    "",
    `Tipo: ${payload.subcategory || "Treinamento/Workshop"}`,
    `Tema: ${payload.tema}`,
    `Responsável (Gerente da área): ${payload.responsavelName}`,
    payload.responsavelEmail ? `E-mail do responsável: ${payload.responsavelEmail}` : null,
    `Facilitador(es): ${payload.facilitador}`,
    `Data da realização: ${payload.dataRealizacao}`,
    `Duração: ${payload.duracaoMinutos} minutos`,
    `Área: ${payload.area}`,
    `Precisa de ajuste em PPT?: ${payload.precisaAjustePpt ? "Sim" : "Não"}`,
    payload.precisaAjustePpt && payload.linkPpt
      ? `Link do PPT: ${payload.linkPpt}`
      : null,
  ];

  return lines.filter((line): line is string => line !== null).join("\n");
}

export function buildMarketingTitle(payload: OrquestraiTreinamentoPayload): string {
  const tipo = payload.subcategory?.trim() || "Desenvolvimento Contínuo";
  const title = `[DC] ${tipo} — ${payload.tema.trim()}`;
  return title.length > 180 ? `${title.slice(0, 177)}...` : title;
}

export async function findExistingRequestId(
  orquestrai: SupabaseClient,
  ticketId: string,
): Promise<string | null> {
  const { data } = await orquestrai
    .from("marketing_requests")
    .select("id")
    .ilike("description", `%Ticket ID: ${ticketId}%`)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function resolveUserByEmail(
  orquestrai: SupabaseClient,
  email: string,
): Promise<{ id: string; name: string; department: string | null } | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const { data } = await orquestrai
    .from("users")
    .select("id, name, email, department")
    .ilike("email", normalized)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    department: data.department ?? null,
  };
}

export async function resolveDesigner(
  orquestrai: SupabaseClient,
  designerName: string,
): Promise<{ id: string; name: string } | null> {
  const { data } = await orquestrai
    .from("users")
    .select("id, name")
    .ilike("name", designerName)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, name: data.name };
}

export async function createMarketingRequestForTreinamento(
  orquestrai: SupabaseClient,
  config: OrquestraiConfig,
  input: {
    ticketId: string;
    ticketAppUrl?: string;
    payload: OrquestraiTreinamentoPayload;
  },
): Promise<{ marketingRequestId: string; created: boolean }> {
  const existingId = await findExistingRequestId(orquestrai, input.ticketId);
  if (existingId) {
    return { marketingRequestId: existingId, created: false };
  }

  const solicitante = await resolveUserByEmail(
    orquestrai,
    input.payload.responsavelEmail,
  );
  const designer = await resolveDesigner(orquestrai, config.defaultDesignerName);

  const requestType = input.payload.precisaAjustePpt ? "PPT" : "Evento";
  const deadline = brDateToIsoDate(input.payload.dataRealizacao);
  const pptLink = input.payload.linkPpt?.trim() || null;
  const ticketLink = input.ticketAppUrl?.trim() || null;

  const { data, error } = await orquestrai
    .from("marketing_requests")
    .insert({
      title: buildMarketingTitle(input.payload),
      description: buildMarketingDescription(
        input.payload,
        input.ticketId,
        ticketLink || undefined,
      ),
      requesting_area: input.payload.area?.trim() || solicitante?.department || "Marketing",
      request_type: requestType,
      status: "pending",
      workflow_stage: "tarefas",
      priority: "normal",
      deadline,
      deadline_time: null,
      link: pptLink || ticketLink,
      referencias: pptLink && ticketLink ? ticketLink : null,
      assignee: designer?.name ?? config.defaultDesignerName,
      assignee_id: designer?.id ?? null,
      solicitante: solicitante?.name ?? input.payload.responsavelName ?? null,
      solicitante_id: solicitante?.id ?? null,
      created_by: "Responsum",
      created_by_id: null,
      nome_advogado: input.payload.responsavelName || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return { marketingRequestId: data.id, created: true };
}
