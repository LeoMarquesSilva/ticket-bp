import {
  NPS_EXEMPT_CATEGORY_KEY,
  NPS_EXEMPT_SUBCATEGORY_KEY,
  isNpsExemptTicket,
} from '@/utils/npsExemptTickets';

/** Mesma categoria/subcategoria isenta de NPS — auditoria de evidência FATAL do SIOE. */
export const EVIDENCIA_FATAL_CATEGORY = NPS_EXEMPT_CATEGORY_KEY;
export const EVIDENCIA_FATAL_SUBCATEGORY = NPS_EXEMPT_SUBCATEGORY_KEY;

export type EvidenciaDecisaoCodigo = 'evidencia_ok' | 'evidencia_nao_ok';
export type EvidenciaDecisaoEfeito = 'excludente_mantida' | 'incluido_no_fatal';

/** Tickets abertos pelo financeiro-bp (SIOE) para auditoria de evidência FATAL. */
export function isEvidenciaFatalAuditTicket(
  category?: string | null,
  subcategory?: string | null,
): boolean {
  return isNpsExemptTicket(category ?? undefined, subcategory ?? undefined);
}

/**
 * Extrai o CI do texto gerado pelo SIOE.
 * Exemplos: "CI 847281", "– CI 847281 –"
 */
export function extractCiFromTicketText(
  title?: string | null,
  description?: string | null,
): string | null {
  const pattern = /CI\s+(\S+)/i;
  for (const text of [title, description]) {
    if (!text) continue;
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].replace(/[.,;:!?)]+$/, '');
    }
  }
  return null;
}

export function evidenciaDecisaoFromBoolean(evidenciaEnviada: boolean): {
  codigo: EvidenciaDecisaoCodigo;
  decisao: EvidenciaDecisaoEfeito;
} {
  if (evidenciaEnviada) {
    return { codigo: 'evidencia_ok', decisao: 'excludente_mantida' };
  }
  return { codigo: 'evidencia_nao_ok', decisao: 'incluido_no_fatal' };
}

/** Tenta inferir ano/mês a partir de datas do ticket (createdAt / resolvedAt). */
export function inferAnoMesFromIso(iso?: string | null): { ano?: number; mes?: number } {
  if (!iso) return {};
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return {};
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}
