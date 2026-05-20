import { createContext, useContext, useState, useEffect, useMemo } from 'react';

// ── Palettes de couleurs accent (indépendant du mode) ─────────────────────────
export const PALETTES = {
  default:     { accent:'#0095CC', name:'Défaut',      icon:'✦'  },
  desert:      { accent:'#E8A020', name:'Désert',      icon:'🏜'  },
  ocean:       { accent:'#00B4D8', name:'Océan',       icon:'🌊'  },
  forest:      { accent:'#3A9A4A', name:'Forêt',       icon:'🌿'  },
  red_passion: { accent:'#E82020', name:'Rouge',       icon:'❤️'  },
  gold:        { accent:'#CCA000', name:'Or',          icon:'✨'  },
  plomberie:   { accent:'#0077BB', name:'Plomberie',   icon:'🔧'  },
  alimentaire: { accent:'#3A9A3A', name:'Alimentaire', icon:'🥗'  },
  vetement:    { accent:'#CC2288', name:'Vêtement',    icon:'👗'  },
  bricolage:   { accent:'#DD6600', name:'Bricolage',   icon:'🔨'  },
  electrique:  { accent:'#CCAA00', name:'Électrique',  icon:'⚡'  },
};

// ── Config icônes et symboles par métier ──────────────────────────────────────
export const METIER_CONFIG = {
  default: {
    navIcons: { dashboard:'⊞', products:'📦', sales:'🧾', clients:'👥', suppliers:'🚚', employees:'👨‍💼', treasury:'💰', reports:'📊', quotes:'📋', settings:'⚙️' },
    dashLabel: 'Tableau de bord',
    productLabel: 'Produits & Stock',
    productIcon: '📦',
    greeting: 'Bienvenue',
    categories: ['Lubrifiants','Filtres','Électrique','Liquides','Distribution','Freinage','Carrosserie','Pneumatiques','Divers'],
  },
  plomberie: {
    navIcons: { dashboard:'🔧', products:'🪠', sales:'📋', clients:'🏠', suppliers:'🏭', employees:'👷', treasury:'💶', reports:'📊', quotes:'🧾', settings:'⚙️' },
    dashLabel: 'Atelier — Tableau de bord',
    productLabel: '🪠 Stock Matériel',
    productIcon: '🪠',
    greeting: 'Bonne journée, artisan 🔧',
    categories: ['Tuyaux PVC','Tuyaux Cuivre','Robinets','Vannes','Raccords','Pompes','Chauffe-eau','Sanitaires','Joints & Sceaux','Outillage','Divers'],
  },
  alimentaire: {
    navIcons: { dashboard:'🥗', products:'🛒', sales:'🧾', clients:'👥', suppliers:'🚜', employees:'👨‍🍳', treasury:'💶', reports:'📊', quotes:'📋', settings:'⚙️' },
    dashLabel: 'Épicerie — Tableau de bord',
    productLabel: '🛒 Rayon Produits',
    productIcon: '🛒',
    greeting: 'Bonne journée 🥗',
    categories: ['Épicerie sèche','Boissons','Produits laitiers','Viandes & Volailles','Légumes & Fruits','Surgelés','Conserves','Hygiène & Beauté','Boulangerie','Divers'],
  },
  vetement: {
    navIcons: { dashboard:'👗', products:'👔', sales:'🛍️', clients:'👤', suppliers:'🏭', employees:'🧵', treasury:'💶', reports:'📊', quotes:'📋', settings:'⚙️' },
    dashLabel: 'Boutique — Tableau de bord',
    productLabel: '👔 Collection',
    productIcon: '👔',
    greeting: 'Bonne journée 👗',
    categories: ['Homme','Femme','Enfant','Chaussures','Accessoires','Sport & Fitness','Lingerie','Mariage','Saison','Divers'],
  },
  bricolage: {
    navIcons: { dashboard:'🔨', products:'🪛', sales:'🧾', clients:'🏠', suppliers:'🏭', employees:'👷', treasury:'💶', reports:'📊', quotes:'📋', settings:'⚙️' },
    dashLabel: 'Quincaillerie — Tableau de bord',
    productLabel: '🪛 Stock Matériel',
    productIcon: '🪛',
    greeting: 'Bonne journée, artisan 🔨',
    categories: ['Visserie & Boulonnerie','Peinture & Enduits','Bois & Panneaux','Plomberie','Électricité','Outils manuels','Machines-outils','Colle & Fixation','Sécurité','Divers'],
  },
  electrique: {
    navIcons: { dashboard:'⚡', products:'🔌', sales:'🧾', clients:'🏢', suppliers:'🏭', employees:'👷', treasury:'💶', reports:'📊', quotes:'📋', settings:'⚙️' },
    dashLabel: 'Électricité — Tableau de bord',
    productLabel: '🔌 Stock Matériel',
    productIcon: '🔌',
    greeting: 'Bonne journée ⚡',
    categories: ['Câbles & Fils','Disjoncteurs','Prises & Interrupteurs','Ampoules & LED','Tableaux électriques','Gaines & Conduits','Batteries & Accus','Outils électriques','Matériel réseau','Divers'],
  },
};

