import { describe, expect, it, vi } from 'vitest';
import {
  readNamedSecret,
  resolveTicketCommunicationAuth,
} from '../../supabase/functions/notify-ticket-communications/_shared/requestAuth.mjs';

describe('readNamedSecret', () => {
  it('lê somente a chave nomeada do envelope JSON de secret keys', () => {
    expect(readNamedSecret(
      '{"default":"sb_secret_default","ticket-communications":"sb_secret_named"}',
      'ticket-communications',
    )).toBe('sb_secret_named');
    expect(readNamedSecret('{"default":"sb_secret_default"}', 'ticket-communications')).toBe('');
    expect(readNamedSecret('not-json', 'ticket-communications')).toBe('');
  });
});

describe('resolveTicketCommunicationAuth', () => {
  it('aceita JWT de usuário validado por getUser, inclusive HS256 sem JWKS', async () => {
    const getUser = vi.fn(async () => ({ id: 'user-1' }));

    await expect(resolveTicketCommunicationAuth({
      authorization: 'Bearer user-hs256-jwt',
      apikey: 'legacy-anon-jwt',
      namedSecret: 'sb_secret_named',
      getUser,
    })).resolves.toEqual({ authMode: 'user' });
    expect(getUser).toHaveBeenCalledWith('user-hs256-jwt');
  });

  it('não rebaixa JWT inválido para a secret key mesmo com apikey correta', async () => {
    const getUser = vi.fn(async () => null);

    await expect(resolveTicketCommunicationAuth({
      authorization: 'Bearer expired-or-unverified-jwt',
      apikey: 'sb_secret_named',
      namedSecret: 'sb_secret_named',
      getUser,
    })).resolves.toBeNull();
    expect(getUser).toHaveBeenCalledOnce();
  });

  it('aceita somente a secret key nomeada no header apikey quando não há Bearer', async () => {
    const getUser = vi.fn();

    await expect(resolveTicketCommunicationAuth({
      authorization: null,
      apikey: 'sb_secret_named',
      namedSecret: 'sb_secret_named',
      getUser,
    })).resolves.toEqual({ authMode: 'secret' });
    await expect(resolveTicketCommunicationAuth({
      authorization: '',
      apikey: 'legacy-anon-jwt',
      namedSecret: 'sb_secret_named',
      getUser,
    })).resolves.toBeNull();
    expect(getUser).not.toHaveBeenCalled();
  });
});
