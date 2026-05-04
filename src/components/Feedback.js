import { useState, useEffect, useCallback, useRef } from 'react';
import { DS, ANIMATIONS_CSS } from '../designSystem';

// ════════════════════════════════════════════════════════════════════════════
// COMPOSANTS DE FEEDBACK — Toast, SaleSuccess, Loader, Skeleton
// ════════════════════════════════════════════════════════════════════════════

// ── Injection CSS animations (une seule fois) ─────────────────────────────
let cssInjected = false;
function injectCSS() {
  if (cssInjected) return;
  const style = document.createElement('style');
  style.textContent = ANIMATIONS_CSS;
  document.head.appendChild(style);
  cssInjected = true;
}

// ── TOAST SYSTEM ─────────────────────────────────────────────────────────────
// Usage :
//   import { useToast } from './Feedback';
//   const toast = useToast();
//   toast.success('Vente enregistrée !');
//   toast.error('Erreur lors de la sauvegarde');
//   toast.warning('Stock bas détecté');
//   toast.info('Synchronisation en cours...');

const TOAST_VARIANTS = {
  success: { bg: DS.colors.successLt, border: DS.colors.successBd, color: DS.colors.success,   icon: '✅' },
  error:   { bg: DS.colors.dangerLt,  border: DS.colors.dangerBd,  color: DS.colors.danger,    icon: '❌' },
  warning: { bg: DS.colors.warningLt, border: DS.colors.warningBd, color: DS.colors.warning,   icon: '⚠️' },
  info:    { bg: DS.colors.primaryLt, border: DS.colors.primaryBd, color: DS.colors.primary,   icon: 'ℹ️' },
};

// Store global des toasts (sans Redux/Context lourd)
let _toastListener = null;
let _toastId = 0;

export const toast = {
  success: (msg, duration) => _emit('success', msg, duration),
  error:   (msg, duration) => _emit('error',   msg, duration),
  warning: (msg, duration) => _emit('warning', msg, duration),
  info:    (msg, duration) => _emit('info',    msg, duration),
};

function _emit(type, message, duration = 3000) {
  if (_toastListener) _toastListener({ id: ++_toastId, type, message, duration });
}

