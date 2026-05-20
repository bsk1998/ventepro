import { useEffect, useState } from 'react';
import { useTheme } from '../ThemeContext';
import { getProactiveInsights } from '../businessFeatures';

const COLORS = {
  danger: ['#EF4444', '#FEF2F2'],
  warning: ['#F59E0B', '#FFFBEB'],
  info: ['#3B82F6', '#EFF6FF'],
  success: ['#10B981', '#ECFDF5'],
};

export default function ProactiveInsightsPanel({ compact = false, onOpenAI }) {
  const { theme: C } = useTheme();
  const [items, setItems] = useState([]);

  useEffect(() => {
    getProactiveInsights().then(setItems).catch(() => setItems([]));
  }, []);

  if (!items.length) return null;
  return (
    <div style={{
      background:C.surface,
      border:`1.5px solid ${C.accentMd || C.border}`,
      borderRadius:12,
      padding:compact ? 10 : 14,
      marginBottom:compact ? 10 : 14,
      boxShadow:C.shadowSm,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div>
          <div style={{ fontWeight:900, fontSize:compact ? 12 : 14, color:C.accent }}>IA proactive</div>
          <div style={{ fontSize:11, color:C.sub }}>Alertes automatiques et decisions conseillees.</div>
        </div>
        {onOpenAI && <button onClick={onOpenAI} style={{ border:'none', background:C.accent, color:'#fff', borderRadius:9, padding:'7px 10px', cursor:'pointer', fontWeight:800, fontSize:11 }}>Ouvrir IA</button>}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:compact ? '1fr' : 'repeat(auto-fit,minmax(220px,1fr))', gap:8 }}>
        {items.slice(0, compact ? 3 : 8).map((item, i) => {
          const [color, bgLight] = COLORS[item.priority] || COLORS.info;
          return (
            <div key={i} style={{ background:C.isLight ? bgLight : color + '12', border:`1px solid ${color}35`, borderRadius:9, padding:'8px 10px' }}>
              <div style={{ color, fontWeight:900, fontSize:12, marginBottom:3 }}>{item.title}</div>
              <div style={{ color:C.text, fontSize:11, lineHeight:1.35 }}>{item.message}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
