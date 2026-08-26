import { parseDateBr } from '@/utils/desenvolvimentoContinuoForm';

export const ORQUESTRAI_SEND_MODES = [
  'ppt',
  'certificados',
  'ppt_e_certificados',
] as const;

export type OrquestraiSendMode = (typeof ORQUESTRAI_SEND_MODES)[number];

export type OrquestraiRequestType = 'PPT' | 'Certificados';

export const PRESENCA_LIST_URL =
  'https://bpplaw2.sharepoint.com/sites/CONTROLADORIAJURDICA/Lists/TREINAMENTOS%20%20OPERAES%20LEGAIS?env=WebViewList';

export const PRESENCA_LIST_ID = '30ea2880-475e-489c-8600-ae541d29faf3';

export function isOrquestraiSendMode(value: unknown): value is OrquestraiSendMode {
  return (
    value === 'ppt' ||
    value === 'certificados' ||
    value === 'ppt_e_certificados'
  );
}

export function defaultSendMode(precisaAjustePpt: boolean): OrquestraiSendMode {
  return precisaAjustePpt ? 'ppt' : 'certificados';
}

export function sendModesFor(mode: OrquestraiSendMode): OrquestraiRequestType[] {
  if (mode === 'ppt') return ['PPT'];
  if (mode === 'certificados') return ['Certificados'];
  return ['PPT', 'Certificados'];
}

export function includesPpt(mode: OrquestraiSendMode): boolean {
  return sendModesFor(mode).includes('PPT');
}

export function includesCertificados(mode: OrquestraiSendMode): boolean {
  return sendModesFor(mode).includes('Certificados');
}

export function isoDateFromBr(value: string): string | null {
  const date = parseDateBr(value);
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Data do workshop + 1 dia civil → YYYY-MM-DD. */
export function certificadosDeadlineIso(dataRealizacaoBr: string): string | null {
  const date = parseDateBr(dataRealizacaoBr);
  if (!date) return null;
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildCertificadosTitle(tema: string, subcategory?: string): string {
  const tipo = subcategory?.trim() || 'Desenvolvimento Contínuo';
  const title = `[DC] Certificados — ${tema.trim() || tipo}`;
  return title.length > 180 ? `${title.slice(0, 177)}...` : title;
}

export function sendModeLabel(mode: OrquestraiSendMode): string {
  if (mode === 'ppt') return 'PPT';
  if (mode === 'certificados') return 'Apenas certificados';
  return 'PPT + certificados';
}
