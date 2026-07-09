export const REQUISICAO_PESSOAL_CATEGORY_KEY = 'formularios_requisicao_movimentacao';
export const REQUISICAO_PESSOAL_SUBCATEGORY_KEY = 'requisicao';

export function isRequisicaoPessoalSelection(categoryKey: string, subcategoryKey: string): boolean {
  return categoryKey === REQUISICAO_PESSOAL_CATEGORY_KEY && subcategoryKey === REQUISICAO_PESSOAL_SUBCATEGORY_KEY;
}

/**
 * Aplica máscara de moeda (R$ 1.234,56) a partir dos dígitos digitados,
 * tratando-os como centavos (padrão de caixa/PDV: os dígitos entram da
 * direita para a esquerda). Evita bugs de posição de cursor porque o valor
 * exibido é sempre recalculado a partir de todos os dígitos já digitados.
 */
export function formatCurrencyBRL(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const cents = parseInt(digits, 10);
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export type MotivoRequisicao = 'aumento_quadro' | 'reposicao' | '';
export type MotivoReposicao =
  | 'desligamento_empregado'
  | 'desligamento_empregador'
  | 'promocao'
  | 'transferencia'
  | 'afastamento'
  | '';
export type FaixaIdade = 'indiferente' | 'ate' | '';
export type Sexo = 'indiferente' | 'masculino' | 'feminino' | '';
export type Escolaridade = 'ensino_medio' | 'graduacao' | 'pos_graduacao' | '';
export type NivelExigencia = 'desejavel' | 'imprescindivel' | 'indiferente' | '';

export interface EquipamentoItem {
  necessario: 'sim' | 'nao' | '';
  valor: string;
}

export interface RequisicaoPessoalFormData {
  // Motivo da requisição
  motivo: MotivoRequisicao;
  justificativaAumentoQuadro: string;
  motivoReposicao: MotivoReposicao;
  nomeColaboradorSubstituido: string;
  cargoColaboradorSubstituido: string;
  justificativaReposicao: string;

  // Requisitos do candidato/cargo
  cargo: string;
  experienciaDesejada: string;
  atribuicoes: string;
  perfilCargo: string;
  faixaIdade: FaixaIdade;
  idadeAte: string;
  sexo: Sexo;
  escolaridade: Escolaridade;
  cursoEspecial: string;
  cursoEspecialNivel: NivelExigencia;

  // Remuneração
  remuneracaoSugerida: string;

  // Necessidade de licenças | equipamentos de TI | suprimentos
  estacaoTrabalho: EquipamentoItem;
  notebook: EquipamentoItem;
  mouseTecladoApoio: EquipamentoItem;
  licencaMicrosoft: EquipamentoItem;
  usuarioLegalOne: EquipamentoItem;

  // Aprovação do sócio
  aprovacaoSocio: 'sim' | 'nao' | '';
  anexoAprovacao: File | null;
}

const emptyEquipamento = (): EquipamentoItem => ({ necessario: '', valor: '' });

export function emptyRequisicaoPessoalForm(): RequisicaoPessoalFormData {
  return {
    motivo: '',
    justificativaAumentoQuadro: '',
    motivoReposicao: '',
    nomeColaboradorSubstituido: '',
    cargoColaboradorSubstituido: '',
    justificativaReposicao: '',

    cargo: '',
    experienciaDesejada: '',
    atribuicoes: '',
    perfilCargo: '',
    faixaIdade: '',
    idadeAte: '',
    sexo: '',
    escolaridade: '',
    cursoEspecial: '',
    cursoEspecialNivel: '',

    remuneracaoSugerida: '',

    estacaoTrabalho: emptyEquipamento(),
    notebook: emptyEquipamento(),
    mouseTecladoApoio: emptyEquipamento(),
    licencaMicrosoft: emptyEquipamento(),
    usuarioLegalOne: emptyEquipamento(),

    aprovacaoSocio: '',
    anexoAprovacao: null,
  };
}

export const MOTIVO_REPOSICAO_LABELS: Record<Exclude<MotivoReposicao, ''>, string> = {
  desligamento_empregado: 'Desligamento por iniciativa do empregado',
  desligamento_empregador: 'Desligamento por iniciativa do empregador',
  promocao: 'Promoção',
  transferencia: 'Transferência',
  afastamento: 'Afastamento',
};

export const ESCOLARIDADE_LABELS: Record<Exclude<Escolaridade, ''>, string> = {
  ensino_medio: 'Ensino Médio',
  graduacao: 'Graduação',
  pos_graduacao: 'Pós-Graduação',
};

export const SEXO_LABELS: Record<Exclude<Sexo, ''>, string> = {
  indiferente: 'Indiferente',
  masculino: 'Masculino',
  feminino: 'Feminino',
};

export const NIVEL_EXIGENCIA_LABELS: Record<Exclude<NivelExigencia, ''>, string> = {
  desejavel: 'Desejável',
  imprescindivel: 'Imprescindível',
  indiferente: 'Indiferente',
};

export function validateRequisicaoPessoalForm(data: RequisicaoPessoalFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.motivo) {
    errors.motivo = 'Selecione o motivo da requisição';
  } else if (data.motivo === 'aumento_quadro') {
    if (!data.justificativaAumentoQuadro.trim()) {
      errors.justificativaAumentoQuadro = 'Informe a justificativa do aumento de quadro';
    }
  } else if (data.motivo === 'reposicao') {
    if (!data.motivoReposicao) {
      errors.motivoReposicao = 'Selecione o motivo da reposição';
    }
    if (!data.nomeColaboradorSubstituido.trim()) {
      errors.nomeColaboradorSubstituido = 'Informe o nome do colaborador substituído';
    }
    if (!data.cargoColaboradorSubstituido.trim()) {
      errors.cargoColaboradorSubstituido = 'Informe o cargo do colaborador substituído';
    }
    if (!data.justificativaReposicao.trim()) {
      errors.justificativaReposicao = 'Informe a justificativa da reposição';
    }
  }

  if (!data.cargo.trim()) {
    errors.cargo = 'Informe o cargo da vaga';
  }

  if (!data.faixaIdade) {
    errors.faixaIdade = 'Selecione a faixa de idade';
  } else if (data.faixaIdade === 'ate' && !data.idadeAte.trim()) {
    errors.idadeAte = 'Informe a idade máxima';
  }

  if (!data.sexo) {
    errors.sexo = 'Selecione o sexo';
  }

  if (!data.escolaridade) {
    errors.escolaridade = 'Selecione a escolaridade mínima';
  }

  if (!data.remuneracaoSugerida.trim()) {
    errors.remuneracaoSugerida = 'Informe a remuneração sugerida';
  }

  (['estacaoTrabalho', 'notebook', 'mouseTecladoApoio', 'licencaMicrosoft', 'usuarioLegalOne'] as const).forEach((key) => {
    const item = data[key];
    if (!item.necessario) {
      errors[key] = 'Informe se é necessário';
    } else if (item.necessario === 'sim' && !item.valor.trim()) {
      errors[`${key}Valor`] = 'Informe o valor estimado';
    }
  });

  if (!data.aprovacaoSocio) {
    errors.aprovacaoSocio = 'Informe se já obteve o "de acordo" do sócio';
  } else if (data.aprovacaoSocio === 'sim' && !data.anexoAprovacao) {
    errors.anexoAprovacao = 'Anexe o print/comprovante do "de acordo" do sócio';
  }

  return errors;
}

