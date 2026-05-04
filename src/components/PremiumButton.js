import { useState } from 'react';
import { DS } from '../designSystem';

// ════════════════════════════════════════════════════════════════════════════
// PREMIUM BUTTON — Remplace tous les <button> inline de l'app
// ════════════════════════════════════════════════════════════════════════════

const VARIANTS = {
  primary: {
    base:    { background: `linear-gradient(135deg, ${DS.colors.primary}, ${DS.colors.primaryDk})`, color: '#fff',                  border: 'none' },
    hover:   { boxShadow: DS.shadows.color(DS.colors.primary), transform: 'translateY(-2px)' },
    active:  { transform: 'scale(0.97)' },
  },
  secondary: {
    base:    { background: DS.colors.neutralLt, color: DS.colors.neutral,  border: `1.5px solid ${DS.colors.neutralBd}` },
    hover:   { background: DS.colors.neutralBd, borderColor: '#CBD5E1' },
    active:  { transform: 'scale(0.98)' },
  },
  success: {
    base:    { background: `linear-gradient(135deg, ${DS.colors.success}, ${DS.colors.successDk})`, color: '#fff', border: 'none' },
    hover:   { boxShadow: DS.shadows.color(DS.colors.success), transform: 'translateY(-2px)' },
    active:  { transform: 'scale(0.97)' },
  },
  danger: {
    base:    { background: DS.colors.dangerLt, color: DS.colors.danger,  border: `1.5px solid ${DS.colors.dangerBd}` },
    hover:   { background: DS.colors.danger,   color: '#fff',            borderColor: DS.colors.danger },
    active:  { transform: 'scale(0.97)' },
  },
  ghost: {
    base:    { background: 'transparent', color: DS.colors.primary, border: `1.5px solid ${DS.colors.primaryBd}` },
    hover:   { background: DS.colors.primaryLt },
    active:  { transform: 'scale(0.98)' },
  },
  warning: {
    base:    { background: DS.colors.warningLt, color: DS.colors.warningDk, border: `1.5px solid ${DS.colors.warningBd}` },
    hover:   { background: DS.colors.warning,   color: '#fff',              borderColor: DS.colors.warning },
    active:  { transform: 'scale(0.97)' },
  },
  violet: {
    base:    { background: `linear-gradient(135deg, #6366F1, #8B5CF6)`, color: '#fff', border: 'none' },
    hover:   { boxShadow: '0 8px 24px rgba(99,102,241,0.4)', transform: 'translateY(-2px)' },
    active:  { transform: 'scale(0.97)' },
  },
};

const SIZES = {
  sm:   { padding: `${DS.spacing.xs}px ${DS.spacing.md}px`, fontSize: '12px', borderRadius: DS.radius.sm, minHeight: 32 },
  md:   { padding: `${DS.spacing.sm}px ${DS.spacing.lg}px`, fontSize: '13px', borderRadius: DS.radius.md, minHeight: 38 },
  lg:   { padding: `${DS.spacing.md}px ${DS.spacing.xxl}px`, fontSize: '15px', borderRadius: DS.radius.lg, minHeight: 46 },
  xl:   { padding: `${DS.spacing.lg}px ${DS.spacing.xxxl}px`, fontSize: '16px', borderRadius: DS.radius.lg, minHeight: 54 },
};

export default function PremiumButton({
  children,
  variant  = 'primary',
  size     = 'md',
  icon,
  loading  = false,
  disabled = false,
  fullWidth = false,
  style    = {},
  onClick,
  ...rest
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const v = VARIANTS[variant] || VARIANTS.primary;
  const s = SIZES[size]       || SIZES.md;

  const computedStyle = {
    // Base
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            DS.spacing.sm,
    cursor:         disabled || loading ? 'not-allowed' : 'pointer',
    fontWeight:     700,
    fontFamily:     DS.typography.body.fontFamily,
    letterSpacing:  '0.3px',
    whiteSpace:     'nowrap',
    userSelect:     'none',
    width:          fullWidth ? '100%' : 'auto',
    opacity:        disabled ? 0.5 : 1,
    transition:     `all ${DS.transitions.normal}`,
    ...v.base,
    ...s,
    // États
    ...(hovered && !disabled && !loading ? v.hover   : {}),
    ...(pressed && !disabled             ? v.active  : {}),
    // Override externe
    ...style,
  };

  return (
    <button
      onClick={!disabled && !loading ? onClick : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      disabled={disabled || loading}
      style={computedStyle}
      {...rest}>
      {loading
        ? <div style={{
            width: 16, height: 16,
            border: '2px solid rgba(255,255,255,0.3)',
            borderTop: '2px solid currentColor',
            borderRadius: '50%',
            animation: 'vx-spin 700ms linear infinite',
          }} />
        : icon && <span style={{ fontSize: Number(s.fontSize) + 2 }}>{icon}</span>
      }
      {children}
    </button>
  );
}