export const INVERSE_FLOW_CATEGORY_KEY = 'validacao_de_indicadores';
/** Chave real no banco: "Auditoria de Excludentes/Envio de Evidência" */
export const INVERSE_FLOW_SUBCATEGORY_KEY = 'auditoria_de_excludentes_envio_de_evidencia';

export function isInverseTicketFlow(category?: string, subcategory?: string): boolean {
  return (
    category === INVERSE_FLOW_CATEGORY_KEY &&
    subcategory === INVERSE_FLOW_SUBCATEGORY_KEY
  );
}

interface TicketForFinishCheck {
  category: string;
  subcategory?: string;
  assignedTo?: string;
}

export function canUserFinishTicket(
  ticket: TicketForFinishCheck,
  userId: string | undefined,
  hasFinishPermission: boolean,
  userRole?: string,
): boolean {
  if (!userId) return false;

  if (isInverseTicketFlow(ticket.category, ticket.subcategory)) {
    return ticket.assignedTo === userId;
  }

  return hasFinishPermission && userRole !== 'user';
}
