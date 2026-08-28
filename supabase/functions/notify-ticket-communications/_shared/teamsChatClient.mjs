import {
  OAUTH_SCOPES,
  decryptRefreshToken,
  encryptRefreshToken,
} from './teamsDelegatedAuth.mjs';

const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0';
const TOKEN_SAFETY_MS = 60_000;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function responseJson(response) {
  return response.json().catch(() => ({}));
}

async function providerError(response, operation) {
  const body = await responseJson(response);
  const code = String(body?.error?.code ?? body?.error ?? 'unknown_error').slice(0, 100);
  const graphMessage = String(body?.error?.message ?? '').replace(/\s+/g, ' ').slice(0, 240);
  const error = new Error(`Microsoft ${operation} failed (${response.status}, ${code})`);
  error.status = response.status;
  error.code = code;
  error.graphMessage = graphMessage;
  return error;
}

function connectedStatus(credential) {
  if (!credential) {
    return {
      connected: false,
      accountEmail: null,
      accountDisplayName: null,
      connectedAt: null,
    };
  }
  return {
    connected: true,
    accountEmail: credential.accountEmail,
    accountDisplayName: credential.accountDisplayName,
    connectedAt: credential.connectedAt,
  };
}

export function createTeamsChatClient({
  config,
  store,
  fetchImpl = fetch,
  cryptoImpl = globalThis.crypto,
  now = () => new Date(),
}) {
  let tokenCache;
  let tokenPromise;

  async function requestToken(parameters) {
    const response = await fetchImpl(
      `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          ...parameters,
          scope: OAUTH_SCOPES.join(' '),
        }).toString(),
      },
    );
    if (!response.ok) throw await providerError(response, 'OAuth');
    const body = await responseJson(response);
    if (typeof body.access_token !== 'string' || !body.access_token) {
      throw new Error('Microsoft OAuth response missing access token');
    }
    return body;
  }

  async function saveCredential(credential, refreshToken) {
    const encryptedRefreshToken = await encryptRefreshToken(refreshToken, {
      encryptionKey: config.tokenEncryptionKey,
      cryptoImpl,
    });
    return store.save({
      accountId: credential.accountId,
      accountEmail: credential.accountEmail,
      accountDisplayName: credential.accountDisplayName,
      encryptedRefreshToken,
      connectedAt: credential.connectedAt,
    });
  }

  async function exchangeCode(code) {
    if (typeof code !== 'string' || !code) throw new TypeError('invalid_authorization_code');
    const token = await requestToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
    });
    if (typeof token.refresh_token !== 'string' || !token.refresh_token) {
      throw new Error('Microsoft OAuth response missing refresh token');
    }
    const meResponse = await fetchImpl(
      `${GRAPH_ROOT}/me?$select=id,displayName,mail,userPrincipalName`,
      { headers: { Authorization: `Bearer ${token.access_token}` } },
    );
    if (!meResponse.ok) throw await providerError(meResponse, 'Graph /me');
    const me = await responseJson(meResponse);
    const accountEmail = String(me.mail ?? me.userPrincipalName ?? '').trim().toLowerCase();
    if (typeof me.id !== 'string' || !me.id || !accountEmail) {
      throw new Error('Microsoft Graph /me returned an invalid account');
    }
    const connectedAt = now().toISOString();
    const credential = await saveCredential({
      accountId: me.id,
      accountEmail,
      accountDisplayName: String(me.displayName ?? '').trim() || null,
      connectedAt,
    }, token.refresh_token);
    const expiresIn = Number(token.expires_in);
    tokenCache = {
      accessToken: token.access_token,
      expiresAt: now().getTime() + (Number.isFinite(expiresIn) ? expiresIn * 1000 : 3_600_000),
    };
    return connectedStatus(credential);
  }

  async function refreshAccessToken(force = false) {
    if (!force && tokenCache && now().getTime() < tokenCache.expiresAt - TOKEN_SAFETY_MS) {
      return tokenCache.accessToken;
    }
    if (!force && tokenPromise) return tokenPromise;
    tokenPromise = (async () => {
      const credential = await store.get();
      if (!credential) {
        const error = new Error('Teams account is not connected');
        error.code = 'teams_not_connected';
        throw error;
      }
      const refreshToken = await decryptRefreshToken(credential.encryptedRefreshToken, {
        encryptionKey: config.tokenEncryptionKey,
        cryptoImpl,
      });
      const token = await requestToken({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });
      if (typeof token.refresh_token === 'string' && token.refresh_token) {
        await saveCredential(credential, token.refresh_token);
      }
      const expiresIn = Number(token.expires_in);
      tokenCache = {
        accessToken: token.access_token,
        expiresAt: now().getTime() + (Number.isFinite(expiresIn) ? expiresIn * 1000 : 3_600_000),
      };
      return token.access_token;
    })();
    try {
      return await tokenPromise;
    } finally {
      tokenPromise = undefined;
    }
  }

  async function graphRequest(path, init, retryUnauthorized = true) {
    const token = await refreshAccessToken(!retryUnauthorized);
    const response = await fetchImpl(`${GRAPH_ROOT}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (response.status === 401 && retryUnauthorized) {
      tokenCache = undefined;
      return graphRequest(path, init, false);
    }
    if (!response.ok) throw await providerError(response, 'Graph');
    return responseJson(response);
  }

  async function sendChat({ recipientUserId, previewText, ticketUrl, html, chatHtml, card }) {
    const credential = await store.get();
    if (!credential) {
      const error = new Error('Teams account is not connected');
      error.code = 'teams_not_connected';
      throw error;
    }
    const chat = await graphRequest('/chats', {
      method: 'POST',
      body: JSON.stringify({
        chatType: 'oneOnOne',
        members: [credential.accountId, recipientUserId].map((userId) => ({
          '@odata.type': '#microsoft.graph.aadUserConversationMember',
          roles: ['owner'],
          'user@odata.bind': `${GRAPH_ROOT}/users('${userId}')`,
        })),
      }),
    });
    if (typeof chat.id !== 'string' || !chat.id) throw new Error('Microsoft Graph returned an invalid chat');
    const payload = card
      ? {
          body: {
            contentType: 'html',
            content: `${typeof chatHtml === 'string' ? chatHtml : ''}<attachment id="responsum-card"></attachment>`,
          },
          attachments: [{
            id: 'responsum-card',
            contentType: 'application/vnd.microsoft.card.adaptive',
            contentUrl: null,
            content: JSON.stringify(card),
          }],
        }
      : {
          body: {
            contentType: 'html',
            content: typeof html === 'string' && html
              ? html
              : `<p>${escapeHtml(previewText)}</p><p><a href="${escapeHtml(ticketUrl)}">Abrir chamado no Responsum</a></p>`,
          },
        };
    await graphRequest(`/chats/${encodeURIComponent(chat.id)}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  return {
    exchangeCode,
    getStatus: async () => connectedStatus(await store.get()),
    disconnect: () => store.disconnect(),
    sendChat,
  };
}
