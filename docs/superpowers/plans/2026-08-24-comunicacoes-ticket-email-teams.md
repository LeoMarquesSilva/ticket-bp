# Comunicações de Chamados por E-mail e Teams Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enviar ao solicitante e-mail imediato na finalização e lembretes diários por e-mail e feed Atividade do Microsoft Teams quando o chamado aguardar sua resposta por 48 horas ou sua avaliação por 72 horas.

**Architecture:** Uma Edge Function autenticada calcula elegibilidade com regras puras, persiste entregas idempotentes no Supabase e usa Microsoft Graph com credenciais app-only. O frontend apenas sinaliza uma finalização bem-sucedida; a execução diária às 09:00 de Brasília também recupera falhas e convites imediatos ausentes.

**Tech Stack:** React 19, TypeScript, Vitest, Supabase/PostgreSQL, Supabase Edge Functions (Deno), Microsoft Graph, Teams app manifest.

## Global Constraints

- Os prazos são exatamente 48 e 72 horas corridas.
- A rotina recorrente executa diariamente às 09:00 em `America/Sao_Paulo`, usando cron `0 12 * * *` em UTC.
- O único destinatário é o usuário de `ticket.created_by`.
- Mensagens com `user_id = 'system'` não contam como interação humana.
- `resolved_feedback_invite` usa somente e-mail; `awaiting_requester` e `awaiting_feedback` usam e-mail e Teams.
- `validacao_de_indicadores/auditoria_de_excludentes_envio_de_evidencia` não recebe avisos de avaliação.
- Convites e lembretes de avaliação só alcançam tickets com `resolved_at >= ticket_communications_enabled_at`.
- Teams significa feed Atividade/banner, não mensagem em chat.
- Nenhum segredo, token, corpo integral do Graph ou dado de credencial pode ser persistido ou registrado.
- Falha de comunicação nunca reverte nem faz falhar a finalização do chamado.

---

## File Structure

- `supabase/migrations/<timestamp>_ticket_communications.sql`: migration gerada pelo Supabase CLI com tabela, configuração de ativação, RLS e RPCs de enfileiramento/reserva/conclusão.
- `supabase/functions/notify-ticket-communications/_shared/rules.mjs`: elegibilidade, última mensagem humana, canais e chaves de ciclo.
- `supabase/functions/notify-ticket-communications/_shared/templates.mjs`: links, assuntos, HTML/texto de e-mail e conteúdo do Teams.
- `supabase/functions/notify-ticket-communications/_shared/graphClient.mjs`: token app-only, resolução Entra, e-mail, Teams e retry.
- `supabase/functions/notify-ticket-communications/_shared/repository.ts`: adaptação do Supabase às RPCs e consultas.
- `supabase/functions/notify-ticket-communications/_shared/processor.mjs`: preparação e processamento das entregas por interfaces injetáveis.
- `supabase/functions/notify-ticket-communications/_shared/cors.ts`: CORS conforme as Functions existentes.
- `supabase/functions/notify-ticket-communications/index.ts`: autenticação, comandos `ticket_resolved`/`daily` e resposta sanitizada.
- `api/shared/ticketCommunicationRules.test.ts`: testes das regras puras.
- `api/shared/ticketCommunicationTemplates.test.ts`: testes de conteúdo e links.
- `api/shared/ticketCommunicationGraph.test.ts`: testes do cliente Graph com transporte injetado.
- `api/shared/ticketCommunicationProcessor.test.ts`: testes de orquestração e independência dos canais.
- `supabase/tests/database/ticket_communications.test.sql`: testes comportamentais pgTAP da migration, idempotência e controles de segurança.
- `src/services/ticketCommunicationService.ts`: invocação não bloqueante da Function após finalização.
- `src/services/ticketCommunicationService.test.ts`: contrato do cliente frontend.
- `src/services/ticketService.ts`: disparo após resolução persistida.
- `src/services/ticketService.finishTicket.test.ts`: ordem, idempotência de intenção e tolerância a falha de comunicação.
- `supabase/config.toml`: registro da nova Function com JWT.
- `.env.example`: nomes dos secrets sem valores.
- `teams/responsum-notifications/manifest.template.json`: manifesto parametrizado do aplicativo Teams.
- `docs/DEPLOY-TICKET-COMMUNICATIONS.md`: permissões Entra, pacote Teams, secrets, cron e smoke test.

---

### Task 1: Regras de elegibilidade e ciclos

**Files:**
- Create: `supabase/functions/notify-ticket-communications/_shared/rules.mjs`
- Create: `api/shared/ticketCommunicationRules.test.ts`

**Interfaces:**
- Produces: `latestHumanMessage(messages)`, `getEligibleNotificationTypes(input)`, `channelsForNotification(type)`, `localCycleKey(date)` e constantes `NPS_EXEMPT_CATEGORY_KEY`/`NPS_EXEMPT_SUBCATEGORY_KEY`.
- Consumes: objetos normalizados `ticket`, `lastHumanMessage`, `enabledAt` e `now`; não acessa banco, Deno ou rede.

- [ ] **Step 1: Escrever os testes que falham para 48 horas, resposta do solicitante e mensagens de sistema**

