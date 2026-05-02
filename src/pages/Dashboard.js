import { useState, useEffect } from 'react';
// Suppression de l'import useTheme qui causait l'erreur
import { getDashboardStats, fmt } from '../db';

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ textAlign:'right' }}>
      <div style={{ fontSize:28, fontWeight:900, color:'#1B4FD8', letterSpacing:1, fontFamily:'monospace', lineHeight:1 }}>
        {time.toLocaleTimeString('fr-DZ', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
      </div>
      <div style={{ fontSize:12, fontWeight:600, color:'#475569', marginTop:2 }}>
        {time.toLocaleDateString('fr-DZ', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
      </div>
    </div>
  );
}

function ModuleTile({ icon, title, shortcut, items, color, bg, onClick, badge }) {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? color : bg,
        border: `2px solid ${color}`,
        borderRadius: 12,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'all .18s',
        position: 'relative',
        boxShadow: hover ? `0 6px 20px ${color}40` : '0 2px 8px rgba(0,0,0,.04)',
      }}>
      {badge > 0 && (
        <div style={{ position:'absolute', top:-8, right:-8, background:'#EF4444', color:'#fff', borderRadius:20, fontSize:10, fontWeight:900, padding:'3px 8px', border:'2px solid #fff' }}>
          {badge}
        </div>
      )}
      <div style={{ display:'flex', gap:14 }}>
        <div style={{
          width:54, height:54, borderRadius:10,
          background: hover ? 'rgba(255,255,255,.25)' : color,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:28, flexShrink:0, transition:'all .18s',
        }}>
          {icon}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:4 }}>
            <span style={{ fontSize:15, fontWeight:900, color: hover ? '#fff' : '#1E293B' }}>{title}</span>
            <span style={{ fontSize:10, fontWeight:800, color: hover ? 'rgba(255,255,255,0.7)' : color }}>{shortcut}</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
            {items && items.map((item, i) => (
              <div key={i} style={{ fontSize:11, color: hover ? 'rgba(255,255,255,.9)' : '#64748B', display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ fontSize:8, color: hover ? '#fff' : color }}>▶</span> {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await getDashboardStats();
        setStats(s);
      } catch (e) { console.error(e); }
    })();
  }, []);

  const MODULES = [
    { icon:'📦', title:'Produits', shortcut:'F3', color:'#0EA5E9', bg:'#E0F2FE', page:'products', badge: stats?.stockAlert||0, items:['Produits & Stock', 'Alertes stock', 'Suivi Produits', 'Inventaire', 'Catégories'] },
    { icon:'👥', title:'Clients', shortcut:'F4', color:'#8B5CF6', bg:'#EDE9FE', page:'clients', items:['Fiche client', 'Suivi Clients', 'Versements', 'Crédits & Créances'] },
    { icon:'🚚', title:'Fournisseurs', shortcut:'F5', color:'#06B6D4', bg:'#CFFAFE', page:'suppliers', items:['Fournisseurs', 'Suivi Fournisseurs', 'Versements', 'Créances'] },
    { icon:'🧾', title:'Vente', shortcut:'F1', color:'#10B981', bg:'#D1FAE5', page:'sales', items:['Vente par client', 'Factures', 'Vente par jour', 'Mise en attente', 'Récap. Vente'] },
    { icon:'🛒', title:'Achat', shortcut:'F2', color:'#F59E0B', bg:'#FEF3C7', page:'suppliers', items:['Achat', 'Mise à jour achat', 'Récap. Achat'] },
    { icon:'💰', title:'Entrée / Sortie', shortcut:'F6', color:'#EF4444', bg:'#FEE2E2', page:'treasury', items:['Dépenses', 'Caisse', 'Bénéfice', 'Zakat'] },
    { icon:'📊', title:'Statistiques', shortcut:'F7', color:'#6366F1', bg:'#E0E7FF', page:'reports', items:['CA par période', 'Top produits', 'Top clients', 'Performances'] },
    { icon:'⚙️', title:'Paramètres', shortcut:'F8', color:'#64748B', bg:'#F1F5F9', page:'settings', items:['Infos Société', 'Mots de passe', 'Sauvegarde', 'Gestion imprimantes'] },
    { icon:'👨‍💼', title:'Employés', shortcut:'F9', color:'#EC4899', bg:'#FCE7F3', page:'employees', items:['Gestion équipe', 'Performances', 'Salaires', 'Accès & rôles'] },
  ];

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', background:'#F1F5F9', overflow:'hidden' }}>
      
      {/* HEADER */}
      <div style={{ background:'#fff', padding:'10px 20px', display:'flex', alignItems:'center', gap:20, borderBottom:'2px solid #E2E8F0' }}>
        <div style={{ minWidth:180 }}>
          <div style={{ fontWeight:900, color:'#1B4FD8', fontSize:20 }}>VentePro</div>
          <div style={{ fontSize:10, color:'#64748B', letterSpacing:1 }}>GESTION COMMERCIALE</div>
        </div>
        <div style={{ flex:1, background:'linear-gradient(135deg, #1B4FD8, #2563EB)', borderRadius:12, padding:'8px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', color:'#fff' }}>
           <span style={{ fontWeight:800 }}>BIENVENUE, ADMINISTRATEUR</span>
           <div style={{ display:'flex', gap:25, fontSize:11, fontWeight:900 }}>
             <span>VENTES JOUR: {stats?.todayTotal || 0} DA</span>
             <span>STOCK ALERTE: {stats?.stockAlert || 12}</span>
             <span>CRÉDITS: {stats?.monthCredit || '1 130'} DA</span>
           </div>
        </div>
        <Clock />
      </div>

      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        <div style={{ flex:1, padding:'25px', overflowY:'auto' }}>
          <div style={{ fontSize:12, fontWeight:800, color:'#64748B', marginBottom:15, display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ width:30, height:2, background:'#1B4FD8' }} /> MODULES
          </div>
          
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:15, marginBottom:20 }}>
            {MODULES.map((m, i) => <ModuleTile key={i} {...m} onClick={() => onNavigate(m.page)} />)}
          </div>

          <div style={{ background:'linear-gradient(135deg, #10B981, #059669)', borderRadius:12, padding:'20px 30px', color:'#fff', display:'flex', alignItems:'center', gap:20, cursor:'pointer' }} onClick={() => onNavigate('sales')}>
            <div style={{ fontSize:35 }}>🧾</div>
            <div style={{ flex:1 }}>
               <div style={{ fontWeight:900, fontSize:20 }}>[F8] Vente Rapide</div>
               <div style={{ fontSize:12, opacity:0.8 }}>Ouvrir la caisse directement · Raccourci clavier F8</div>
            </div>
            <div style={{ background:'rgba(255,255,255,0.2)', padding:'10px 25px', borderRadius:10, fontWeight:900 }}>Ouvrir →</div>
          </div>
        </div>

        {/* PANNEAU DROIT */}
        <div style={{ width:260, background:'#fff', borderLeft:'2px solid #E2E8F0', padding:'20px' }}>
          <div style={{ fontWeight:900, fontSize:13, color:'#1E293B', marginBottom:20 }}>📊 RÉSUMÉ RAPIDE</div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ background:'#F0FDF4', padding:'12px', borderRadius:10, border:'1px solid #10B98120' }}>
                <div style={{ fontSize:10, fontWeight:800, color:'#10B981' }}>CA AUJOURD'HUI</div>
                <div style={{ fontSize:18, fontWeight:900 }}>0 DA</div>
            </div>
            <div style={{ background:'#EFF6FF', padding:'12px', borderRadius:10, border:'1px solid #3B82F620' }}>
                <div style={{ fontSize:10, fontWeight:800, color:'#3B82F6' }}>CA DU MOIS</div>
                <div style={{ fontSize:18, fontWeight:900 }}>1 180 DA</div>
            </div>
            <div style={{ background:'#FFFBEB', padding:'12px', borderRadius:10, border:'1px solid #F59E0B20' }}>
                <div style={{ fontSize:10, fontWeight:800, color:'#F59E0B' }}>CRÉDITS</div>
                <div style={{ fontSize:18, fontWeight:900 }}>1 130 DA</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}