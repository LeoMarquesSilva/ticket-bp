import { describe, expect, it, vi } from 'vitest';
import { createGraphClient } from '../../supabase/functions/notify-ticket-communications/_shared/graphClient.mjs';

const config = {
  tenantId: 'tenant-id',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  sender: 'notificacoes@bpplaw.com.br',
  teamsAppId: 'teams-app-id',
};

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('createGraphClient', () => {
  it('envia email pela caixa configurada', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-token' }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    const graph = createGraphClient(config, { fetchImpl, sleep: vi.fn() });

    await graph.sendEmail({ to: 'ana@bpplaw.com.br', subject: 'Assunto', html: '<p>Oi</p>', text: 'Oi' });

    expect(fetchImpl.mock.calls[0][0]).toBe('https://login.microsoftonline.com/tenant-id/oauth2/v2.0/token');
    expect(String(fetchImpl.mock.calls[0][1].body)).toBe('client_id=client-id&client_secret=client-secret&scope=https%3A%2F%2Fgraph.microsoft.com%2F.default&grant_type=client_credentials');
    expect(fetchImpl.mock.calls[1][0]).toBe('https://graph.microsoft.com/v1.0/users/notificacoes%40bpplaw.com.br/sendMail');
    expect(fetchImpl.mock.calls[1][1].headers).toMatchObject({
      Authorization: 'Bearer access-token',
      'Content-Type': 'text/plain',
    });
    expect(Buffer.from(fetchImpl.mock.calls[1][1].body, 'base64').toString('utf8')).toBe([
      'From: notificacoes@bpplaw.com.br',
      'To: ana@bpplaw.com.br',
      'Subject: =?UTF-8?B?QXNzdW50bw==?=',
      'MIME-Version: 1.0',
      'Content-Type: multipart/alternative; boundary="responsum-ticket-notification"',
      '',
      '--responsum-ticket-notification',
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      'T2k=',
      '--responsum-ticket-notification',
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      'PHA+T2k8L3A+',
      '--responsum-ticket-notification--',
    ].join('\r\n'));
  });

  it('resolve o domínio corporativo alternativo antes de desistir', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-token' }))
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'Request_ResourceNotFound' } }, 404))
      .mockResolvedValueOnce(jsonResponse({ value: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: 'entra-user-id' }));
    const graph = createGraphClient(config, { fetchImpl, sleep: vi.fn() });

    await expect(graph.resolveUserId('ana@bismarchipires.com.br')).resolves.toBe('entra-user-id');

    expect(fetchImpl.mock.calls.slice(1).map(([url]) => url)).toEqual([
      'https://graph.microsoft.com/v1.0/users/ana%40bismarchipires.com.br?$select=id',
      "https://graph.microsoft.com/v1.0/users?$filter=mail%20eq%20'ana%40bismarchipires.com.br'%20or%20userPrincipalName%20eq%20'ana%40bismarchipires.com.br'&$select=id&$top=1",
      'https://graph.microsoft.com/v1.0/users/ana%40bpplaw.com.br?$select=id',
    ]);
  });

  it('envia atividade com link do chamado', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-token' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const graph = createGraphClient(config, { fetchImpl, sleep: vi.fn() });

    await graph.sendTeamsActivity({ userId: 'entra-user-id', topic: 'Chamado', previewText: 'Avaliação pendente', webUrl: 'https://responsum.example/tickets/1' });

    expect(fetchImpl.mock.calls[1][0]).toContain('/users/entra-user-id/teamwork/sendActivityNotification');
    expect(fetchImpl.mock.calls[1][1].headers).toMatchObject({
      Authorization: 'Bearer access-token',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({
      teamsAppId: 'teams-app-id',
      activityType: 'systemDefault',
      topic: {
        source: 'text',
        value: 'Chamado',
        webUrl: 'https://responsum.example/tickets/1',
      },
      previewText: { content: 'Avaliação pendente' },
    });
  });

  it('respeita Retry-After em respostas 429', async () => {
    const sleep = vi.fn();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-token' }))
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '1' } }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    const graph = createGraphClient(config, { fetchImpl, sleep });

    await graph.sendEmail({ to: 'ana@bpplaw.com.br', subject: 'Assunto', html: '<p>Oi</p>', text: 'Oi' });

    expect(sleep).toHaveBeenCalledOnce();
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('repete falhas 503 com backoff exponencial até obter sucesso', async () => {
    const sleep = vi.fn();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-token' }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    const graph = createGraphClient(config, { fetchImpl, sleep });

    await graph.sendEmail({ to: 'ana@bpplaw.com.br', subject: 'Assunto', html: '<p>Oi</p>', text: 'Oi' });

    expect(sleep).toHaveBeenNthCalledWith(1, 250);
    expect(sleep).toHaveBeenNthCalledWith(2, 500);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('encerra depois de três tentativas transientes', async () => {
    const sleep = vi.fn();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-token' }))
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'ServiceUnavailable', message: 'Indisponível' } }, 503))
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'ServiceUnavailable', message: 'Indisponível' } }, 503))
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'ServiceUnavailable', message: 'Indisponível' } }, 503));
    const graph = createGraphClient(config, { fetchImpl, sleep });

    await expect(graph.sendEmail({ to: 'ana@bpplaw.com.br', subject: 'Assunto', html: '<p>Oi</p>', text: 'Oi' }))
      .rejects.toMatchObject({ status: 503, code: 'ServiceUnavailable' });

    expect(sleep).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('expõe somente status, código e mensagem Graph truncada ao falhar', async () => {
    const code = 'C'.repeat(101);
    const message = 'M'.repeat(301);
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-token' }))
      .mockResolvedValueOnce(jsonResponse(
        { error: { code, message }, responseBodySecret: 'response-body-secret' },
        400,
        { 'X-Private': 'header-secret' },
      ));
    const graph = createGraphClient(config, { fetchImpl, sleep: vi.fn() });
    let caught: (Error & { status?: number; code?: string }) | undefined;

    try {
      await graph.sendEmail({ to: 'ana@bpplaw.com.br', subject: 'Assunto', html: '<p>Oi</p>', text: 'Oi' });
    } catch (error) {
      caught = error as Error & { status?: number; code?: string };
    }

    expect(caught).toMatchObject({ status: 400, code: 'C'.repeat(100) });
    expect(caught?.message).toBe(`Microsoft Graph 400 ${'C'.repeat(100)}: ${'M'.repeat(300)}`);
    expect(Object.keys(caught ?? {})).toEqual(['status', 'code']);
    expect(caught?.message).not.toContain('access-token');
    expect(caught?.message).not.toContain('header-secret');
    expect(caught?.message).not.toContain('response-body-secret');
  });
});