```ts
import { describe, expect, it } from 'vitest';
import {
  getEligibleNotificationTypes,
  latestHumanMessage,
} from '../../supabase/functions/notify-ticket-communications/_shared/rules.mjs';

const now = new Date('2026-08-24T12:00:00.000Z');

it('lembra quando a última mensagem humana do suporte completa 48 horas', () => {
  const result = getEligibleNotificationTypes({
    now,
    enabledAt: new Date('2026-08-01T00:00:00.000Z'),
    ticket: { status: 'in_progress', created_by: 'requester', resolved_at: null, feedback_submitted_at: null, category: 'ti', subcategory: 'acesso' },
    lastHumanMessage: { user_id: 'support', created_at: '2026-08-22T12:00:00.000Z' },
  });
  expect(result).toEqual(['awaiting_requester']);
});

it('não lembra quando a última mensagem humana é do solicitante', () => {
  const result = getEligibleNotificationTypes({
    now,
    enabledAt: new Date('2026-08-01T00:00:00.000Z'),
    ticket: { status: 'in_progress', created_by: 'requester', resolved_at: null, feedback_submitted_at: null, category: 'ti', subcategory: 'acesso' },
    lastHumanMessage: { user_id: 'requester', created_at: '2026-08-20T12:00:00.000Z' },
  });
  expect(result).toEqual([]);
});

it('ignora mensagens do sistema ao localizar a última mensagem humana', () => {
  expect(latestHumanMessage([
    { user_id: 'support', created_at: '2026-08-20T12:00:00.000Z' },
    { user_id: 'system', created_at: '2026-08-24T11:00:00.000Z' },
  ])?.user_id).toBe('support');
});
```

- [ ] **Step 2: Executar os testes e confirmar RED**

Run: `npm test -- api/shared/ticketCommunicationRules.test.ts`

Expected: FAIL porque o módulo `rules.mjs` ainda não existe.

- [ ] **Step 3: Implementar a API mínima de regras**

```js
export const NPS_EXEMPT_CATEGORY_KEY = 'validacao_de_indicadores';
export const NPS_EXEMPT_SUBCATEGORY_KEY = 'auditoria_de_excludentes_envio_de_evidencia';

const ACTIVE = new Set(['open', 'assigned', 'in_progress']);
const HOURS_48 = 48 * 60 * 60 * 1000;
const HOURS_72 = 72 * 60 * 60 * 1000;

export function latestHumanMessage(messages) {
  return [...messages]
    .filter((message) => message.user_id !== 'system')
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] ?? null;
}

export function getEligibleNotificationTypes({ now, enabledAt, ticket, lastHumanMessage }) {
  const types = [];
  const nowMs = now.getTime();
  if (ACTIVE.has(ticket.status) && lastHumanMessage && lastHumanMessage.user_id !== ticket.created_by && nowMs - Date.parse(lastHumanMessage.created_at) >= HOURS_48) {
    types.push('awaiting_requester');
  }
  const exempt = ticket.category === NPS_EXEMPT_CATEGORY_KEY && ticket.subcategory === NPS_EXEMPT_SUBCATEGORY_KEY;
  const resolvedMs = ticket.resolved_at ? Date.parse(ticket.resolved_at) : Number.NaN;
  if (ticket.status === 'resolved' && !exempt && !ticket.feedback_submitted_at && resolvedMs >= enabledAt.getTime()) {
    types.push('resolved_feedback_invite');
    if (nowMs - resolvedMs >= HOURS_72) types.push('awaiting_feedback');
  }
  return types;
}

export function channelsForNotification(type) {
  return type === 'resolved_feedback_invite' ? ['email'] : ['email', 'teams'];
}

export function localCycleKey(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
```

- [ ] **Step 4: Acrescentar testes de 72 horas, isenção, ativação, canais e data local; executar GREEN**

Run: `npm test -- api/shared/ticketCommunicationRules.test.ts`

Expected: PASS cobrindo limites imediatamente antes e exatamente em 48/72 horas, ticket histórico, nova resolução, isenção e `localCycleKey`.

- [ ] **Step 5: Commit**

```bash
git add api/shared/ticketCommunicationRules.test.ts supabase/functions/notify-ticket-communications/_shared/rules.mjs
git commit -m "feat: define regras de comunicacao de tickets"
```

### Task 2: Templates seguros e links diretos

**Files:**
- Create: `supabase/functions/notify-ticket-communications/_shared/templates.mjs`
- Create: `api/shared/ticketCommunicationTemplates.test.ts`

**Interfaces:**
- Consumes: `buildNotificationContent({ type, ticket, requester, appBaseUrl })`.
- Produces: `{ email?: { subject, html, text }, teams?: { topic, previewText, webUrl } }` e `escapeHtml(value)`.

- [ ] **Step 1: Escrever testes que falham para os links e escape**

```ts
import { buildNotificationContent } from '../../supabase/functions/notify-ticket-communications/_shared/templates.mjs';

const ticket = {
  id: '11111111-1111-1111-1111-111111111111',
  title: 'Acesso ao sistema',
};
const requester = { name: 'Ana' };

it('cria link de avaliação para convite e lembrete de feedback', () => {
  const content = buildNotificationContent({
    type: 'awaiting_feedback',
    ticket: { id: '11111111-1111-1111-1111-111111111111', title: 'Acesso <urgente>' },
    requester: { name: 'Ana & Cia' },
    appBaseUrl: 'https://responsum.example/',
  });
  expect(content.teams.webUrl).toBe('https://responsum.example/tickets/11111111-1111-1111-1111-111111111111?showFeedback=true');
  expect(content.email.html).toContain('Acesso &lt;urgente&gt;');
  expect(content.email.html).not.toContain('Acesso <urgente>');
});

it('usa o chamado sem showFeedback no lembrete de resposta', () => {
  const content = buildNotificationContent({ type: 'awaiting_requester', ticket, requester, appBaseUrl: 'https://responsum.example' });
  expect(content.teams.webUrl).toBe(`https://responsum.example/tickets/${ticket.id}`);
});
```

- [ ] **Step 2: Executar RED**

Run: `npm test -- api/shared/ticketCommunicationTemplates.test.ts`

Expected: FAIL por módulo ausente.

- [ ] **Step 3: Implementar templates para os três tipos**

```js
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

export function buildTicketUrl(base, ticketId, feedback) {
  const root = String(base).replace(/\/$/, '');
  return `${root}/tickets/${encodeURIComponent(ticketId)}${feedback ? '?showFeedback=true' : ''}`;
}

