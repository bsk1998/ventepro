import { ThemeSwitcher } from '../ThemeContext';
import { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { Card, Btn, Badge, Loader, PageHeader, TableWrap, TR, TD, MiniChart, fmt } from '../components/ui';
import { db, getDashboardStats, exportBackup, importBackup, nowISO } from '../db';
import { printQuote as printQuoteDoc, PrintSettingsPanel } from '../components/Ticket';

// ════════════════════════════════════════════════════════════════════════════
// REPORTS (inchangé)
// ════════════════════════════════════════════════════════════════════════════
export function Reports() {
  const { theme: C } = useTheme();
  const [data, setData]     = useState(null);
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [period]); // eslint-disable-line

  async function load() {
    setLoading(true);
    const now = new Date();
    let start;
    if (period==='today')      start = now.toISOString().slice(0,10);
    else if (period==='week')  { const d=new Date(); d.setDate(d.getDate()-7); start=d.toISOString().slice(0,10); }
    else if (period==='month') start = now.toISOString().slice(0,7)+'-01';
    else if (period==='year')  start = now.getFullYear()+'-01-01';
    else                       start = '2000-01-01';

    const [sales,products,clients,employees,expenses] = await Promise.all([
      db.sales.toArray(), db.products.toArray(),
      db.clients.toArray(), db.employees.toArray(), db.expenses.toArray(),
    ]);
    const periodSales = sales.filter(s => s.createdAt >= start);
    const periodExp   = expenses.filter(e => e.createdAt >= start);
    const items       = await db.saleItems.toArray();

    const prodCounts = {};
    items.filter(i => periodSales.some(s => s.id===i.saleId)).forEach(i => {
      prodCounts[i.productName] = (prodCounts[i.productName]||0) + i.qty;
    });
    const topProds = Object.entries(prodCounts).sort((a,b) => b[1]-a[1]).slice(0,5);

    const clientCA = {};
    periodSales.forEach(s => {
      if (s.clientName && s.clientName!=='Passage')
        clientCA[s.clientName] = (clientCA[s.clientName]||0) + Number(s.total||0);
    });
    const topClients = Object.entries(clientCA).sort((a,b) => b[1]-a[1]).slice(0,5);

    const empCA = {};
    periodSales.forEach(s => {
      if (s.employeeName) empCA[s.employeeName] = (empCA[s.employeeName]||0) + Number(s.total||0);
    });

    const ca    = periodSales.reduce((s,v) => s+Number(v.total||0), 0);
    const exp   = periodExp.reduce((s,e)   => s+Number(e.amount||0), 0);
    const stats = await getDashboardStats();

    setData({ ca, exp, benefice:ca-exp, count:periodSales.length,
      credit:periodSales.filter(s=>s.status==='crédit').length,
      topProds, topClients, empCA, chart:stats.chart });
    setLoading(false);
  }

  if (loading) return <Loader/>;

  const periodLabel = { today:"Aujourd'hui", week:'7 derniers jours', month:'Ce mois', year:'Cette année', all:'Tout' };

  return (
    <div>
      <PageHeader title="Rapports & Analyses" sub="Vue d'ensemble de votre activité">
        <select value={period} onChange={e=>setPeriod(e.target.value)}
          style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'9px 14px',color:C.text,fontSize:13,outline:'none'}}>
          {Object.entries(periodLabel).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </PageHeader>

      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
        {[
          {label:"Chiffre d'affaires",val:fmt(data.ca),   icon:'📈',color:C.green},
          {label:'Dépenses',          val:fmt(data.exp),  icon:'💸',color:C.red},
          {label:'Bénéfice net',      val:fmt(data.benefice),icon:'💰',color:C.accent},
          {label:'Nbr ventes',        val:data.count,     icon:'🧾',color:C.blue},
        ].map(s=>(
          <Card key={s.label} style={{position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:-15,right:-15,width:60,height:60,borderRadius:'50%',background:s.color+'15'}}/>
            <div style={{fontSize:20,marginBottom:6}}>{s.icon}</div>
            <div style={{color:C.sub,fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:.8,marginBottom:3}}>{s.label}</div>
            <div style={{fontSize:20,fontWeight:900,color:s.color,fontFamily:C.fontDisplay}}>{s.val}</div>
          </Card>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        <Card>
          <div style={{fontWeight:700,fontSize:14,marginBottom:14,fontFamily:C.fontDisplay}}>🏆 Top produits</div>
          {data.topProds.length===0
            ? <div style={{color:C.sub,fontSize:13,textAlign:'center',padding:16}}>Aucune vente</div>
            : data.topProds.map(([name,qty],i)=>(
              <div key={name} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:'flex',gap:10,alignItems:'center'}}>
                  <span style={{color:C.muted,fontSize:11,minWidth:16}}>#{i+1}</span>
                  <span style={{fontSize:13,fontWeight:600}}>{name}</span>
                </div>
                <span style={{color:C.accent,fontWeight:700}}>{qty} vendus</span>
              </div>
            ))}
        </Card>
        <Card>
          <div style={{fontWeight:700,fontSize:14,marginBottom:14,fontFamily:C.fontDisplay}}>👥 Top clients</div>
          {data.topClients.length===0
            ? <div style={{color:C.sub,fontSize:13,textAlign:'center',padding:16}}>Aucun client</div>
            : data.topClients.map(([name,ca],i)=>(
              <div key={name} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:'flex',gap:10,alignItems:'center'}}>
                  <span style={{color:C.muted,fontSize:11,minWidth:16}}>#{i+1}</span>
                  <span style={{fontSize:13,fontWeight:600}}>{name}</span>
                </div>
                <span style={{color:C.green,fontWeight:700}}>{fmt(ca)}</span>
              </div>
            ))}
        </Card>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// QUOTES (inchangé)
