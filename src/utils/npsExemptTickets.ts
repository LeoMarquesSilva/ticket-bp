export const NPS_EXEMPT_CATEGORY_KEY = 'validacao_de_indicadores';
/** Chave real no banco: "Auditoria de Excludentes/Envio de Evidência" */
export const NPS_EXEMPT_SUBCATEGORY_KEY = 'auditoria_de_excludentes_envio_de_evidencia';

/** Tickets desta categoria/subcategoria são tratados como tickets comuns, mas não pedem avaliação (NPS) ao serem finalizados. */
export function isNpsExemptTicket(category?: string, subcategory?: string): boolean {
  return (
    category === NPS_EXEMPT_CATEGORY_KEY &&
    subcategory === NPS_EXEMPT_SUBCATEGORY_KEY
  );
}

export function canUserFinishTicket(
  userId: string | undefined,
  hasFinishPermission: boolean,
  userRole?: string,
): boolean {
  if (!userId) return false;
  return hasFinishPermission && userRole !== 'user';
}
