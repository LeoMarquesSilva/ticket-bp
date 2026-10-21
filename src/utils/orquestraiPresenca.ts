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

/** Tira o bloco "Presença:" que uma consulta anterior deixou no fim da descrição. */
export function stripPresencaBlock(description: string): string {
  return description.replace(/(?:^|\n)\s*Presença:[\s\S]*$/, '').trimEnd();
}

export function appendPresencaBlock(description: string, names: string[]): string {
  return `${stripPresencaBlock(description)}\n\n${formatPresencaBlock(names)}`;
}

function normalizeTreinamentoTitle(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * O mesmo workshop às vezes é aberto em mais de um ticket (ex.: o gerente e o
 * facilitador abrem cada um o seu), e cada ticket cria um item na lista de
 * Treinamentos. Quem marca presença escolhe o treinamento pelo nome e pode
 * cair em qualquer um deles, então itens com o mesmo nome e a mesma data
 * contam como o mesmo treinamento.
 */
export function isSameTreinamento(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined,
): boolean {
  const titleA = normalizeTreinamentoTitle(a?.NomedoTreinamento ?? a?.Title);
  const dateA = String(a?.Data ?? '').slice(0, 10);
  if (!titleA || !dateA) return false;
  return (
    titleA === normalizeTreinamentoTitle(b?.NomedoTreinamento ?? b?.Title) &&
    dateA === String(b?.Data ?? '').slice(0, 10)
  );
}

const CONTROLADORIA_EMAIL = 'controladoria@bpplaw.com.br';

/** Parte antes do @: o domínio mudou de bpplaw.com.br para bismarchipires.com.br. */
export function emailLocalPart(email: string): string {
  return email.trim().toLowerCase().split('@')[0] ?? '';
}

/**
 * Nome completo por parte local do e-mail. A ordem das fontes é a prioridade:
 * a primeira que tiver o e-mail define o nome.
 */
export function buildNameDirectory(
  ...sources: Array<Array<{ name?: string | null; email?: string | null }>>
): Record<string, string> {
  const directory: Record<string, string> = {};
  for (const source of sources) {
    for (const person of source) {
      const name = String(person.name ?? '').trim();
      const localPart = emailLocalPart(String(person.email ?? ''));
      if (name && localPart && !(localPart in directory)) directory[localPart] = name;
    }
  }
  return directory;
}

export type ColaboradorDirectory = {
  /** LookupId → pessoa, da "Lista de Informações de Utilizadores" do site. */
  siteUsers: Record<string, { name: string; email: string }>;
  /** Mapa antigo e-mail/nome → LookupId (sharepoint_person_lookups), invertido. */
  lookupIdToEmail: Record<string, string>;
  /** Parte local do e-mail → nome completo do cadastro. */
  namesByLocalPart: Record<string, string>;
};

function nameFromEmail(email: string, directory: ColaboradorDirectory): string | null {
  const localPart = emailLocalPart(email);
  return localPart ? directory.namesByLocalPart[localPart] ?? null : null;
}

/**
 * Nome completo de quem marcou presença. O LookupId da coluna Colaborador
 * aponta para a lista de usuários do site, que dá o e-mail; com ele vem o nome
 * do cadastro. Sem cadastro, fica o nome de exibição do Microsoft 365.
 */
export function resolveColaboradorName(
  lookupId: string,
  directory: ColaboradorDirectory,
  createdByName?: string | null,
  createdByEmail?: string | null,
): string | null {
  const siteUser = directory.siteUsers[String(lookupId)];
  if (siteUser) {
    const fromCadastro = siteUser.email ? nameFromEmail(siteUser.email, directory) : null;
    const name = fromCadastro || siteUser.name.trim() || siteUser.email.trim();
    if (name) return name;
  }

  const legacy = directory.lookupIdToEmail[String(lookupId)]?.trim().toLowerCase();
  if (legacy?.includes('@')) return nameFromEmail(legacy, directory) || legacy;

  const fallbackEmail = createdByEmail?.trim().toLowerCase() ?? '';
  const fallbackName = createdByName?.trim() ?? '';
  if (
    fallbackName &&
    !(fallbackEmail === CONTROLADORIA_EMAIL && /controladoria/i.test(fallbackName))
  ) {
    return (fallbackEmail && nameFromEmail(fallbackEmail, directory)) || fallbackName;
  }
  return legacy || null;
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