export function useToast() {
  return toast;
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    injectCSS();
    _toastListener = (t) => {
      setToasts(prev => [...prev, t]);
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id));
      }, t.duration);
    };
    return () => { _toastListener = null; };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%',
      transform: 'translateX(-50%)',
      zIndex: DS.zIndex.toast,
      display: 'flex', flexDirection: 'column', gap: 8,
      alignItems: 'center', pointerEvents: 'none',
    }}>
      {toasts.map(t => {
        const v = TOAST_VARIANTS[t.type] || TOAST_VARIANTS.info;
        return (
          <div key={t.id} className="vx-fadeUp" style={{
            background:   v.bg,
            border:       `1.5px solid ${v.border}`,
            borderRadius: DS.radius.lg,
            padding:      `${DS.spacing.md}px ${DS.spacing.xl}px`,
            display:      'flex', alignItems: 'center', gap: DS.spacing.sm,
            boxShadow:    DS.shadows.md,
            pointerEvents: 'auto',
            minWidth:     280, maxWidth: 420,
          }}>
            <span style={{ fontSize: 18 }}>{v.icon}</span>
            <span style={{ ...DS.typography.body, color: DS.colors.neutralDk, fontWeight: 600, flex: 1 }}>
              {t.message}
            </span>
            <div style={{
              width: '100%', height: 3,
              background: v.border,
              borderRadius: 99,
              position:   'absolute',
              bottom: 0, left: 0,
              transformOrigin: 'left',
              animation: `toastBar ${t.duration}ms linear forwards`,
            }} />
          </div>
        );
      })}
      <style>{`
        @keyframes toastBar {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>
    </div>
  );
}

// ── ANIMATION CONFIRMATION VENTE ─────────────────────────────────────────────
// Usage :
//   const { triggerSaleSuccess, SaleSuccessOverlay } = useSaleSuccess();
//   // Après finishSale() :
//   triggerSaleSuccess(totalTTC);

export function useSaleSuccess() {
  const [show,  setShow]  = useState(false);
  const [total, setTotal] = useState(0);
  const timerRef = useRef(null);

  const triggerSaleSuccess = useCallback((amount = 0) => {
    setTotal(amount);
    setShow(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShow(false), 2200);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const SaleSuccessOverlay = show ? (
    <div style={{
      position:       'fixed',
      inset:          0,
      zIndex:         DS.zIndex.top,
      pointerEvents:  'none',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
    }}>
      {/* Fond semi-transparent flash */}
      <div style={{
        position:   'absolute',
        inset:      0,
        background: `${DS.colors.success}12`,
        animation:  `vx-fadeUp 200ms ease both`,
      }} />

      {/* Carte centrale */}
      <div className="vx-popup" style={{
        background:   '#fff',
        border:       `3px solid ${DS.colors.success}`,
        borderRadius: DS.radius.xl,
        padding:      `${DS.spacing.xxl}px ${DS.spacing.xxxl}px`,
        textAlign:    'center',
        boxShadow:    `0 32px 80px ${DS.colors.success}30`,
        position:     'relative',
        zIndex:       1,
      }}>
        <div style={{ fontSize: 64, lineHeight: 1, marginBottom: DS.spacing.lg }}>✅</div>
        <div style={{ ...DS.typography.h2, color: DS.colors.success, marginBottom: DS.spacing.sm }}>
          Vente enregistrée !
        </div>
        {total > 0 && (
          <div style={{ ...DS.typography.monoLg, color: DS.colors.neutralDk, marginTop: DS.spacing.md }}>
            {total.toLocaleString('fr-DZ')} DA
          </div>
        )}
        <div style={{
          marginTop:    DS.spacing.lg,
          ...DS.typography.caption,
          color:        DS.colors.neutral,
          letterSpacing: '1px',
        }}>
          Ticket imprimé automatiquement
        </div>
      </div>
    </div>
  ) : null;

  return { triggerSaleSuccess, SaleSuccessOverlay };
}

// ── LOADING SPINNER ───────────────────────────────────────────────────────────
export function Spinner({ size = 24, color = DS.colors.primary }) {
  return (
    <div style={{
      width:        size,
      height:       size,
      border:       `3px solid ${color}25`,
      borderTop:    `3px solid ${color}`,
      borderRadius: '50%',
      animation:    'vx-spin 700ms linear infinite',
      flexShrink:   0,
    }} />
  );
}

// ── FULL PAGE LOADER ──────────────────────────────────────────────────────────
export function PageLoader({ message = 'Chargement...' }) {
  return (
    <div style={{
      height:         '60vh',
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            DS.spacing.lg,
    }}>
      <Spinner size={40} />
      <div style={{ ...DS.typography.body, color: DS.colors.neutral }}>{message}</div>
    </div>
  );
}

// ── SKELETON LOADER ───────────────────────────────────────────────────────────
// Usage : <Skeleton width="100%" height={20} />
export function Skeleton({ width = '100%', height = 16, radius = DS.radius.sm, style = {} }) {
  return (
    <div style={{
      width,
      height,
      borderRadius: radius,
      background:   `linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)`,
      backgroundSize: '200% 100%',
      animation:   'skeletonShimmer 1.5s infinite',
      ...style,
    }}>
      <style>{`
        @keyframes skeletonShimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

