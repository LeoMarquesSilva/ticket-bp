import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildTeamsAuthorizationUrl,
  createTeamsOAuthState,
  decryptRefreshToken,
  encryptRefreshToken,
  verifyTeamsOAuthState,
} from '../../supabase/functions/notify-ticket-communications/_shared/teamsDelegatedAuth.mjs';

const KEY = Buffer.from(Array.from({ length: 32 }, (_, index) => index + 1)).toString('base64');
const NOW = new Date('2026-08-28T18:00:00.000Z');

describe('Teams delegated OAuth', () => {
  it('gera autorização somente com os escopos delegados necessários e callback exato', () => {
    const url = new URL(buildTeamsAuthorizationUrl({
      tenantId: 'tenant-id',
      clientId: 'client-id',
      redirectUri: 'https://project.supabase.co/functions/v1/notify-ticket-communications/oauth/callback',
    }, 'signed-state'));

    expect(`${url.origin}${url.pathname}`).toBe(
      'https://login.microsoftonline.com/tenant-id/oauth2/v2.0/authorize',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'client-id',
      response_type: 'code',
      redirect_uri: 'https://project.supabase.co/functions/v1/notify-ticket-communications/oauth/callback',
      response_mode: 'query',
      scope: 'openid profile offline_access User.Read Chat.Create ChatMessage.Send',
      prompt: 'select_account',
      state: 'signed-state',
    });
  });

  it('aceita state assinado por dez minutos e rejeita adulteração ou expiração', async () => {
    const state = await createTeamsOAuthState({
      encryptionKey: KEY,
      now: () => NOW,
      randomBytes: () => new Uint8Array(16).fill(7),
      cryptoImpl: webcrypto,
    });

    await expect(verifyTeamsOAuthState(state, {
      encryptionKey: KEY,
      now: () => new Date('2026-08-28T18:09:59.000Z'),
      cryptoImpl: webcrypto,
    })).resolves.toEqual({ expiresAt: '2026-08-28T18:10:00.000Z' });
    await expect(verifyTeamsOAuthState(`${state.slice(0, -1)}x`, {
      encryptionKey: KEY,
      now: () => NOW,
      cryptoImpl: webcrypto,
    })).rejects.toThrow('invalid_oauth_state');
    await expect(verifyTeamsOAuthState(state, {
      encryptionKey: KEY,
      now: () => new Date('2026-08-28T18:10:01.000Z'),
      cryptoImpl: webcrypto,
    })).rejects.toThrow('expired_oauth_state');
  });

  it('cifra o refresh token com AES-GCM e detecta ciphertext adulterado', async () => {
    const encrypted = await encryptRefreshToken('refresh-token-secret', {
      encryptionKey: KEY,
      randomBytes: () => new Uint8Array(12).fill(9),
      cryptoImpl: webcrypto,
    });

    expect(encrypted).toEqual({
      ciphertext: expect.any(String),
      iv: 'CQkJCQkJCQkJCQkJ',
    });
    expect(encrypted.ciphertext).not.toContain('refresh-token-secret');
    await expect(decryptRefreshToken(encrypted, {
      encryptionKey: KEY,
      cryptoImpl: webcrypto,
    })).resolves.toBe('refresh-token-secret');

    const tampered = { ...encrypted, ciphertext: `${encrypted.ciphertext.slice(0, -1)}A` };
    await expect(decryptRefreshToken(tampered, {
      encryptionKey: KEY,
      cryptoImpl: webcrypto,
    })).rejects.toThrow('invalid_encrypted_refresh_token');
  });

  it('recusa chave que não tenha exatamente 32 bytes', async () => {
    await expect(encryptRefreshToken('refresh-token', {
      encryptionKey: Buffer.from('short').toString('base64'),
      cryptoImpl: webcrypto,
    })).rejects.toThrow('invalid_oauth_encryption_key');
  });
});
