export const PRESENCA_MARKER = 'Presença:';
export const PRESENCA_NAO_PREENCHIDA = 'Presença: não preenchida';

export function descriptionAlreadyHasPresenca(description: string): boolean {
  return /(^|\n)\s*Presença:/m.test(description);
}

export function formatPresencaBlock(names: string[]): string {
  const unique = [
    ...new Set(names.map((name) => name.trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  if (unique.length === 0) return PRESENCA_NAO_PREENCHIDA;
  return `${PRESENCA_MARKER}\n${unique.map((name) => `- ${name}`).join('\n')}`;
}

/** Processa só depois que o dia do prazo (D+1) já passou. */
export function isPresencaDue(deadlineIso: string, todayIso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadlineIso)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayIso)) return false;
  return todayIso > deadlineIso;
}

export function appendPresencaBlock(description: string, names: string[]): string {
  const trimmed = description.trimEnd();
  return `${trimmed}\n\n${formatPresencaBlock(names)}`;
}

export function resolveColaboradorName(
  lookupId: string,
  lookupIdToEmail: Record<string, string>,
  emailToName: Record<string, string>,
): string | null {
  const email = lookupIdToEmail[String(lookupId)]?.trim().toLowerCase();
  if (!email) return null;
  const name = emailToName[email]?.trim();
  return name || email;
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

export function extractTicketIdFromDescription(description: string): string | null {
  const match = /Ticket ID:\s*([0-9a-f-]{36})/i.exec(description);
  return match?.[1] ?? null;
}