// ── MODAL AVEC TRANSITION ─────────────────────────────────────────────────────
// Remplace le Modal de ui.js avec une vraie animation
export function AnimatedModal({ title, onClose, children, width = 520 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Micro-délai pour déclencher la transition CSS
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 250);
  }

  return (
    <div
      onClick={e => e.target === e.currentTarget && handleClose()}
      style={{
        position:       'fixed',
        inset:          0,
        background:     DS.colors.overlay,
        zIndex:         DS.zIndex.modal,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        opacity:         visible ? 1 : 0,
        transition:     `opacity ${DS.transitions.normal}`,
      }}>
      <div style={{
        background:   DS.colors.surface,
        borderRadius: DS.radius.xl,
        width,
        maxWidth:     '95vw',
        maxHeight:    '90vh',
        overflow:     'auto',
        boxShadow:    DS.shadows.lg,
        transform:    visible ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.96)',
        transition:   `transform ${DS.transitions.spring}`,
      }}>
        {/* Header */}
        <div style={{
          padding:      `${DS.spacing.lg}px ${DS.spacing.xl}px`,
          borderBottom: `1.5px solid ${DS.colors.neutralBd}`,
          display:      'flex',
          justifyContent: 'space-between',
          alignItems:   'center',
        }}>
          <div style={{ ...DS.typography.h3, color: DS.colors.neutralDk }}>{title}</div>
          <button
            onClick={handleClose}
            style={{
              background:   DS.colors.neutralLt,
              border:       'none',
              borderRadius: DS.radius.sm,
              width:        30, height: 30,
              display:      'flex', alignItems: 'center', justifyContent: 'center',
              cursor:       'pointer',
              color:        DS.colors.neutral,
              fontSize:     18,
              transition:   `all ${DS.transitions.fast}`,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = DS.colors.dangerLt; e.currentTarget.style.color = DS.colors.danger; }}
            onMouseLeave={e => { e.currentTarget.style.background = DS.colors.neutralLt; e.currentTarget.style.color = DS.colors.neutral; }}>
            ×
          </button>
        </div>
        <div style={{ padding: DS.spacing.xl }}>{children}</div>
      </div>
    </div>
  );
}

// ── CONFIRM DIALOG ANIMÉ ─────────────────────────────────────────────────────
export function ConfirmDialog({ msg, onOk, onCancel, danger = true }) {
  return (
    <AnimatedModal title="Confirmer" onClose={onCancel} width={380}>
      <p style={{ ...DS.typography.body, color: DS.colors.neutral, marginBottom: DS.spacing.xl }}>
        {msg}
      </p>
      <div style={{ display: 'flex', gap: DS.spacing.sm, justifyContent: 'flex-end' }}>
        <button
          onClick={onCancel}
          style={{
            padding:      `${DS.spacing.md}px ${DS.spacing.xl}px`,
            background:   DS.colors.neutralLt,
            border:       `1.5px solid ${DS.colors.neutralBd}`,
            borderRadius: DS.radius.md,
            cursor:       'pointer',
            ...DS.typography.body,
            fontWeight:   600,
            color:        DS.colors.neutral,
            transition:   `all ${DS.transitions.fast}`,
          }}>
          Annuler
        </button>
        <button
          onClick={onOk}
          style={{
            padding:      `${DS.spacing.md}px ${DS.spacing.xl}px`,
            background:   danger ? DS.colors.danger : DS.colors.primary,
            border:       'none',
            borderRadius: DS.radius.md,
            cursor:       'pointer',
            ...DS.typography.body,
            fontWeight:   800,
            color:        '#fff',
            transition:   `all ${DS.transitions.fast}`,
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = DS.shadows.color(danger ? DS.colors.danger : DS.colors.primary); }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
          Confirmer
        </button>
      </div>
    </AnimatedModal>
  );
}

// ── BADGE ANIMÉ ───────────────────────────────────────────────────────────────
export function PulseBadge({ count, color = DS.colors.danger }) {
  if (!count || count <= 0) return null;
  return (
    <div style={{
      position:     'absolute',
      top:          -8, right: -8,
      background:   color,
      color:        '#fff',
      borderRadius: DS.radius.full,
      fontSize:     10, fontWeight: 900,
      padding:      '2px 7px',
      border:       '2px solid #fff',
      animation:    count > 0 ? 'vx-pulse 2s infinite' : 'none',
      minWidth:     20, textAlign: 'center',
    }}>
      {count > 99 ? '99+' : count}
    </div>
  );
}