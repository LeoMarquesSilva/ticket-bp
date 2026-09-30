import { describe, expect, it } from 'vitest';
import { buildLinkedTicketTitle, canOpenLinkedTicket, LINKED_TICKET_TITLE_MAX } from './linkedTicket';

const resolved = { status: 'resolved', createdBy: 'requester', assignedTo: 'agent' };
const noPerms = { canAssign: false, canFinish: false };

describe('buildLinkedTicketTitle', () => {
  it('prefixa o título original', () => {
    expect(buildLinkedTicketTitle('Acesso ao sistema')).toBe('Continuação: Acesso ao sistema');
  });

  it('não empilha o prefixo em continuações de continuações', () => {
    expect(buildLinkedTicketTitle('Continuação: Continuação: Acesso')).toBe('Continuação: Acesso');
  });

  it('respeita o limite de tamanho', () => {
    expect(buildLinkedTicketTitle('x'.repeat(500))).toHaveLength(LINKED_TICKET_TITLE_MAX);
  });
});

describe('canOpenLinkedTicket', () => {
  it('libera o solicitante e o responsável', () => {
    expect(canOpenLinkedTicket(resolved, 'requester', noPerms)).toBe(true);
    expect(canOpenLinkedTicket(resolved, 'agent', noPerms)).toBe(true);
  });

  it('libera a equipe com permissão de atribuir ou finalizar', () => {
    expect(canOpenLinkedTicket(resolved, 'other', { canAssign: true, canFinish: false })).toBe(true);
    expect(canOpenLinkedTicket(resolved, 'other', { canAssign: false, canFinish: true })).toBe(true);
  });

  it('bloqueia terceiros sem permissão', () => {
    expect(canOpenLinkedTicket(resolved, 'other', noPerms)).toBe(false);
  });

  it('só vale para chamados finalizados', () => {
    expect(canOpenLinkedTicket({ ...resolved, status: 'in_progress' }, 'requester', noPerms)).toBe(false);
  });

  it('exige usuário logado', () => {
    expect(canOpenLinkedTicket(resolved, undefined, { canAssign: true, canFinish: true })).toBe(false);
  });
});