// ── Couleurs de base selon le mode ────────────────────────────────────────────
function buildBase(mode) {
  if (mode === 'light') return {
    bg: '#F1F5F9', surface: '#FFFFFF', card: '#FFFFFF', border: '#E2E8F0',
    text: '#1E293B', sub: '#64748B', muted: '#94A3B8',
    // Chat toujours lisible mode clair
    chatBg: '#F8FAFC', chatAiBg: '#FFFFFF', chatAiText: '#1E293B',
    chatUserText: '#FFFFFF', chatBorder: '#E2E8F0',
  };
  return {
    bg: '#07090F', surface: '#0B0E18', card: '#0F1320', border: '#1B2135',
    text: '#EDF1FF', sub: '#7A85AA', muted: '#3A4260',
    // Chat toujours lisible mode sombre
    chatBg: '#0B0E18', chatAiBg: '#141B2D', chatAiText: '#EDF1FF',
    chatUserText: '#FFFFFF', chatBorder: '#1B2135',
  };
}

// ── Construction thème complet ────────────────────────────────────────────────
function buildTheme(mode, paletteKey) {
  const base    = buildBase(mode);
  const palette = PALETTES[paletteKey] || PALETTES.default;
  const acc     = palette.accent;
  const isLight = mode === 'light';

  const green  = isLight ? '#059669' : '#00E5A0';
  const red    = isLight ? '#DC2626' : '#FF4D6A';
  const amber  = isLight ? '#D97706' : '#FFC04D';
  const blue   = isLight ? '#2563EB' : '#4D9FFF';
  const purple = isLight ? '#7C3AED' : '#C084FC';
  const violet = isLight ? '#6D28D9' : '#8B5CF6';

  return {
    ...base,
    accent: acc, accentLo: acc + '20', accentMd: acc + '40',
    accentGrad: `linear-gradient(135deg,${acc},${acc}BB)`,
    green,  greenLo:  green  + '20',
    red,    redLo:    red    + '18',
    amber,  amberLo:  amber  + '20',
    blue,   blueLo:   blue   + '18',
    purple, purpleLo: purple + '18',
    violet, violetLo: violet + '18',
    shadow:  isLight ? '0 4px 20px rgba(0,0,0,.10)' : '0 8px 32px rgba(0,0,0,.6)',
    shadowSm:isLight ? '0 2px 8px rgba(0,0,0,.07)'  : '0 4px 16px rgba(0,0,0,.4)',
    glow:    `0 0 24px ${acc}30`,
    // Polices magazine bold
    fontDisplay: "'Playfair Display', 'Times New Roman', serif",
    fontBody:    "'IBM Plex Sans', 'Segoe UI', sans-serif",
    fontMono:    "'IBM Plex Mono', 'Consolas', monospace",
    isLight, mode, paletteKey,
    paletteName: palette.name,
    paletteIcon: palette.icon,
  };
}

// ── Context ───────────────────────────────────────────────────────────────────
const ThemeCtx = createContext(null);

