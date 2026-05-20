import { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './ThemeContext';
import Login from './pages/Login';
import Activation from './pages/Activation';
import AIAgentPanel from './components/AIAgentPanel';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Sales from './pages/Sales';
import { Clients } from './pages/Clients';
import Suppliers from './pages/Suppliers';
import Employees from './pages/Employees';
import Treasury from './pages/Treasury';
import { Reports, Quotes, Settings } from './pages/Other';
import { db, seedIfEmpty } from './db';
import { runAutoBackup } from './businessFeatures';
import { DS, ANIMATIONS_CSS } from './designSystem';
// ── FIX AUDIT : composants orphelins maintenant montés ────────────────────
import { ToastContainer }  from './components/Feedback';
import GlobalSearch         from './components/GlobalSearch';
import QuickAIButton        from './components/QuickAIButton';
import UpdateChecker        from './components/UpdateChecker';
import { checkLicense } from './license';

function GlobalStyles() {
  return <style>{ANIMATIONS_CSS}</style>;
}

// ─── BOUTON RETOUR ────────────────────────────────────────────────────────────
function BackBtn({ onBack, shopName, pageName, alerts, onOpenAI, isAdmin, user, onNavigate, currentPage }) {
  const [exp, setExp] = useState(false);
  return (
    <div style={{
      position:'fixed', top:0, left:0, right:0, zIndex: DS.zIndex.sticky,
      height: 48,
      display:'flex', alignItems:'center', gap: DS.spacing.sm,
      padding:`0 ${DS.spacing.lg}px`,
      background: 'rgba(255,255,255,0.92)',
      backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)',
      borderBottom: `1.5px solid ${DS.colors.primaryBd}`,
      boxShadow: DS.shadows.sm,
    }}>

      {/* Retour */}
      <button onClick={onBack}
        onMouseEnter={()=>setExp(true)} onMouseLeave={()=>setExp(false)}
        style={{
          display:'flex', alignItems:'center', gap: 7,
          background: exp ? `linear-gradient(135deg, ${DS.colors.primary}, ${DS.colors.secondary})` : DS.colors.primaryLt,
          border: `1.5px solid ${DS.colors.primaryBd}`,
          borderRadius: DS.radius.md,
          padding: '5px 14px',
          color: exp ? DS.colors.surface : DS.colors.secondary,
          fontWeight: 800, fontSize: 13, cursor: 'pointer',
          transition: DS.transitions.fast,
          boxShadow: exp ? DS.shadows.md : 'none',
          fontFamily: DS.typography.body.fontFamily,
          flexShrink: 0,
        }}>
        <span>←</span>
        <div style={{ lineHeight: 1.1 }}>
          <div style={DS.typography.label}>{shopName}</div>
          <div>Menu</div>
        </div>
      </button>

      {/* Nom page */}
      <div style={{ ...DS.typography.h3, color: DS.colors.neutralDk, marginLeft: DS.spacing.sm, flexShrink: 0 }}>
        {pageName}
      </div>

      {/* FIX AUDIT: GlobalSearch maintenant visible dans le header */}
      <div style={{ flex: 1, maxWidth: 340, margin: '0 12px' }}>
        <GlobalSearch onNavigate={onNavigate} onOpenAI={onOpenAI} isAdmin={isAdmin} />
      </div>

      {/* Alerte stock */}
      {alerts > 0 && (
        <div className="vx-pulse" style={{
          background: DS.colors.dangerLt, border: `1.5px solid ${DS.colors.dangerBd}`,
          borderRadius: DS.radius.sm, padding: '3px 10px', color: DS.colors.danger,
          fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', gap: 5,
          flexShrink: 0,
        }}>
          ⚠ Stock: <span style={{ background: DS.colors.danger, color: '#fff', borderRadius: 20,
            fontSize: 10, fontWeight: 900, padding: '1px 6px' }}>{alerts}</span>
        </div>
      )}

      {/* Utilisateur */}
      <div style={{
        display:'flex', alignItems:'center', gap:6, background: DS.colors.secondaryLt,
        border: `1px solid ${DS.colors.secondaryBd}`, borderRadius: DS.radius.sm, padding: '4px 10px',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 14 }}>{isAdmin ? '👑' : '👨‍💼'}</span>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: DS.colors.secondary }}>{user?.name}</div>
          <div style={{ ...DS.typography.label, fontSize: 8, color: DS.colors.neutral }}>{isAdmin ? 'Admin' : 'Employé'}</div>
        </div>
      </div>

      {/* IA */}
      <button onClick={onOpenAI} style={{
        background: `linear-gradient(135deg, ${DS.colors.primary}, ${DS.colors.secondary})`,
        border: 'none', borderRadius: DS.radius.sm, padding: '5px 12px',
        color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 5, boxShadow: DS.shadows.sm,
        flexShrink: 0,
      }}>🤖 IA</button>
</div>
  );
}

