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
