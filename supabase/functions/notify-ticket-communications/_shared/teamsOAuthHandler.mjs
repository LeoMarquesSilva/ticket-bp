import {
  buildTeamsAuthorizationUrl,
  createTeamsOAuthState,
  verifyTeamsOAuthState,
} from './teamsDelegatedAuth.mjs';

export const TEAMS_OAUTH_ACTIONS = new Set([
  'teams_oauth_status',
  'teams_oauth_start',
  'teams_oauth_disconnect',
]);

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
