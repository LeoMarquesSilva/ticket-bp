import { describe, expect, it } from 'vitest';
import { matchesUserTicketFilter } from './ticketFiltersUtils';

const USER_ID = 'user-1';
const OTHER_ID = 'user-2';

describe('matchesUserTicketFilter', () => {
  it('retorna true para all', () => {
    expect(
      matchesUserTicketFilter({ createdBy: OTHER_ID, assignedTo: OTHER_ID }, USER_ID, 'all')
    ).toBe(true);
  });

  it('mine inclui ticket criado por mim', () => {
    expect(
      matchesUserTicketFilter({ createdBy: USER_ID, assignedTo: OTHER_ID }, USER_ID, 'mine')
    ).toBe(true);
  });

  it('mine inclui ticket atribuído a mim', () => {
    expect(
      matchesUserTicketFilter({ createdBy: OTHER_ID, assignedTo: USER_ID }, USER_ID, 'mine')
    ).toBe(true);
  });

  it('mine exclui ticket que não é meu', () => {
    expect(
      matchesUserTicketFilter({ createdBy: OTHER_ID, assignedTo: OTHER_ID }, USER_ID, 'mine')
    ).toBe(false);
  });

  it('filtro por responsável específico inclui apenas assignedTo igual', () => {
    expect(
      matchesUserTicketFilter({ createdBy: USER_ID, assignedTo: OTHER_ID }, USER_ID, OTHER_ID)
    ).toBe(true);
    expect(
      matchesUserTicketFilter({ createdBy: USER_ID, assignedTo: USER_ID }, USER_ID, OTHER_ID)
    ).toBe(false);
  });
});
