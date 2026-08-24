function utf8Base64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function foldBase64(value) {
  return utf8Base64(value).match(/.{1,76}/g)?.join('\r\n') ?? '';
}

function encodedSubjectWords(value) {
  const encoder = new TextEncoder();
  const words = [];
  let bytes = [];

  for (const character of String(value)) {
    const characterBytes = [...encoder.encode(character)];
    if (bytes.length && bytes.length + characterBytes.length > 45) {
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      words.push(`=?UTF-8?B?${btoa(binary)}?=`);
      bytes = [];
    }
    bytes.push(...characterBytes);
  }

  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  words.push(`=?UTF-8?B?${btoa(binary)}?=`);
  return words;
}

function encodedSubjectHeader(subject) {
  const words = encodedSubjectWords(subject);
  if (words.length === 1) return `Subject: ${words[0]}`;
  return ['Subject:', ...words.map((word) => ` ${word}`)].join('\r\n');
}

function buildMimeBase64({ from, to, subject, html, text }) {
  const boundary = 'responsum-ticket-notification';
  const safeFrom = String(from).replace(/[\r\n]/g, '');
  const safeTo = String(to).replace(/[\r\n]/g, '');
  const mime = [
    `From: ${safeFrom}`,
    `To: ${safeTo}`,
    encodedSubjectHeader(subject),
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    foldBase64(text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    foldBase64(html),
    `--${boundary}--`,
  ].join('\r\n');
  return utf8Base64(mime);
}

function isRetryable(response) {
  return [408, 429].includes(response.status) || response.status >= 500;
}

function retryDelayMs(response, attempt) {
  const retryAfterHeader = response.headers.get('Retry-After');
  const retryAfterSeconds = retryAfterHeader === null ? NaN : Number(retryAfterHeader);
  return Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : 250 * 2 ** (attempt - 1);
}

async function requestToken(config, fetchImpl, sleep) {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetchImpl(
      `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      },
    );
    if (isRetryable(response) && attempt < 3) {
      await sleep(retryDelayMs(response, attempt));
      continue;
    }

    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json.access_token) {
      throw new Error(`Falha ao autenticar no Microsoft Graph (${response.status})`);
    }
    return String(json.access_token);
  }

  throw new Error('Falha ao autenticar no Microsoft Graph');
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
  const variants = emailVariants(email);
  for (const variant of variants) {
    const direct = await graphRequest(
      `/users/${encodeURIComponent(variant)}?$select=id,userPrincipalName,mail`,
      {},
      { allowNotFound: true },
    );
    if (!direct.ok) continue;
    const user = await direct.json();
    if (user?.id && String(user.userPrincipalName ?? '').trim().toLowerCase() === variant) {
      return String(user.id);
    }
  }

  for (const variant of variants) {
    const escaped = variant.replace(/'/g, "''");
    const filter = encodeURIComponent(`mail eq '${escaped}'`);
    const filtered = await graphRequest(`/users?$filter=${filter}&$select=id,mail,userPrincipalName&$top=2`);
    const users = (await filtered.json()).value;
    const matches = Array.isArray(users)
      ? users.filter((user) => user?.id && String(user.mail ?? '').trim().toLowerCase() === variant)
      : [];
    if (matches.length === 1) return String(matches[0].id);
    if (matches.length > 1) return null;
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
  const getToken = () => {
    if (!tokenPromise) {
      tokenPromise = requestToken(config, fetchImpl, sleep).catch((error) => {
        tokenPromise = undefined;
        throw error;
      });
    }
    return tokenPromise;
  };

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
    if (isRetryable(response) && attempt < 3) {
      await sleep(retryDelayMs(response, attempt));
      return graphRequest(path, init, options, attempt + 1);
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
