import { useTheme } from '../ThemeContext';

const PAGE_AGENTS = {
  products:  { agentId:'stock',     label:'Agent Stock',    color:'#FFC04D' },
  sales:     { agentId:'sales',     label:'Agent Ventes',   color:'#00E5A0' },
  clients:   { agentId:'clients',   label:'Agent Clients',  color:'#4D9FFF' },
  suppliers: { agentId:'assistant', label:'Assistant IA',   color:'#00D4FF' },
  employees: { agentId:'hr',        label:'Agent RH',       color:'#8B5CF6' },
  treasury:  { agentId:'finance',   label:'Agent Finance',  color:'#C084FC' },
  reports:   { agentId:'finance',   label:'Agent Finance',  color:'#C084FC' },
  dashboard: { agentId:'assistant', label:'Assistant IA',   color:'#00D4FF' },
};

export default function QuickAIButton({ currentPage, onOpenAI }) {
  const { metier } = useTheme();
  const agent = PAGE_AGENTS[currentPage];
  if (!agent) return null;

  // Use metier icon for current page
  const icon = metier.navIcons[currentPage] || '🤖';
  const col  = agent.color;

  return (
    <button onClick={onOpenAI} title={`Ouvrir ${agent.label}`}
      style={{
        position:'fixed', bottom:28, right:28, zIndex:100,
        background:`linear-gradient(135deg,${col},${col}CC)`,
        border:'none', borderRadius:16, padding:'12px 18px',
        color:'#000', fontWeight:900, fontSize:13, cursor:'pointer',
        boxShadow:`0 8px 32px ${col}50`,
        display:'flex', alignItems:'center', gap:8,
        transition:'all .2s',
      }}
      onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-3px) scale(1.05)'; }}
      onMouseLeave={e=>{ e.currentTarget.style.transform='none'; }}>
      <span style={{ fontSize:18 }}>{icon}</span>
      {agent.label}
    </button>
  );
}
