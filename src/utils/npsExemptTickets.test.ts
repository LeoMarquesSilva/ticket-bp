import { describe, expect, it } from 'vitest';
import { canUserFinishTicket } from './npsExemptTickets';

describe('canUserFinishTicket', () => {
  it('permite finalizar para usuário com a permissão, independentemente do cargo', () => {
    expect(canUserFinishTicket('user-1', true, 'user')).toBe(true);
  });
});
