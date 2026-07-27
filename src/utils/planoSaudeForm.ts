export const PLANO_SAUDE_CATEGORY_KEY = 'plano_saude';
export const PLANO_SAUDE_SUBCATEGORY_KEY = 'inclusao';

export function isPlanoSaudeSelection(categoryKey: string, subcategoryKey: string): boolean {
  return categoryKey === PLANO_SAUDE_CATEGORY_KEY && subcategoryKey === PLANO_SAUDE_SUBCATEGORY_KEY;
}

export type VinculoEmpresa = 'socio_servicos' | 'clt' | '';
export type VinculoDependente = 'conjuge' | 'filho' | 'outro' | '';

export interface PlanoSaudeFileAttachment {
  name: string;
  type: string;
  size: number;
  url: string;
}

export interface PlanoSaudeDependenteFormData {
  id: string;
  nomeCompleto: string;
  dataNascimento: string;
  vinculoComTitular: VinculoDependente;
  vinculoOutro: string;
  documentoIdentidade: File | null;
  comprovanteEndereco: File | null;
  email: string;
  telefone: string;
}

export interface PlanoSaudeFormData {
  nomeCompleto: string;
  dataNascimento: string;
  vinculoEmpresa: VinculoEmpresa;
  documentoIdentidade: File | null;
  comprovanteEndereco: File | null;
  email: string;
  telefone: string;
  incluirDependentes: 'sim' | 'nao' | '';
  dependentes: PlanoSaudeDependenteFormData[];
}

export type PlanoSaudeDependenteFichaData = Omit<
  PlanoSaudeDependenteFormData,
  'documentoIdentidade' | 'comprovanteEndereco'
> & {
  documentoIdentidade: PlanoSaudeFileAttachment | null;
  comprovanteEndereco: PlanoSaudeFileAttachment | null;
};

export type PlanoSaudeFichaData = Omit<
  PlanoSaudeFormData,
  'documentoIdentidade' | 'comprovanteEndereco' | 'dependentes'
> & {
  documentoIdentidade: PlanoSaudeFileAttachment | null;
  comprovanteEndereco: PlanoSaudeFileAttachment | null;
  dependentes: PlanoSaudeDependenteFichaData[];
};

export function createEmptyDependente(): PlanoSaudeDependenteFormData {
  return {
    id: crypto.randomUUID(),
    nomeCompleto: '',
    dataNascimento: '',
    vinculoComTitular: '',
    vinculoOutro: '',
    documentoIdentidade: null,
    comprovanteEndereco: null,
    email: '',
    telefone: '',
  };
}

export function emptyPlanoSaudeForm(): PlanoSaudeFormData {
  return {
    nomeCompleto: '',
    dataNascimento: '',
    vinculoEmpresa: '',
    documentoIdentidade: null,
    comprovanteEndereco: null,
    email: '',
    telefone: '',
    incluirDependentes: '',
    dependentes: [],
  };
}

export const VINCULO_EMPRESA_LABELS: Record<Exclude<VinculoEmpresa, ''>, string> = {
  socio_servicos: 'Sócio de serviços (Contrato Social)',
  clt: 'Colaborador CLT',
};

export const VINCULO_DEPENDENTE_LABELS: Record<Exclude<VinculoDependente, ''>, string> = {
  conjuge: 'Cônjuge / Companheiro(a)',
  filho: 'Filho(a)',
  outro: 'Outro',
};

