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

function retryDelayMs(response, attempt, maxRetryDelayMs) {
  const retryAfterHeader = response.headers.get('Retry-After');
  const retryAfterSeconds = retryAfterHeader === null ? NaN : Number(retryAfterHeader);
  const requestedDelay = Number.isFinite(retryAfterSeconds)
    ? Math.max(0, retryAfterSeconds * 1000)
    : 250 * 2 ** (attempt - 1);
  return Math.min(requestedDelay, maxRetryDelayMs);
}

function timeoutError(operation) {
  const error = new Error(`Microsoft Graph ${operation} timeout`);
  error.code = 'network_timeout';
  return error;
}

async function fetchWithTimeout(fetchImpl, url, init, timeoutMs, operation) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      fetchImpl(url, { ...init, signal: controller.signal }),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(timeoutError(operation));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function networkError(error, operation) {
  if (error?.code === 'network_timeout') return error;
  const sanitized = new Error(`Microsoft Graph ${operation} network error`);
  sanitized.code = 'network_error';
  return sanitized;
}

async function requestToken(config, dependencies) {
  const {
    fetchImpl,
    sleep,
    now,
    tokenTimeoutMs,
    maxRetryDelayMs,
  } = dependencies;
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let response;
    try {
      response = await fetchWithTimeout(
        fetchImpl,
        `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`,
        {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        },
        tokenTimeoutMs,
        'token request',
      );
    } catch (error) {
      if (attempt < 3) {
        await sleep(Math.min(250 * 2 ** (attempt - 1), maxRetryDelayMs));
        continue;
      }
      throw networkError(error, 'token request');
    }
    if (isRetryable(response) && attempt < 3) {
      await sleep(retryDelayMs(response, attempt, maxRetryDelayMs));
      continue;
    }

    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json.access_token) {
      throw new Error(`Falha ao autenticar no Microsoft Graph (${response.status})`);
    }
    const expiresInSeconds = Number(json.expires_in);
    const lifetimeMs = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
      ? expiresInSeconds * 1000
      : 5 * 60 * 1000;
    const refreshSkewMs = Math.min(60_000, lifetimeMs / 2);
    return {
      accessToken: String(json.access_token),
      expiresAt: now() + lifetimeMs - refreshSkewMs,
    };
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
  const resolveExact = async (variant) => {
    const direct = await graphRequest(
      `/users/${encodeURIComponent(variant)}?$select=id,userPrincipalName,mail`,
      {},
      { allowNotFound: true },
    );
    if (direct.ok) {
      const user = await direct.json();
      const exactUpn = String(user?.userPrincipalName ?? '').trim().toLowerCase() === variant;
      const exactMail = String(user?.mail ?? '').trim().toLowerCase() === variant;
      if (user?.id && (exactUpn || exactMail)) return String(user.id);
    }

    const escaped = variant.replace(/'/g, "''");
    const filter = encodeURIComponent(`mail eq '${escaped}'`);
    const filtered = await graphRequest(`/users?$filter=${filter}&$select=id,mail,userPrincipalName&$top=2`);
    const users = (await filtered.json()).value;
    const matches = Array.isArray(users)
      ? users.filter((user) => user?.id && String(user.mail ?? '').trim().toLowerCase() === variant)
      : [];
    if (matches.length === 1) return String(matches[0].id);
    if (matches.length > 1) return null;
    return undefined;
  };

  for (const variant of variants) {
    const result = await resolveExact(variant);
    if (result !== undefined) return result;
  }
  return null;
}

export function createGraphClient(
  config,
  {
    fetchImpl = fetch,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now = () => Date.now(),
    tokenTimeoutMs = 10_000,
    requestTimeoutMs = 10_000,
    maxRetryDelayMs = 30_000,
  } = {},
) {
  let tokenRecord;
  let tokenPromise;
  const getToken = (forceRefresh = false) => {
    if (forceRefresh) {
      tokenRecord = undefined;
      tokenPromise = undefined;
    }
    if (tokenRecord && now() < tokenRecord.expiresAt) {
      return Promise.resolve(tokenRecord.accessToken);
    }
    if (!tokenPromise) {
      tokenPromise = requestToken(config, {
        fetchImpl,
        sleep,
        now,
        tokenTimeoutMs,
        maxRetryDelayMs,
      }).then((record) => {
        tokenRecord = record;
        return record;
      }).finally(() => {
        tokenPromise = undefined;
      });
    }
    return tokenPromise.then((record) => record.accessToken);
  };

  const graphRequest = async (path, init = {}, options = {}) => {
    let attempt = 1;
    let refreshedAfterUnauthorized = false;

    while (attempt <= 3) {
      const token = await getToken(refreshedAfterUnauthorized);
      refreshedAfterUnauthorized = false;
      let response;
      try {
        response = await fetchWithTimeout(
          fetchImpl,
          `https://graph.microsoft.com/v1.0${path}`,
          {
            ...init,
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              ...(init.headers ?? {}),
            },
          },
          requestTimeoutMs,
          'request',
        );
      } catch (error) {
        if (attempt < 3) {
          await sleep(Math.min(250 * 2 ** (attempt - 1), maxRetryDelayMs));
          attempt += 1;
          continue;
        }
        throw networkError(error, 'request');
      }

      if (response.status === 401 && !options.didRefreshToken) {
        options = { ...options, didRefreshToken: true };
        refreshedAfterUnauthorized = true;
        continue;
      }
      if (isRetryable(response) && attempt < 3) {
        await sleep(retryDelayMs(response, attempt, maxRetryDelayMs));
        attempt += 1;
        continue;
      }
      if (options.allowNotFound && response.status === 404) return response;
      if (!response.ok) throw await sanitizedGraphError(response);
      return response;
    }

    throw new Error('Microsoft Graph request exhausted retries');
  };

  const sendEmail = ({ to, subject, html, text }) => graphRequest(
    `/users/${encodeURIComponent(config.sender)}/sendMail`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: buildMimeBase64({ from: config.sender, to, subject, html, text }),
    },
  );
  return {
    sendEmail,
    resolveUserId: (email) => resolveGraphUserId(email, graphRequest),
  };
}