export interface RequisicaoPessoalRequester {
  name: string;
  department?: string;
}

export function buildRequisicaoPessoalTitle(data: RequisicaoPessoalFormData): string {
  const motivoLabel = data.motivo === 'aumento_quadro' ? 'Aumento de Quadro' : data.motivo === 'reposicao' ? 'Reposição' : '';
  const title = motivoLabel
    ? `Requisição de Pessoal (${motivoLabel}) — ${data.cargo.trim()}`
    : `Requisição de Pessoal — ${data.cargo.trim()}`;
  return title.length > 120 ? title.slice(0, 117) + '...' : title;
}

export function motivoDescricaoLinha(data: RequisicaoPessoalFormData): string[] {
  if (data.motivo === 'aumento_quadro') {
    return [
      'Motivo: Aumento de Quadro',
      `Justificativa: ${data.justificativaAumentoQuadro.trim()}`,
    ];
  }
  if (data.motivo === 'reposicao') {
    return [
      'Motivo: Reposição',
      `Tipo de reposição: ${data.motivoReposicao ? MOTIVO_REPOSICAO_LABELS[data.motivoReposicao] : ''}`,
      `Colaborador substituído: ${data.nomeColaboradorSubstituido.trim()} (${data.cargoColaboradorSubstituido.trim()})`,
      `Justificativa: ${data.justificativaReposicao.trim()}`,
    ];
  }
  return [];
}

export function idadeDescricao(data: RequisicaoPessoalFormData): string {
  if (data.faixaIdade === 'ate') return `Até ${data.idadeAte.trim()} anos`;
  return 'Indiferente';
}

