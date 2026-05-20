const STORAGE_KEY = 'vx_license';
const API_URL = 'https://ventexai2.onrender.com';
const LICENSE_HMAC_SECRET = process.env.REACT_APP_LICENSE_HMAC_SECRET || '';

function bytesToHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function normalizeSignature(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^[0-9a-f]{64}$/i.test(raw)) return raw.toLowerCase();
  try {
    const binary = atob(raw.replace(/-/g, '+').replace(/_/g, '/'));
    return bytesToHex(Uint8Array.from(binary, c => c.charCodeAt(0)));
  } catch {
    return '';
  }
}

async function hmacSha256Hex(secret, payload) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return bytesToHex(new Uint8Array(signature));
}

async function verifyLicenseSignature(license, machineId) {
  if (!LICENSE_HMAC_SECRET) return false;
  const signature = normalizeSignature(license.signature);
  if (!signature) return false;
  const payload = license.signedPayload || `${license.key}:${machineId}`;
  const expected = await hmacSha256Hex(LICENSE_HMAC_SECRET, payload);
  return timingSafeEqual(signature, expected);
}

// Génère un ID unique pour cette machine
export async function getMachineId() {
  if (window.electronAPI?.getMachineId) {
    return await window.electronAPI.getMachineId();
  }
  // Fallback si pas Electron
  let id = localStorage.getItem('vx_machine_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('vx_machine_id', id);
  }
  return id;
}

// Récupère la licence stockée localement
export function getStoredLicense() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Active la licence via le serveur (nécessite internet, une seule fois)
export async function activateLicense(licenseKey) {
  const machineId = await getMachineId();
  const res = await fetch(`${API_URL}/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licenseKey, machineId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail?.message || data.message || 'Activation échouée');
  const signature = data.signature || data.license?.signature || '';
  const signedPayload = data.signedPayload || data.license?.signedPayload || `${licenseKey}:${machineId}`;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    key: licenseKey,
    machineId,
    signature,
    signedPayload,
    activatedAt: new Date().toISOString(),
    clientName: data.clientName || '',
  }));
  return data;
}

// Vérifie la licence localement (offline)
export async function checkLicense() {
  const license = getStoredLicense();
  if (!license) return { valid: false, reason: 'no_license' };
  const machineId = await getMachineId();
  if (license.machineId !== machineId) return { valid: false, reason: 'wrong_machine' };
  if (!(await verifyLicenseSignature(license, machineId))) {
    return { valid: false, reason: 'bad_signature' };
  }
  return { valid: true, license };
}
