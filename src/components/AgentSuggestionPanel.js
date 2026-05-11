import { DS } from '../designSystem';

const palette = {
  danger: { color: DS.colors.danger, bg: DS.colors.dangerLt, border: DS.colors.dangerBd },
  warning: { color: DS.colors.warning, bg: DS.colors.warningLt, border: DS.colors.warningBd },
  success: { color: DS.colors.success, bg: DS.colors.successLt, border: DS.colors.successBd },
  info: { color: DS.colors.primary, bg: DS.colors.primaryLt, border: DS.colors.primaryBd },
};

export default function AgentSuggestionPanel({
  title = 'Agent IA',
  subtitle,
  suggestions = [],
  onApply,
  onDismiss,
  compact = false,
  style,
}) {
  if (!suggestions?.length) return null;

  return (
    <div style={{
      background: DS.colors.surface,
      border: `1.5px solid ${DS.colors.primaryBd}`,
      borderRadius: DS.radius.md,
      boxShadow: DS.shadows.sm,
      padding: compact ? 8 : 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      ...style,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div>
          <div style={{ ...DS.typography.label, color: DS.colors.primary }}>{title}</div>
          {subtitle && <div style={{ ...DS.typography.caption, color: DS.colors.neutral, letterSpacing: 0 }}>{subtitle}</div>}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              width: 26,
              height: 26,
              borderRadius: DS.radius.sm,
              border: `1px solid ${DS.colors.neutralBd}`,
              background: DS.colors.neutralLt,
              color: DS.colors.neutral,
              cursor: 'pointer',
              fontWeight: 900,
            }}>
            x
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gap: 7 }}>
        {suggestions.map((item, index) => {
          const p = palette[item.priority] || palette.info;
          return (
            <div key={item.id || index} style={{
              background: p.bg,
              border: `1.5px solid ${p.border}`,
              borderRadius: DS.radius.sm,
              padding: compact ? '7px 9px' : '9px 11px',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
              alignItems: 'center',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: compact ? 11 : 12, fontWeight: 900, color: p.color, marginBottom: 2 }}>
                  {item.title}
                </div>
                <div style={{ fontSize: compact ? 10 : 11, color: DS.colors.neutralDk, lineHeight: 1.35 }}>
                  {item.message}
                </div>
              </div>
              {item.actionLabel && onApply && (
                <button
                  onClick={() => onApply(item)}
                  style={{
                    flexShrink: 0,
                    border: 'none',
                    borderRadius: DS.radius.sm,
                    background: p.color,
                    color: '#fff',
                    padding: compact ? '6px 8px' : '7px 10px',
                    fontSize: compact ? 10 : 11,
                    fontWeight: 900,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}>
                  {item.actionLabel}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
