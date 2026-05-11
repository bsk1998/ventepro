import { useState, useEffect } from 'react';

const GITHUB_REPO = 'boushakiahmed1998-star/ventex-app';
const CURRENT_VERSION = '1.0.0';

export default function UpdateChecker() {
  const [update, setUpdate] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!window.electronAPI?.isElectron) return;
    checkForUpdate();
  }, []);

  async function checkForUpdate() {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        { headers: { 'Accept': 'application/vnd.github.v3+json' } }
      );
      if (!res.ok) return;
      const data = await res.json();

      const latest = data.tag_name?.replace('v', '') || '';
      if (!latest) return;

      if (isNewer(latest, CURRENT_VERSION)) {
        const exe = data.assets?.find(a => a.name.endsWith('.exe'));
        setUpdate({
          version: latest,
          notes: data.body || '',
          downloadUrl: exe?.browser_download_url || data.html_url,
        });
        setVisible(true);
      }
    } catch (e) {
      // Pas de connexion ou erreur → on ignore silencieusement
    }
  }

  function isNewer(latest, current) {
    const l = latest.split('.').map(Number);
    const c = current.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if ((l[i] || 0) > (c[i] || 0)) return true;
      if ((l[i] || 0) < (c[i] || 0)) return false;
    }
    return false;
  }

  function openDownload() {
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(update.downloadUrl);
    } else {
      window.open(update.downloadUrl, '_blank');
    }
  }

  if (!visible || !update) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      width: 340, background: '#0F1320',
      border: '1px solid #3B82F640',
      borderRadius: 16, padding: '18px 20px',
      boxShadow: '0 20px 60px rgba(0,0,0,.7)',
      animation: 'slideIn .3s ease',
    }}>
      <style>{`
        @keyframes slideIn {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg,#3B82F6,#6366F1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>🔄</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#EDF1FF' }}>
            Mise à jour disponible
          </div>
          <div style={{ fontSize: 11, color: '#7A85AA' }}>
            VenteX AI v{update.version}
          </div>
        </div>
        <button onClick={() => setVisible(false)} style={{
          marginLeft: 'auto', background: 'none', border: 'none',
          color: '#7A85AA', cursor: 'pointer', fontSize: 18, lineHeight: 1,
        }}>×</button>
      </div>

      {/* Notes */}
      {update.notes && (
        <div style={{
          background: '#07090F', borderRadius: 8, padding: '8px 12px',
          marginBottom: 12, fontSize: 12, color: '#A0ABCC', lineHeight: 1.5,
          maxHeight: 80, overflowY: 'auto',
        }}>
          {update.notes.slice(0, 200)}{update.notes.length > 200 ? '...' : ''}
        </div>
      )}

      {/* Boutons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={openDownload} style={{
          flex: 1, padding: '9px', borderRadius: 10, border: 'none',
          background: 'linear-gradient(135deg,#3B82F6,#6366F1)',
          color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}>
          ⬇️ Télécharger
        </button>
        <button onClick={() => setVisible(false)} style={{
          padding: '9px 14px', borderRadius: 10,
          background: 'transparent', border: '1px solid #1B2135',
          color: '#7A85AA', fontSize: 12, cursor: 'pointer',
        }}>
          Plus tard
        </button>
      </div>

      <div style={{ fontSize: 10, color: '#3A4260', marginTop: 8, textAlign: 'center' }}>
        Version actuelle : v{CURRENT_VERSION}
      </div>
    </div>
  );
}
