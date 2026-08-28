import { webcrypto } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createTeamsOAuthState } from '../../supabase/functions/notify-ticket-communications/_shared/teamsDelegatedAuth.mjs';
import {
  handleTeamsOAuthAction,
  handleTeamsOAuthCallback,
  handleTeamsTestSend,
} from '../../supabase/functions/notify-ticket-communications/_shared/teamsOAuthHandler.mjs';

const KEY = Buffer.alloc(32, 11).toString('base64');
const CONFIG = {
  tenantId: 'tenant-id',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'https://project.supabase.co/functions/v1/notify-ticket-communications/oauth/callback',
  tokenEncryptionKey: KEY,
  appPublicUrl: 'https://www.responsum.com.br',
};
const NOW = new Date('2026-08-28T18:00:00.000Z');

function client() {
  return {
    getStatus: vi.fn(async () => ({
      connected: true,
      accountEmail: 'leonardo.marques@bismarchipires.com.br',
      accountDisplayName: 'Leonardo Marques',
      connectedAt: NOW.toISOString(),
    })),
    disconnect: vi.fn(async () => undefined),
    exchangeCode: vi.fn(async () => ({ connected: true })),
  };
}

describe('handleTeamsOAuthAction', () => {
  it('recusa ações administrativas sem usuário autorizado', async () => {
    const teamsClient = client();

    await expect(handleTeamsOAuthAction({
      authMode: 'secret',
      body: { action: 'teams_oauth_status' },
      isAdmin: true,
      config: CONFIG,
      teamsClient,
      cryptoImpl: webcrypto,
    })).resolves.toEqual({ status: 403, body: { error: 'forbidden' } });
    await expect(handleTeamsOAuthAction({
      authMode: 'user',
      body: { action: 'teams_oauth_status' },
      isAdmin: false,
      config: CONFIG,
      teamsClient,
      cryptoImpl: webcrypto,
    })).resolves.toEqual({ status: 403, body: { error: 'forbidden' } });
    expect(teamsClient.getStatus).not.toHaveBeenCalled();
  });

  it('retorna status sem credenciais e gera URL assinada para conexão', async () => {
    const teamsClient = client();
    const status = await handleTeamsOAuthAction({
      authMode: 'user',
      body: { action: 'teams_oauth_status' },
      isAdmin: true,
      config: CONFIG,
      teamsClient,
      now: () => NOW,
      cryptoImpl: webcrypto,
    });
    const start = await handleTeamsOAuthAction({
      authMode: 'user',
      body: { action: 'teams_oauth_start' },
      isAdmin: true,
      config: CONFIG,
      teamsClient,
      now: () => NOW,
      randomBytes: () => new Uint8Array(16).fill(3),
      cryptoImpl: webcrypto,
    });

    expect(status).toEqual({ status: 200, body: { ok: true, teams: await teamsClient.getStatus() } });
    expect(JSON.stringify(status)).not.toContain('token');
    expect(start.status).toBe(200);
    const authorizationUrl = new URL(start.body.authorizationUrl);
    expect(authorizationUrl.hostname).toBe('login.microsoftonline.com');
    expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(CONFIG.redirectUri);
    expect(authorizationUrl.searchParams.get('state')).toBeTruthy();
  });

  it('desconecta a única conta e rejeita campos extras', async () => {
    const teamsClient = client();
    await expect(handleTeamsOAuthAction({
      authMode: 'user',
      body: { action: 'teams_oauth_disconnect' },
      isAdmin: true,
      config: CONFIG,
      teamsClient,
      cryptoImpl: webcrypto,
    })).resolves.toEqual({ status: 200, body: { ok: true } });
    expect(teamsClient.disconnect).toHaveBeenCalledOnce();

    await expect(handleTeamsOAuthAction({
      authMode: 'user',
      body: { action: 'teams_oauth_start', redirectUri: 'https://attacker.invalid' },
      isAdmin: true,
      config: CONFIG,
      teamsClient,
      cryptoImpl: webcrypto,
    })).resolves.toEqual({ status: 400, body: { error: 'invalid_body' } });
  });
});

