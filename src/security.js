const PASSWORD_ALGORITHM = 'sha256';

function bytesToHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const clean = String(hex || '').trim();
  if (!/^[0-9a-f]+$/i.test(clean) || clean.length % 2 !== 0) return null;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function timingSafeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function parsePasswordRecord(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    if (parsed?.algorithm && parsed?.salt && parsed?.hash) return parsed;
  } catch {
    return null;
  }
  return null;
}

export function isPasswordHash(value) {
  return !!parsePasswordRecord(value);
}

export async function hashPassword(password, salt = null) {
  const actualSalt = salt || bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(actualSalt + password));
  return {
    algorithm: PASSWORD_ALGORITHM,
    salt: actualSalt,
    hash: bytesToHex(new Uint8Array(digest)),
  };
}

export async function serializePassword(password) {
  return JSON.stringify(await hashPassword(password));
}

export async function verifyPassword(password, storedValue, fallbackPlainText = '') {
  const record = parsePasswordRecord(storedValue);
  if (record?.algorithm === PASSWORD_ALGORITHM && record.salt && record.hash) {
    const candidate = await hashPassword(password, record.salt);
    return timingSafeEqual(candidate.hash, record.hash);
  }
  const legacy = typeof storedValue === 'string' ? storedValue.trim() : '';
  return password === (legacy || fallbackPlainText);
}

export function isHexSignature(value) {
  return !!hexToBytes(value);
}