export function buildNotificationContent({ type, ticket, requester, appBaseUrl }) {
  const feedback = type !== 'awaiting_requester';
  const webUrl = buildTicketUrl(appBaseUrl, ticket.id, feedback);
  const copy = {
    resolved_feedback_invite: { subject: `Avalie o atendimento: ${ticket.title}`, action: 'Avaliar atendimento', reason: 'Seu chamado foi finalizado.' },
    awaiting_requester: { subject: `Seu chamado aguarda uma resposta: ${ticket.title}`, action: 'Responder chamado', reason: 'O suporte aguarda sua resposta há mais de 48 horas.' },
    awaiting_feedback: { subject: `Avaliação pendente: ${ticket.title}`, action: 'Avaliar atendimento', reason: 'Seu chamado foi finalizado há mais de 72 horas e ainda não foi avaliado.' },
  }[type];
  const safeName = escapeHtml(requester.name);
  const safeTitle = escapeHtml(ticket.title);
  const html = `<p>Olá, ${safeName}.</p><p>${escapeHtml(copy.reason)}</p><p><strong>${safeTitle}</strong></p><p><a href="${escapeHtml(webUrl)}">${escapeHtml(copy.action)}</a></p><p>${escapeHtml(webUrl)}</p>`;
  const text = `Olá, ${requester.name}.\n\n${copy.reason}\n\n${ticket.title}\n\n${copy.action}: ${webUrl}`;
  return { email: { subject: copy.subject, html, text }, teams: { topic: ticket.title, previewText: copy.reason, webUrl } };
}
```

- [ ] **Step 4: Executar GREEN e verificar todos os tipos**

Run: `npm test -- api/shared/ticketCommunicationTemplates.test.ts`

Expected: PASS sem HTML não escapado e com URLs exatas.

- [ ] **Step 5: Commit**

```bash
git add api/shared/ticketCommunicationTemplates.test.ts supabase/functions/notify-ticket-communications/_shared/templates.mjs
git commit -m "feat: cria templates de email e teams"
```

### Task 3: Cliente Microsoft Graph resiliente

**Files:**
- Create: `supabase/functions/notify-ticket-communications/_shared/graphClient.mjs`
- Create: `api/shared/ticketCommunicationGraph.test.ts`

**Interfaces:**
- Produces: `createGraphClient(config, dependencies)` com métodos `sendEmail`, `resolveUserId`, `sendTeamsActivity`.
- Consumes: `fetchImpl` e `sleep` injetáveis; configuração `{ tenantId, clientId, clientSecret, sender, teamsAppId }`.

- [ ] **Step 1: Escrever testes RED para e-mail, variantes de domínio e Teams**

```ts
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

it('envia email pela caixa configurada', async () => {
  const fetchImpl = vi.fn()
    .mockResolvedValueOnce(jsonResponse({ access_token: 'access-token' }))
    .mockResolvedValueOnce(new Response(null, { status: 202 }));
  const graph = createGraphClient(config, { fetchImpl, sleep: vi.fn() });
  await graph.sendEmail({ to: 'ana@bpplaw.com.br', subject: 'Assunto', html: '<p>Oi</p>', text: 'Oi' });
  expect(fetchImpl.mock.calls[1][0]).toBe('https://graph.microsoft.com/v1.0/users/notificacoes%40bpplaw.com.br/sendMail');
});

it('resolve o domínio corporativo alternativo antes de desistir', async () => {
  const fetchImpl = vi.fn()
    .mockResolvedValueOnce(jsonResponse({ access_token: 'access-token' }))
    .mockResolvedValueOnce(jsonResponse({ error: { code: 'Request_ResourceNotFound' } }, 404))
    .mockResolvedValueOnce(jsonResponse({ value: [] }))
    .mockResolvedValueOnce(jsonResponse({ id: 'entra-user-id' }));
  const graph = createGraphClient(config, { fetchImpl, sleep: vi.fn() });
  await expect(graph.resolveUserId('ana@bismarchipires.com.br')).resolves.toBe('entra-user-id');
});