describe('handleTeamsOAuthCallback', () => {
  it('valida state, troca o código e volta diretamente à aba Comunicações', async () => {
    const state = await createTeamsOAuthState({
      encryptionKey: KEY,
      now: () => NOW,
      randomBytes: () => new Uint8Array(16).fill(5),
      cryptoImpl: webcrypto,
    });
    const teamsClient = client();
    const result = await handleTeamsOAuthCallback({
      url: new URL(`${CONFIG.redirectUri}?code=authorization-code&state=${encodeURIComponent(state)}`),
      config: CONFIG,
      teamsClient,
      now: () => NOW,
      cryptoImpl: webcrypto,
    });

    expect(teamsClient.exchangeCode).toHaveBeenCalledWith('authorization-code');
    expect(result).toEqual({
      status: 302,
      location: 'https://www.responsum.com.br/categories?tab=comunicacoes&teams=connected',
    });
  });

  it('não troca código com state inválido nem expõe erro do provedor', async () => {
    const teamsClient = client();
    await expect(handleTeamsOAuthCallback({
      url: new URL(`${CONFIG.redirectUri}?code=authorization-code&state=invalid`),
      config: CONFIG,
      teamsClient,
      now: () => NOW,
      cryptoImpl: webcrypto,
    })).resolves.toEqual({ status: 400, body: { error: 'invalid_oauth_state' } });
    expect(teamsClient.exchangeCode).not.toHaveBeenCalled();
  });
});

describe('handleTeamsTestSend', () => {
  it('envia o cartão configurado para um e-mail corporativo escolhido', async () => {
    const resolveUserId = vi.fn(async () => 'entra-user-1');
    const sendChat = vi.fn(async () => undefined);

    await expect(handleTeamsTestSend({
      authMode: 'user',
      isAdmin: true,
      email: 'samuel.silva@bpplaw.com.br',
      type: 'awaiting_requester',
      appPublicUrl: CONFIG.appPublicUrl,
      resolveUserId,
      sendChat,
      teamsTemplateOverrides: {
        awaiting_requester: { reason: 'Responda no teste.', action: 'Abrir teste' },
      },
    })).resolves.toEqual({ status: 200, body: { ok: true } });
    expect(resolveUserId).toHaveBeenCalledWith('samuel.silva@bpplaw.com.br');
    expect(sendChat).toHaveBeenCalledWith(expect.objectContaining({
      recipientUserId: 'entra-user-1',
      previewText: 'Responda no teste.',
      label: 'Abrir teste',
      html: expect.stringContaining('RESPONSUM'),
      card: expect.objectContaining({ type: 'AdaptiveCard' }),
    }));
  });

  it('recusa destinatário externo, secret key ou ausência no Entra sem vazar o provedor', async () => {
    const resolveUserId = vi.fn(async () => null);
    const sendChat = vi.fn();

    await expect(handleTeamsTestSend({
      authMode: 'secret',
      isAdmin: true,
      email: 'leonardo.marques@bismarchipires.com.br',
      appPublicUrl: CONFIG.appPublicUrl,
      resolveUserId,
      sendChat,
    })).resolves.toEqual({ status: 403, body: { error: 'forbidden' } });
    await expect(handleTeamsTestSend({
      authMode: 'user',
      isAdmin: true,
      email: 'alguem@gmail.com',
      appPublicUrl: CONFIG.appPublicUrl,
      resolveUserId,
      sendChat,
    })).resolves.toEqual({ status: 400, body: { error: 'invalid_recipient' } });
    await expect(handleTeamsTestSend({
      authMode: 'user',
      isAdmin: true,
      email: 'nao-e-email',
      appPublicUrl: CONFIG.appPublicUrl,
      resolveUserId,
      sendChat,
    })).resolves.toEqual({ status: 400, body: { error: 'invalid_recipient' } });
    await expect(handleTeamsTestSend({
      authMode: 'user',
      isAdmin: true,
      email: 'leonardo.marques@bismarchipires.com.br',
      appPublicUrl: CONFIG.appPublicUrl,
      resolveUserId,
      sendChat,
    })).resolves.toEqual({ status: 404, body: { error: 'entra_user_not_found' } });
    expect(sendChat).not.toHaveBeenCalled();
  });

  it('devolve o código sanitizado do Graph quando a entrega falha', async () => {
    const error = Object.assign(new Error('Microsoft Graph failed'), {
      status: 403,
      code: 'ErrorAccessDenied',
      graphMessage: 'Missing scope permissions on the request.',
    });

    await expect(handleTeamsTestSend({
      authMode: 'user',
      isAdmin: true,
      email: 'leonardo.marques@bismarchipires.com.br',
      appPublicUrl: CONFIG.appPublicUrl,
      resolveUserId: async () => 'entra-user-1',
      sendChat: async () => {
        throw error;
      },
    })).resolves.toEqual({
      status: 502,
      body: { error: 'delivery_error', code: 'ErrorAccessDenied', detail: 'Missing scope permissions on the request.' },
    });
  });
});
