import type { SharepointTreinamentoPayload } from '@/utils/desenvolvimentoContinuoForm';
import {
  certificadosDeadlineIso,
  isoDateFromBr,
  sendModesFor,
  type OrquestraiSendMode,
} from '@/utils/orquestraiSendMode';

function extractField(text: string, labels: string[]): string {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Aceita descrição plain e mensagem do chat com **negrito**/emoji opcional no início.
    const re = new RegExp(
      `(?:^|\\n)\\s*(?:[^\\w\\n*]{1,3}\\s*)?(?:\\*\\*)?${escaped}(?:\\*\\*)?\\s*:\\s*(.+?)\\s*(?=\\n|$)`,
      'i',
    );
    const match = re.exec(text);
    if (match?.[1]) return match[1].replace(/\*\*/g, '').trim();
  }
  return '';
}

/** Reconstrói o payload ORQESTRAI/SharePoint a partir da descrição (ou mensagem do chat) do ticket DC. */
export function parseDesenvolvimentoContinuoPayload(
  description: string,
  subcategoryLabelFallback = '',
): SharepointTreinamentoPayload | null {
  const text = String(description ?? '').trim();
  if (!text) return null;

  const tema = extractField(text, ['Tema']);
  if (!tema) return null;

  const subcategory =
    extractField(text, ['Tipo']) || subcategoryLabelFallback.trim();
  const responsavelName = extractField(text, [
    'Responsável (Gerente da área)',
    'Responsável',
  ]);
  const facilitador =
    extractField(text, ['Facilitadores', 'Facilitador(es)', 'Facilitador']) || '';
  const dataRealizacao = extractField(text, ['Data da realização', 'Data']);
  const duracaoRaw = extractField(text, ['Duração']);
  const duracaoMinutos = duracaoRaw.replace(/[^\d]/g, '') || '';
  const area = extractField(text, ['Área', 'Area']);
  const pptFlag = extractField(text, [
    'Precisa de ajuste em PPT?',
    'Precisa de ajuste em PPT',
  ]).toLowerCase();
  const precisaAjustePpt = pptFlag.startsWith('sim');
  const linkPpt = extractField(text, ['Link do PPT']) || undefined;

  return {
    tema,
    facilitador,
    responsavelEmail: '',
    responsavelName,
    dataRealizacao,
    area,
    subcategory,
    duracaoMinutos,
    precisaAjustePpt,
    linkPpt: precisaAjustePpt ? linkPpt : undefined,
  };
}

export type OrquestraiPreviewRow = {
  label: string;
  value: string;
};

export function buildOrquestraiPreviewRows(
  payload: SharepointTreinamentoPayload,
  ticketAppUrl?: string,
  sendMode: OrquestraiSendMode = payload.sendMode ?? 'certificados',
): OrquestraiPreviewRow[] {
  const types = sendModesFor(sendMode);
  const title = `[DC] ${payload.subcategory || 'Desenvolvimento Contínuo'} — ${payload.tema}`;
  const certificadosTitle = `[DC] Certificados — ${payload.tema}`;
  const pptDeadline = isoDateFromBr(payload.dataRealizacao) || payload.dataRealizacao || '—';
  const certDeadline =
    certificadosDeadlineIso(payload.dataRealizacao) || pptDeadline;

  const rows: OrquestraiPreviewRow[] = [
    {
      label: 'Título no ORQESTRAI',
      value: types.includes('Certificados') && types.includes('PPT')
        ? `${title} + ${certificadosTitle}`
        : types.includes('Certificados')
          ? certificadosTitle
          : title,
    },
    { label: 'Tipo de solicitação', value: types.join(' + ') },
    { label: 'Estágio', value: 'Tarefas' },
    { label: 'Designer (assignee)', value: 'Valentina Iacovacci' },
    {
      label: 'Prazo',
      value: types
        .map((type) =>
          type === 'Certificados'
            ? `Certificados: ${certDeadline}`
            : `PPT: ${pptDeadline}`,
        )
        .join(' · '),
    },
    { label: 'Área solicitante', value: payload.area || '—' },
    {
      label: 'Responsável (gerente)',
      value: payload.responsavelName || '—',
    },
    {
      label: 'E-mail do responsável',
      value: payload.responsavelEmail || '— (não encontrado no Responsum)',
    },
    { label: 'Facilitador(es)', value: payload.facilitador || '—' },
    { label: 'Tema', value: payload.tema },
    { label: 'Data da realização', value: payload.dataRealizacao || '—' },
    {
      label: 'Duração',
      value: payload.duracaoMinutos ? `${payload.duracaoMinutos} minutos` : '—',
    },
  ];

  if (types.includes('PPT')) {
    rows.push({
      label: 'Precisa de ajuste em PPT?',
      value: payload.precisaAjustePpt ? 'Sim' : 'Não',
    });
  }

  if (payload.precisaAjustePpt && payload.linkPpt) {
    rows.push({ label: 'Link do PPT', value: payload.linkPpt });
  }

  if (ticketAppUrl) {
    rows.push({ label: 'Link do ticket', value: ticketAppUrl });
  }

  rows.push({
    label: 'Origem',
    value: 'Responsum — Desenvolvimento Contínuo da Equipe',
  });

  return rows;
}

/** Enriquece o e-mail do responsável buscando pelo nome na lista de usuários. */
export function enrichResponsavelEmail(
  payload: SharepointTreinamentoPayload,
  users: Array<{ name: string; email: string }>,
): SharepointTreinamentoPayload {
  if (payload.responsavelEmail?.trim()) return payload;
  const name = payload.responsavelName.trim().toLowerCase();
  if (!name) return payload;

  const match = users.find((u) => u.name.trim().toLowerCase() === name);
  if (!match?.email) return payload;

  return { ...payload, responsavelEmail: match.email.trim() };
}