it('envia atividade com link do chamado', async () => {
  const fetchImpl = vi.fn()
    .mockResolvedValueOnce(jsonResponse({ access_token: 'access-token' }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  const graph = createGraphClient(config, { fetchImpl, sleep: vi.fn() });
  await graph.sendTeamsActivity({ userId: 'entra-user-id', topic: 'Chamado', previewText: 'Avaliação pendente', webUrl: 'https://responsum.example/tickets/1' });
  expect(fetchImpl.mock.calls[1][0]).toContain('/users/entra-user-id/teamwork/sendActivityNotification');
});
```

- [ ] **Step 2: Executar RED**

Run: `npm test -- api/shared/ticketCommunicationGraph.test.ts`

Expected: FAIL por módulo ausente.

- [ ] **Step 3: Implementar token, requests e payloads**

O método de e-mail deve construir MIME `multipart/alternative` com partes `text/plain` e `text/html`, codificar os bytes em base64 e enviar para `sendMail` com header `Content-Type: text/plain`. O método Teams deve enviar `teamsAppId`, `activityType: 'systemDefault'`, `topic: { source: 'text', value, webUrl }` e `previewText: { content }`. `resolveUserId` tenta cada variante primeiro em `/users/{email}?$select=id` e depois com filtro `mail eq ... or userPrincipalName eq ...`.

```js
function utf8Base64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function buildMimeBase64({ from, to, subject, html, text }) {
  const boundary = 'responsum-ticket-notification';
  const safeFrom = String(from).replace(/[\r\n]/g, '');
  const safeTo = String(to).replace(/[\r\n]/g, '');
  const encodedSubject = `=?UTF-8?B?${utf8Base64(String(subject))}?=`;
  const mime = [
    `From: ${safeFrom}`,
    `To: ${safeTo}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    utf8Base64(text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    utf8Base64(html),
    `--${boundary}--`,
  ].join('\r\n');
  return utf8Base64(mime);
}

async function requestToken(config, fetchImpl) {
  const body = new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' });
  const response = await fetchImpl(`https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.access_token) throw new Error(`Falha ao autenticar no Microsoft Graph (${response.status})`);
  return String(json.access_token);
}

async function sanitizedGraphError(response) {
  const json = await response.json().catch(() => ({}));
  const code = String(json.error?.code ?? 'graph_error').slice(0, 100);
  const message = String(json.error?.message ?? response.statusText).slice(0, 300);
  const error = new Error(`Microsoft Graph ${response.status} ${code}: ${message}`);
  error.status = response.status;
  error.code = code;
  return error;
}

export function createGraphClient(config, { fetchImpl = fetch, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  let tokenPromise;
  const getToken = () => tokenPromise ??= requestToken(config, fetchImpl);
  const graphRequest = async (path, init = {}, options = {}, attempt = 1) => {
    const token = await getToken();
    const response = await fetchImpl(`https://graph.microsoft.com/v1.0${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
    if ([408, 429].includes(response.status) || response.status >= 500) {
      if (attempt < 3) {
        const retryAfter = Number(response.headers.get('Retry-After'));
        await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** (attempt - 1));
        return graphRequest(path, init, options, attempt + 1);
      }
    }
    if (options.allowNotFound && response.status === 404) return response;
    if (!response.ok) throw await sanitizedGraphError(response);
    return response;
  };
  const sendEmail = ({ to, subject, html, text }) => graphRequest(
    `/users/${encodeURIComponent(config.sender)}/sendMail`,
    { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: buildMimeBase64({ from: config.sender, to, subject, html, text }) },
  );
  const sendTeamsActivity = ({ userId, topic, previewText, webUrl }) => graphRequest(
    `/users/${encodeURIComponent(userId)}/teamwork/sendActivityNotification`,
    { method: 'POST', body: JSON.stringify({ teamsAppId: config.teamsAppId, activityType: 'systemDefault', topic: { source: 'text', value: topic, webUrl }, previewText: { content: previewText } }) },
  );
  return { sendEmail, resolveUserId: (email) => resolveGraphUserId(email, graphRequest), sendTeamsActivity };
}

function emailVariants(email) {
  const normalized = email.trim().toLowerCase();
  const variants = new Set([normalized]);
  if (normalized.endsWith('@bpplaw.com.br')) variants.add(normalized.replace('@bpplaw.com.br', '@bismarchipires.com.br'));
  if (normalized.endsWith('@bismarchipires.com.br')) variants.add(normalized.replace('@bismarchipires.com.br', '@bpplaw.com.br'));
  return [...variants].filter(Boolean);
}

async function resolveGraphUserId(email, graphRequest) {
  for (const variant of emailVariants(email)) {
    const direct = await graphRequest(`/users/${encodeURIComponent(variant)}?$select=id`, {}, { allowNotFound: true });
    if (direct.ok) return String((await direct.json()).id);
    const escaped = variant.replace(/'/g, "''");
    const filter = encodeURIComponent(`mail eq '${escaped}' or userPrincipalName eq '${escaped}'`);
    const filtered = await graphRequest(`/users?$filter=${filter}&$select=id&$top=1`);
    const user = (await filtered.json()).value?.[0];
    if (user?.id) return String(user.id);
  }
  return null;
}
```

- [ ] **Step 4: Acrescentar testes de retry e sanitização**

Testar `429` com `Retry-After: 1`, dois `503` seguidos de sucesso, limite de três tentativas e erro final contendo apenas `status`, `code` e mensagem truncada, nunca headers ou token.

Run: `npm test -- api/shared/ticketCommunicationGraph.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/shared/ticketCommunicationGraph.test.ts supabase/functions/notify-ticket-communications/_shared/graphClient.mjs
git commit -m "feat: adiciona cliente microsoft graph de notificacoes"
```

### Task 4: Persistência, RLS e fila idempotente

**Files:**
- Create via `npx supabase migration new ticket_communications`: `supabase/migrations/<timestamp>_ticket_communications.sql`
- Create: `supabase/tests/database/ticket_communications.test.sql`

**Interfaces:**
- Produces RPC `helpdesk_enqueue_ticket_notification(uuid,text,text,text)`, RPC `helpdesk_claim_ticket_notifications(integer,timestamptz)` e RPC `helpdesk_complete_ticket_notification(uuid,boolean,text,timestamptz)`.
- Consumes somente `service_role`; nenhuma permissão para `anon` ou `authenticated`.

- [ ] **Step 1: Escrever teste RED comportamental com pgTAP**

Criar `supabase/tests/database/ticket_communications.test.sql` dentro de transação. O teste deve exercer o banco real e comprovar: tabela e RPCs existem; duas tentativas do mesmo `ticket_id + notification_type + channel + cycle_key` produzem uma única entrega; `anon` e `authenticated` não executam as RPCs; `service_role` consegue enfileirar, reservar e concluir; uma entrega reservada deixa de aparecer para outra reserva; e RLS está habilitado. Não testar o SQL por busca de texto.

- [ ] **Step 2: Executar RED**

Run: `npx supabase test db supabase/tests/database/ticket_communications.test.sql`

Expected: FAIL porque a migration e as RPCs ainda não existem.

- [ ] **Step 3: Gerar a migration pelo CLI e criar tabela/configuração de ativação**

Run: `npx supabase migration new ticket_communications`

Usar exatamente o arquivo criado pelo CLI; não inventar timestamp manualmente.

```sql
CREATE TABLE public.app_c009c0e4f1_ticket_notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.app_c009c0e4f1_tickets(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('resolved_feedback_invite', 'awaiting_requester', 'awaiting_feedback')),
  channel text NOT NULL CHECK (channel IN ('email', 'teams')),
  cycle_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  processing_started_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, notification_type, channel, cycle_key)
);

CREATE UNIQUE INDEX ticket_notification_one_unsent_cycle
  ON public.app_c009c0e4f1_ticket_notification_deliveries (ticket_id, notification_type, channel)
  WHERE status IN ('pending', 'processing', 'failed');

ALTER TABLE public.app_c009c0e4f1_ticket_notification_deliveries ENABLE ROW LEVEL SECURITY;

INSERT INTO public.app_c009c0e4f1_integration_settings (key, value, updated_at)
VALUES ('ticket_communications_enabled_at', now()::text, now())
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 4: Implementar as três RPCs com concorrência segura**

`helpdesk_enqueue_ticket_notification` deve validar tipo/canal, obter `pg_advisory_xact_lock(hashtextextended(concat_ws(':', p_ticket_id, p_notification_type, p_channel), 0))`, retornar a entrega não enviada existente ou inserir a nova com `ON CONFLICT` da chave diária.

`helpdesk_claim_ticket_notifications` deve usar uma CTE com `FOR UPDATE SKIP LOCKED`, selecionar `pending`/`failed` vencidos ou `processing` há mais de 15 minutos, atualizar para `processing`, incrementar `attempt_count` e retornar as linhas reservadas.

`helpdesk_complete_ticket_notification` deve marcar `sent` com `sent_at = now()` quando `p_success`, ou `failed` com `last_error = left(p_error, 500)` e `next_attempt_at = p_next_attempt_at` quando falhar.

```sql
REVOKE ALL ON FUNCTION public.helpdesk_enqueue_ticket_notification(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.helpdesk_claim_ticket_notifications(integer,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.helpdesk_complete_ticket_notification(uuid,boolean,text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.helpdesk_enqueue_ticket_notification(uuid,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.helpdesk_claim_ticket_notifications(integer,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.helpdesk_complete_ticket_notification(uuid,boolean,text,timestamptz) TO service_role;
```

- [ ] **Step 5: Executar GREEN e validar SQL**

Run: `npx supabase test db supabase/tests/database/ticket_communications.test.sql`

Run, quando o Supabase local estiver disponível: `npx supabase db lint --local`

Expected: teste PASS; lint sem erros na nova migration.

- [ ] **Step 6: Commit**

```bash
git add supabase/tests/database/ticket_communications.test.sql supabase/migrations/*_ticket_communications.sql
git commit -m "feat: cria fila idempotente de comunicacoes"
```

### Task 5: Processador testável de entregas

**Files:**
- Create: `supabase/functions/notify-ticket-communications/_shared/processor.mjs`
- Create: `api/shared/ticketCommunicationProcessor.test.ts`

**Interfaces:**
- Consumes repository `{ listCandidates(ticketId?), enqueue(input), claim(limit, now), complete(input) }` e graph `{ sendEmail, resolveUserId, sendTeamsActivity }`.
- Produces `prepareDeliveries(context)` e `processDeliveries(context)` com contadores sanitizados.

- [ ] **Step 1: Escrever testes RED para preparação e independência dos canais**

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  prepareDeliveries,
  processDeliveries,
} from '../../supabase/functions/notify-ticket-communications/_shared/processor.mjs';

const now = new Date('2026-08-24T12:00:00.000Z');
const ticket = {
  id: '11111111-1111-1111-1111-111111111111',
  title: 'Acesso',
  status: 'in_progress',
  created_by: 'requester-id',
  category: 'ti',
  subcategory: 'acesso',
  resolved_at: null,
  feedback_submitted_at: null,
};
const requester = { id: 'requester-id', name: 'Ana', email: 'ana@bpplaw.com.br' };
const awaitingRequesterCandidate = {
  enabledAt: '2026-08-01T00:00:00.000Z',
  ticket,
  requester,
  lastHumanMessage: { user_id: 'support-id', created_at: '2026-08-22T12:00:00.000Z' },
};
const emailDelivery = { id: 'delivery-email', notification_type: 'awaiting_requester', channel: 'email', ticket, requester };
const teamsDelivery = { id: 'delivery-teams', notification_type: 'awaiting_requester', channel: 'teams', ticket, requester };

function fakeRepository({ candidates = [], claimed = [] } = {}) {
  const enqueued: Record<string, unknown>[] = [];
  const completed: Record<string, unknown>[] = [];
  return {
    enqueued,
    completed,
    listCandidates: vi.fn(async () => candidates),
    enqueue: vi.fn(async (row) => { enqueued.push(row); return row; }),
    claim: vi.fn(async () => claimed),
    complete: vi.fn(async (row) => { completed.push(row); }),
  };
}

function fakeGraph({ teamsError }: { teamsError?: Error } = {}) {
  return {
    sendEmail: vi.fn(async () => undefined),
    resolveUserId: vi.fn(async () => 'entra-user-id'),
    sendTeamsActivity: vi.fn(async () => {
      if (teamsError) throw teamsError;
    }),
  };
}

it('enfileira email e teams para chamado aguardando solicitante', async () => {
  const repository = fakeRepository({ candidates: [awaitingRequesterCandidate] });
  await prepareDeliveries({ repository, now, appBaseUrl: 'https://responsum.example' });
  expect(repository.enqueued.map((row) => row.channel)).toEqual(['email', 'teams']);
});

it('não reenvia email quando somente teams falha', async () => {
  const repository = fakeRepository({ claimed: [emailDelivery, teamsDelivery] });
  const graph = fakeGraph({ teamsError: new Error('Teams app not installed') });
  const result = await processDeliveries({ repository, graph, appBaseUrl: 'https://responsum.example', now });
  expect(graph.sendEmail).toHaveBeenCalledTimes(1);
  expect(repository.completed).toEqual([
    expect.objectContaining({ id: emailDelivery.id, success: true }),
    expect.objectContaining({ id: teamsDelivery.id, success: false }),
  ]);
  expect(result).toEqual(expect.objectContaining({ sent: 1, failed: 1 }));
});
```

- [ ] **Step 2: Executar RED**

Run: `npm test -- api/shared/ticketCommunicationProcessor.test.ts`

Expected: FAIL por módulo ausente.

- [ ] **Step 3: Implementar preparação**

Para cada candidato, usar `getEligibleNotificationTypes`. `resolved_feedback_invite` recebe `cycle_key = ticket.resolved_at`; os recorrentes recebem `localCycleKey(now)`. Enfileirar cada canal via repository e deixar a RPC reaproveitar uma falha anterior.

```js
export async function prepareDeliveries({ repository, now }) {
  const candidates = await repository.listCandidates();
  let enqueued = 0;
  for (const candidate of candidates) {
    const types = getEligibleNotificationTypes({ now, enabledAt: new Date(candidate.enabledAt), ticket: candidate.ticket, lastHumanMessage: candidate.lastHumanMessage });
    for (const type of types) {
      const cycleKey = type === 'resolved_feedback_invite' ? candidate.ticket.resolved_at : localCycleKey(now);
      for (const channel of channelsForNotification(type)) {
        await repository.enqueue({ ticketId: candidate.ticket.id, notificationType: type, channel, cycleKey });
        enqueued += 1;
      }
    }
  }
  return { candidates: candidates.length, enqueued };
}
```

- [ ] **Step 4: Implementar processamento**

Carregar ticket e solicitante junto de cada entrega reservada. Construir conteúdo. Para e-mail chamar `sendEmail`; para Teams resolver Entra ID e chamar `sendTeamsActivity`. Em sucesso ou erro, sempre chamar `repository.complete`. Calcular `nextAttemptAt` para a próxima rotina diária após falha final.

- [ ] **Step 5: Executar GREEN e cobrir destinatário ausente, NPS e falha Graph**

Run: `npm test -- api/shared/ticketCommunicationProcessor.test.ts`

Expected: PASS com contadores `{ selected, sent, failed, skipped }` sem nomes/e-mails.

- [ ] **Step 6: Commit**

```bash
git add api/shared/ticketCommunicationProcessor.test.ts supabase/functions/notify-ticket-communications/_shared/processor.mjs
git commit -m "feat: processa entregas de comunicacao por canal"
```

### Task 6: Edge Function e adaptação do Supabase

**Files:**
- Create: `supabase/functions/notify-ticket-communications/_shared/repository.ts`
- Create: `supabase/functions/notify-ticket-communications/_shared/cors.ts`
- Create: `supabase/functions/notify-ticket-communications/_shared/requestHandler.mjs`
- Create: `supabase/functions/notify-ticket-communications/index.ts`
- Create: `api/shared/ticketCommunicationHandler.test.ts`
- Modify: `supabase/config.toml`
- Modify: `.env.example`

**Interfaces:**
- `ticket_resolved`: body `{ action: 'ticket_resolved', ticketId: string }`, resposta `{ ok, prepared, sent, failed }`.
- `daily`: body `{ action: 'daily' }`, autorizado pela secret key nomeada `ticket-communications` no header `apikey`, mesma resposta agregada.

- [ ] **Step 1: Criar repository usando service role e RPCs**

`listCandidates(ticketId?)` consulta tickets `open/assigned/in_progress` e tickets `resolved` sem feedback posteriores à ativação, busca os respectivos usuários e a última mensagem com `.neq('user_id', 'system').order('created_at', { ascending: false }).limit(1)`. Quando `ticketId` existe, restringe todas as consultas a esse UUID. `claim` e `complete` chamam as RPCs da Task 4.

- [ ] **Step 2: Escrever testes RED do handler injetável**

Criar `requestHandler.mjs` sem dependência de Deno, com dependências injetadas, e testar: ação inválida; UUID inválido; `ticket_resolved` recusado sem `authMode = user`; `daily` recusado sem `authMode = secret`; ticket não visível/não resolvido; nenhum destinatário/conteúdo vindo do body; e resposta apenas com contagens.

Run: `npm test -- api/shared/ticketCommunicationHandler.test.ts`

Expected: FAIL porque o handler ainda não existe.

- [ ] **Step 3: Criar handler e wrapper autenticado**

Usar `withSupabase({ auth: ['user', 'secret:ticket-communications'] }, ...)` de `npm:@supabase/server`. O handler injetável deve aceitar somente `authMode`, body e dependências já construídas. Para `ticket_resolved`, exigir `authMode = user`, UUID válido, visibilidade do ticket pelo cliente RLS do usuário e status `resolved`. Para `daily`, exigir `authMode = secret`. A operação é idempotente e não aceita conteúdo/destinatário do cliente.

- [ ] **Step 4: Configurar Graph e orquestrar**

Validar os seis secrets antes de processar. Criar Graph client uma vez, executar `prepareDeliveries` com `ticketId` no modo imediato ou sem filtro no modo diário e depois `processDeliveries`. Responder somente contagens. Adicionar:

```toml
[functions.notify-ticket-communications]
verify_jwt = false
```

Adicionar à `.env.example` somente os nomes `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_NOTIFICATION_SENDER`, `MICROSOFT_TEAMS_APP_ID` e `HELPDESK_APP_BASE_URL`.

- [ ] **Step 5: Executar GREEN e verificar importações/configuração**

Run: `npm test -- api/shared/ticketCommunicationRules.test.ts api/shared/ticketCommunicationTemplates.test.ts api/shared/ticketCommunicationGraph.test.ts api/shared/ticketCommunicationProcessor.test.ts api/shared/ticketCommunicationHandler.test.ts`

Run: `npx supabase test db supabase/tests/database/ticket_communications.test.sql`

Run, se Deno estiver disponível: `deno check supabase/functions/notify-ticket-communications/index.ts`

Expected: todos PASS; Deno sem erro de tipo/importação.

- [ ] **Step 6: Commit**

```bash
git add .env.example api/shared/ticketCommunicationHandler.test.ts supabase/config.toml supabase/functions/notify-ticket-communications
git commit -m "feat: adiciona edge function de comunicacoes"
```

### Task 7: Disparo não bloqueante após finalização

**Files:**
- Create: `src/services/ticketCommunicationService.ts`
- Create: `src/services/ticketCommunicationService.test.ts`
- Modify: `src/services/ticketService.ts`
- Modify: `src/services/ticketService.finishTicket.test.ts`

**Interfaces:**
- Produces `notifyTicketResolved(ticketId): Promise<void>` que nunca lança para o chamador.
- `TicketService.finishTicket` continua retornando `Promise<Ticket>` e dispara a comunicação somente depois de `updateTicket` resolver.

- [ ] **Step 1: Escrever teste RED do cliente frontend**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));

import { notifyTicketResolved } from './ticketCommunicationService';

beforeEach(() => mocks.invoke.mockReset());

it('invoca ticket_resolved e absorve falha de comunicação', async () => {
  mocks.invoke.mockResolvedValue({ data: null, error: new Error('offline') });
  await expect(notifyTicketResolved('ticket-1')).resolves.toBeUndefined();
  expect(mocks.invoke).toHaveBeenCalledWith('notify-ticket-communications', {
    body: { action: 'ticket_resolved', ticketId: 'ticket-1' },
  });
});
```

- [ ] **Step 2: Executar RED**

Run: `npm test -- src/services/ticketCommunicationService.test.ts`

Expected: FAIL por serviço ausente.

- [ ] **Step 3: Implementar serviço não bloqueante**

```ts
export async function notifyTicketResolved(ticketId: string): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('notify-ticket-communications', {
      body: { action: 'ticket_resolved', ticketId },
    });
    if (error || (data as { error?: string } | null)?.error) {
      console.warn('[ticket-communications] convite pendente para retry', { ticketId });
    }
  } catch {
    console.warn('[ticket-communications] convite pendente para retry', { ticketId });
  }
}
```

- [ ] **Step 4: Escrever testes RED da ordem na finalização**

Acrescentar mock de `notifyTicketResolved`. Testar que ele não é chamado quando `updateTicket` rejeita e é chamado depois do update bem-sucedido, tanto com quanto sem atribuição ao finalizador.

- [ ] **Step 5: Alterar `TicketService.finishTicket` minimamente**

```ts
const resolvedTicket = await this.updateTicket(ticketId, updates);
void notifyTicketResolved(ticketId);
return resolvedTicket;
```

Importar o novo serviço. Não aguardar a comunicação e não alterar toast/dialog do componente.

- [ ] **Step 6: Executar GREEN**

Run: `npm test -- src/services/ticketCommunicationService.test.ts src/services/ticketService.finishTicket.test.ts src/utils/finishTicketOrchestration.test.ts`

Expected: PASS; finalização falha continua sem sucesso visual, finalização concluída não é revertida por comunicação.

- [ ] **Step 7: Commit**

```bash
git add src/services/ticketCommunicationService.ts src/services/ticketCommunicationService.test.ts src/services/ticketService.ts src/services/ticketService.finishTicket.test.ts
git commit -m "feat: dispara convite ao finalizar ticket"
```

### Task 8: Aplicativo Teams e runbook de implantação

**Files:**
- Create: `teams/responsum-notifications/manifest.template.json`
- Create: `docs/DEPLOY-TICKET-COMMUNICATIONS.md`
- Modify: `.gitignore`

**Interfaces:**
- O manifesto usa `MICROSOFT_TEAMS_APP_ID` como `id` do app Teams e `MICROSOFT_CLIENT_ID` em `webApplicationInfo.id` durante o empacotamento administrativo.
- O runbook produz um pacote com `manifest.json`, `color.png` 192×192 e `outline.png` 32×32; o ZIP gerado fica ignorado pelo Git.

- [ ] **Step 1: Criar manifesto versionado**

Usar o schema oficial estável validado no Developer Portal durante a execução. Não declarar bot, chat ou canal. Declarar somente a permissão RSC de aplicação `TeamsActivity.Send.User`, opção de menor privilégio para o app pessoal instalado. O template versionado será:

```json
{
  "$schema": "https://developer.microsoft.com/en-us/json-schemas/teams/v1.22/MicrosoftTeams.schema.json",
  "manifestVersion": "1.22",
  "version": "1.0.0",
  "id": "${MICROSOFT_TEAMS_APP_ID}",
  "developer": {
    "name": "Bismarchi Pires",
    "websiteUrl": "https://www.responsum.com.br",
    "privacyUrl": "https://www.responsum.com.br/privacy",
    "termsOfUseUrl": "https://www.responsum.com.br/terms"
  },
  "name": {
    "short": "Responsum",
    "full": "Responsum - Avisos de Chamados"
  },
  "description": {
    "short": "Avisos de chamados do Responsum.",
    "full": "Receba no feed Atividade do Teams avisos sobre chamados que aguardam resposta ou avaliação."
  },
  "icons": {
    "outline": "outline.png",
    "color": "color.png"
  },
  "accentColor": "#D5B170",
  "validDomains": ["www.responsum.com.br"],
  "webApplicationInfo": {
    "id": "${MICROSOFT_CLIENT_ID}",
    "resource": "api://www.responsum.com.br/${MICROSOFT_CLIENT_ID}"
  },
  "authorization": {
    "permissions": {
      "resourceSpecific": [
        {
          "name": "TeamsActivity.Send.User",
          "type": "Application"
        }
      ]
    }
  }
}
```

Validar as URLs legais no Developer Portal. Se o tenant exigir páginas existentes para publicação no catálogo, apontar `privacyUrl` e `termsOfUseUrl` para as páginas corporativas aprovadas antes do upload; isso não altera a API nem o manifesto versionado da aplicação.

- [ ] **Step 2: Escrever runbook completo**

Documentar na ordem:

1. conceder consentimento administrativo no Entra para `Mail.Send` e `User.Read.All`;
2. restringir `Mail.Send` à caixa `MICROSOFT_NOTIFICATION_SENDER` por Application Access Policy quando disponível no tenant;
3. preparar e validar ícones a partir dos ativos oficiais do Responsum;
4. substituir os dois identificadores do template, criar ZIP e publicar no catálogo da organização;
5. aprovar `TeamsActivity.Send.User` no manifesto e instalar o app no escopo pessoal dos usuários por política do Teams Admin Center, concedendo o consentimento específico ao recurso;
6. configurar os seis Edge Function secrets;
7. aplicar migration e fazer deploy da Function;
8. criar uma secret key Supabase nomeada `ticket-communications` e o cron `0 12 * * *` chamando `{SUPABASE_URL}/functions/v1/notify-ticket-communications` com body `{ "action": "daily" }` e a secret key armazenada no Vault/painel e enviada somente em `apikey`, nunca no repositório;
9. realizar smoke test com usuário de homologação e consultas de auditoria na tabela de entregas;
10. diagnosticar `403` de Graph, app não instalado, UPN não resolvido e `429`.

- [ ] **Step 3: Ignorar artefatos gerados**

Adicionar `teams/responsum-notifications/*.zip`, `teams/responsum-notifications/manifest.json`, `teams/responsum-notifications/color.png` e `teams/responsum-notifications/outline.png` ao `.gitignore`; manter apenas o template versionado.

- [ ] **Step 4: Revisar documentação contra o código**

Run: `rg -n "Mail.Send|User.Read.All|TeamsActivity.Send.User|0 12 \* \* \*|MICROSOFT_NOTIFICATION_SENDER|HELPDESK_APP_BASE_URL" docs/DEPLOY-TICKET-COMMUNICATIONS.md .env.example teams/responsum-notifications/manifest.template.json`

Expected: todas as permissões, variáveis e cron aparecem nos arquivos corretos; nenhum valor secreto aparece.

- [ ] **Step 5: Commit**

```bash
git add .gitignore docs/DEPLOY-TICKET-COMMUNICATIONS.md teams/responsum-notifications/manifest.template.json
git commit -m "docs: adiciona implantacao de email e teams"
```

### Task 9: Verificação integral e entrega operacional

**Files:**
- Modify somente arquivos das Tasks 1–8 se a verificação revelar defeito reproduzível.

**Interfaces:**
- Produces evidência de testes, lint, build, migration, Function e smoke tests.

- [ ] **Step 1: Executar suíte direcionada**

Run: `npm test -- api/shared/ticketCommunicationRules.test.ts api/shared/ticketCommunicationTemplates.test.ts api/shared/ticketCommunicationGraph.test.ts api/shared/ticketCommunicationProcessor.test.ts api/shared/ticketCommunicationHandler.test.ts src/services/ticketCommunicationService.test.ts src/services/ticketService.finishTicket.test.ts src/utils/finishTicketOrchestration.test.ts`

Run: `npx supabase test db supabase/tests/database/ticket_communications.test.sql`

Expected: todos PASS, sem warnings inesperados.

- [ ] **Step 2: Executar regressão completa**

Run: `npm test`

Expected: todos PASS.

- [ ] **Step 3: Executar lint e build**

Run: `npm run lint`

Run: `npm run build`

Expected: ambos exit code 0.

- [ ] **Step 4: Validar banco e Function**

Run, quando runtime local estiver disponível: `npx supabase db lint --local`

Run, quando Deno estiver disponível: `deno check supabase/functions/notify-ticket-communications/index.ts`

Expected: sem erros novos. Se o runtime não estiver instalado, registrar explicitamente essa limitação e executar a validação equivalente no ambiente Supabase antes do deploy.

- [ ] **Step 5: Aplicar em homologação e realizar smoke test**

Finalizar um ticket de homologação e confirmar uma linha `sent` para `resolved_feedback_invite/email`. Preparar um ticket com última mensagem do suporte há 48 horas e outro resolvido há 72 horas sem feedback; invocar `daily` e confirmar e-mail, feed Atividade, links e uma única entrega por canal. Responder/avaliar, executar novamente e confirmar ausência de novas entregas. Repetir a invocação no mesmo dia e confirmar deduplicação.

- [ ] **Step 6: Revisar escopo Git e commit de correções, se houver**

Run: `git status --short`

Confirmar que alterações preexistentes do usuário continuam fora dos commits. Se a verificação exigiu correção, criar teste RED, corrigir e commitar somente os arquivos da funcionalidade:

```bash
git add api/shared/ticketCommunicationRules.test.ts api/shared/ticketCommunicationTemplates.test.ts api/shared/ticketCommunicationGraph.test.ts api/shared/ticketCommunicationProcessor.test.ts api/shared/ticketCommunicationHandler.test.ts supabase/tests/database/ticket_communications.test.sql src/services/ticketCommunicationService.ts src/services/ticketCommunicationService.test.ts src/services/ticketService.ts src/services/ticketService.finishTicket.test.ts supabase/config.toml supabase/migrations/*_ticket_communications.sql supabase/functions/notify-ticket-communications .env.example .gitignore docs/DEPLOY-TICKET-COMMUNICATIONS.md teams/responsum-notifications/manifest.template.json
git commit -m "fix: corrige verificacao de comunicacoes de tickets"
```

Se não houve correção, não criar commit vazio.