/** Máscara simples de telefone BR: (11) 98765-4321 ou (11) 3456-7890 */
export function formatTelefoneBR(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Máscara de data BR: DD/MM/AAAA */
export function formatDateInputBR(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Valida data no formato DD/MM/AAAA */
export function isValidDateBR(value: string): boolean {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || year < 1900 || year > 2100) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Exibe data sempre em DD/MM/AAAA (aceita ISO YYYY-MM-DD ou já BR). */
export function formatDateBR(raw: string): string {
  if (!raw) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw.trim())) return raw.trim();
  const [year, month, day] = raw.split('-');
  if (!year || !month || !day) return raw;
  return `${day}/${month}/${year}`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validatePlanoSaudeForm(data: PlanoSaudeFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.nomeCompleto.trim()) {
    errors.nomeCompleto = 'Informe o nome completo';
  }
  if (!data.dataNascimento.trim()) {
    errors.dataNascimento = 'Informe a data de nascimento';
  } else if (!isValidDateBR(data.dataNascimento)) {
    errors.dataNascimento = 'Use o formato DD/MM/AAAA';
  }
  if (!data.vinculoEmpresa) {
    errors.vinculoEmpresa = 'Selecione o vínculo com a empresa';
  }
  if (!data.documentoIdentidade) {
    errors.documentoIdentidade = 'Anexe a cópia do RG ou CNH';
  }
  if (!data.comprovanteEndereco) {
    errors.comprovanteEndereco = 'Anexe o comprovante de endereço';
  }
  if (!data.email.trim()) {
    errors.email = 'Informe o e-mail';
  } else if (!isValidEmail(data.email)) {
    errors.email = 'Informe um e-mail válido';
  }
  if (!data.telefone.trim() || data.telefone.replace(/\D/g, '').length < 10) {
    errors.telefone = 'Informe um telefone válido';
  }

  if (!data.incluirDependentes) {
    errors.incluirDependentes = 'Informe se deseja incluir dependentes';
  } else if (data.incluirDependentes === 'sim') {
    if (data.dependentes.length === 0) {
      errors.dependentes = 'Adicione ao menos um dependente';
    }
    data.dependentes.forEach((dep, index) => {
      const prefix = `dep_${index}_`;
      if (!dep.nomeCompleto.trim()) {
        errors[`${prefix}nomeCompleto`] = 'Informe o nome completo do dependente';
      }
      if (!dep.dataNascimento.trim()) {
        errors[`${prefix}dataNascimento`] = 'Informe a data de nascimento';
      } else if (!isValidDateBR(dep.dataNascimento)) {
        errors[`${prefix}dataNascimento`] = 'Use o formato DD/MM/AAAA';
      }
      if (!dep.vinculoComTitular) {
        errors[`${prefix}vinculoComTitular`] = 'Selecione o vínculo com o titular';
      } else if (dep.vinculoComTitular === 'outro' && !dep.vinculoOutro.trim()) {
        errors[`${prefix}vinculoOutro`] = 'Descreva o vínculo';
      }
      if (!dep.documentoIdentidade) {
        errors[`${prefix}documentoIdentidade`] =
          'Anexe a certidão (casamento/nascimento), RG ou CNH';
      }
      if (!dep.comprovanteEndereco) {
        errors[`${prefix}comprovanteEndereco`] = 'Anexe o comprovante de endereço';
      }
      if (!dep.email.trim()) {
        errors[`${prefix}email`] = 'Informe o e-mail';
      } else if (!isValidEmail(dep.email)) {
        errors[`${prefix}email`] = 'Informe um e-mail válido';
      }
      if (!dep.telefone.trim() || dep.telefone.replace(/\D/g, '').length < 10) {
        errors[`${prefix}telefone`] = 'Informe um telefone válido';
      }
    });
  }

  return errors;
}

export interface PlanoSaudeRequester {
  name: string;
  department?: string;
}

function vinculoDependenteLabel(dep: Pick<PlanoSaudeDependenteFormData, 'vinculoComTitular' | 'vinculoOutro'>): string {
  if (dep.vinculoComTitular === 'outro') {
    return dep.vinculoOutro.trim() || 'Outro';
  }
  return dep.vinculoComTitular ? VINCULO_DEPENDENTE_LABELS[dep.vinculoComTitular] : '';
}

export function buildPlanoSaudeTitle(data: PlanoSaudeFormData): string {
  const deps =
    data.incluirDependentes === 'sim' && data.dependentes.length > 0
      ? ` + ${data.dependentes.length} dependente${data.dependentes.length > 1 ? 's' : ''}`
      : '';
  const title = `Inclusão Plano de Saúde — ${data.nomeCompleto.trim()}${deps}`;
  return title.length > 120 ? title.slice(0, 117) + '...' : title;
}

