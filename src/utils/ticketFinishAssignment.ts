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
  const currentAssignee = assignedToName?.trim();
  return {
    description: currentAssignee
      ? `Este ticket está com ${currentAssignee}. Escolha em nome de quem esta conclusão deve ser registrada.`
      : 'Este ticket já tem um responsável. Escolha em nome de quem esta conclusão deve ser registrada.',
    keepLabel: currentAssignee
      ? `Finalizar em nome de ${currentAssignee}`
      : 'Finalizar em nome do responsável atual',
    keepDescription: 'Mantém a atribuição atual e contabiliza a conclusão para essa pessoa.',
    assignLabel: 'Transferir para mim e finalizar',
    assignDescription: 'Transfere o ticket para você antes de concluir e contabiliza o atendimento no seu nome.',
  };
}
