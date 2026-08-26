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
  sendMode?: "ppt" | "certificados" | "ppt_e_certificados";
};

export type OrquestraiSendMode = "ppt" | "certificados" | "ppt_e_certificados";
export type OrquestraiRequestType = "PPT" | "Certificados";

export type OrquestraiCardResult = {
  requestType: OrquestraiRequestType;
  created: boolean;
  marketingRequestId: string;
};

const DEFAULT_DESIGNER = "Valentina Iacovacci";
const PRESENCA_LIST_URL =
  "https://bpplaw2.sharepoint.com/sites/CONTROLADORIAJURDICA/Lists/TREINAMENTOS%20%20OPERAES%20LEGAIS?env=WebViewList";

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

/** Data do workshop + 1 dia civil. */
export function certificadosDeadlineIso(value: string): string | null {
  const iso = brDateToIsoDate(value);
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function sendModesFor(mode: OrquestraiSendMode): OrquestraiRequestType[] {
  if (mode === "ppt") return ["PPT"];
  if (mode === "certificados") return ["Certificados"];
  return ["PPT", "Certificados"];
}

export function normalizeSendMode(value: unknown, precisaAjustePpt: boolean): OrquestraiSendMode {
  if (value === "ppt" || value === "certificados" || value === "ppt_e_certificados") {
    return value;
  }
  return precisaAjustePpt ? "ppt" : "certificados";
}

export function buildMarketingDescription(
  payload: OrquestraiTreinamentoPayload,
  ticketId: string,
  ticketAppUrl?: string,
  requestType: OrquestraiRequestType = "PPT",
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
    requestType === "PPT"
      ? `Precisa de ajuste em PPT?: ${payload.precisaAjustePpt ? "Sim" : "Não"}`
      : null,
    requestType === "PPT" && payload.precisaAjustePpt && payload.linkPpt
      ? `Link do PPT: ${payload.linkPpt}`
      : null,
    requestType === "Certificados"
      ? `Lista de presença: ${PRESENCA_LIST_URL}`
      : null,
    requestType === "Certificados"
      ? "Consultar após o workshop quem preencheu o registro de presença."
      : null,
  ];

  return lines.filter((line): line is string => line !== null).join("\n");
}

export function buildMarketingTitle(
  payload: OrquestraiTreinamentoPayload,
  requestType: OrquestraiRequestType = "PPT",
): string {
  if (requestType === "Certificados") {
    const title = `[DC] Certificados — ${payload.tema.trim()}`;
    return title.length > 180 ? `${title.slice(0, 177)}...` : title;
  }
  const tipo = payload.subcategory?.trim() || "Desenvolvimento Contínuo";
  const title = `[DC] ${tipo} — ${payload.tema.trim()}`;
  return title.length > 180 ? `${title.slice(0, 177)}...` : title;
}

export async function findExistingRequestId(
  orquestrai: SupabaseClient,
  ticketId: string,
  requestType?: OrquestraiRequestType,
): Promise<string | null> {
  let query = orquestrai
    .from("marketing_requests")
    .select("id")
    .ilike("description", `%Ticket ID: ${ticketId}%`);

  if (requestType) {
    query = query.eq("request_type", requestType);
  }

  const { data } = await query.limit(1);
  return data?.[0]?.id ?? null;
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

async function insertMarketingRequest(
  orquestrai: SupabaseClient,
  config: OrquestraiConfig,
  input: {
    ticketId: string;
    ticketAppUrl?: string;
    payload: OrquestraiTreinamentoPayload;
    requestType: OrquestraiRequestType;
    parentRequestId?: string | null;
    solicitante: { id: string; name: string; department: string | null } | null;
    designer: { id: string; name: string } | null;
  },
): Promise<OrquestraiCardResult> {
  const existingId = await findExistingRequestId(
    orquestrai,
    input.ticketId,
    input.requestType,
  );
  if (existingId) {
    return {
      requestType: input.requestType,
      marketingRequestId: existingId,
      created: false,
    };
  }

  const ticketLink = input.ticketAppUrl?.trim() || null;
  const pptLink = input.payload.linkPpt?.trim() || null;
  const deadline = input.requestType === "Certificados"
    ? certificadosDeadlineIso(input.payload.dataRealizacao)
    : brDateToIsoDate(input.payload.dataRealizacao);
  const cardLink = input.requestType === "Certificados"
    ? PRESENCA_LIST_URL
    : pptLink || ticketLink;
  const referencias = input.requestType === "Certificados"
    ? ticketLink
    : pptLink && ticketLink
      ? ticketLink
      : null;

  const { data, error } = await orquestrai
    .from("marketing_requests")
    .insert({
      title: buildMarketingTitle(input.payload, input.requestType),
      description: buildMarketingDescription(
        input.payload,
        input.ticketId,
        ticketLink || undefined,
        input.requestType,
      ),
      requesting_area: input.payload.area?.trim() || input.solicitante?.department || "Marketing",
      request_type: input.requestType,
      status: "pending",
      workflow_stage: "tarefas",
      priority: "normal",
      deadline,
      deadline_time: null,
      link: cardLink,
      referencias,
      parent_request_id: input.parentRequestId ?? null,
      assignee: input.designer?.name ?? config.defaultDesignerName,
      assignee_id: input.designer?.id ?? null,
      solicitante: input.solicitante?.name ?? input.payload.responsavelName ?? null,
      solicitante_id: input.solicitante?.id ?? null,
      created_by: "Responsum",
      created_by_id: null,
      nome_advogado: input.payload.responsavelName || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return {
    requestType: input.requestType,
    marketingRequestId: data.id,
    created: true,
  };
}

export async function createMarketingRequestForTreinamento(
  orquestrai: SupabaseClient,
  config: OrquestraiConfig,
  input: {
    ticketId: string;
    ticketAppUrl?: string;
    payload: OrquestraiTreinamentoPayload;
    sendMode?: OrquestraiSendMode;
  },
): Promise<{
  marketingRequestId: string;
  created: boolean;
  results: OrquestraiCardResult[];
}> {
  const sendMode = normalizeSendMode(
    input.sendMode ?? input.payload.sendMode,
    input.payload.precisaAjustePpt,
  );
  const types = sendModesFor(sendMode);
  const solicitante = await resolveUserByEmail(
    orquestrai,
    input.payload.responsavelEmail,
  );
  const designer = await resolveDesigner(orquestrai, config.defaultDesignerName);

  const results: OrquestraiCardResult[] = [];
  let pptId = await findExistingRequestId(orquestrai, input.ticketId, "PPT");

  for (const requestType of types) {
    const result = await insertMarketingRequest(orquestrai, config, {
      ticketId: input.ticketId,
      ticketAppUrl: input.ticketAppUrl,
      payload: input.payload,
      requestType,
      parentRequestId: requestType === "Certificados" ? pptId : null,
      solicitante,
      designer,
    });
    results.push(result);
    if (requestType === "PPT") pptId = result.marketingRequestId;
  }

  const created = results.some((item) => item.created);
  return {
    marketingRequestId: results[results.length - 1]?.marketingRequestId ?? "",
    created,
    results,
  };
}
