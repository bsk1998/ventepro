import { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { getDashboardStats, fmt } from '../db';
import financeAgent from '../components/FinanceAgent';

function Clock({ C }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: 28, fontWeight: 900, color: C.accent, letterSpacing: 1, fontFamily: 'monospace', lineHeight: 1 }}>
        {time.toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.sub, marginTop: 2 }}>
        {time.toLocaleDateString('fr-DZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </div>
    </div>
  );
}

function ModuleTile({ icon, title, shortcut, items, color, onClick, badge, C }) {
  const [hover, setHover] = useState(false);
  const tileBg   = hover ? color : color + (C.isLight ? '18' : '22');
  const textColor = hover ? '#fff' : C.text;
  const subColor  = hover ? 'rgba(255,255,255,.82)' : C.sub;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: tileBg,
        border: `2px solid ${color}`,
        borderRadius: 12,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'all .18s',
        position: 'relative',
        boxShadow: hover ? `0 6px 20px ${color}40` : C.shadowSm,
      }}>
      {badge > 0 && (
        <div style={{
          position: 'absolute', top: -8, right: -8,
          background: C.red, color: '#fff', borderRadius: 20,
          fontSize: 10, fontWeight: 900, padding: '3px 8px',
          border: `2px solid ${C.surface}`,
        }}>{badge}</div>
      )}
      <div style={{ display: 'flex', gap: 14 }}>
        <div style={{
          width: 54, height: 54, borderRadius: 10,
          background: hover ? 'rgba(255,255,255,.22)' : color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, flexShrink: 0, transition: 'all .18s',
        }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: textColor }}>{title}</span>
            <span style={{ fontSize: 10, fontWeight: 800, color: hover ? 'rgba(255,255,255,.65)' : color }}>{shortcut}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {items && items.map((item, i) => (
              <div key={i} style={{ fontSize: 11, color: subColor, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 8, color: hover ? '#fff' : color }}>▶</span> {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color, C }) {
  return (
    <div style={{ background: color + '18', padding: '12px', borderRadius: 10, border: `1px solid ${color}30` }}>
      <div style={{ fontSize: 10, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: .6, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color: C.text, fontFamily: 'monospace' }}>{value}</div>
    </div>
  );
}

export default function Dashboard({ onNavigate }) {
  const { theme: C, metier } = useTheme();
  const [stats,       setStats]       = useState(null);
  const [reportAlert, setReportAlert] = useState([]);

  useEffect(() => {
    getDashboardStats().then(setStats).catch(console.error);
    financeAgent.generateMonthlyReport()
      .then(r => setReportAlert(r.recommendations.filter(rec => rec.type === 'danger' || rec.type === 'warning')))
      .catch(() => {});
  }, []);

  const MODULES = [
    { icon: metier.navIcons?.products  || '📦', title: 'Produits',       shortcut: 'F3', color: C.blue,   page: 'products',  badge: stats?.stockAlert || 0, items: ['Produits & Stock', 'Alertes stock', 'Inventaire', 'Catégories'] },
    { icon: metier.navIcons?.clients   || '👥', title: 'Clients',        shortcut: 'F4', color: C.violet, page: 'clients',   items: ['Fiche client', 'Suivi Clients', 'Versements', 'Crédits'] },
    { icon: metier.navIcons?.suppliers || '🚚', title: 'Fournisseurs',   shortcut: 'F5', color: C.accent, page: 'suppliers', items: ['Fournisseurs', 'Suivi', 'Versements', 'Créances'] },
    { icon: metier.navIcons?.sales     || '🧾', title: 'Vente',          shortcut: 'F1', color: C.green,  page: 'sales',     items: ['Vente par client', 'Factures', 'Vente par jour', 'Récap.'] },
    { icon: '🛒',                               title: 'Achat',          shortcut: 'F2', color: C.amber,  page: 'suppliers', items: ['Achat', 'Mise à jour achat', 'Récap. Achat'] },
    { icon: metier.navIcons?.treasury  || '💰', title: 'Entrée / Sortie',shortcut: 'F6', color: C.red,    page: 'treasury',  items: ['Dépenses', 'Caisse', 'Bénéfice', 'Zakat'] },
    { icon: metier.navIcons?.reports   || '📊', title: 'Statistiques',   shortcut: 'F7', color: C.purple, page: 'reports',   items: ['CA par période', 'Top produits', 'Top clients'] },
    { icon: metier.navIcons?.settings  || '⚙️', title: 'Paramètres',    shortcut: 'F8', color: C.sub,    page: 'settings',  items: ['Infos Société', 'Sauvegarde', 'Imprimante'] },
    { icon: metier.navIcons?.employees || '👨‍💼',title: 'Employés',       shortcut: 'F9', color: '#EC4899',page: 'employees', items: ['Gestion équipe', 'Performances', 'Salaires'] },
  ];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden', fontFamily: C.fontBody }}>

      {/* ── HEADER ── */}
      <div style={{ background: C.surface, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 20, borderBottom: `2px solid ${C.border}` }}>
        <div style={{ minWidth: 180 }}>
          <div style={{ fontWeight: 900, color: C.accent, fontSize: 20, fontFamily: C.fontDisplay }}>VentePro</div>
          <div style={{ fontSize: 10, color: C.sub, letterSpacing: 1, textTransform: 'uppercase' }}>Gestion Commerciale</div>
        </div>

        <div style={{
          flex: 1,
          background: `linear-gradient(135deg, ${C.accent}, ${C.accent}CC)`,
          borderRadius: 12, padding: '8px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          color: C.isLight ? '#fff' : '#000',
        }}>
          <span style={{ fontWeight: 800 }}>BIENVENUE, ADMINISTRATEUR</span>
          <div style={{ display: 'flex', gap: 25, fontSize: 11, fontWeight: 900 }}>
            <span>VENTES JOUR: {fmt(stats?.todayTotal || 0)}</span>
            <span>STOCK ALERTE: {stats?.stockAlert || 0}</span>
            <span>CRÉDITS: {fmt(stats?.monthCredit || 0)}</span>
          </div>
        </div>

        <Clock C={C} />
      </div>

      {/* ── ALERTES IA ── */}
      {reportAlert.length > 0 && (
        <div style={{
          padding: '8px 20px', background: C.amberLo,
          borderBottom: `2px solid ${C.amber}40`,
          display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 12, fontWeight: 900, color: C.amber, flexShrink: 0 }}>🤖 Agent Finance :</span>
          {reportAlert.slice(0, 2).map((r, i) => (
            <span key={i} style={{
              fontSize: 12, color: C.text,
              background: C.surface, border: `1px solid ${C.amber}40`,
              borderRadius: 20, padding: '3px 12px',
            }}>
              {r.type === 'danger' ? '🔴' : '🟡'} {r.msg}
            </span>
          ))}
        </div>
      )}

      {/* ── CORPS ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Zone modules */}
        <div style={{ flex: 1, padding: '25px', overflowY: 'auto' }}>
          <div style={{
            fontSize: 12, fontWeight: 800, color: C.sub, marginBottom: 15,
            display: 'flex', alignItems: 'center', gap: 10,
            textTransform: 'uppercase', letterSpacing: 1.2,
          }}>
            <span style={{ width: 30, height: 2, background: C.accent, display: 'inline-block' }} />
            MODULES
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 15, marginBottom: 20 }}>
            {MODULES.map((m, i) => (
              <ModuleTile key={i} {...m} C={C} onClick={() => onNavigate(m.page)} />
            ))}
          </div>

          {/* Bouton Vente Rapide */}
          <div
            onClick={() => onNavigate('sales')}
            style={{
              background: `linear-gradient(135deg, ${C.green}, ${C.green}CC)`,
              borderRadius: 12, padding: '20px 30px',
              color: '#fff', display: 'flex', alignItems: 'center', gap: 20,
              cursor: 'pointer', transition: 'all .18s',
              boxShadow: `0 4px 20px ${C.green}40`,
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
            <div style={{ fontSize: 35 }}>🧾</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 20 }}>[F8] Vente Rapide</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Ouvrir la caisse directement · Raccourci clavier F8</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '10px 25px', borderRadius: 10, fontWeight: 900 }}>
              Ouvrir →
            </div>
          </div>
        </div>

        {/* Panneau résumé */}
        <div style={{ width: 260, background: C.surface, borderLeft: `2px solid ${C.border}`, padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 13, color: C.text, textTransform: 'uppercase', letterSpacing: .5 }}>
            📊 Résumé rapide
          </div>
          <StatBox label="CA Aujourd'hui" value={fmt(stats?.todayTotal || 0)}   color={C.green}  C={C} />
          <StatBox label="CA du mois"     value={fmt(stats?.monthTotal || 0)}   color={C.accent} C={C} />
          <StatBox label="Crédits"        value={fmt(stats?.monthCredit || 0)}  color={C.amber}  C={C} />
          <StatBox label="Alertes stock"  value={stats?.stockAlert || 0}        color={C.red}    C={C} />

          {/* Mini graphique evolution */}
          {stats?.evolution?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: .6, marginBottom: 8 }}>
                Évolution 7 mois
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 56 }}>
                {stats.evolution.map((d, i) => {
                  const max = Math.max(...stats.evolution.map(x => x.total), 1);
                  const h   = Math.max(4, Math.round((d.total / max) * 48));
                  const isLast = i === stats.evolution.length - 1;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{
                        width: '100%', height: h,
                        background: isLast ? C.accentGrad : `linear-gradient(180deg,${C.accent}60,${C.accent}25)`,
                        borderRadius: '3px 3px 0 0',
                        transition: 'height .3s',
                      }} />
                      <span style={{ color: C.muted, fontSize: 8 }}>{d.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}