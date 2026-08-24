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
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const response = await fetchImpl(
    `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
  );
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.access_token) {
    throw new Error(`Falha ao autenticar no Microsoft Graph (${response.status})`);
  }
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

function emailVariants(email) {
  const normalized = String(email).trim().toLowerCase();
  const variants = new Set([normalized]);
  if (normalized.endsWith('@bpplaw.com.br')) {
    variants.add(normalized.replace('@bpplaw.com.br', '@bismarchipires.com.br'));
  }
  if (normalized.endsWith('@bismarchipires.com.br')) {
    variants.add(normalized.replace('@bismarchipires.com.br', '@bpplaw.com.br'));
  }
  return [...variants].filter(Boolean);
}

async function resolveGraphUserId(email, graphRequest) {
  for (const variant of emailVariants(email)) {
    const direct = await graphRequest(
      `/users/${encodeURIComponent(variant)}?$select=id`,
      {},
      { allowNotFound: true },
    );
    if (direct.ok) return String((await direct.json()).id);

    const escaped = variant.replace(/'/g, "''");
    const filter = encodeURIComponent(`mail eq '${escaped}' or userPrincipalName eq '${escaped}'`);
    const filtered = await graphRequest(`/users?$filter=${filter}&$select=id&$top=1`);
    const user = (await filtered.json()).value?.[0];
    if (user?.id) return String(user.id);
  }
  return null;
}

export function createGraphClient(
  config,
  {
    fetchImpl = fetch,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {},
) {
  let tokenPromise;
  const getToken = () => tokenPromise ??= requestToken(config, fetchImpl);

  const graphRequest = async (path, init = {}, options = {}, attempt = 1) => {
    const token = await getToken();
    const response = await fetchImpl(`https://graph.microsoft.com/v1.0${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
    if ([408, 429].includes(response.status) || response.status >= 500) {
      if (attempt < 3) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const retryAfterSeconds = retryAfterHeader === null ? NaN : Number(retryAfterHeader);
        await sleep(Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : 250 * 2 ** (attempt - 1));
        return graphRequest(path, init, options, attempt + 1);
      }
    }
    if (options.allowNotFound && response.status === 404) return response;
    if (!response.ok) throw await sanitizedGraphError(response);
    return response;
  };

  const sendEmail = ({ to, subject, html, text }) => graphRequest(
    `/users/${encodeURIComponent(config.sender)}/sendMail`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: buildMimeBase64({ from: config.sender, to, subject, html, text }),
    },
  );
  const sendTeamsActivity = ({ userId, topic, previewText, webUrl }) => graphRequest(
    `/users/${encodeURIComponent(userId)}/teamwork/sendActivityNotification`,
    {
      method: 'POST',
      body: JSON.stringify({
        teamsAppId: config.teamsAppId,
        activityType: 'systemDefault',
        topic: { source: 'text', value: topic, webUrl },
        previewText: { content: previewText },
      }),
    },
  );

  return {
    sendEmail,
    resolveUserId: (email) => resolveGraphUserId(email, graphRequest),
    sendTeamsActivity,
  };
}
