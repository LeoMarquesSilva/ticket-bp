import { type GraphConfig, getGraphConfig, graphFetch } from "./graphClient.ts";
import {
  persistGraphUserId,
  resolveGraphUserIdByEmail,
} from "./graphUsers.ts";
import {
  isPersonFieldDisplayName,
  persistSharepointPersonLookup,
  personLookupFieldName,
  resolveSharepointPersonLookupIdFull,
} from "./sharepointPerson.ts";

export type SharepointTreinamentoInput = {
  tema: string;
  /** Nome exibido do facilitador (campo texto no SharePoint). */
  facilitador: string;
  /** E-mail do responsável (campo person no SharePoint). */
  responsavelEmail: string;
  /** Nome do responsável (fallback para resolver LookupId). */
  responsavelName: string;
  dataRealizacao: string;
  area: string;
  subcategory: string;
  duracaoMinutos: string;
  precisaAjustePpt: boolean;
  linkPpt?: string;
  ticketId: string;
  /** URL pública do ticket no app (ex.: https://www.responsum.com.br/tickets/uuid). */
  ticketAppUrl?: string;
};

type ListColumn = {
  name: string;
  displayName: string;
  readOnly?: boolean;
};

/** Campos mapeados explicitamente pelo negócio. */
const PRIMARY_DISPLAY_MAP: Record<string, (p: SharepointTreinamentoInput) => string> = {
  "Nome do treinamento": (p) => p.tema.trim(),
  Facilitador: (p) => p.facilitador.trim(),
  Data: (p) => brDateToGraphDate(p.dataRealizacao),
  Status: () => "Futuro",
  Área: (p) => p.area.trim(),
  Categoria: () => "Equipe",
  /** Coluna "Tipo do Treinamento" = meta PPT (SIM/NÃO), não subcategoria. */
  "Tipo do Treinamento": (p) => (p.precisaAjustePpt ? "SIM" : "NÃO"),
};

/** Campos extras do formulário — preenchidos se existirem na lista. */
const OPTIONAL_DISPLAY_MAP: Record<string, (p: SharepointTreinamentoInput) => string | undefined> = {
  Duração: (p) => `${p.duracaoMinutos.trim()} minutos`,
  "Duração (Minutos)": (p) => p.duracaoMinutos.trim(),
  Subcategoria: (p) => p.subcategory.trim(),
  Observações: (p) => {
    const parts = [
      `Precisa de ajuste em PPT: ${p.precisaAjustePpt ? "Sim" : "Não"}`,
    ];
    if (p.linkPpt?.trim()) parts.push(`Link do PPT: ${p.linkPpt.trim()}`);
    const ticketLink = p.ticketAppUrl?.trim() || p.ticketId;
    parts.push(`Ticket: ${ticketLink}`);
    return parts.join("\n");
  },
  "Link do PPT": (p) => p.linkPpt?.trim() || undefined,
  "Precisa de ajuste em PPT?": (p) => (p.precisaAjustePpt ? "Sim" : "Não"),
  "ID do Ticket": (p) => p.ticketId,
  Ticket: (p) => p.ticketId,
};

function normalizeDisplayName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function brDateToGraphDate(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return value.trim();
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

function appendResponsavelToObservacoes(
  fields: Record<string, string>,
  byDisplay: Map<string, ListColumn>,
  payload: SharepointTreinamentoInput,
): void {
  const obsCol = byDisplay.get(normalizeDisplayName("Observações"));
  if (!obsCol) return;
  const extra =
    `Responsável (pendente LookupId): ${payload.responsavelName.trim()} <${payload.responsavelEmail.trim()}>`;
  const current = fields[obsCol.name]?.trim();
  fields[obsCol.name] = current ? `${current}\n${extra}` : extra;
}

export async function listTreinamentosColumns(
  config?: GraphConfig,
): Promise<ListColumn[]> {
  const { siteId, listId } = config ?? getGraphConfig();
  const res = await graphFetch(
    `/sites/${siteId}/lists/${listId}/columns?$select=name,displayName,readOnly`,
    { config: config ?? getGraphConfig() },
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      json.error?.message ?? `Erro ao listar colunas SharePoint (${res.status})`,
    );
  }
  return (json.value ?? []) as ListColumn[];
}

