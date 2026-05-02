import { useState, useEffect } from 'react';
import { db } from '../db';

const USERS = [
  { username: 'admin', password: 'admin00', role: 'admin', name: 'Administrateur' },
  { username: 'vendeur', password: '0000', role: 'employee', name: 'Vendeur' },
];

const ADKAR = [
  { ar: "اللّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّد", fr: "Ô Allah, prie sur notre Prophète Muhammad" },
  { ar: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", fr: "Gloire et louange à Allah" },
  { ar: "أستغفر الله واتوب إليه", fr: "Je demande pardon à Allah et je me repens" },
  { ar: "لا حَوْلَ وَلا قُوَّةَ إِلا بِاللَّهِ", fr: "Il n'y a de force et de puissance que par Allah" },
  { ar: "الحَمْدُ للهِ كَثيراً", fr: "Louange à Allah, abondamment" }
];

function Particles() {
  const particles = Array.from({ length: 18 }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 4 + Math.random() * 12,
    dur: 6 + Math.random() * 10,
    delay: Math.random() * 8,
    color: ['#3B82F6', '#6366F1', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B'][i % 6],
  }));

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <style>{`
        @keyframes drift {
          0%   { transform: translate(0,0) rotate(0deg); }
          50%  { transform: translate(20px,-20px) rotate(180deg); }
          100% { transform: translate(0,0) rotate(360deg); }
        }
        @keyframes pulseNeo {
          0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
          70% { box-shadow: 0 0 0 15px rgba(99, 102, 241, 0); }
          100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute', left: `${p.x}%`, top: `${p.y}%`,
          width: p.size, height: p.size, borderRadius: '50%',
          background: p.color, opacity: 0.25, filter: 'blur(1px)',
          animation: `drift ${p.dur}s ${p.delay}s infinite ease-in-out`,
        }} />
      ))}
    </div>
  );
}

export default function Login({ onLogin }) {
  const [shopName, setShopName] = useState('VentePro');
  const [profile, setProfile] = useState(null);
  const [showProf, setShowProf] = useState(false);
  const [password, setPassword] = useState('');
  const [passOpen, setPassOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dhikrIndex, setDhikrIndex] = useState(0);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      if (!loading) setDhikrIndex(prev => (prev + 1) % ADKAR.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [loading]);

  async function handleLogin() {
    if (!profile) { setError('Choisissez un profil'); return; }
    if (!password) { setPassOpen(true); setError('Mot de passe requis'); return; }
    
    setLoading(true); setError('');
    
    await new Promise(r => setTimeout(r, 1500));

    const match = USERS.find(u => u.username === profile.username && u.password === password);
    if (match) {
      onLogin({ name: match.name, role: match.role, id: null });
    } else {
      setError('Mot de passe incorrect');
      setLoading(false);
    }
  }

  return (
    <div style={{
      height: '100vh', width: '100vw', overflow: 'hidden',
      position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      background: '#0F172A',
    }}>
      <Particles />

      <div style={{
        width: 420, position: 'relative', zIndex: 10,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(40px)',
        transition: 'all 0.8s cubic-bezier(0.2, 1, 0.3, 1)',
      }}>
        
        {/* Adkar Dynamiques en haut */}
        <div style={{ textAlign: 'center', marginBottom: 25, animation: 'fadeSlideUp 1s ease' }}>
            <div style={{ fontSize: 22, color: '#6366F1', fontWeight: 'bold', marginBottom: 5 }}>{ADKAR[dhikrIndex].ar}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>{ADKAR[dhikrIndex].fr}</div>
        </div>

        <div style={{
          background: 'rgba(30, 41, 59, 0.7)',
          backdropFilter: 'blur(25px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 32,
          padding: '45px 40px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}>

          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h1 style={{ fontSize: 36, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-1.5px' }}>VentePro</h1>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: 8 }}>Gestion Commerciale</p>
          </div>

          {/* Profil */}
          <div style={{ marginBottom: 16, position: 'relative' }}>
            <button
              onClick={() => { setShowProf(!showProf); setPassOpen(false); }}
              style={{
                width: '100%', padding: '16px 20px', borderRadius: 20,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 10, color: 'rgba(99, 102, 241, 1)', fontWeight: 800, marginBottom: 4 }}>PROFIL</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{profile ? profile.name : 'Sélectionner...'}</div>
              </div>
              <span style={{ opacity: 0.4 }}>▾</span>
            </button>

            {showProf && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 10, zIndex: 100,
                background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, overflow: 'hidden',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)', animation: 'fadeSlideUp 0.2s ease'
              }}>
                {USERS.map(u => (
                  <button key={u.username} onClick={() => { setProfile(u); setShowProf(false); setPassOpen(true); }}
                    style={{ width: '100%', padding: '15px 20px', background: 'transparent', border: 'none', color: '#fff', textAlign: 'left', cursor: 'pointer', fontWeight: 500 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.15)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {u.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Code d'accès (Input invisible fusionné au bouton) */}
          <div style={{ marginBottom: 35, position: 'relative' }}>
            <div
              onClick={() => { setPassOpen(true); setShowProf(false); }}
              style={{
                width: '100%', padding: '16px 20px', borderRadius: 20,
                background: 'rgba(255,255,255,0.05)', border: passOpen ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255,255,255,0.1)',
                color: '#fff', cursor: 'text', transition: 'all 0.2s'
              }}>
              <div style={{ fontSize: 10, color: '#10B981', fontWeight: 800, marginBottom: 4 }}>CODE D'ACCÈS</div>
              
              <div style={{ display: 'flex', alignItems: 'center', height: 20 }}>
                {passOpen ? (
                   <input
                   autoFocus
                   type="password"
                   placeholder="Saisir le code..."
                   value={password}
                   onChange={e => setPassword(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && handleLogin()}
                   onBlur={() => !password && setPassOpen(false)}
                   style={{ 
                     width: '100%', background: 'transparent', border: 'none', outline: 'none', 
                     color: '#fff', fontSize: 16, letterSpacing: password ? '4px' : 'normal',
                     padding: 0
                   }}
                 />
                ) : (
                  <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)' }}>Cliquer pour saisir...</div>
                )}
              </div>
            </div>
          </div>

          {error && <div style={{ color: '#ef4444', textAlign: 'center', fontSize: 13, marginBottom: 20, animation: 'fadeSlideUp 0.3s' }}>{error}</div>}

          {/* Bouton Login */}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%', padding: '18px', borderRadius: 20, border: 'none',
              background: 'linear-gradient(135deg, #6366F1 0%, #3B82F6 100%)',
              color: '#fff', fontSize: 16, fontWeight: 800, cursor: loading ? 'wait' : 'pointer',
              boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.4)',
              transition: 'all 0.3s',
              animation: loading ? 'none' : 'pulseNeo 3s infinite'
            }}>
            {loading ? 'Connexion en cours...' : 'Se connecter'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 30, color: 'rgba(255,255,255,0.15)', fontSize: 10, letterSpacing: '1px' }}>
            VENTEPRO v1.0 • 100% OFFLINE • DZ
          </div>
        </div>
      </div>
    </div>
  );
}