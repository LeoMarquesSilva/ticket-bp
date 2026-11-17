// Funções puras do status de envio ao ORQESTRAI. Sem imports de Deno/esm.sh
// para os testes do front (vitest) poderem importar este arquivo direto.

export type PresencaSummary = {
  /** aguardando: a consulta diária ainda não gravou o bloco "Presença:" no card. */
  state: "aguardando" | "preenchida" | "nao_preenchida";
  names: string[];
};

export type OrquestraiCardSummary = {
  id: string;
  requestType: string;
  title: string;
  status: string | null;
  workflowStage: string | null;
  deadline: string | null;
  createdAt: string | null;
  presenca: PresencaSummary | null;
};

/** Lê o bloco "Presença:" que a orquestrai-certificados-presenca grava no fim da descrição. */
export function summarizePresenca(description: string): PresencaSummary {
  const match = /(?:^|\n)\s*Presença:([\s\S]*)$/.exec(description ?? "");
  if (!match) return { state: "aguardando", names: [] };

  const rest = match[1];
  if (/^\s*não preenchida/i.test(rest)) return { state: "nao_preenchida", names: [] };

  const names = rest
    .split("\n")
    .map((line) => /^\s*-\s+(.+?)\s*$/.exec(line)?.[1] ?? "")
    .filter(Boolean);
  return names.length
    ? { state: "preenchida", names }
    : { state: "nao_preenchida", names: [] };
}

function textOrNull(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

/** Linha crua de marketing_requests → resumo enviado ao front (sem a descrição inteira). */
export function summarizeCard(row: Record<string, unknown>): OrquestraiCardSummary {
  const requestType = String(row.request_type ?? "");
  const deadline = textOrNull(row.deadline);
  return {
    id: String(row.id ?? ""),
    requestType,
    title: String(row.title ?? ""),
    status: textOrNull(row.status),
    workflowStage: textOrNull(row.workflow_stage),
    deadline: deadline ? deadline.slice(0, 10) : null,
    createdAt: textOrNull(row.created_at),
    presenca: requestType === "Certificados"
      ? summarizePresenca(String(row.description ?? ""))
      : null,
  };
}