// ════════════════════════════════════════════════════════════════════════════
export function Quotes() {
  const { theme: C } = useTheme();
  const [quotes,setQuotes]=useState([]);
  const [clients,setClients]=useState([]);
  const [products,setProducts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [modal,setModal]=useState(false);
  const [cart,setCart]=useState([]);
  const [clientId,setClientId]=useState('');
  const [clientName,setClientName]=useState('');
  const [note,setNote]=useState('');
  const [search,setSearch]=useState('');
  const [qty,setQty]=useState(1);
  const [saving,setSaving]=useState(false);

  useEffect(()=>{load();},[]);

  async function load(){
    setLoading(true);
    const [q,c,p]=await Promise.all([
      db.quotes.orderBy('createdAt').reverse().toArray(),
      db.clients.toArray(),db.products.toArray()
    ]);
    const enriched=await Promise.all(q.map(async qt=>{
      const items=await db.quoteItems.where('quoteId').equals(qt.id).toArray();
      return {...qt,items};
    }));
    setQuotes(enriched);setClients(c);setProducts(p);setLoading(false);
  }

  const filteredProds=products.filter(p=>search&&p.name?.toLowerCase().includes(search.toLowerCase())).slice(0,6);
  const total=cart.reduce((s,i)=>s+i.unitPrice*i.qty,0);

  function addToCart(p){
    const ex=cart.find(i=>i.productId===p.id);
    if(ex) setCart(cart.map(i=>i.productId===p.id?{...i,qty:i.qty+qty}:i));
    else setCart([...cart,{productId:p.id,productName:p.name,unitPrice:p.sellPrice,qty}]);
    setSearch('');setQty(1);
  }

  async function saveQuote(){
    if(!cart.length) return alert('Panier vide');
    setSaving(true);
    const num=`DEV-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
    const cl=clients.find(c=>c.id===Number(clientId));
    const qid=await db.quotes.add({
      number:num,clientId:cl?.id||null,clientName:cl?.name||clientName||'—',
      total,note,status:'en attente',createdAt:nowISO()
    });
    await db.quoteItems.bulkAdd(cart.map(i=>({...i,quoteId:qid})));
    setCart([]);setClientId('');setClientName('');setNote('');setModal(false);
    await load();setSaving(false);
  }

  async function convertToSale(quote){
    if(!window.confirm('Convertir ce devis en vente ?')) return;
    const items=await db.quoteItems.where('quoteId').equals(quote.id).toArray();
    const saleId=await db.sales.add({
      clientName:quote.clientName,clientId:quote.clientId,
      total:quote.total,paid:quote.total,status:'payé',
      note:`Devis ${quote.number}`,createdAt:nowISO()
    });
    await db.saleItems.bulkAdd(items.map(i=>({...i,saleId})));
    for(const i of items){
      const p=await db.products.get(i.productId);
      if(p) await db.products.update(i.productId,{stock:Math.max(0,p.stock-i.qty)});
    }
    await db.quotes.update(quote.id,{status:'converti'});
    await load();alert('Devis converti en vente ✅');
  }

  async function printQuote(q){
    const client = q.clientId ? await db.clients.get(q.clientId) : null;
    await printQuoteDoc(q, q.items||[], client);
  }

  if(loading) return <Loader/>;

  return (
    <div>
      <PageHeader title="Devis & Factures" sub={`${quotes.length} devis · ${quotes.filter(q=>q.status==='converti').length} convertis`}>
        <Btn onClick={()=>setModal(true)}>+ Nouveau devis</Btn>
      </PageHeader>
      <TableWrap headers={['Numéro','Client','Total','Statut','Date','Actions']}>
        {quotes.map((q,i)=>(
          <TR key={q.id} i={i}>
            <TD style={{fontFamily:C.fontMono,fontSize:12,color:C.accent}}>{q.number}</TD>
            <TD style={{fontWeight:600}}>{q.clientName}</TD>
            <TD style={{fontWeight:700,color:C.accent}}>{fmt(q.total)}</TD>
            <TD><Badge color={q.status==='converti'?'green':q.status==='refusé'?'red':'amber'} small>{q.status}</Badge></TD>
            <TD style={{color:C.sub,fontSize:11}}>{new Date(q.createdAt).toLocaleDateString('fr-DZ')}</TD>
            <TD>
              <div style={{display:'flex',gap:5}}>
                <button onClick={()=>printQuote(q)} style={{background:C.accentLo,border:'none',borderRadius:7,padding:'4px 9px',color:C.accent,cursor:'pointer',fontSize:11}}>🖨 Imprimer</button>
                {q.status==='en attente'&&<button onClick={()=>convertToSale(q)} style={{background:C.greenLo,border:'none',borderRadius:7,padding:'4px 9px',color:C.green,cursor:'pointer',fontSize:11,fontWeight:700}}>✓ Convertir</button>}
                <button onClick={async()=>{if(window.confirm('Supprimer ?')){await db.quotes.delete(q.id);await load();}}} style={{background:C.redLo,border:'none',borderRadius:7,padding:'4px 9px',color:C.red,cursor:'pointer',fontSize:11}}>🗑</button>
              </div>
            </TD>
          </TR>
        ))}
      </TableWrap>

      {modal&&(
        <div style={{position:'fixed',inset:0,background:'#00000096',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:20,width:580,maxWidth:'95vw',maxHeight:'90vh',overflow:'auto',boxShadow:'0 40px 100px #000c'}}>
            <div style={{padding:'18px 22px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{fontWeight:800,fontSize:16,fontFamily:C.fontDisplay}}>+ Nouveau devis</div>
              <button onClick={()=>setModal(false)} style={{background:'none',border:'none',color:C.sub,fontSize:24,cursor:'pointer'}}>×</button>
            </div>
            <div style={{padding:22}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
                <div>
                  <div style={{color:C.sub,fontSize:10,fontWeight:700,marginBottom:5,textTransform:'uppercase',letterSpacing:.6}}>Client</div>
                  <select value={clientId} onChange={e=>setClientId(e.target.value)} style={{width:'100%',background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:'9px 12px',color:C.text,fontSize:13,outline:'none'}}>
                    <option value="">Sélectionner...</option>
                    {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{color:C.sub,fontSize:10,fontWeight:700,marginBottom:5,textTransform:'uppercase',letterSpacing:.6}}>Ou nom libre</div>
                  <input value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="Client externe..." style={{width:'100%',background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:'9px 12px',color:C.text,fontSize:13,outline:'none'}}/>
                </div>
              </div>
              <div style={{marginBottom:14,position:'relative'}}>
                <div style={{color:C.sub,fontSize:10,fontWeight:700,marginBottom:5,textTransform:'uppercase',letterSpacing:.6}}>Ajouter produit</div>
                <div style={{display:'flex',gap:8}}>
                  <div style={{position:'relative',flex:1}}>
                    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher..." style={{width:'100%',background:C.bg,border:`1px solid ${C.accent}50`,borderRadius:10,padding:'9px 12px',color:C.text,fontSize:13,outline:'none'}}/>
                    {filteredProds.length>0&&(
                      <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:10,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,boxShadow:C.shadow,marginTop:4}}>
                        {filteredProds.map(p=>(
                          <div key={p.id} onClick={()=>addToCart(p)} style={{padding:'10px 14px',cursor:'pointer',display:'flex',justifyContent:'space-between',borderBottom:`1px solid ${C.border}`}} onMouseEnter={e=>e.currentTarget.style.background=C.accentLo} onMouseLeave={e=>e.currentTarget.style.background='none'}>
                            <span style={{fontSize:13,fontWeight:600}}>{p.name}</span>
                            <span style={{color:C.accent,fontWeight:700}}>{fmt(p.sellPrice)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="number" value={qty} min={1} onChange={e=>setQty(Number(e.target.value))} style={{width:60,background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:'9px 8px',color:C.text,fontSize:13,outline:'none',textAlign:'center'}}/>
                </div>
              </div>
              <div style={{background:C.bg,borderRadius:12,padding:14,marginBottom:14}}>
                {cart.map(i=>(
                  <div key={i.productId} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 0',borderBottom:`1px solid ${C.border}`}}>
                    <span style={{flex:1,fontSize:13}}>{i.productName}</span>
                    <span style={{color:C.sub,fontSize:12}}>×{i.qty}</span>
                    <span style={{color:C.accent,fontWeight:700,fontSize:13}}>{fmt(i.unitPrice*i.qty)}</span>
                    <button onClick={()=>setCart(cart.filter(x=>x.productId!==i.productId))} style={{background:C.redLo,border:'none',color:C.red,cursor:'pointer',borderRadius:6,width:22,height:22,fontSize:11}}>✕</button>
                  </div>
                ))}
                {cart.length===0&&<div style={{color:C.muted,fontSize:13,textAlign:'center',padding:12}}>Panier vide</div>}
                {cart.length>0&&<div style={{display:'flex',justifyContent:'space-between',marginTop:10,fontWeight:900,fontSize:17}}><span>Total</span><span style={{color:C.accent}}>{fmt(total)}</span></div>}
              </div>
              <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Note..." style={{width:'100%',background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:'8px 12px',color:C.text,fontSize:12,outline:'none',marginBottom:16}}/>
              <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                <button onClick={()=>setModal(false)} style={{background:C.card,color:C.sub,border:`1px solid ${C.border}`,borderRadius:10,padding:'9px 18px',cursor:'pointer',fontSize:13}}>Annuler</button>
                <button onClick={saveQuote} disabled={saving||!cart.length} style={{background:'linear-gradient(135deg,#00D4FF,#0085FF)',color:'#000',border:'none',borderRadius:10,padding:'9px 18px',cursor:'pointer',fontSize:13,fontWeight:800,opacity:saving||!cart.length?.5:1}}>{saving?'⏳...':'✓ Créer le devis'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SETTINGS — version corrigée (audit fixes #3 #4 #6 #7)
// ════════════════════════════════════════════════════════════════════════════
export function Settings() {
  const { theme: C } = useTheme();

  // ── state formulaire boutique ──────────────────────────────────────────────
  const [form, setForm] = useState({
    shop_name:    'VentePro',
    shop_address: '',
    shop_phone:   '',
    shop_tax:     '',
    footer_text:  'Merci de votre confiance !',
    ticket_width: '80mm',
    currency:     'DA',
    tax_rate:     '19',
  });

  // FIX AUDIT #3 : mots de passe maintenant lus ET écrits depuis db.settings
  const [adminPwd,   setAdminPwd]   = useState('');
  const [userPwd,    setUserPwd]    = useState('');
  const [showPwd,    setShowPwd]    = useState(false);

  // FIX AUDIT #4 : clé Groq maintenant configurable ici
  const [groqKey,    setGroqKey]    = useState('');
  const [groqSaved,  setGroqSaved]  = useState(false);
  const [showGroq,   setShowGroq]   = useState(false);

  const [saved,      setSaved]      = useState(false);
  const [exporting,  setExporting]  = useState(false);
  const [activeTab,  setActiveTab]  = useState('boutique');

  useEffect(() => {
    (async () => {
      const rows = await db.settings.toArray();
      const map  = {};
      rows.forEach(r => { map[r.key] = r.value; });
      setForm(f => ({ ...f, ...map }));
      // Lire mots de passe depuis la DB
      setAdminPwd(map.admin_password || '');
      setUserPwd(map.user_password   || '');
      // Lire la clé Groq depuis localStorage
      setGroqKey(localStorage.getItem('groq_key') || '');
    })();
  }, []);

  // ── Sauvegarder boutique + impression + mots de passe ─────────────────────
  async function save() {
    for (const [key, value] of Object.entries(form)) {
      await db.settings.put({ key, value });
    }
    // FIX AUDIT #3 : sauvegarder les mots de passe en DB
    await db.settings.put({ key: 'admin_password', value: adminPwd });
    await db.settings.put({ key: 'user_password',  value: userPwd  });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  // FIX AUDIT #4 : sauvegarder la clé Groq dans localStorage
  function saveGroqKey() {
    localStorage.setItem('groq_key', groqKey.trim());
    setGroqSaved(true);
    setTimeout(() => setGroqSaved(false), 2000);
  }

  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!window.confirm('Importer ? Ceci remplacera toutes vos données actuelles.')) return;
    try {
      await importBackup(file);
      alert('✅ Import réussi ! Rechargement...');
      window.location.reload();
    } catch (err) {
      alert('❌ Erreur import: ' + err.message);
    }
  }

  // ── Helpers UI ─────────────────────────────────────────────────────────────
  const inputStyle = {
    width:'100%', background:C.isLight?'#fff':C.bg,
    border:`1px solid ${C.border}`, borderRadius:10,
    padding:'9px 12px', color:C.text, fontSize:13, outline:'none',
    boxSizing:'border-box',
  };

  const labelStyle = {
    color:C.sub, fontSize:10, fontWeight:700, marginBottom:5,
    textTransform:'uppercase', letterSpacing:.6, display:'block',
  };

  const TABS = [
    { id:'boutique',   label:'🏪 Boutique'   },
    { id:'impression', label:'🖨️ Impression' },
    { id:'securite',   label:'🔐 Sécurité'  },
    { id:'ia',         label:'🤖 IA & Groq' },
    { id:'theme',      label:'🎨 Thème'      },
    { id:'donnees',    label:'💾 Données'    },
  ];

  return (
    <div>
      <PageHeader title="⚙️ Paramètres" sub="Configuration complète de VenteX AI"/>

      {/* Onglets */}
      <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{
            padding:'8px 16px', borderRadius:10, border:'none', cursor:'pointer',
            fontSize:12, fontWeight:activeTab===t.id?800:500,
            background: activeTab===t.id ? C.accent : C.isLight?'#F1F5F9':C.card,
            color: activeTab===t.id ? '#fff' : C.sub,
            transition:'all .15s',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:640 }}>

        {/* ── ONGLET BOUTIQUE ── */}
        {activeTab==='boutique' && (
          <Card>
            <div style={{fontWeight:800,fontSize:15,marginBottom:18,fontFamily:C.fontDisplay}}>🏪 Informations boutique</div>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={labelStyle}>Nom de la boutique</label>
                <input value={form.shop_name||''} onChange={e=>setForm(f=>({...f,shop_name:e.target.value}))} style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>Adresse</label>
                <input value={form.shop_address||''} onChange={e=>setForm(f=>({...f,shop_address:e.target.value}))} placeholder="12 Rue de la Paix, Alger" style={inputStyle}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <label style={labelStyle}>Téléphone</label>
                  <input value={form.shop_phone||''} onChange={e=>setForm(f=>({...f,shop_phone:e.target.value}))} placeholder="0550 12 34 56" style={inputStyle}/>
                </div>
                <div>
                  <label style={labelStyle}>NIF / RC</label>
                  <input value={form.shop_tax||''} onChange={e=>setForm(f=>({...f,shop_tax:e.target.value}))} placeholder="123456789" style={inputStyle}/>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <label style={labelStyle}>Devise</label>
                  <select value={form.currency||'DA'} onChange={e=>setForm(f=>({...f,currency:e.target.value}))} style={inputStyle}>
                    {['DA','€','$','£'].map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>TVA (%)</label>
                  <input type="number" value={form.tax_rate||'19'} onChange={e=>setForm(f=>({...f,tax_rate:e.target.value}))} style={inputStyle}/>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* ── ONGLET IMPRESSION ── */}
        {activeTab==='impression' && (
          <Card>
            <div style={{fontWeight:800,fontSize:15,marginBottom:18,fontFamily:C.fontDisplay}}>🖨️ Paramètres d'impression</div>
            <div style={{background:C.isLight?'#EFF6FF':C.blueLo,border:`1px solid ${C.blue}30`,borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:12,color:C.blue,fontWeight:600}}>
              ℹ️ Ces informations apparaissent sur tous vos tickets, factures et bons de livraison.
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={labelStyle}>Pied de page ticket</label>
                <input value={form.footer_text||''} onChange={e=>setForm(f=>({...f,footer_text:e.target.value}))} placeholder="Merci de votre confiance !" style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>Largeur ticket thermique</label>
                <select value={form.ticket_width||'80mm'} onChange={e=>setForm(f=>({...f,ticket_width:e.target.value}))} style={inputStyle}>
                  {['58mm','72mm','80mm'].map(w=><option key={w} value={w}>{w}</option>)}
                </select>
              </div>
            </div>
          </Card>
        )}

        {/* ── ONGLET SÉCURITÉ ── */}
        {activeTab==='securite' && (
          <Card>
            <div style={{fontWeight:800,fontSize:15,marginBottom:6,fontFamily:C.fontDisplay}}>🔐 Mots de passe</div>
            {/* FIX AUDIT #3 : avertissement que ça modifie vraiment le login */}
            <div style={{background:C.isLight?'#ECFDF5':C.greenLo,border:`1px solid ${C.green}30`,borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:12,color:C.green,fontWeight:600}}>
              ✅ Ces mots de passe sont maintenant reliés à la page de connexion. La modification prend effet immédiatement après sauvegarde.
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={labelStyle}>Mot de passe Admin (actuel: <code>admin00</code>)</label>
                <input type={showPwd?'text':'password'} value={adminPwd} onChange={e=>setAdminPwd(e.target.value)} placeholder="Nouveau mot de passe admin" style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>Mot de passe Vendeur (actuel: <code>0000</code>)</label>
                <input type={showPwd?'text':'password'} value={userPwd} onChange={e=>setUserPwd(e.target.value)} placeholder="Nouveau mot de passe vendeur" style={inputStyle}/>
              </div>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,color:C.sub}}>
                <input type="checkbox" checked={showPwd} onChange={e=>setShowPwd(e.target.checked)}/>
                Afficher les mots de passe
              </label>
            </div>
          </Card>
        )}

        {/* ── ONGLET IA & GROQ ── */}
        {activeTab==='ia' && (
          <Card>
            <div style={{fontWeight:800,fontSize:15,marginBottom:6,fontFamily:C.fontDisplay}}>🤖 Configuration IA — Groq</div>
            <div style={{background:C.isLight?'#EFF6FF':C.blueLo,border:`1px solid ${C.blue}30`,borderRadius:10,padding:'12px 14px',marginBottom:16,fontSize:13,color:C.blue,lineHeight:1.6}}>
              <strong>Pour activer les Agents IA :</strong><br/>
              1. Allez sur <a href="https://console.groq.com" target="_blank" rel="noreferrer" style={{color:C.blue}}>console.groq.com</a><br/>
              2. Créez un compte gratuit<br/>
              3. Générez une clé API<br/>
              4. Collez-la ci-dessous
            </div>
            <div style={{marginBottom:14}}>
              <label style={labelStyle}>Clé API Groq</label>
              <div style={{display:'flex',gap:8}}>
                <input
                  type={showGroq?'text':'password'}
                  value={groqKey}
                  onChange={e=>setGroqKey(e.target.value)}
                  placeholder="gsk_xxxxxxxxxxxxxxxxxxxx"
                  style={{...inputStyle,flex:1,fontFamily:'monospace',letterSpacing:showGroq?'normal':'2px'}}
                />
                <button onClick={()=>setShowGroq(!showGroq)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:'0 12px',cursor:'pointer',color:C.sub,fontSize:12,flexShrink:0}}>
                  {showGroq?'🙈':'👁️'}
                </button>
              </div>
            </div>
            {groqKey && (
              <div style={{marginBottom:14,padding:'8px 12px',background:C.greenLo,border:`1px solid ${C.green}30`,borderRadius:8,fontSize:12,color:C.green,fontWeight:600}}>
                ✅ Clé configurée — les Agents IA sont actifs
              </div>
            )}
            <button onClick={saveGroqKey} style={{
              width:'100%',background:groqSaved?C.green:`linear-gradient(135deg,#06B6D4,#3B82F6)`,
              color:'#fff',border:'none',borderRadius:10,padding:'11px',cursor:'pointer',fontSize:13,fontWeight:800,
            }}>
              {groqSaved?'✅ Clé sauvegardée !':'💾 Sauvegarder la clé Groq'}
            </button>
            <div style={{marginTop:10,fontSize:11,color:C.muted,textAlign:'center'}}>
              La clé est stockée localement sur cet appareil uniquement.
            </div>
          </Card>
        )}

        {/* ── ONGLET THÈME ── */}
        {/* FIX AUDIT #6 : ThemeSwitcher maintenant visible dans Settings */}
        {activeTab==='theme' && (
          <Card>
            <div style={{fontWeight:800,fontSize:15,marginBottom:18,fontFamily:C.fontDisplay}}>🎨 Thème & Apparence</div>
            <ThemeSwitcher />
          </Card>
        )}

        {/* ── ONGLET DONNÉES ── */}
        {activeTab==='donnees' && (
          <>
            <Card>
              <div style={{fontWeight:800,fontSize:15,marginBottom:16,fontFamily:C.fontDisplay}}>💾 Sauvegarde & Restauration</div>
              <div style={{color:C.sub,fontSize:13,marginBottom:16,lineHeight:1.7}}>
                Toutes vos données sont stockées localement sur cet appareil. Exportez régulièrement une sauvegarde JSON.
              </div>
              <div style={{display:'flex',gap:12}}>
                <button onClick={async()=>{setExporting(true);await exportBackup();setExporting(false);}}
                  style={{flex:1,background:'linear-gradient(135deg,#00D4FF,#0085FF)',color:'#000',border:'none',borderRadius:10,padding:'10px',cursor:'pointer',fontSize:13,fontWeight:800}}>
                  {exporting?'⏳ Export...':'📤 Exporter backup JSON'}
                </button>
                <label style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:C.violetLo,color:C.violet,border:`1px solid ${C.violet}35`,borderRadius:10,padding:'10px',cursor:'pointer',fontSize:13,fontWeight:700,gap:6}}>
                  📥 Importer backup
                  <input type="file" accept=".json" onChange={handleImport} style={{display:'none'}}/>
                </label>
              </div>
            </Card>

            <Card>
              <div style={{fontWeight:800,fontSize:15,marginBottom:12,fontFamily:C.fontDisplay}}>ℹ️ À propos</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
                {[['Version','VentePro v3.0'],['Stockage','IndexedDB (local)'],['Mode','100% Offline'],['Agents IA','6 spécialisés']].map(([k,v])=>(
                  <div key={k} style={{background:C.bg,borderRadius:8,padding:'10px 12px'}}>
                    <div style={{color:C.muted,fontSize:10,textTransform:'uppercase',letterSpacing:.6,marginBottom:3}}>{k}</div>
                    <div style={{fontSize:13,fontWeight:700,color:C.accent}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{color:C.muted,fontSize:11,textAlign:'center'}}>VentePro v3.0 — Fait pour l'Algérie 🇩🇿</div>
            </Card>
          </>
        )}

        {/* Bouton sauvegarder (visible sur tous les onglets sauf thème et données) */}
        {!['theme','donnees'].includes(activeTab) && (
          <button onClick={save} style={{
            width:'100%', background:saved?'#10B981':'linear-gradient(135deg,#00D4FF,#0085FF)',
            color: saved?'#fff':'#000', border:'none', borderRadius:10,
            padding:'13px', cursor:'pointer', fontSize:15, fontWeight:900,
            transition:'background .3s',
          }}>
            {saved ? '✅ Paramètres sauvegardés !' : '💾 Sauvegarder les paramètres'}
          </button>
        )}
      </div>
    </div>
  );
}