/** Itens de equipamento/licença marcados como necessários, com o valor estimado (para renderização em grid). */
export function equipamentosSolicitados(data: RequisicaoPessoalFormData): Array<{ label: string; valor: string }> {
  const itens: Array<[string, EquipamentoItem]> = [
    ['Estação de trabalho | Cadeira', data.estacaoTrabalho],
    ['Notebook', data.notebook],
    ['Mouse | Teclado | Apoio', data.mouseTecladoApoio],
    ['Licença da Microsoft', data.licencaMicrosoft],
    ['Usuário do Legal One', data.usuarioLegalOne],
  ];
  return itens
    .filter(([, item]) => item.necessario === 'sim')
    .map(([label, item]) => ({ label, valor: item.valor.trim() }));
}

/** Lista apenas os itens marcados como necessários (evita ruído de "Não" repetido). */
function equipamentosLinhas(data: RequisicaoPessoalFormData, bullet: string): string[] {
  const solicitados = equipamentosSolicitados(data);
  if (solicitados.length === 0) {
    return ['Nenhum equipamento ou licença adicional solicitado.'];
  }
  return solicitados.map(({ label, valor }) => `${bullet} ${label} (valor estimado: ${valor})`);
}

/** Texto simples armazenado na descrição do ticket. */
export function buildRequisicaoPessoalDescription(
  data: RequisicaoPessoalFormData,
  requester: RequisicaoPessoalRequester,
): string {
  const lines = [
    `Solicitante: ${requester.name}`,
    requester.department && `Área: ${requester.department}`,
    '',
    ...motivoDescricaoLinha(data),
    '',
    'Requisitos do candidato / cargo:',
    `Cargo: ${data.cargo.trim()}`,
    data.experienciaDesejada.trim() && `Experiência desejada: ${data.experienciaDesejada.trim()}`,
    data.atribuicoes.trim() && `Atribuições do cargo: ${data.atribuicoes.trim()}`,
    data.perfilCargo.trim() && `Perfil desejado: ${data.perfilCargo.trim()}`,
    `Idade: ${idadeDescricao(data)}`,
    `Sexo: ${data.sexo ? SEXO_LABELS[data.sexo] : ''}`,
    `Escolaridade: ${data.escolaridade ? ESCOLARIDADE_LABELS[data.escolaridade] : ''}`,
    data.cursoEspecial.trim() &&
      `Curso especial: ${data.cursoEspecial.trim()} (${data.cursoEspecialNivel ? NIVEL_EXIGENCIA_LABELS[data.cursoEspecialNivel] : 'Indiferente'})`,
    '',
    `Remuneração sugerida: ${data.remuneracaoSugerida.trim()}`,
    '',
    'Licenças | Equipamentos de TI | Suprimentos:',
    ...equipamentosLinhas(data, '-'),
    '',
    `Já obteve o "de acordo" do sócio?: ${data.aprovacaoSocio === 'sim' ? 'Sim (comprovante anexado no chat)' : 'Não'}`,
  ].filter((line): line is string => Boolean(line || line === ''));

  return lines.join('\n');
}

/** Texto curto que acompanha o card da ficha no chat (o detalhamento fica no modal). */
export function buildRequisicaoPessoalCardMessageText(data: RequisicaoPessoalFormData): string {
  return `📋 Ficha de Requisição de Pessoal enviada — ${data.cargo.trim()}.`;
}

export interface RequisicaoPessoalApprovalAttachment {
  name: string;
  type: string;
  size: number;
  url: string;
}

/** Payload estruturado (guardado no campo `attachments`, jsonb, da mensagem) usado para renderizar o card + modal da ficha no chat. */
export interface RequisicaoPessoalFichaCardAttachment {
  kind: 'requisicao_pessoal_ficha';
  version: 1;
  requester: RequisicaoPessoalRequester;
  data: Omit<RequisicaoPessoalFormData, 'anexoAprovacao'>;
  approvalAttachment: RequisicaoPessoalApprovalAttachment | null;
}

export function buildRequisicaoPessoalFichaCardAttachment(
  data: RequisicaoPessoalFormData,
  requester: RequisicaoPessoalRequester,
  approvalAttachment: RequisicaoPessoalApprovalAttachment | null = null,
): RequisicaoPessoalFichaCardAttachment {
  const { anexoAprovacao: _anexoAprovacao, ...rest } = data;
  return {
    kind: 'requisicao_pessoal_ficha',
    version: 1,
    requester,
    data: rest,
    approvalAttachment,
  };
}
