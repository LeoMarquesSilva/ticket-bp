import {
  buildTeamsAuthorizationUrl,
  createTeamsOAuthState,
  verifyTeamsOAuthState,
} from './teamsDelegatedAuth.mjs';
import { buildNotificationContent, TEAMS_TEMPLATE_DEFAULTS } from './templates.mjs';

export const TEAMS_OAUTH_ACTIONS = new Set([
  'teams_oauth_status',
  'teams_oauth_start',
  'teams_oauth_disconnect',
]);
export const TEAMS_TEST_ACTION = 'teams_test_send';
export const TEAMS_TEST_RECIPIENT = 'leonardo.marques@bismarchipires.com.br';
const TEST_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEST_DOMAINS = new Set(['bpplaw.com.br', 'bismarchipires.com.br']);

export function isAllowedTeamsTestRecipient(email) {
  const recipient = String(email ?? '').trim().toLowerCase();
  if (!TEST_EMAIL.test(recipient)) return false;
  return TEST_DOMAINS.has(recipient.split('@')[1]);
}

function response(status, error) {
  return { status, body: { error } };
}

function hasOnlyAction(body) {
  return body
    && typeof body === 'object'
    && !Array.isArray(body)
    && typeof body.action === 'string'
    && Object.keys(body).length === 1;
}

function callbackLocation(appPublicUrl, state) {
  const url = new URL('/categories', appPublicUrl);
  url.searchParams.set('tab', 'comunicacoes');
  url.searchParams.set('teams', state);
  return url.toString();
}

export async function handleTeamsOAuthAction({
  authMode,
  body,
  isAdmin,
  config,
  teamsClient,
  now = () => new Date(),
  randomBytes,
  cryptoImpl = globalThis.crypto,
}) {
  if (authMode !== 'user' || !isAdmin) return response(403, 'forbidden');
  if (!hasOnlyAction(body) || !TEAMS_OAUTH_ACTIONS.has(body.action)) {
    return response(400, 'invalid_body');
  }

  if (body.action === 'teams_oauth_status') {
    return { status: 200, body: { ok: true, teams: await teamsClient.getStatus() } };
  }
  if (body.action === 'teams_oauth_disconnect') {
    await teamsClient.disconnect();
    return { status: 200, body: { ok: true } };
  }

  const state = await createTeamsOAuthState({
    encryptionKey: config.tokenEncryptionKey,
    now,
    randomBytes,
    cryptoImpl,
  });
  return {
    status: 200,
    body: {
      ok: true,
      authorizationUrl: buildTeamsAuthorizationUrl(config, state),
    },
  };
}

export async function handleTeamsTestSend({
  authMode,
  isAdmin,
  email,
  type,
  appPublicUrl,
  resolveUserId,
  sendChat,
  teamsTemplateOverrides,
}) {
  if (authMode !== 'user' || !isAdmin) return response(403, 'forbidden');
  const recipient = String(email ?? '').trim().toLowerCase();
  if (!isAllowedTeamsTestRecipient(recipient)) return response(400, 'invalid_recipient');
  const userId = await resolveUserId(recipient);
  if (!userId) return response(404, 'entra_user_not_found');
  const notificationType = TEAMS_TEMPLATE_DEFAULTS[type] ? type : 'resolved_feedback_invite';
  const content = buildNotificationContent({
    type: notificationType,
    ticket: {
      id: 'teste-comunicacao',
      title: 'Mensagem de teste do Responsum',
    },
    requester: { name: 'você' },
    appBaseUrl: appPublicUrl,
    teamsTemplateOverrides,
  });
  try {
    await sendChat({
      recipientUserId: userId,
      ...content.teams,
    });
  } catch (error) {
    if (error?.code === 'teams_not_connected') return response(409, 'teams_not_connected');
    const code = typeof error?.code === 'string' && error.code
      ? error.code.slice(0, 100)
      : 'unknown_error';
    const detail = typeof error?.graphMessage === 'string' && error.graphMessage
      ? error.graphMessage
      : undefined;
    console.info('[ticket-communications] teams test send failed', {
      status: Number.isFinite(error?.status) ? error.status : null,
      code,
    });
    return { status: 502, body: { error: 'delivery_error', code, ...(detail ? { detail } : {}) } };
  }
  return { status: 200, body: { ok: true } };
}

export async function handleTeamsOAuthCallback({
  url,
  config,
  teamsClient,
  now = () => new Date(),
  cryptoImpl = globalThis.crypto,
}) {
  try {
    await verifyTeamsOAuthState(url.searchParams.get('state'), {
      encryptionKey: config.tokenEncryptionKey,
      now,
      cryptoImpl,
    });
  } catch (error) {
    return response(400, error?.message === 'expired_oauth_state'
      ? 'expired_oauth_state'
      : 'invalid_oauth_state');
  }

  const code = url.searchParams.get('code');
  if (url.searchParams.has('error') || !code) {
    return { status: 302, location: callbackLocation(config.appPublicUrl, 'error') };
  }

  try {
    await teamsClient.exchangeCode(code);
    return { status: 302, location: callbackLocation(config.appPublicUrl, 'connected') };
  } catch {
    return { status: 302, location: callbackLocation(config.appPublicUrl, 'error') };
  }
}
