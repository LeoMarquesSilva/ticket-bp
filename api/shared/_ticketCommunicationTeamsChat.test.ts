import { webcrypto } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { encryptRefreshToken } from '../../supabase/functions/notify-ticket-communications/_shared/teamsDelegatedAuth.mjs';
import { createTeamsChatClient } from '../../supabase/functions/notify-ticket-communications/_shared/teamsChatClient.mjs';

const KEY = Buffer.from(Array.from({ length: 32 }, (_, index) => index + 20)).toString('base64');
const CONFIG = {
  tenantId: 'tenant-id',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'https://project.supabase.co/functions/v1/notify-ticket-communications/oauth/callback',
  tokenEncryptionKey: KEY,
};
const ACCOUNT = {
  accountId: '11111111-1111-1111-1111-111111111111',
  accountEmail: 'leonardo.marques@bismarchipires.com.br',
  accountDisplayName: 'Leonardo Marques',
  connectedAt: '2026-08-28T18:00:00.000Z',
  updatedAt: '2026-08-28T18:00:00.000Z',
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('createTeamsChatClient', () => {
  it('troca o código, identifica /me e persiste apenas o refresh token cifrado', async () => {
    const store = { get: vi.fn(), save: vi.fn(async (value) => ({ ...value, updatedAt: value.connectedAt })), disconnect: vi.fn() };
    const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
      if (input.includes('/token')) {
        expect(String(init?.body)).toBe(new URLSearchParams({
          client_id: 'client-id',
          client_secret: 'client-secret',
          grant_type: 'authorization_code',
          code: 'authorization-code',
          redirect_uri: CONFIG.redirectUri,
          scope: 'openid profile offline_access User.Read Chat.Create ChatMessage.Send',
        }).toString());
        return jsonResponse(200, { access_token: 'delegated-access', refresh_token: 'refresh-token-secret', expires_in: 3600 });
      }
      expect(input).toBe('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName');
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer delegated-access' });
      return jsonResponse(200, {
        id: ACCOUNT.accountId,
        displayName: ACCOUNT.accountDisplayName,
        mail: ACCOUNT.accountEmail,
        userPrincipalName: ACCOUNT.accountEmail,
      });
    });
    const client = createTeamsChatClient({
      config: CONFIG,
      store,
      fetchImpl,
      cryptoImpl: webcrypto,
      now: () => new Date(ACCOUNT.connectedAt),
    });

    await expect(client.exchangeCode('authorization-code')).resolves.toEqual({
      connected: true,
      accountEmail: ACCOUNT.accountEmail,
      accountDisplayName: ACCOUNT.accountDisplayName,
      connectedAt: ACCOUNT.connectedAt,
    });
    expect(store.save).toHaveBeenCalledWith(expect.objectContaining({
      accountId: ACCOUNT.accountId,
      accountEmail: ACCOUNT.accountEmail,
      encryptedRefreshToken: { ciphertext: expect.any(String), iv: expect.any(String) },
    }));
    expect(JSON.stringify(store.save.mock.calls)).not.toContain('refresh-token-secret');
  });

  it('renova e rotaciona o token, cria o chat 1:1 e envia conteúdo escapado com link direto', async () => {
    const encryptedRefreshToken = await encryptRefreshToken('old-refresh-token', {
      encryptionKey: KEY,
      cryptoImpl: webcrypto,
    });
    const store = {
      get: vi.fn(async () => ({ ...ACCOUNT, encryptedRefreshToken })),
      save: vi.fn(async (value) => ({ ...value, updatedAt: ACCOUNT.updatedAt })),
      disconnect: vi.fn(),
    };
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.includes('/token')) {
        expect(String(init?.body)).toContain('grant_type=refresh_token');
        expect(String(init?.body)).toContain('refresh_token=old-refresh-token');
        return jsonResponse(200, { access_token: 'fresh-access', refresh_token: 'rotated-refresh-token', expires_in: 3600 });
      }
      if (url.endsWith('/chats')) return jsonResponse(201, { id: 'chat-id' });
      if (url.endsWith('/chats/chat-id/messages')) return jsonResponse(201, { id: 'message-id' });
      return jsonResponse(404, {});
    });
    const client = createTeamsChatClient({ config: CONFIG, store, fetchImpl, cryptoImpl: webcrypto });

    await client.sendChat({
      recipientUserId: '22222222-2222-2222-2222-222222222222',
      previewText: 'Avalie <agora>',
      ticketUrl: 'https://www.responsum.com.br/tickets/ticket-id?showFeedback=true&source=teams',
    });

    const chatBody = JSON.parse(String(calls.find((call) => call.url.endsWith('/chats'))?.init?.body));
    expect(chatBody).toEqual({
      chatType: 'oneOnOne',
      members: [
        {
          '@odata.type': '#microsoft.graph.aadUserConversationMember',
          roles: ['owner'],
          'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${ACCOUNT.accountId}')`,
        },
        {
          '@odata.type': '#microsoft.graph.aadUserConversationMember',
          roles: ['owner'],
          'user@odata.bind': "https://graph.microsoft.com/v1.0/users('22222222-2222-2222-2222-222222222222')",
        },
      ],
    });
    const messageBody = JSON.parse(String(calls.find((call) => call.url.endsWith('/messages'))?.init?.body));
    expect(messageBody.body).toEqual({
      contentType: 'html',
      content: '<p>Avalie &lt;agora&gt;</p><p><a href="https://www.responsum.com.br/tickets/ticket-id?showFeedback=true&amp;source=teams">Abrir chamado no Responsum</a></p>',
    });
    expect(messageBody.attachments).toBeUndefined();
    expect(store.save).toHaveBeenCalledWith(expect.objectContaining({
      encryptedRefreshToken: { ciphertext: expect.any(String), iv: expect.any(String) },
    }));
    expect(JSON.stringify(store.save.mock.calls)).not.toContain('rotated-refresh-token');
  });

  it('envia o cartão Adaptive Card e o HTML rico quando o template fornece o layout', async () => {
    const encryptedRefreshToken = await encryptRefreshToken('old-refresh-token', {
      encryptionKey: KEY,
      cryptoImpl: webcrypto,
    });
    const store = {
      get: vi.fn(async () => ({ ...ACCOUNT, encryptedRefreshToken })),
      save: vi.fn(async (value) => ({ ...value, updatedAt: ACCOUNT.updatedAt })),
      disconnect: vi.fn(),
    };
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.includes('/token')) {
        return jsonResponse(200, { access_token: 'fresh-access', refresh_token: 'rotated-refresh-token', expires_in: 3600 });
      }
      if (url.endsWith('/chats')) return jsonResponse(201, { id: 'chat-id' });
      if (url.endsWith('/chats/chat-id/messages')) return jsonResponse(201, { id: 'message-id' });
      return jsonResponse(404, {});
    });
    const client = createTeamsChatClient({ config: CONFIG, store, fetchImpl, cryptoImpl: webcrypto });

    await client.sendChat({
      recipientUserId: '22222222-2222-2222-2222-222222222222',
      previewText: 'Avalie <agora>',
      ticketUrl: 'https://www.responsum.com.br/tickets/ticket-id',
      html: '<p>Cartão <strong>Responsum</strong></p>',
      chatHtml: '<p><strong>RESPONSUM</strong> · Avaliar atendimento</p><p>Avalie &lt;agora&gt;.</p>',
      card: { type: 'AdaptiveCard', version: '1.4', body: [{ type: 'TextBlock', text: 'RESPONSUM' }] },
    });

    const messageBody = JSON.parse(String(calls.find((call) => call.url.endsWith('/messages'))?.init?.body));
    expect(messageBody.body).toEqual({
      contentType: 'html',
      content: '<p><strong>RESPONSUM</strong> · Avaliar atendimento</p><p>Avalie &lt;agora&gt;.</p><attachment id="responsum-card"></attachment>',
    });
    expect(messageBody.attachments).toEqual([{
      id: 'responsum-card',
      contentType: 'application/vnd.microsoft.card.adaptive',
      contentUrl: null,
      content: JSON.stringify({ type: 'AdaptiveCard', version: '1.4', body: [{ type: 'TextBlock', text: 'RESPONSUM' }] }),
    }]);
  });

  it('informa status da conta sem devolver material de autenticação', async () => {
    const store = {
      get: vi.fn(async () => ({
        ...ACCOUNT,
        encryptedRefreshToken: { ciphertext: 'ciphertext', iv: 'iv' },
      })),
      save: vi.fn(),
      disconnect: vi.fn(),
    };
    const client = createTeamsChatClient({ config: CONFIG, store, fetchImpl: vi.fn(), cryptoImpl: webcrypto });

    const status = await client.getStatus();

    expect(status).toEqual({
      connected: true,
      accountEmail: ACCOUNT.accountEmail,
      accountDisplayName: ACCOUNT.accountDisplayName,
      connectedAt: ACCOUNT.connectedAt,
    });
    expect(JSON.stringify(status)).not.toContain('ciphertext');
    expect(JSON.stringify(status)).not.toContain('refresh');
  });
});