/** Texto simples armazenado na descrição do ticket. */
export function buildPlanoSaudeDescription(
  data: PlanoSaudeFormData,
  requester: PlanoSaudeRequester,
): string {
  const lines: (string | false | '')[] = [
    'AVISO IMPORTANTE: O escritório não concede subsídio para o plano de saúde. A adesão está disponível exclusivamente para sócios de serviços vinculados ao Contrato Social e colaboradores contratados sob o regime CLT.',
    '',
    `Solicitante: ${requester.name}`,
    requester.department ? `Área: ${requester.department}` : '',
    '',
    'Dados do titular:',
    `Nome completo: ${data.nomeCompleto.trim()}`,
    `Data de nascimento: ${formatDateBR(data.dataNascimento)}`,
    `Vínculo com a empresa: ${data.vinculoEmpresa ? VINCULO_EMPRESA_LABELS[data.vinculoEmpresa] : ''}`,
    `E-mail: ${data.email.trim()}`,
    `Telefone: ${data.telefone.trim()}`,
    'Documentos: RG/CNH e comprovante de endereço anexados no chat',
    '',
  ];

  if (data.incluirDependentes === 'sim' && data.dependentes.length > 0) {
    lines.push(`Dependentes (${data.dependentes.length}):`);
    data.dependentes.forEach((dep, index) => {
      lines.push('');
      lines.push(`Dependente ${index + 1}:`);
      lines.push(`Nome completo: ${dep.nomeCompleto.trim()}`);
      lines.push(`Data de nascimento: ${formatDateBR(dep.dataNascimento)}`);
      lines.push(`Vínculo com o titular: ${vinculoDependenteLabel(dep)}`);
      lines.push(`E-mail: ${dep.email.trim()}`);
      lines.push(`Telefone: ${dep.telefone.trim()}`);
      lines.push('Documentos: anexados no chat');
    });
  } else {
    lines.push('Dependentes: não');
  }

  return lines.filter((line): line is string => Boolean(line || line === '')).join('\n');
}

export function buildPlanoSaudeCardMessageText(data: PlanoSaudeFormData): string {
  const deps =
    data.incluirDependentes === 'sim' && data.dependentes.length > 0
      ? ` (${data.dependentes.length} dependente${data.dependentes.length > 1 ? 's' : ''})`
      : '';
  return `📋 Solicitação de Inclusão no Plano de Saúde enviada — ${data.nomeCompleto.trim()}${deps}.`;
}

/** Payload estruturado (campo `attachments` jsonb da mensagem) para o card + modal no chat. */
export interface PlanoSaudeFichaCardAttachment {
  kind: 'plano_saude_ficha';
  version: 1;
  requester: PlanoSaudeRequester;
  data: PlanoSaudeFichaData;
}

export async function uploadPlanoSaudeFiles(
  data: PlanoSaudeFormData,
  upload: (file: File) => Promise<PlanoSaudeFileAttachment>,
): Promise<PlanoSaudeFichaData> {
  const documentoIdentidade = data.documentoIdentidade
    ? await upload(data.documentoIdentidade)
    : null;
  const comprovanteEndereco = data.comprovanteEndereco
    ? await upload(data.comprovanteEndereco)
    : null;

  const dependentes: PlanoSaudeDependenteFichaData[] = [];
  for (const dep of data.incluirDependentes === 'sim' ? data.dependentes : []) {
    dependentes.push({
      id: dep.id,
      nomeCompleto: dep.nomeCompleto,
      dataNascimento: dep.dataNascimento,
      vinculoComTitular: dep.vinculoComTitular,
      vinculoOutro: dep.vinculoOutro,
      email: dep.email,
      telefone: dep.telefone,
      documentoIdentidade: dep.documentoIdentidade ? await upload(dep.documentoIdentidade) : null,
      comprovanteEndereco: dep.comprovanteEndereco ? await upload(dep.comprovanteEndereco) : null,
    });
  }

  return {
    nomeCompleto: data.nomeCompleto,
    dataNascimento: data.dataNascimento,
    vinculoEmpresa: data.vinculoEmpresa,
    email: data.email,
    telefone: data.telefone,
    incluirDependentes: data.incluirDependentes,
    documentoIdentidade,
    comprovanteEndereco,
    dependentes,
  };
}

export function buildPlanoSaudeFichaCardAttachment(
  fichaData: PlanoSaudeFichaData,
  requester: PlanoSaudeRequester,
): PlanoSaudeFichaCardAttachment {
  return {
    kind: 'plano_saude_ficha',
    version: 1,
    requester,
    data: fichaData,
  };
}

export { vinculoDependenteLabel };
