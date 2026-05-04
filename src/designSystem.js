// ════════════════════════════════════════════════════════════════════════════
// VENTEPRO — DESIGN SYSTEM UNIFIÉ
// Source unique de vérité pour tous les styles de l'application
// ════════════════════════════════════════════════════════════════════════════

export const DS = {

  // ── 1. TYPOGRAPHIE ─────────────────────────────────────────────────────────
  typography: {
    h1:      { fontSize: '32px', fontWeight: 900, fontFamily: "'Playfair Display', serif",    letterSpacing: '-0.5px', lineHeight: 1.2 },
    h2:      { fontSize: '24px', fontWeight: 800, fontFamily: "'Playfair Display', serif",    letterSpacing: '-0.3px', lineHeight: 1.3 },
    h3:      { fontSize: '18px', fontWeight: 700, fontFamily: "'IBM Plex Sans', sans-serif",  letterSpacing: 0,        lineHeight: 1.4 },
    body:    { fontSize: '14px', fontWeight: 500, fontFamily: "'IBM Plex Sans', sans-serif",  letterSpacing: '0.2px',  lineHeight: 1.6 },
    caption: { fontSize: '12px', fontWeight: 600, fontFamily: "'IBM Plex Sans', sans-serif",  letterSpacing: '0.5px',  lineHeight: 1.5 },
    label:   { fontSize: '11px', fontWeight: 700, fontFamily: "'IBM Plex Sans', sans-serif",  letterSpacing: '0.8px',  lineHeight: 1.4, textTransform: 'uppercase' },
    mono:    { fontSize: '13px', fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace",   letterSpacing: 0,        lineHeight: 1.5 },
    monoLg:  { fontSize: '24px', fontWeight: 900, fontFamily: "'IBM Plex Mono', monospace",   letterSpacing: 0,        lineHeight: 1.2 },
  },

  // ── 2. ESPACEMENT (grille de 4px) ──────────────────────────────────────────
  spacing: {
    xs:    4,   // 4px  — gap icon/texte
    sm:    8,   // 8px  — gap boutons, padding badge
    md:    12,  // 12px — padding input
    lg:    16,  // 16px — padding card compacte
    xl:    24,  // 24px — padding card standard
    xxl:   32,  // 32px — gap sections
    xxxl:  48,  // 48px — padding page
  },

  // ── 3. PALETTE RÉDUITE (7 couleurs + nuances) ──────────────────────────────
  colors: {
    primary:   '#3B82F6',
    primaryDk: '#2563EB',
    primaryLt: '#EFF6FF',
    primaryBd: '#BFDBFE',

    secondary:   '#6366F1',
    secondaryDk: '#4338CA',
    secondaryLt: '#EEF2FF',
    secondaryBd: '#C7D2FE',

    success:   '#10B981',
    successDk: '#059669',
    successLt: '#ECFDF5',
    successBd: '#A7F3D0',

    warning:   '#F59E0B',
    warningDk: '#D97706',
    warningLt: '#FFFBEB',
    warningBd: '#FDE68A',

    danger:   '#EF4444',
    dangerDk: '#DC2626',
    dangerLt: '#FEF2F2',
    dangerBd: '#FECACA',

    neutral:   '#64748B',
    neutralDk: '#334155',
    neutralLt: '#F8FAFC',
    neutralBd: '#E2E8F0',

    surface: '#FFFFFF',
    bg:      '#F1F5F9',
    overlay: 'rgba(0,0,0,0.5)',
  },

  // ── 4. BORDER RADIUS ───────────────────────────────────────────────────────
  radius: {
    sm:   6,
    md:   10,
    lg:   14,
    xl:   20,
    full: 9999,
  },

  // ── 5. OMBRES (3 niveaux) ──────────────────────────────────────────────────
  shadows: {
    sm:    '0 2px 8px rgba(0,0,0,0.08)',
    md:    '0 8px 24px rgba(0,0,0,0.12)',
    lg:    '0 16px 48px rgba(0,0,0,0.16)',
    color: (hex) => `0 8px 24px ${hex}35`,
  },

  // ── 6. TRANSITIONS ─────────────────────────────────────────────────────────
  transitions: {
    fast:   '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    normal: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow:   '500ms cubic-bezier(0.4, 0, 0.2, 1)',
    spring: '400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },

  // ── 7. Z-INDEX ─────────────────────────────────────────────────────────────
  zIndex: {
    base:    1,
    sticky:  100,
    float:   200,
    modal:   300,
    toast:   400,
    top:     500,
  },
};

// ── CSS GLOBAL ANIMATIONS ──────────────────────────────────────────────────
// À injecter une seule fois dans l'app via <GlobalStyles/>
export const ANIMATIONS_CSS = `
  @keyframes vx-popup {
    0%   { transform: translate(-50%, -50%) scale(0.7); opacity: 0; }
    60%  { transform: translate(-50%, -50%) scale(1.06); opacity: 1; }
    100% { transform: translate(-50%, -50%) scale(1);    opacity: 1; }
  }
  @keyframes vx-fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes vx-fadeDown {
    from { opacity: 0; transform: translateY(-16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes vx-slideRight {
    from { opacity: 0; transform: translateX(100%); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes vx-slideLeft {
    from { opacity: 0; transform: translateX(-100%); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes vx-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.5; }
  }
  @keyframes vx-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes vx-bounce {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-8px); }
  }
  @keyframes vx-shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-6px); }
    40%, 80% { transform: translateX(6px); }
  }
  @keyframes vx-glow {
    0%, 100% { box-shadow: 0 0 8px rgba(59,130,246,0.4); }
    50%       { box-shadow: 0 0 20px rgba(59,130,246,0.8); }
  }

  .vx-fadeUp    { animation: vx-fadeUp    ${300}ms cubic-bezier(0.4,0,0.2,1) both; }
  .vx-fadeDown  { animation: vx-fadeDown  ${300}ms cubic-bezier(0.4,0,0.2,1) both; }
  .vx-slideRight{ animation: vx-slideRight ${300}ms cubic-bezier(0.4,0,0.2,1) both; }
  .vx-popup     { animation: vx-popup     ${400}ms cubic-bezier(0.34,1.56,0.64,1) both; }

  * { box-sizing: border-box; }
  ::-webkit-scrollbar       { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track  { background: transparent; }
  ::-webkit-scrollbar-thumb  { background: #CBD5E1; border-radius: 99px; }
  ::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
`;

export default DS;