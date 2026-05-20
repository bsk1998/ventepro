import { useState, useEffect } from 'react';
import { db } from '../db';
import { isPasswordHash, serializePassword, verifyPassword } from '../security';

// FIX AUDIT #3 : les mots de passe par défaut sont toujours là,
// MAIS Login.js lit maintenant db.settings au démarrage.
// Si l'admin a changé ses mots de passe dans Paramètres → Sécurité,
// les nouvelles valeurs s'appliquent immédiatement.
const DEFAULT_USERS = [
  { username: 'admin',   role: 'admin',    name: 'Administrateur', defaultPwd: 'admin00', settingKey: 'admin_password' },
  { username: 'vendeur', role: 'employee', name: 'Vendeur',         defaultPwd: '0000',    settingKey: 'user_password'  },
];

const ADKAR = [
  { ar: "اللّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّد", fr: "Ô Allah, prie sur notre Prophète Muhammad" },
  { ar: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", fr: "Gloire et louange à Allah" },
  { ar: "أستغفر الله واتوب إليه", fr: "Je demande pardon à Allah et je me repens" },
  { ar: "لا حَوْلَ وَلا قُوَّةَ إِلا بِاللَّهِ", fr: "Il n'y a de force et de puissance que par Allah" },
  { ar: "الحَمْدُ للهِ كَثيراً", fr: "Louange à Allah, abondamment" },
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
          0%   { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); }
          70%  { box-shadow: 0 0 0 15px rgba(99,102,241,0); }
          100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
        }
        @keyframes fadeSlideUp {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
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
  const [shopName,    setShopName]    = useState('VentePro');
  // FIX : mots de passe chargés depuis la DB
  const [users,       setUsers]       = useState([]);
  const [profile,     setProfile]     = useState(null);
  const [showProf,    setShowProf]    = useState(false);
  const [password,    setPassword]    = useState('');
  const [passOpen,    setPassOpen]    = useState(false);
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [mounted,     setMounted]     = useState(false);
  const [dhikrIndex,  setDhikrIndex]  = useState(0);

  // Charger shop_name ET les mots de passe depuis la DB au montage
  useEffect(() => {
    setMounted(true);

    (async () => {
      try {
        const rows = await db.settings.toArray();
        const map  = {};
        rows.forEach(r => { map[r.key] = r.value; });

        if (map.shop_name) setShopName(map.shop_name);

        // Construire la liste d'utilisateurs avec hash DB ou défaut
        setUsers(DEFAULT_USERS.map(u => ({
          ...u,
          passwordRecord: map[u.settingKey] || '',
        })));
      } catch {
        // DB pas encore prête → utiliser les valeurs par défaut
        setUsers(DEFAULT_USERS.map(u => ({ ...u, passwordRecord: '' })));
      }
    })();

    const interval = setInterval(() => {
      setDhikrIndex(prev => (prev + 1) % ADKAR.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  async function handleLogin() {
    if (!profile) { setError('Choisissez un profil'); return; }
    if (!password) { setPassOpen(true); setError('Mot de passe requis'); return; }

    setLoading(true); setError('');
    await new Promise(r => setTimeout(r, 1200));

    const candidates = users.filter(u => u.username === profile.username);
    let match = null;
    for (const candidate of candidates) {
      if (await verifyPassword(password, candidate.passwordRecord, candidate.defaultPwd)) {
        match = candidate;
        break;
      }
    }
    if (match) {
      if (!isPasswordHash(match.passwordRecord)) {
        await db.settings.put({ key: match.settingKey, value: await serializePassword(password) });
      }
      onLogin({ name: match.name, role: match.role, id: null });
    } else {
      setError('Mot de passe incorrect');
      setLoading(false);
    }
  }

  // Afficher un loader pendant que les utilisateurs se chargent
  if (users.length === 0) return (
    <div style={{ height:'100vh', background:'#0F172A', display:'flex', alignItems:'center', justifyContent:'center', color:'#EDF1FF' }}>
      <div>⏳ Chargement...</div>
    </div>
  );

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

        {/* Adkar */}
        <div style={{ textAlign: 'center', marginBottom: 25, animation: 'fadeSlideUp 1s ease' }}>
          <div style={{ fontSize: 22, color: '#6366F1', fontWeight: 'bold', marginBottom: 5 }}>{ADKAR[dhikrIndex].ar}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>{ADKAR[dhikrIndex].fr}</div>
        </div>

        <div style={{
          background: 'rgba(30, 41, 59, 0.7)',
          backdropFilter: 'blur(25px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 32,
          padding: '45px 40px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        }}>

          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h1 style={{ fontSize: 36, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-1.5px' }}>{shopName}</h1>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: 8 }}>Gestion Commerciale</p>
          </div>

          {/* Sélecteur profil */}
          <div style={{ marginBottom: 16, position: 'relative' }}>
            <button
              onClick={() => { setShowProf(!showProf); setPassOpen(false); }}
              style={{
                width: '100%', padding: '16px 20px', borderRadius: 20,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 10, color: 'rgba(99,102,241,1)', fontWeight: 800, marginBottom: 4 }}>PROFIL</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{profile ? profile.name : 'Sélectionner...'}</div>
              </div>
              <span style={{ opacity: 0.4 }}>▾</span>
            </button>

            {showProf && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 10, zIndex: 100,
                background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, overflow: 'hidden',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)', animation: 'fadeSlideUp 0.2s ease',
              }}>
                {users.map(u => (
                  <button key={u.username}
                    onClick={() => { setProfile(u); setShowProf(false); setPassOpen(true); }}
                    style={{ width: '100%', padding: '15px 20px', background: 'transparent', border: 'none', color: '#fff', textAlign: 'left', cursor: 'pointer', fontWeight: 500 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.15)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {u.name}
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginLeft: 8 }}>
                      {u.role === 'admin' ? '👑 Admin' : '👨‍💼 Vendeur'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Code d'accès */}
          <div style={{ marginBottom: 35, position: 'relative' }}>
            <div
              onClick={() => { setPassOpen(true); setShowProf(false); }}
              style={{
                width: '100%', padding: '16px 20px', borderRadius: 20,
                background: 'rgba(255,255,255,0.05)',
                border: passOpen ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.1)',
                color: '#fff', cursor: 'text', transition: 'all 0.2s',
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
                      color: '#fff', fontSize: 16, letterSpacing: password ? '4px' : 'normal', padding: 0,
                    }}
                  />
                ) : (
                  <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)' }}>Cliquer pour saisir...</div>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div style={{ color: '#ef4444', textAlign: 'center', fontSize: 13, marginBottom: 20, animation: 'fadeSlideUp 0.3s' }}>
              {error}
            </div>
          )}

          {/* Bouton connexion */}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%', padding: '18px', borderRadius: 20, border: 'none',
              background: 'linear-gradient(135deg, #6366F1 0%, #3B82F6 100%)',
              color: '#fff', fontSize: 16, fontWeight: 800, cursor: loading ? 'wait' : 'pointer',
              boxShadow: '0 10px 25px -5px rgba(99,102,241,0.4)',
              transition: 'all 0.3s',
              animation: loading ? 'none' : 'pulseNeo 3s infinite',
            }}>
            {loading ? 'Connexion en cours...' : 'Se connecter'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 30, color: 'rgba(255,255,255,0.15)', fontSize: 10, letterSpacing: '1px' }}>
            VENTEPRO v1.0 • DONNÉES LOCALES • DZ
          </div>
        </div>
      </div>
    </div>
  );
}
