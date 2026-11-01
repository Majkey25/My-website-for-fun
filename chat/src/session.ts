// Short-lived chat sessions: issued once a Turnstile check passes, then sent as a bearer token.
// The token is `<id>.<expiry ms>.<HMAC-SHA256 of both>`, so verifying it needs no storage.

export const SESSION_TTL_MS = 30 * 60 * 1000;
const encoder = new TextEncoder();

const toBase64Url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  // One leftover character (length % 4 === 1) is not valid base64; atob would throw.
  if (!/^[A-Za-z0-9_-]+$/.test(text) || text.length % 4 === 1) return null;
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** A secret shorter than 32 characters is a configuration error, not a usable key. */
export function hasStrongSecret(secret: string | undefined): secret is string {
  return typeof secret === 'string' && secret.length >= 32;
}

const hmacKey = (secret: string) =>
  crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);

export async function issueSession(secret: string, now = Date.now()) {
  const expires = now + SESSION_TTL_MS;
  const payload = `${crypto.randomUUID()}.${expires}`;
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret),
    encoder.encode(payload),
  );
  return { token: `${payload}.${toBase64Url(signature)}`, expires };
}

/** Returns the session id for a valid, unexpired token, otherwise null. */
export async function verifySession(
  secret: string,
  token: string,
  now = Date.now(),
): Promise<string | null> {
  const [id, expires, signature, extra] = token.split('.');
  if (extra !== undefined || !id || !expires || !signature) return null;
  if (!/^\d{13}$/.test(expires) || Number(expires) <= now) return null;
  const bytes = fromBase64Url(signature);
  if (!bytes) return null;
  // subtle.verify compares in constant time.
  const valid = await crypto.subtle.verify(
    'HMAC',
    await hmacKey(secret),
    bytes,
    encoder.encode(`${id}.${expires}`),
  );
  return valid ? id : null;
}
