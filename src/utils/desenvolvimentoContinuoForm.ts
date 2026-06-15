export const DESENVOLVIMENTO_CONTINUO_CATEGORY_KEY = 'desenvolvimento_continuo_equipe';

export interface DesenvolvimentoContinuoFormData {
  responsavelUserId: string;
  facilitadorUserId: string;
  tema: string;
  /** Sempre no formato DD/MM/AAAA */
  dataRealizacao: string;
  duracaoMinutos: string;
  area: string;
  precisaAjustePpt: 'sim' | 'nao' | '';
  linkPpt: string;
}

export function emptyDesenvolvimentoContinuoForm(): DesenvolvimentoContinuoFormData {
  return {
    responsavelUserId: '',
    facilitadorUserId: '',
    tema: '',
    dataRealizacao: '',
    duracaoMinutos: '',
    area: '',
    precisaAjustePpt: '',
    linkPpt: '',
  };
}

/** Aplica máscara DD/MM/AAAA enquanto o usuário digita. */
export function formatDateInputBr(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function parseDateBr(value: string): Date | undefined {
  const trimmed = value.trim();
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return undefined;

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (!match) return undefined;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }

  return date;
}

export function isValidDateBr(value: string): boolean {
  return parseDateBr(value) !== undefined;
}

function resolveUserName(
  userId: string,
  users: Array<{ id: string; name: string }>,
): string {
  return users.find((u) => u.id === userId)?.name?.trim() ?? '';
}

function resolveUserEmail(
  userId: string,
  users: Array<{ id: string; email: string }>,
): string {
  return users.find((u) => u.id === userId)?.email?.trim() ?? '';
}

export function isDesenvolvimentoContinuoCategory(categoryKey: string): boolean {
  return categoryKey === DESENVOLVIMENTO_CONTINUO_CATEGORY_KEY;
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateDesenvolvimentoContinuoForm(
  data: DesenvolvimentoContinuoFormData,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.responsavelUserId) {
    errors.responsavelUserId = 'Selecione o responsável (gerente da área)';
  }
  if (!data.facilitadorUserId) {
    errors.facilitadorUserId = 'Selecione o facilitador';
  }
  if (!data.tema.trim()) {
    errors.tema = 'Informe o tema';
  } else if (data.tema.trim().length < 3) {
    errors.tema = 'O tema deve ter pelo menos 3 caracteres';
  }
  if (!data.dataRealizacao.trim()) {
    errors.dataRealizacao = 'Informe a data da realização';
  } else if (!isValidDateBr(data.dataRealizacao)) {
    errors.dataRealizacao = 'Informe uma data válida no formato DD/MM/AAAA';
  }
  if (!data.duracaoMinutos.trim()) {
    errors.duracaoMinutos = 'Informe a duração em minutos';
  } else if (!/^\d+$/.test(data.duracaoMinutos.trim()) || Number(data.duracaoMinutos) <= 0) {
    errors.duracaoMinutos = 'Informe uma duração válida em minutos';
  }
  if (!data.area) {
    errors.area = 'Selecione a área';
  }
  if (!data.precisaAjustePpt) {
    errors.precisaAjustePpt = 'Informe se precisa de ajuste em PPT';
  }
  if (data.precisaAjustePpt === 'sim') {
    if (!data.linkPpt.trim()) {
      errors.linkPpt = 'Informe o link do PPT';
    } else if (!isValidUrl(data.linkPpt)) {
      errors.linkPpt = 'Informe um link válido (http ou https)';
    }
  }

  return errors;
}

export function buildDesenvolvimentoContinuoTitle(
  subcategoryLabel: string,
  tema: string,
): string {
  const title = `${subcategoryLabel} — ${tema.trim()}`;
  return title.length > 120 ? title.slice(0, 117) + '...' : title;
}

/** Texto armazenado na descrição do ticket (painel de detalhes e WhatsApp). */
export function buildDesenvolvimentoContinuoDescription(
  data: DesenvolvimentoContinuoFormData,
  subcategoryLabel: string,
  users: Array<{ id: string; name: string }>,
): string {
  const responsavel = resolveUserName(data.responsavelUserId, users);
  const facilitador = resolveUserName(data.facilitadorUserId, users);

  const lines = [
    `Tipo: ${subcategoryLabel}`,
    `Responsável (Gerente da área): ${responsavel}`,
    `Facilitador: ${facilitador}`,
    `Tema: ${data.tema.trim()}`,
    `Data da realização: ${data.dataRealizacao.trim()}`,
    `Duração: ${data.duracaoMinutos.trim()} minutos`,
    `Área: ${data.area}`,
    `Precisa de ajuste em PPT?: ${data.precisaAjustePpt === 'sim' ? 'Sim' : 'Não'}`,
  ];

  if (data.precisaAjustePpt === 'sim' && data.linkPpt.trim()) {
    lines.push(`Link do PPT: ${data.linkPpt.trim()}`);
  }

  return lines.join('\n');
}

/** Mensagem inicial enviada no chat com formatação estruturada. */
export function buildDesenvolvimentoContinuoChatMessage(
  data: DesenvolvimentoContinuoFormData,
  subcategoryLabel: string,
  categoryLabel: string,
  users: Array<{ id: string; name: string }>,
): string {
  const responsavel = resolveUserName(data.responsavelUserId, users);
  const facilitador = resolveUserName(data.facilitadorUserId, users);

  const lines = [
    `📋 **${categoryLabel} — ${subcategoryLabel}**`,
    '',
    `👤 **Responsável (Gerente da área):** ${responsavel}`,
    `🎯 **Facilitador:** ${facilitador}`,
    `📌 **Tema:** ${data.tema.trim()}`,
    `📅 **Data da realização:** ${data.dataRealizacao.trim()}`,
    `⏱️ **Duração:** ${data.duracaoMinutos.trim()} minutos`,
    `🏢 **Área:** ${data.area}`,
    `📊 **Precisa de ajuste em PPT?:** ${data.precisaAjustePpt === 'sim' ? 'Sim' : 'Não'}`,
  ];

  if (data.precisaAjustePpt === 'sim' && data.linkPpt.trim()) {
    lines.push(`🔗 **Link do PPT:** ${data.linkPpt.trim()}`);
  }

  return lines.join('\n');
}

export interface SharepointTreinamentoPayload {
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
}

export function buildSharepointTreinamentoPayload(
  data: DesenvolvimentoContinuoFormData,
  subcategoryLabel: string,
  users: Array<{ id: string; name: string; email: string }>,
): SharepointTreinamentoPayload {
  return {
    tema: data.tema.trim(),
    facilitador: resolveUserName(data.facilitadorUserId, users),
    responsavelEmail: resolveUserEmail(data.responsavelUserId, users),
    responsavelName: resolveUserName(data.responsavelUserId, users),
    dataRealizacao: data.dataRealizacao.trim(),
    area: data.area,
    subcategory: subcategoryLabel,
    duracaoMinutos: data.duracaoMinutos.trim(),
    precisaAjustePpt: data.precisaAjustePpt === 'sim',
    linkPpt: data.precisaAjustePpt === 'sim' ? data.linkPpt.trim() : undefined,
  };
}
