export const PRESENCA_MARKER = "Presença:";
export const PRESENCA_NAO_PREENCHIDA = "Presença: não preenchida";
export const PRESENCA_LIST_ID = "30ea2880-475e-489c-8600-ae541d29faf3";
const CONTROLADORIA_EMAIL = "controladoria@bpplaw.com.br";

export function descriptionAlreadyHasPresenca(description: string): boolean {
  return /(^|\n)\s*Presença:/m.test(description);
}

export function formatPresencaBlock(names: string[]): string {
  const unique = [
    ...new Set(names.map((name) => name.trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  if (unique.length === 0) return PRESENCA_NAO_PREENCHIDA;
  return `${PRESENCA_MARKER}\n${unique.map((name) => `- ${name}`).join("\n")}`;
}

export function isPresencaDue(deadlineIso: string, todayIso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadlineIso)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayIso)) return false;
  return todayIso > deadlineIso;
}

export function appendPresencaBlock(description: string, names: string[]): string {
  return `${description.trimEnd()}\n\n${formatPresencaBlock(names)}`;
}

export function extractTicketIdFromDescription(description: string): string | null {
  const match = /Ticket ID:\s*([0-9a-f-]{36})/i.exec(description);
  return match?.[1] ?? null;
}

export function todayIsoSaoPaulo(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function invertLookupMap(
  emailToLookupId: Record<string, string>,
): Record<string, string> {
  const inverted: Record<string, string> = {};
  for (const [email, lookupId] of Object.entries(emailToLookupId)) {
    const id = String(lookupId).trim();
    if (!id) continue;
    inverted[id] = email.trim().toLowerCase();
  }
  return inverted;
}

export function resolveColaboradorName(
  lookupId: string,
  lookupIdToEmail: Record<string, string>,
  emailToName: Record<string, string>,
  createdByName?: string | null,
  createdByEmail?: string | null,
): string | null {
  const email = lookupIdToEmail[String(lookupId)]?.trim().toLowerCase();
  if (email) {
    return emailToName[email]?.trim() || email;
  }
  const fallbackEmail = createdByEmail?.trim().toLowerCase() ?? "";
  const fallbackName = createdByName?.trim() ?? "";
  if (
    fallbackName &&
    !(fallbackEmail === CONTROLADORIA_EMAIL && /controladoria/i.test(fallbackName))
  ) {
    return fallbackName;
  }
  return null;
}