// ─── APPLICATION PRINCIPALE ───────────────────────────────────────────────────
function AppInner() {
  const [user,     setUser]     = useState(null);
  const [page,     setPage]     = useState('dashboard');
  const [showAI,   setShowAI]   = useState(false);
  const [aiDefaultAgent, setAiDefaultAgent] = useState(null);
  const [liveData, setLiveData] = useState({});
  const [alerts,   setAlerts]   = useState(0);
  const [shopName, setShopName] = useState('VenteX AI');
  const [ready,    setReady]    = useState(false);
  const [licenseReady, setLicenseReady] = useState(false);
  const [licenseValid, setLicenseValid] = useState(false);

  useEffect(() => {
    (async () => {
      await seedIfEmpty();
      const sn = await db.settings.get('shop_name').catch(()=>null);
      if (sn?.value) setShopName(sn.value);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!window.electronAPI?.isElectron) {
        setLicenseValid(true);
        setLicenseReady(true);
        return;
      }
      const result = await checkLicense().catch(() => ({ valid: false }));
      setLicenseValid(!!result.valid);
      setLicenseReady(true);
    })();
  }, []);

  useEffect(() => { if (user) loadLiveData(); }, [user]);
  useEffect(() => { if (user) runAutoBackup().catch(() => {}); }, [user]);

  async function loadLiveData() {
    try {
      const products = await db.products.toArray();
      const clients  = await db.clients.toArray();
      const sales    = await db.sales.orderBy('createdAt').reverse().limit(50).toArray();
      setAlerts(products.filter(p => p.stock <= (p.minStock||5)).length);
      setLiveData({ products, clients, sales });
    } catch(e) {}
  }

  function handleLogin(u)  { setUser(u); setPage('dashboard'); }
  function handleLogout()  { setUser(null); setPage('dashboard'); setShowAI(false); }
  function navigate(p)     { setPage(p); window.scrollTo(0,0); }
  function openAI(agentId = null) {
    setAiDefaultAgent(agentId);
    loadLiveData();
    setShowAI(true);
  }

  const isAdmin = ['admin', 'gerant', 'gérant'].includes(user?.role);
  const employeePages = ['dashboard', 'products', 'sales', 'clients'];
  const adminPages = ['dashboard', 'products', 'sales', 'clients', 'suppliers', 'employees', 'treasury', 'reports', 'quotes', 'settings'];
  const allowedPages = isAdmin ? adminPages : employeePages;
  const safeNavigate = (p) => navigate(allowedPages.includes(p) ? p : 'dashboard');

  const PAGE_NAMES = {
    products:'Produits & Stock', sales:'Ventes & Caisse', clients:'Clients',
    suppliers:'Fournisseurs', employees:'Employés', treasury:'Trésorerie',
    reports:'Rapports & Statistiques', quotes:'Devis & Factures', settings:'Paramètres',
  };

  const PAGE_AGENTS = {
    products: 'stock',
    sales: 'sales',
    clients: 'clients',
    treasury: 'finance',
    reports: 'finance',
    employees: 'hr',
    dashboard: 'assistant',
  };

  if (!ready || !licenseReady) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background: DS.colors.bg, flexDirection:'column', gap:14, fontFamily: DS.typography.body.fontFamily }}>
      <div className="vx-popup" style={{ fontSize: 48 }}>⚡</div>
      <div style={{ ...DS.typography.h3, color: DS.colors.primary }}>{shopName}</div>
      <div style={{ ...DS.typography.caption, color: DS.colors.neutral }}>Initialisation...</div>
    </div>
  );

  if (!licenseValid) return <Activation onActivated={() => setLicenseValid(true)} />;

  if (!user) return <Login onLogin={handleLogin}/>;

  const currentPage = allowedPages.includes(page) ? page : 'dashboard';
  const onDashboard = currentPage === 'dashboard';

  return (
    <div style={{
      width:'100vw', height:'100vh', overflow:'hidden',
      display:'flex', flexDirection:'column',
      background: DS.colors.bg,
      fontFamily: DS.typography.body.fontFamily,
    }}>
      <GlobalStyles />

      {/* FIX AUDIT #1 : ToastContainer jamais monté → maintenant ici */}
      <ToastContainer />

      {/* FIX AUDIT #6 : UpdateChecker jamais monté → maintenant ici */}
      <UpdateChecker />

      {showAI && (
        <AIAgentPanel onClose={()=>setShowAI(false)} liveData={liveData}
          userRole={isAdmin?'admin':'employee'} defaultAgentId={aiDefaultAgent}/>
      )}

      {!onDashboard && (
        <BackBtn
          onBack={()=>navigate('dashboard')}
          shopName={shopName}
          pageName={PAGE_NAMES[currentPage]||currentPage}
          alerts={alerts}
          onOpenAI={() => openAI(PAGE_AGENTS[currentPage] || null)}
          isAdmin={isAdmin}
          user={user}
          onNavigate={safeNavigate}
          currentPage={currentPage}
        />
      )}

      <div style={{
        flex:1, width:'100%',
        marginTop: onDashboard ? 0 : 48,
        overflow: onDashboard ? 'hidden' : 'auto',
        padding: 0,
      }}>
        {currentPage === 'dashboard' && <Dashboard onNavigate={safeNavigate} user={user} isAdmin={isAdmin} onOpenAI={() => openAI('assistant')}/>}
        {currentPage === 'products'  && <Products/>}
        {currentPage === 'sales'     && <Sales user={user}/>}
        {currentPage === 'clients'   && <Clients/>}
        {currentPage === 'suppliers' && <Suppliers/>}
        {currentPage === 'employees' && <Employees/>}
        {currentPage === 'treasury'  && <Treasury/>}
        {currentPage === 'reports'   && <Reports/>}
        {currentPage === 'quotes'    && <Quotes/>}
        {currentPage === 'settings'  && <Settings onLogout={handleLogout}/>}
      </div>

      {/* FIX AUDIT #6 : QuickAIButton flottant contextuel par page */}
      {!onDashboard && (
        <QuickAIButton
          currentPage={currentPage}
          onOpenAI={openAI}
        />
      )}
    </div>
  );
}

export default function App() {
  return <ThemeProvider><AppInner/></ThemeProvider>;
}
