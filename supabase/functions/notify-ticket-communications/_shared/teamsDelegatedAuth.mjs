const OAUTH_SCOPES = Object.freeze([
  'openid',
  'profile',
  'offline_access',
  'User.Read',
  'Chat.Create',
  'ChatMessage.Send',
]);
const STATE_TTL_MS = 10 * 60 * 1000;

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function base64UrlToBytes(value) {
  if (typeof value !== 'string' || !value) throw new TypeError('invalid_base64_value');
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  try {
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    throw new TypeError('invalid_base64_value');
  }
}

function encryptionKeyBytes(value) {
  let bytes;
  try {
    bytes = base64UrlToBytes(value);
  } catch {
    throw new TypeError('invalid_oauth_encryption_key');
  }
  if (bytes.length !== 32) throw new TypeError('invalid_oauth_encryption_key');
  return bytes;
}

function cryptoApi(cryptoImpl) {
  const value = cryptoImpl ?? globalThis.crypto;
  if (!value?.subtle || !value?.getRandomValues) throw new TypeError('crypto_unavailable');
  return value;
}

function randomBytes(length, cryptoImpl, factory) {
  if (factory) {
    const value = factory(length);
    if (!(value instanceof Uint8Array) || value.length !== length) {
      throw new TypeError('invalid_random_bytes');
    }
    return value;
  }
  return cryptoApi(cryptoImpl).getRandomValues(new Uint8Array(length));
}

async function hmacKey(encryptionKey, cryptoImpl, usages) {
  return cryptoApi(cryptoImpl).subtle.importKey(
    'raw',
    encryptionKeyBytes(encryptionKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages,
  );
}

export function isValidTokenEncryptionKey(value) {
  try {
    encryptionKeyBytes(value);
    return true;
  } catch {
    return false;
  }
}

export function buildTeamsAuthorizationUrl(config, state) {
  const url = new URL(
    `/` + `${encodeURIComponent(config.tenantId)}/oauth2/v2.0/authorize`,
    'https://login.microsoftonline.com',
  );
  url.search = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    response_mode: 'query',
    scope: OAUTH_SCOPES.join(' '),
    prompt: 'select_account',
    state,
  }).toString();
  return url.toString();
}

export async function createTeamsOAuthState({
  encryptionKey,
  now = () => new Date(),
  randomBytes: randomFactory,
  cryptoImpl,
}) {
  const expiresAt = new Date(now().getTime() + STATE_TTL_MS).toISOString();
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({
    expiresAt,
    nonce: bytesToBase64Url(randomBytes(16, cryptoImpl, randomFactory)),
  })));
  const key = await hmacKey(encryptionKey, cryptoImpl, ['sign']);
  const signature = await cryptoApi(cryptoImpl).subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload),
  );
  return `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifyTeamsOAuthState(state, {
  encryptionKey,
  now = () => new Date(),
  cryptoImpl,
}) {
  try {
    const [payload, signature, extra] = String(state ?? '').split('.');
    if (!payload || !signature || extra) throw new Error('invalid');
    const key = await hmacKey(encryptionKey, cryptoImpl, ['verify']);
    const valid = await cryptoApi(cryptoImpl).subtle.verify(
      'HMAC',
      key,
      base64UrlToBytes(signature),
      new TextEncoder().encode(payload),
    );
    if (!valid) throw new Error('invalid');
    const parsed = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
    if (typeof parsed.expiresAt !== 'string' || typeof parsed.nonce !== 'string') {
      throw new Error('invalid');
    }
    const expiresAt = new Date(parsed.expiresAt);
    if (!Number.isFinite(expiresAt.getTime())) throw new Error('invalid');
    if (now().getTime() > expiresAt.getTime()) throw new Error('expired');
    return { expiresAt: expiresAt.toISOString() };
  } catch (error) {
    if (error?.message === 'expired') throw new Error('expired_oauth_state');
    throw new Error('invalid_oauth_state');
  }
}

export async function encryptRefreshToken(refreshToken, {
  encryptionKey,
  randomBytes: randomFactory,
  cryptoImpl,
}) {
  if (typeof refreshToken !== 'string' || !refreshToken) {
    throw new TypeError('invalid_refresh_token');
  }
  const cryptoValue = cryptoApi(cryptoImpl);
  const iv = randomBytes(12, cryptoValue, randomFactory);
  const key = await cryptoValue.subtle.importKey(
    'raw',
    encryptionKeyBytes(encryptionKey),
    'AES-GCM',
    false,
    ['encrypt'],
  );
  const ciphertext = await cryptoValue.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(refreshToken),
  );
  return {
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
    iv: bytesToBase64Url(iv),
  };
}

export async function decryptRefreshToken(record, { encryptionKey, cryptoImpl }) {
  try {
    const cryptoValue = cryptoApi(cryptoImpl);
    const key = await cryptoValue.subtle.importKey(
      'raw',
      encryptionKeyBytes(encryptionKey),
      'AES-GCM',
      false,
      ['decrypt'],
    );
    const plaintext = await cryptoValue.subtle.decrypt(
      { name: 'AES-GCM', iv: base64UrlToBytes(record?.iv) },
      key,
      base64UrlToBytes(record?.ciphertext),
    );
    const value = new TextDecoder().decode(plaintext);
    if (!value) throw new Error('empty');
    return value;
  } catch (error) {
    if (error?.message === 'invalid_oauth_encryption_key') throw error;
    throw new Error('invalid_encrypted_refresh_token');
  }
}

export { OAUTH_SCOPES };