export function ThemeProvider({ children }) {
  const [mode,       setMode]       = useState(() => localStorage.getItem('vp_mode')    || 'light');
  const [paletteKey, setPaletteKey] = useState(() => localStorage.getItem('vp_palette') || 'default');

  const theme  = useMemo(() => buildTheme(mode, paletteKey), [mode, paletteKey]);
  const metier = useMemo(() => METIER_CONFIG[paletteKey] || METIER_CONFIG.default, [paletteKey]);

  useEffect(() => {
    document.body.style.background = theme.bg;
    document.body.style.color      = theme.text;
    document.body.style.fontFamily = theme.fontBody;
    // Inject Google Fonts once
    if (!document.getElementById('vp-fonts')) {
      const link = document.createElement('link');
      link.id   = 'vp-fonts';
      link.rel  = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap';
      document.head.appendChild(link);
    }
  }, [theme]);

  const switchMode    = m => { setMode(m);       localStorage.setItem('vp_mode',    m); };
  const switchPalette = p => { setPaletteKey(p); localStorage.setItem('vp_palette', p); };

  // Agent Design support
  const applyFromAgent = (instruction) => {
    const inst = instruction.toLowerCase();
    // Mode
    if (inst.includes('clair') || inst.includes('light') || inst.includes('jour')) switchMode('light');
    else if (inst.includes('sombre') || inst.includes('dark') || inst.includes('nuit')) switchMode('dark');
    // Palette
    Object.keys(PALETTES).forEach(k => {
      const p = PALETTES[k];
      if (inst.includes(k) || inst.includes(p.name.toLowerCase())) switchPalette(k);
    });
  };

  return (
    <ThemeCtx.Provider value={{ theme, metier, mode, paletteKey, switchMode, switchPalette, applyFromAgent, PALETTES, METIER_CONFIG }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
}

// ── Sélecteur de thème ────────────────────────────────────────────────────────
export function ThemeSwitcher() {
  const { mode, paletteKey, switchMode, switchPalette } = useTheme();
  const GENERAL = ['default','desert','ocean','forest','red_passion','gold'];
  const METIERS = ['plomberie','alimentaire','vetement','bricolage','electrique'];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:22 }}>

      {/* ── Mode clair/sombre INDÉPENDANT ── */}
      <div>
        <div style={{ fontSize:15, fontWeight:700, textTransform:'uppercase', letterSpacing:1.2,
          color:'#7A85AA', marginBottom:10 }}>☀️🌙 Mode d'affichage — indépendant du thème</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {[
            { k:'light', icon:'☀️', label:'Clair',  desc:'Fond blanc, texte sombre' },
            { k:'dark',  icon:'🌙', label:'Sombre', desc:'Fond noir, texte clair'   },
          ].map(m => (
            <button key={m.k} onClick={() => switchMode(m.k)} style={{
              padding:'16px', borderRadius:14, cursor:'pointer', textAlign:'center',
              background: mode===m.k ? '#3B82F618' : 'transparent',
              border: `2px solid ${mode===m.k ? '#3B82F6' : '#2A3150'}`,
              transition:'all .15s',
            }}>
              <div style={{ fontSize:24, marginBottom:6 }}>{m.icon}</div>
              <div style={{ fontSize:15, fontWeight:700, color: mode===m.k ? '#3B82F6' : '#EDF1FF' }}>{m.label}</div>
              <div style={{ fontSize:12, color:'#7A85AA', marginTop:3 }}>{m.desc}</div>
              {mode===m.k && <div style={{ fontSize:12, color:'#3B82F6', marginTop:4, fontWeight:800 }}>✓ Actif</div>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Couleur / Palette ── */}
      <div>
        <div style={{ fontSize:15, fontWeight:700, textTransform:'uppercase', letterSpacing:1.2,
          color:'#7A85AA', marginBottom:10 }}>🎨 Couleur & Thème métier</div>

        <div style={{ fontSize:12, color:'#7A85AA', marginBottom:6, fontWeight:600, letterSpacing:.6 }}>Général</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, marginBottom:14 }}>
          {GENERAL.map(k => {
            const p = PALETTES[k];
            return (
              <button key={k} onClick={() => switchPalette(k)} style={{
                padding:'13px 10px', borderRadius:10, cursor:'pointer', textAlign:'center',
                background: paletteKey===k ? p.accent+'22' : 'transparent',
                border: `2px solid ${paletteKey===k ? p.accent : '#2A3150'}`,
                transition:'all .15s',
              }}>
                <div style={{ fontSize:18, marginBottom:3 }}>{p.icon}</div>
                <div style={{ fontSize:12, fontWeight:700, color: paletteKey===k ? p.accent : '#EDF1FF' }}>{p.name}</div>
                <div style={{ width:24, height:4, borderRadius:2, background:p.accent, margin:'5px auto 0' }}/>
              </button>
            );
          })}
        </div>

        <div style={{ fontSize:12, color:'#7A85AA', marginBottom:6, fontWeight:600, letterSpacing:.6 }}>Métiers — icônes adaptées</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
          {METIERS.map(k => {
            const p = PALETTES[k];
            const m = METIER_CONFIG[k];
            return (
              <button key={k} onClick={() => switchPalette(k)} style={{
                padding:'13px 10px', borderRadius:10, cursor:'pointer', textAlign:'center',
                background: paletteKey===k ? p.accent+'22' : 'transparent',
                border: `2px solid ${paletteKey===k ? p.accent : '#2A3150'}`,
                transition:'all .15s',
              }}>
                <div style={{ fontSize:18, marginBottom:3 }}>{p.icon}</div>
                <div style={{ fontSize:12, fontWeight:700, color: paletteKey===k ? p.accent : '#EDF1FF' }}>{p.name}</div>
                <div style={{ fontSize:11, color:'#7A85AA', marginTop:2 }}>
                  {Object.values(m.navIcons).slice(0,3).join(' ')}
                </div>
                <div style={{ width:24, height:4, borderRadius:2, background:p.accent, margin:'4px auto 0' }}/>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ background:'#3B82F612', border:'1px solid #3B82F630',
        borderRadius:10, padding:'10px 14px' }}>
        <div style={{ color:'#3B82F6', fontSize:12, fontWeight:600, lineHeight:1.5 }}>
          💡 Mode clair/sombre et couleur sont <strong>indépendants</strong> — exemple : thème Plomberie en mode Clair !
        </div>
      </div>
    </div>
  );
}