export async function buildTreinamentosFields(
  payload: SharepointTreinamentoInput,
  admin?: { from: (table: string) => unknown },
): Promise<{
  fields: Record<string, string>;
  mappedDisplays: string[];
  unmappedDisplays: string[];
  missingFromList: string[];
  responsavelLookupId?: string;
  responsavelGraphUserId?: string;
  responsavelWarning?: string;
}> {
  const columns = await listTreinamentosColumns();
  const writable = columns.filter((c) => !c.readOnly && c.name !== "id");
  const byDisplay = new Map<string, ListColumn>();

  for (const col of writable) {
    byDisplay.set(normalizeDisplayName(col.displayName), col);
  }

  const fields: Record<string, string> = {};
  const mappedDisplays: string[] = [];
  const missingFromList: string[] = [];

  const applyMap = (
    map: Record<string, (p: SharepointTreinamentoInput) => string | undefined>,
    required = false,
  ) => {
    for (const [displayName, getter] of Object.entries(map)) {
      const col = byDisplay.get(normalizeDisplayName(displayName));
      const value = getter(payload);
      if (!col) {
        if (required) missingFromList.push(displayName);
        continue;
      }
      if (value === undefined || value === "") continue;
      fields[col.name] = value;
      mappedDisplays.push(displayName);
    }
  };

  applyMap(PRIMARY_DISPLAY_MAP, true);
  applyMap(OPTIONAL_DISPLAY_MAP, false);

  const { siteId, listId } = getGraphConfig();
  const responsavelCol = [...byDisplay.entries()].find(([display]) =>
    isPersonFieldDisplayName(display)
  )?.[1];
  let responsavelLookupId: string | undefined;
  let responsavelGraphUserId: string | undefined;
  let responsavelWarning: string | undefined;

  if (responsavelCol && payload.responsavelEmail.trim()) {
    const graphUserId = await resolveGraphUserIdByEmail(
      payload.responsavelEmail,
      payload.responsavelName,
      admin,
    );

    if (graphUserId) responsavelGraphUserId = graphUserId;

    const lookupId = await resolveSharepointPersonLookupIdFull(
      payload.responsavelEmail,
      payload.responsavelName,
      siteId,
      listId,
      admin,
    );

    if (lookupId) {
      responsavelLookupId = lookupId;
      fields[personLookupFieldName(responsavelCol.name)] = lookupId;
      mappedDisplays.push(responsavelCol.displayName);
    } else {
      responsavelWarning =
        `Responsável sem LookupId SharePoint (${payload.responsavelName} / ${payload.responsavelEmail}). ` +
        "Nome e e-mail foram incluídos em Observações.";
      appendResponsavelToObservacoes(fields, byDisplay, payload);
    }
  }

  const titleCol = writable.find((c) => c.name === "Title");
  if (titleCol && !fields.Title) {
    fields.Title = payload.tema.trim();
    mappedDisplays.push("Title");
  }

  const allKnown = new Set([
    ...Object.keys(PRIMARY_DISPLAY_MAP),
    ...Object.keys(OPTIONAL_DISPLAY_MAP),
    "Title",
  ].map(normalizeDisplayName));

  const unmappedDisplays = writable
    .filter((c) => c.name !== "Title" && c.name !== "LinkTitle")
    .map((c) => c.displayName)
    .filter((displayName) => !allKnown.has(normalizeDisplayName(displayName)));

  return {
    fields,
    mappedDisplays,
    unmappedDisplays,
    missingFromList,
    responsavelLookupId,
    responsavelGraphUserId,
    responsavelWarning,
  };
}

export async function createTreinamentosListItem(
  payload: SharepointTreinamentoInput,
  admin?: { from: (table: string) => unknown },
): Promise<{
  itemId: string;
  mappedDisplays: string[];
  unmappedDisplays: string[];
  missingFromList: string[];
  responsavelLookupId?: string;
  responsavelGraphUserId?: string;
  responsavelWarning?: string;
}> {
  const { siteId, listId } = getGraphConfig();
  const {
    fields,
    mappedDisplays,
    unmappedDisplays,
    missingFromList,
    responsavelLookupId,
    responsavelGraphUserId,
    responsavelWarning,
  } = await buildTreinamentosFields(payload, admin);

  if (missingFromList.length > 0) {
    throw new Error(
      `Colunas não encontradas na lista SharePoint: ${missingFromList.join(", ")}`,
    );
  }

  const res = await graphFetch(
    `/sites/${siteId}/lists/${listId}/items`,
    {
      method: "POST",
      body: JSON.stringify({ fields }),
    },
  );

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      json.error?.message ?? `Erro ao criar item SharePoint (${res.status})`,
    );
  }

  if (admin && payload.responsavelEmail.trim()) {
    if (responsavelGraphUserId) {
      await persistGraphUserId(
        admin,
        payload.responsavelEmail,
        payload.responsavelName,
        responsavelGraphUserId,
      );
    } else if (responsavelLookupId) {
      await persistSharepointPersonLookup(
        admin,
        payload.responsavelEmail,
        payload.responsavelName,
        responsavelLookupId,
      );
    }
  }

  return {
    itemId: String(json.id ?? ""),
    mappedDisplays,
    unmappedDisplays,
    missingFromList,
    responsavelLookupId,
    responsavelGraphUserId,
    responsavelWarning,
  };
}
