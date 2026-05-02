import { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './ThemeContext';
import Login from './pages/Login';
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

// ─── Bouton retour flottant ───────────────────────────────────────────────────
function BackBtn({ onBack, shopName, pageName, alerts, onOpenAI, isAdmin, user, onLogout }) {
  const [exp, setExp] = useState(false);
  return (
    <div style={{
      position:'fixed', top:0, left:0, right:0, zIndex:200,
      height:46,
      display:'flex', alignItems:'center', gap:8,
      padding:'0 14px',
      background:'rgba(255,255,255,0.92)',
      backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)',
      borderBottom:'1.5px solid rgba(99,102,241,0.15)',
      boxShadow:'0 2px 16px rgba(99,102,241,0.08)',
    }}>

      {/* Retour */}
      <button onClick={onBack}
        onMouseEnter={()=>setExp(true)} onMouseLeave={()=>setExp(false)}
        style={{
          display:'flex', alignItems:'center', gap:7,
          background:exp?'linear-gradient(135deg,#3B82F6,#6366F1)':'#EEF2FF',
          border:'1.5px solid #C7D2FE', borderRadius:10, padding:'5px 14px',
          color:exp?'#fff':'#6366F1', fontWeight:800, fontSize:13, cursor:'pointer',
          transition:'all .18s', boxShadow:exp?'0 4px 14px rgba(99,102,241,0.3)':'none',
          flexShrink:0, fontFamily:"'Segoe UI',system-ui",
        }}>
        <span>←</span>
        <div style={{ lineHeight:1.1 }}>
          <div style={{ fontSize:9, opacity:.7, fontWeight:600, textTransform:'uppercase', letterSpacing:.8 }}>
            {shopName}
          </div>
          <div>Menu principal</div>
        </div>
      </button>

      {/* Nom page */}
      <div style={{ fontSize:14, fontWeight:800, color:'#1E293B', letterSpacing:-.2 }}>
        {pageName}
      </div>

      <div style={{ flex:1 }}/>

      {/* Alerte stock */}
      {alerts > 0 && (
        <div style={{ background:'#FEF2F2', border:'1.5px solid #FECACA', borderRadius:8,
          padding:'3px 10px', color:'#EF4444', fontWeight:700, fontSize:11,
          display:'flex', alignItems:'center', gap:5 }}>
          ⚠ Stock: <span style={{ background:'#EF4444', color:'#fff', borderRadius:20,
            fontSize:10, fontWeight:900, padding:'1px 6px', marginLeft:2 }}>{alerts}</span>
        </div>
      )}

      {/* Utilisateur */}
      <div style={{ display:'flex', alignItems:'center', gap:6, background:'#EEF2FF',
        border:'1px solid #C7D2FE', borderRadius:8, padding:'4px 10px' }}>
        <span style={{ fontSize:14 }}>{isAdmin?'👑':'👨‍💼'}</span>
        <div style={{ lineHeight:1.2 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#6366F1' }}>{user?.name}</div>
          <div style={{ fontSize:9, color:'#94A3B8' }}>{isAdmin?'Admin':'Employé'}</div>
        </div>
      </div>

      {/* IA */}
      <button onClick={onOpenAI} style={{
        background:'linear-gradient(135deg,#3B82F6,#6366F1)',
        border:'none', borderRadius:8, padding:'5px 12px',
        color:'#fff', fontWeight:800, fontSize:12, cursor:'pointer',
        display:'flex', alignItems:'center', gap:5,
        boxShadow:'0 3px 10px rgba(99,102,241,0.3)',
      }}>🤖 IA</button>

      {/* Déconnexion */}
      <button onClick={onLogout} style={{
        background:'transparent', border:'1.5px solid #FECACA',
        borderRadius:8, padding:'5px 10px',
        color:'#EF4444', fontSize:11, cursor:'pointer', fontWeight:600,
      }}>🚪</button>
    </div>
  );
}

// ─── Application principale ───────────────────────────────────────────────────
function AppInner() {
  const { theme: C } = useTheme();
  const [user,     setUser]     = useState(null);
  const [page,     setPage]     = useState('dashboard');
  const [showAI,   setShowAI]   = useState(false);
  const [liveData, setLiveData] = useState({});
  const [alerts,   setAlerts]   = useState(0);
  const [shopName, setShopName] = useState('VenteX AI');
  const [ready,    setReady]    = useState(false);

  useEffect(() => {
    (async () => {
      await seedIfEmpty();
      const sn = await db.settings.get('shop_name').catch(()=>null);
      if (sn?.value) setShopName(sn.value);
      setReady(true);
    })();
  }, []);

  useEffect(() => { if (user) loadLiveData(); }, [user]);

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

  const isAdmin = user?.role === 'admin' || user?.role === 'gérant';

  const PAGE_NAMES = {
    products:'Produits & Stock', sales:'Ventes & Caisse', clients:'Clients',
    suppliers:'Fournisseurs', employees:'Employés', treasury:'Trésorerie',
    reports:'Rapports & Statistiques', quotes:'Devis & Factures', settings:'Paramètres',
  };

  const EMPLOYEE_PAGES = ['dashboard','products','sales','clients'];

  // Chargement
  if (!ready) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'linear-gradient(135deg,#EEF2FF,#F0F9FF,#F0FDF4)',
      flexDirection:'column', gap:14, fontFamily:"'Segoe UI',system-ui" }}>
      <div style={{ fontSize:48 }}>⚡</div>
      <div style={{ fontSize:16, fontWeight:800, color:'#3B82F6' }}>{shopName}</div>
      <div style={{ fontSize:13, color:'#94A3B8' }}>Initialisation...</div>
    </div>
  );

  // Connexion
  if (!user) return <Login onLogin={handleLogin}/>;

  const currentPage = (!isAdmin && !EMPLOYEE_PAGES.includes(page)) ? 'dashboard' : page;
  const onDashboard = currentPage === 'dashboard';

  const renderPage = () => {
    switch(currentPage) {
      case 'dashboard': return <Dashboard onNavigate={navigate} user={user} isAdmin={isAdmin}/>;
      case 'products':  return <Products/>;
      case 'sales':     return <Sales/>;
      case 'clients':   return <Clients/>;
      case 'suppliers': return <Suppliers/>;
      case 'employees': return <Employees/>;
      case 'treasury':  return <Treasury/>;
      case 'reports':   return <Reports/>;
      case 'quotes':    return <Quotes/>;
      case 'settings':  return <Settings/>;
      default:          return <Dashboard onNavigate={navigate} user={user} isAdmin={isAdmin}/>;
    }
  };

  return (
    <div style={{
      width:'100vw', height:'100vh', overflow:'hidden',
      display:'flex', flexDirection:'column',
      background:'linear-gradient(135deg,#EEF2FF 0%,#F0F9FF 50%,#F0FDF4 100%)',
      fontFamily:"'Segoe UI', system-ui, sans-serif",
    }}>
      {showAI && (
        <AIAgentPanel onClose={()=>setShowAI(false)} liveData={liveData}
          userRole={isAdmin?'admin':'employee'}/>
      )}

      {!onDashboard && (
        <BackBtn
          onBack={()=>navigate('dashboard')}
          shopName={shopName}
          pageName={PAGE_NAMES[currentPage]||currentPage}
          alerts={alerts}
          onOpenAI={()=>{ loadLiveData(); setShowAI(true); }}
          isAdmin={isAdmin} user={user} onLogout={handleLogout}
        />
      )}

      <div style={{
        flex:1, width:'100%',
        marginTop: onDashboard ? 0 : 46,
        overflow: onDashboard ? 'hidden' : 'auto',
        padding: 0,
      }}>
        {renderPage()}
      </div>
    </div>
  );
}

export default function App() {
  return <ThemeProvider><AppInner/></ThemeProvider>;
}