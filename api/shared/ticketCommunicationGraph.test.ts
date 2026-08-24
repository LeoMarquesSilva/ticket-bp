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

function sentMime(fetchImpl: ReturnType<typeof vi.fn>) {
  const emailCall = fetchImpl.mock.calls[fetchImpl.mock.calls.length - 1];
  return Buffer.from(emailCall[1].body, 'base64').toString('utf8');
}

function mimeBase64Parts(mime: string) {
  const lines = mime.split('\r\n');
  const parts: string[][] = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index] !== 'Content-Transfer-Encoding: base64') continue;
    const encodedLines: string[] = [];
    for (let bodyIndex = index + 2; bodyIndex < lines.length && !lines[bodyIndex].startsWith('--responsum-ticket-notification'); bodyIndex += 1) {
      encodedLines.push(lines[bodyIndex]);
    }
    parts.push(encodedLines);
  }

  return parts;
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
      .mockResolvedValueOnce(jsonResponse({ id: 'entra-user-id', userPrincipalName: 'ana@bpplaw.com.br', mail: 'ana@bpplaw.com.br' }));
    const graph = createGraphClient(config, { fetchImpl, sleep: vi.fn() });

    await expect(graph.resolveUserId('ana@bismarchipires.com.br')).resolves.toBe('entra-user-id');

    expect(fetchImpl.mock.calls.slice(1).map(([url]) => url)).toEqual([
      'https://graph.microsoft.com/v1.0/users/ana%40bismarchipires.com.br?$select=id,userPrincipalName,mail',
      'https://graph.microsoft.com/v1.0/users/ana%40bpplaw.com.br?$select=id,userPrincipalName,mail',
    ]);
  });

  it('não aceita resposta direta cujo UPN não coincide exatamente', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-token' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'wrong-user-id', userPrincipalName: 'outra.pessoa@bismarchipires.com.br', mail: 'ana@bismarchipires.com.br' }))
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'Request_ResourceNotFound' } }, 404))
      .mockResolvedValueOnce(jsonResponse({ value: [] }))
      .mockResolvedValueOnce(jsonResponse({ value: [] }));
    const graph = createGraphClient(config, { fetchImpl, sleep: vi.fn() });

    await expect(graph.resolveUserId('ana@bismarchipires.com.br')).resolves.toBeNull();
  });

  it('aceita somente um resultado de mail que coincide exatamente', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-token' }))
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'Request_ResourceNotFound' } }, 404))
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'Request_ResourceNotFound' } }, 404))
      .mockResolvedValueOnce(jsonResponse({
        value: [{ id: 'mail-user-id', mail: 'ana@bismarchipires.com.br', userPrincipalName: 'ana.externa@tenant.onmicrosoft.com' }],
      }));
    const graph = createGraphClient(config, { fetchImpl, sleep: vi.fn() });

    await expect(graph.resolveUserId('ana@bismarchipires.com.br')).resolves.toBe('mail-user-id');
    expect(fetchImpl.mock.calls[3][0]).toBe(
      "https://graph.microsoft.com/v1.0/users?$filter=mail%20eq%20'ana%40bismarchipires.com.br'&$select=id,mail,userPrincipalName&$top=2",
    );
  });

  it('rejeita mail ambíguo sem escolher arbitrariamente uma pessoa', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-token' }))
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'Request_ResourceNotFound' } }, 404))
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'Request_ResourceNotFound' } }, 404))
      .mockResolvedValueOnce(jsonResponse({
        value: [
          { id: 'first-user-id', mail: 'ana@bismarchipires.com.br', userPrincipalName: 'ana.primeira@tenant.onmicrosoft.com' },
          { id: 'second-user-id', mail: 'ana@bismarchipires.com.br', userPrincipalName: 'ana.segunda@tenant.onmicrosoft.com' },
        ],
      }));
    const graph = createGraphClient(config, { fetchImpl, sleep: vi.fn() });

    await expect(graph.resolveUserId('ana@bismarchipires.com.br')).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(4);
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

  it('serializa assunto e partes Unicode longas em MIME com linhas RFC-compliant', async () => {
    const subject = `Atualização ${'áéíóú 😀 '.repeat(18)}`;
    const text = `Olá, ${'conteúdo acentuado 😀 '.repeat(40)}`;
    const html = `<p>${'conteúdo HTML áéíóú 😀 '.repeat(40)}</p>`;
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-token' }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    const graph = createGraphClient(config, { fetchImpl, sleep: vi.fn() });

    await graph.sendEmail({ to: 'ana@bpplaw.com.br', subject, html, text });

    const mime = sentMime(fetchImpl);
    const subjectHeader = mime.slice(mime.indexOf('Subject:'), mime.indexOf('MIME-Version:'));
    const encodedWords = [...subjectHeader.matchAll(/=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=/g)];
    const encodedParts = mimeBase64Parts(mime);

    expect(subjectHeader).toContain('\r\n ');
    expect(encodedWords.length).toBeGreaterThan(1);
    expect(encodedWords.every(([word]) => word.length <= 75)).toBe(true);
    expect(encodedWords.map(([, value]) => Buffer.from(value, 'base64').toString('utf8')).join('')).toBe(subject);
    expect(encodedParts).toHaveLength(2);
    expect(encodedParts.flat().every((line) => line.length <= 76 && /^[A-Za-z0-9+/]+={0,2}$/.test(line))).toBe(true);
    expect(Buffer.from(encodedParts[0].join(''), 'base64').toString('utf8')).toBe(text);
    expect(Buffer.from(encodedParts[1].join(''), 'base64').toString('utf8')).toBe(html);
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

  it('repete falha transitória ao obter token antes de enviar o e-mail', async () => {
    const sleep = vi.fn();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'access-token' }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    const graph = createGraphClient(config, { fetchImpl, sleep });

    await graph.sendEmail({ to: 'ana@bpplaw.com.br', subject: 'Assunto', html: '<p>Oi</p>', text: 'Oi' });

    expect(sleep).toHaveBeenCalledWith(250);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('permite uma nova obtenção de token após falha terminal anterior', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'invalid_client' }, 401))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'new-access-token' }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    const graph = createGraphClient(config, { fetchImpl, sleep: vi.fn() });
    const email = { to: 'ana@bpplaw.com.br', subject: 'Assunto', html: '<p>Oi</p>', text: 'Oi' };

    await expect(graph.sendEmail(email)).rejects.toThrow('Falha ao autenticar no Microsoft Graph (401)');
    await expect(graph.sendEmail(email)).resolves.toBeInstanceOf(Response);

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
