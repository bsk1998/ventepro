// src/pages/Activation.js
import { useState } from 'react';
import { activateLicense } from '../license';

export default function Activation({ onActivated }) {
  const [key, setKey]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState(false);

  async function handleActivate() {
    if (!key.trim()) return setError('Veuillez entrer votre clé de licence.');
    setLoading(true);
    setError('');
    try {
      const data = await activateLicense(key.trim().toUpperCase());
      setSuccess(true);
      setTimeout(() => onActivated(), 1800);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#07090F', fontFamily: 'sans-serif',
    }}>
      <div style={{
        width: 460, background: '#0F1320', borderRadius: 24,
        border: '1px solid #1B2135', padding: '40px 36px',
        boxShadow: '0 30px 80px rgba(0,0,0,.6)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: 'linear-gradient(135deg,#3B82F6,#6366F1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, margin: '0 auto 16px',
            boxShadow: '0 8px 32px #3B82F640',
          }}>⚡</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#EDF1FF' }}>VenteX AI</div>
          <div style={{ fontSize: 13, color: '#7A85AA', marginTop: 6 }}>
            Activation du logiciel
          </div>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#22C55E' }}>
              Licence activée !
            </div>
            <div style={{ fontSize: 13, color: '#7A85AA', marginTop: 8 }}>
              Bienvenue sur VenteX AI...
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 10, fontSize: 13, color: '#7A85AA' }}>
              Entrez votre clé de licence pour activer le logiciel sur cet appareil.
              Une connexion internet est requise pour cette étape.
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#A0ABCC',
                display: 'block', marginBottom: 8, letterSpacing: 1 }}>
                CLÉ DE LICENCE
              </label>
              <input
                value={key}
                onChange={e => setKey(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleActivate()}
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: 12,
                  background: '#07090F', border: `2px solid ${error ? '#EF4444' : '#1B2135'}`,
                  color: '#EDF1FF', fontSize: 16, fontFamily: 'monospace',
                  letterSpacing: 3, outline: 'none', boxSizing: 'border-box',
                  textTransform: 'uppercase', transition: 'border .15s',
                }}
                onFocus={e => { e.target.style.borderColor = '#3B82F6'; setError(''); }}
                onBlur={e => { e.target.style.borderColor = error ? '#EF4444' : '#1B2135'; }}
              />
              {error && (
                <div style={{ color: '#EF4444', fontSize: 12, marginTop: 6, fontWeight: 600 }}>
                  ⚠ {error}
                </div>
              )}
            </div>

            <button
              onClick={handleActivate}
              disabled={loading}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                background: loading ? '#1B2135' : 'linear-gradient(135deg,#3B82F6,#6366F1)',
                color: '#fff', fontSize: 15, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'sans-serif', transition: 'all .2s',
                boxShadow: loading ? 'none' : '0 4px 20px #3B82F640',
              }}>
              {loading ? '⏳ Activation en cours...' : '🔑 Activer le logiciel'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#3A4260' }}>
              Vous n'avez pas de clé ? Contactez-nous pour acheter une licence.
            </div>
          </>
        )}
      </div>
    </div>
  );
}