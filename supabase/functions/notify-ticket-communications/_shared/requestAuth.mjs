export function readNamedSecret(secretKeysJson, name) {
  if (typeof secretKeysJson !== 'string' || !secretKeysJson.trim()) return '';
  try {
    const parsed = JSON.parse(secretKeysJson);
    const value = parsed?.[name];
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

function bearerToken(authorization) {
  if (typeof authorization !== 'string') return '';
  const match = authorization.match(/^Bearer\s+(\S+)/i);
  return match?.[1] ?? '';
}

function timingSafeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || !left || !right) return false;
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a[index] ^ b[index];
  return diff === 0;
}

export async function resolveTicketCommunicationAuth({
  authorization,
  apikey,
  namedSecret,
  getUser,
}) {
  const token = bearerToken(authorization);
  if (token) {
    const user = await getUser(token);
    return user?.id ? { authMode: 'user' } : null;
  }
  if (timingSafeEqual(apikey, namedSecret)) return { authMode: 'secret' };
  return null;
}
