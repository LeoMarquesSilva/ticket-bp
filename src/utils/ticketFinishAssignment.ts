export type FinishAssignmentDecision = 'keep-current' | 'assign-to-finalizer';
export type FinishTicketStep = 'assignment-choice' | 'confirmation' | 'evidence';

interface InitialFinishTicketStepInput {
  assignedTo?: string;
  finalizerId?: string;
  isEvidenceAudit: boolean;
}

export function getFinishStepAfterAssignmentChoice(
  isEvidenceAudit: boolean,
): Exclude<FinishTicketStep, 'assignment-choice'> {
  return isEvidenceAudit ? 'evidence' : 'confirmation';
}

export function getInitialFinishTicketStep({
  assignedTo,
  finalizerId,
  isEvidenceAudit,
}: InitialFinishTicketStepInput): FinishTicketStep {
  if (assignedTo && finalizerId && assignedTo !== finalizerId) {
    return 'assignment-choice';
  }

  return getFinishStepAfterAssignmentChoice(isEvidenceAudit);
}

export function shouldAssignToFinalizer(
  assignedTo?: string,
  decision?: FinishAssignmentDecision,
): boolean {
  return !assignedTo || decision === 'assign-to-finalizer';
}

export function getFinishAssignmentCopy(assignedToName?: string) {
  const currentAssignee = assignedToName?.trim() || 'o responsável atual';
  return {
    description: `Este ticket está atribuído a ${currentAssignee}. Escolha como deseja contabilizar a finalização.`,
    keepLabel: `Finalizar com ${currentAssignee}`,
    assignLabel: 'Transferir para mim e finalizar',
  };
}
