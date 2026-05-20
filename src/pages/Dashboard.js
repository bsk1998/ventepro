import { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { getDashboardStats, fmt } from '../db';
import financeAgent from '../components/FinanceAgent';
import ProactiveInsightsPanel from '../components/ProactiveInsightsPanel';

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

const MODULE_HELP = {
  sales: {
    title: 'Vente',
    actions: ['Créer une vente comptoir ou client', 'Imprimer ticket, bon de livraison et facture', 'Consulter les ventes détaillées et encaisser un versement'],
    buttons: ['Ticket : imprime le reçu', 'B.Livraison A4 : prépare le bon de livraison', 'Facture : imprime la facture', 'Versement client : ajoute un paiement sur crédit'],
    shortcuts: ['F1 : ouvrir Vente', 'Fin : quitter la liste détaillée', 'Ctrl+I : ouvrir l agent IA du module'],
  },
  products: {
    title: 'Produits',
    actions: ['Ajouter et modifier les produits', 'Suivre le stock et les alertes', 'Gérer les catégories, références et codes-barres'],
    buttons: ['Ajouter : crée un produit', 'Modifier : met à jour la fiche', 'Stock : ajuste les quantités', 'Recherche : filtre rapidement le catalogue'],
    shortcuts: ['F3 : ouvrir Produits', 'Ctrl+I : ouvrir l agent IA du module'],
  },
  clients: {
    title: 'Clients',
    actions: ['Créer les fiches clients', 'Suivre les crédits et versements', 'Retrouver l historique des achats'],
    buttons: ['Ajouter : crée un client', 'Versement : enregistre un paiement', 'Historique : affiche les transactions', 'Recherche : retrouve une fiche'],
    shortcuts: ['F4 : ouvrir Clients', 'Ctrl+I : ouvrir l agent IA du module'],
  },
  suppliers: {
    title: 'Fournisseurs / Achat',
    actions: ['Gérer les fournisseurs', 'Suivre les achats et créances', 'Mettre à jour le stock depuis les entrées'],
    buttons: ['Achat : crée une entrée fournisseur', 'Versement : enregistre un règlement', 'Suivi : consulte les dettes et paiements'],
    shortcuts: ['F2 : ouvrir Achat', 'F5 : ouvrir Fournisseurs', 'Ctrl+I : ouvrir l agent IA du module'],
  },
  treasury: {
    title: 'Entrée / Sortie',
    actions: ['Enregistrer les dépenses', 'Analyser caisse, bénéfice et sorties', 'Contrôler les mouvements financiers'],
    buttons: ['Dépense : ajoute une sortie', 'Rapport : synthétise la période', 'Filtre : cible une date ou catégorie'],
    shortcuts: ['F6 : ouvrir Entrée / Sortie', 'Ctrl+I : ouvrir l agent Finance'],
  },
  reports: {
    title: 'Statistiques',
    actions: ['Analyser le chiffre d affaires', 'Identifier les meilleurs produits et clients', 'Comparer les périodes'],
    buttons: ['Période : change l intervalle', 'Top produits : classe les articles', 'Top clients : classe les clients'],
    shortcuts: ['F7 : ouvrir Statistiques', 'Ctrl+I : ouvrir l agent IA'],
  },
  settings: {
    title: 'Paramètres',
    actions: ['Configurer les informations société', 'Sauvegarder et restaurer les données', 'Adapter thème et affichage'],
    buttons: ['Sauvegarder : exporte les données', 'Importer : restaure une sauvegarde', 'Thème : change le mode clair/sombre'],
    shortcuts: ['F9 : ouvrir Paramètres'],
  },
  employees: {
    title: 'Employés',
    actions: ['Gérer les membres de l équipe', 'Suivre les performances vendeurs', 'Enregistrer les salaires'],
    buttons: ['Ajouter : crée un employé', 'Actif : active ou désactive un compte', 'Salaire : enregistre un paiement'],
    shortcuts: ['F8 : ouvrir Employés'],
  },
};

const NORMALIZED_MODULE_HELP = {
  sales: {
    title: 'Vente',
    actions: ['Creer une vente comptoir ou client', 'Rechercher par nom, code-barres ou categorie', 'Imprimer ticket, bon de livraison, facture ou proforma', 'Consulter les ventes et encaisser les credits'],
    buttons: ['+ Nouveau : cree un produit depuis la caisse', '+ Ajouter : ajoute le produit au panier', 'Valider : confirme la vente avec paiement', 'Liste ventes : ouvre l historique detaille', 'Versement client : encaisse un paiement sur credit'],
    shortcuts: ['F1 : ouvrir Vente', 'F8 : valider une vente', 'Ctrl+I : ouvrir l agent IA du module'],
  },
  products: {
    title: 'Produits',
    actions: ['Ajouter et modifier les produits', 'Suivre stock, alertes, marges et dates de creation', 'Gerer categories, references et codes-barres'],
    buttons: ['Ajouter : cree un produit', 'Modifier : met a jour la fiche', 'Stock : ajuste les quantites', 'Filtres : trie par categorie, date ou niveau de stock'],
    shortcuts: ['F3 : ouvrir Produits', 'Ctrl+I : ouvrir l agent Stock'],
  },
  clients: {
    title: 'Clients',
    actions: ['Creer les fiches clients', 'Suivre credits et versements', 'Retrouver l historique des achats'],
    buttons: ['Ajouter : cree un client', 'Versement : enregistre un paiement', 'Historique : affiche les transactions', 'Recherche : retrouve une fiche'],
    shortcuts: ['F4 : ouvrir Clients', 'Ctrl+I : ouvrir l agent Clients'],
  },
  suppliers: {
    title: 'Fournisseurs / Achat',
    actions: ['Gerer les fournisseurs', 'Suivre achats, dettes et paiements', 'Mettre a jour le stock depuis les entrees'],
    buttons: ['Achat : cree une entree fournisseur', 'Versement : enregistre un reglement', 'Suivi : consulte les dettes et paiements'],
    shortcuts: ['F2 : ouvrir Achat', 'F5 : ouvrir Fournisseurs', 'Ctrl+I : ouvrir l assistant IA'],
  },
  treasury: {
    title: 'Entree / Sortie',
    actions: ['Enregistrer les depenses', 'Analyser caisse, benefice et sorties', 'Controler les mouvements financiers'],
    buttons: ['Depense : ajoute une sortie', 'Rapport : synthetise la periode', 'Filtre : cible une date ou categorie'],
    shortcuts: ['F6 : ouvrir Entree / Sortie', 'Ctrl+I : ouvrir l agent Finance'],
  },
  reports: {
    title: 'Statistiques',
    actions: ['Analyser le chiffre d affaires', 'Identifier les meilleurs produits et clients', 'Comparer les periodes'],
    buttons: ['Periode : change l intervalle', 'Top produits : classe les articles', 'Top clients : classe les clients'],
    shortcuts: ['F7 : ouvrir Statistiques', 'Ctrl+I : ouvrir l agent Finance'],
  },
  settings: {
    title: 'Parametres',
    actions: ['Configurer les informations societe', 'Sauvegarder et restaurer les donnees', 'Adapter theme et affichage'],
    buttons: ['Sauvegarder : exporte les donnees', 'Importer : restaure une sauvegarde', 'Theme : change le mode clair ou sombre'],
    shortcuts: ['F9 : ouvrir Parametres'],
  },
  employees: {
    title: 'Employes',
    actions: ['Gerer les membres de l equipe', 'Suivre les performances vendeurs', 'Enregistrer les salaires'],
    buttons: ['Ajouter : cree un employe', 'Actif : active ou desactive un compte', 'Salaire : enregistre un paiement'],
    shortcuts: ['F8 : ouvrir Employes'],
  },
};

function ModuleHelpModal({ module, onClose, C }) {
  if (!module) return null;
  const sections = [
    ['Actions principales', module.actions],
    ['Boutons', module.buttons],
    ['Raccourcis', module.shortcuts],
  ];
  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, zIndex:10000, background:'rgba(0,0,0,.42)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:20,
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:420, maxWidth:'100%', background:C.surface, color:C.text,
        border:`1.5px solid ${C.accent}`, borderRadius:12, boxShadow:C.shadow,
        padding:18,
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom:12 }}>
          <div style={{ fontSize:16, fontWeight:900, color:C.text }}>Aide - {module.title}</div>
          <button onClick={onClose} style={{
            border:'none', background:C.redLo, color:C.red, borderRadius:8,
            width:30, height:30, cursor:'pointer', fontWeight:900,
          }}>x</button>
        </div>
        {sections.map(([title, items]) => (
          <div key={title} style={{ marginTop:12 }}>
            <div style={{ fontSize:10, fontWeight:900, color:C.accent, textTransform:'uppercase', letterSpacing:.8, marginBottom:6 }}>{title}</div>
            {items.map((item, i) => (
              <div key={i} style={{ fontSize:12, color:C.text, padding:'4px 0', borderBottom:`1px solid ${C.border}` }}>{item}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ModuleTile({ icon, title, shortcut, items, color, onClick, badge, C, help, onHelp }) {
  const [hover, setHover] = useState(false);
  const tileBg    = hover ? color : color + (C.isLight ? '18' : '22');
  const textColor  = hover ? '#fff' : C.text;
  const subColor   = hover ? 'rgba(255,255,255,.82)' : C.sub;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: tileBg, border: `2px solid ${color}`, borderRadius: 12,
        padding: '14px 16px', cursor: 'pointer', transition: 'all .18s',
        position: 'relative', boxShadow: hover ? `0 6px 20px ${color}40` : C.shadowSm,
      }}>
      {badge > 0 && (
        <div style={{ position: 'absolute', top: -8, right: -8,
          background: C.red, color: '#fff', borderRadius: 20,
          fontSize: 10, fontWeight: 900, padding: '3px 8px',
          border: `2px solid ${C.surface}` }}>{badge}</div>
      )}
      {help && (
        <button
          type="button"
          title={`Aide ${title}`}
          onClick={e => { e.stopPropagation(); onHelp(help); }}
          style={{
            position:'absolute', top:8, right:8, width:26, height:26,
            border:`1px solid ${hover ? 'rgba(255,255,255,.45)' : color + '70'}`,
            borderRadius:10, background:hover ? 'rgba(255,255,255,.18)' : C.surface,
            color:hover ? '#fff' : color, cursor:'help', fontWeight:900,
            fontSize:13, lineHeight:1,
          }}>
          ?
        </button>
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
      <div style={{ fontSize: 10, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: .6, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: C.text, fontFamily: 'monospace' }}>{value}</div>
    </div>
  );
}

export default function Dashboard({ onNavigate, user, isAdmin, onOpenAI }) {
  const { theme: C, metier } = useTheme();
  const [stats,       setStats]       = useState(null);
  const [reportAlert, setReportAlert] = useState([]);
  const [helpModule,  setHelpModule]  = useState(null);

  useEffect(() => {
    getDashboardStats().then(setStats).catch(console.error);
    financeAgent.generateMonthlyReport()
      .then(r => setReportAlert(r.recommendations.filter(rec => rec.type === 'danger' || rec.type === 'warning')))
      .catch(() => {});
  }, []);

  // Raccourcis alignés sur les modules réellement visibles.
  useEffect(() => {
    const adminMap = { F1: 'sales', F2: 'suppliers', F3: 'products', F4: 'clients', F5: 'suppliers', F6: 'treasury', F7: 'reports', F8: 'employees', F9: 'settings' };
    const employeeMap = { F1: 'sales', F3: 'products', F4: 'clients' };
    const MAP = isAdmin ? adminMap : employeeMap;
    function handler(e) {
      if (MAP[e.key]) { e.preventDefault(); onNavigate(MAP[e.key]); }
      // Ctrl+I → ouvre l'IA depuis le Dashboard
      if (e.ctrlKey && e.key === 'i') { e.preventDefault(); if (onOpenAI) onOpenAI(); }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onNavigate, onOpenAI, isAdmin]);

  const ADMIN_MODULES = [
    { icon: metier.navIcons?.products  || '📦', title: 'Produits',        shortcut: 'F3', color: C.blue,    page: 'products',  badge: stats?.stockAlert || 0, items: ['Produits & Stock', 'Alertes stock', 'Inventaire', 'Catégories'] },
    { icon: metier.navIcons?.clients   || '👥', title: 'Clients',         shortcut: 'F4', color: C.violet,  page: 'clients',   items: ['Fiche client', 'Suivi Clients', 'Versements', 'Crédits'] },
    { icon: metier.navIcons?.suppliers || '🚚', title: 'Fournisseurs',    shortcut: 'F5', color: C.accent,  page: 'suppliers', items: ['Fournisseurs', 'Suivi', 'Versements', 'Créances'] },
    { icon: metier.navIcons?.sales     || '🧾', title: 'Vente',           shortcut: 'F1', color: C.green,   page: 'sales',     items: ['Vente par client', 'Factures', 'Vente par jour', 'Récap.'] },
    { icon: '🛒',                               title: 'Achat',           shortcut: 'F2', color: C.amber,   page: 'suppliers', items: ['Achat fournisseur', 'Mise à jour stock', 'Récap. Achat'] },
    { icon: metier.navIcons?.treasury  || '💰', title: 'Entrée / Sortie', shortcut: 'F6', color: C.red,     page: 'treasury',  items: ['Dépenses', 'Caisse', 'Bénéfice', 'Zakat'] },
    { icon: metier.navIcons?.reports   || '📊', title: 'Statistiques',    shortcut: 'F7', color: C.purple,  page: 'reports',   items: ['CA par période', 'Top produits', 'Top clients'] },
    { icon: metier.navIcons?.settings  || '⚙️', title: 'Paramètres',     shortcut: 'F9', color: C.sub,     page: 'settings',  items: ['Infos Société', 'Sauvegarde', 'Thème'] },
    { icon: metier.navIcons?.employees || '👨‍💼', title: 'Employés',      shortcut: 'F8', color: '#EC4899', page: 'employees', items: ['Gestion équipe', 'Performances', 'Salaires'] },
  ];
  const EMPLOYEE_MODULES = ADMIN_MODULES.filter(m => ['sales', 'products', 'clients'].includes(m.page));
  const MODULES = isAdmin ? ADMIN_MODULES : EMPLOYEE_MODULES;

  // FIX AUDIT : couleur texte bannière toujours blanche (indépendante du mode)
  // L'ancienne logique `C.isLight ? '#fff' : '#000'` donnait du noir sur fond
  // orange/doré en mode sombre avec certaines palettes → illisible.
  const bannerTextColor = '#fff';

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden', fontFamily: C.fontBody }}>
      <ModuleHelpModal module={helpModule} C={C} onClose={() => setHelpModule(null)} />

      {/* ── HEADER ── */}
      <div style={{ background: C.surface, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 20, borderBottom: `2px solid ${C.border}` }}>
        <div style={{ minWidth: 180 }}>
          <div style={{ fontWeight: 900, color: C.accent, fontSize: 20, fontFamily: C.fontDisplay }}>VentePro</div>
          <div style={{ fontSize: 10, color: C.sub, letterSpacing: 1, textTransform: 'uppercase' }}>Gestion Commerciale</div>
        </div>

        {/* FIX AUDIT : couleur texte toujours '#fff' sur fond accent */}
        <div style={{
          flex: 1,
          background: `linear-gradient(135deg, ${C.accent}, ${C.accent}CC)`,
          borderRadius: 12, padding: '8px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          color: bannerTextColor,
        }}>
          <span style={{ fontWeight: 800 }}>
            BIENVENUE{user?.name ? `, ${user.name.toUpperCase()}` : ''}
          </span>
          <div style={{ display: 'flex', gap: 25, fontSize: 11, fontWeight: 900 }}>
            <span>VENTES JOUR: {fmt(stats?.todayTotal || 0)}</span>
            <span>STOCK ALERTE: {stats?.stockAlert || 0}</span>
            <span>CRÉDITS: {fmt(stats?.monthCredit || 0)}</span>
          </div>
        </div>

        {/* FIX AUDIT : bouton IA accessible depuis le Dashboard */}
        {onOpenAI && (
          <button onClick={onOpenAI} style={{
            background: `linear-gradient(135deg,#06B6D4,#3B82F6)`,
            border: 'none', borderRadius: 10, padding: '8px 16px',
            color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 4px 14px rgba(6,182,212,0.4)', flexShrink: 0,
          }}>🤖 Agents IA</button>
        )}

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
            MODULES — <span style={{ fontWeight: 500, fontSize: 10 }}>{isAdmin ? 'raccourcis F1-F9 actifs' : 'accès vendeur: F1, F3, F4'}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 15, marginBottom: 20 }}>
            {MODULES.map((m, i) => (
              <ModuleTile key={i} {...m} help={m.help || NORMALIZED_MODULE_HELP[m.page]} C={C} onHelp={setHelpModule} onClick={() => onNavigate(m.page)} />
            ))}
          </div>

          <ProactiveInsightsPanel compact onOpenAI={onOpenAI} />

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
              <div style={{ fontWeight: 900, fontSize: 20 }}>[F1] Vente Rapide</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Ouvrir la caisse directement · Raccourci clavier F1</div>
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
          <StatBox label="CA Aujourd'hui" value={fmt(stats?.todayTotal || 0)}  color={C.green}  C={C} />
          <StatBox label="CA du mois"     value={fmt(stats?.monthTotal || 0)}  color={C.accent} C={C} />
          <StatBox label="Crédits"        value={fmt(stats?.monthCredit || 0)} color={C.amber}  C={C} />
          <StatBox label="Alertes stock"  value={stats?.stockAlert || 0}       color={C.red}    C={C} />

          {stats?.evolution?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: .6, marginBottom: 8 }}>
                Évolution 7 mois
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 56 }}>
                {stats.evolution.map((d, i) => {
                  const max    = Math.max(...stats.evolution.map(x => x.total), 1);
                  const h      = Math.max(4, Math.round((d.total / max) * 48));
                  const isLast = i === stats.evolution.length - 1;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{
                        width: '100%', height: h,
                        background: isLast ? C.accentGrad : `linear-gradient(180deg,${C.accent}60,${C.accent}25)`,
                        borderRadius: '3px 3px 0 0', transition: 'height .3s',
                      }} />
                      <span style={{ color: C.muted, fontSize: 8 }}>{d.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* FIX AUDIT : accès IA depuis le panneau résumé */}
          {onOpenAI && (
            <button onClick={onOpenAI} style={{
              marginTop: 8,
              background: `linear-gradient(135deg,#06B6D4,#3B82F6)`,
              border: 'none', borderRadius: 10, padding: '10px',
              color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: '0 4px 14px rgba(6,182,212,0.3)',
            }}>✨ Ouvrir les Agents IA</button>
          )}
        </div>
      </div>
    </div>
  );
}
