import { describe, expect, it } from 'vitest';
import {
  getFinishAssignmentCopy,
  getFinishStepAfterAssignmentChoice,
  getInitialFinishTicketStep,
  shouldAssignToFinalizer,
} from './ticketFinishAssignment';

describe('ticketFinishAssignment', () => {
  it('mantém a confirmação normal quando o ticket pertence ao finalizador', () => {
    expect(getInitialFinishTicketStep({
      assignedTo: 'user-1',
      finalizerId: 'user-1',
      isEvidenceAudit: false,
    })).toBe('confirmation');
  });

  it('pede escolha quando o ticket pertence a outra pessoa', () => {
    expect(getInitialFinishTicketStep({
      assignedTo: 'user-2',
      finalizerId: 'user-1',
      isEvidenceAudit: false,
    })).toBe('assignment-choice');
  });

  it('atribui ticket sem responsável automaticamente ao finalizador', () => {
    expect(shouldAssignToFinalizer(undefined)).toBe(true);
  });

  it('mantém o responsável quando essa opção é escolhida', () => {
    expect(shouldAssignToFinalizer('user-2', 'keep-current')).toBe(false);
  });

  it('atribui ao finalizador quando essa opção é escolhida', () => {
    expect(shouldAssignToFinalizer('user-2', 'assign-to-finalizer')).toBe(true);
  });

  it('leva auditoria FATAL à evidência depois da escolha de responsável', () => {
    expect(getFinishStepAfterAssignmentChoice(true)).toBe('evidence');
  });

  it('leva ticket FATAL sem responsável direto à evidência e exige atribuição', () => {
    expect(getInitialFinishTicketStep({
      assignedTo: undefined,
      finalizerId: 'user-1',
      isEvidenceAudit: true,
    })).toBe('evidence');
    expect(shouldAssignToFinalizer(undefined)).toBe(true);
  });

  it('identifica o responsável atual nas opções de finalização', () => {
    expect(getFinishAssignmentCopy('Ana')).toEqual({
      description: 'Este ticket está atribuído a Ana. Escolha como deseja contabilizar a finalização.',
      keepLabel: 'Finalizar com Ana',
      assignLabel: 'Transferir para mim e finalizar',
    });
  });

  it('usa texto seguro quando o nome do responsável não está disponível', () => {
    expect(getFinishAssignmentCopy(undefined).keepLabel)
      .toBe('Finalizar com o responsável atual');
  });
});
