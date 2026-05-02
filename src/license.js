const STORAGE_KEY = 'vx_license';
const API_URL = 'https://ventexai2.onrender.com';

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
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    key: licenseKey,
    machineId,
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
  return { valid: true, license };
}