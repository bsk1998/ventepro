import { ThemeSwitcher } from '../ThemeContext';
import { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { Card, Btn, Badge, Loader, PageHeader, TableWrap, TR, TD, MiniChart, fmt } from '../components/ui';
import { db, getDashboardStats, exportBackup, importBackup, nowISO, invalidateCache, saveAutoBackupSnapshot } from '../db';
import { printQuote as printQuoteDoc, PrintSettingsPanel } from '../components/Ticket';
import { serializePassword } from '../security';

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

    const productByName = new Map(products.map(p => [p.name, p]));
    const periodSaleIds = new Set(periodSales.map(s => s.id));
    const periodItems = items.filter(i => periodSaleIds.has(i.saleId));
    const categoryMargin = {};
    periodItems.forEach(i => {
      const p = productByName.get(i.productName) || {};
      const cat = p.category || 'Divers';
      if (!categoryMargin[cat]) categoryMargin[cat] = { ca:0, cost:0, profit:0, qty:0 };
      const qty = Number(i.qty || 0);
      const caLine = Number(i.unitPrice || 0) * qty;
      const costLine = Number(p.buyPrice || i.buyPrice || 0) * qty;
      categoryMargin[cat].ca += caLine;
      categoryMargin[cat].cost += costLine;
      categoryMargin[cat].profit += caLine - costLine;
      categoryMargin[cat].qty += qty;
    });
    const soldNames = new Set(periodItems.map(i => i.productName));
    const dormantProducts = products.filter(p => !soldNames.has(p.name)).slice(0, 8);
    const lowMargin = products
      .filter(p => Number(p.buyPrice || 0) > 0)
      .map(p => ({ name:p.name, margin:((Number(p.sellPrice||0)-Number(p.buyPrice||0))/Number(p.buyPrice||1))*100 }))
      .sort((a,b)=>a.margin-b.margin).slice(0,8);

    const ca    = periodSales.reduce((s,v) => s+Number(v.total||0), 0);
    const exp   = periodExp.reduce((s,e)   => s+Number(e.amount||0), 0);
    const stats = await getDashboardStats();

    setData({ ca, exp, benefice:ca-exp, count:periodSales.length,
      credit:periodSales.filter(s=>s.status==='crédit').length,
      topProds, topClients, empCA, chart:stats.chart,
      advanced:{ categoryMargin:Object.entries(categoryMargin).sort((a,b)=>b[1].profit-a[1].profit), dormantProducts, lowMargin,
        sellerRanking:Object.entries(empCA).sort((a,b)=>b[1]-a[1]) } });
    setLoading(false);
  }

  if (loading) return <Loader/>;

  const periodLabel = { today:"Aujourd'hui", week:'7 derniers jours', month:'Ce mois', year:'Cette année', all:'Tout' };

  return (
    <div>
      <PageHeader title="Rapports & Analyses" sub="Vue d'ensemble de votre activité">
        <select value={period} onChange={e=>setPeriod(e.target.value)}
          style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'9px 14px',color:C.text,fontSize:16,outline:'none'}}>
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
            ? <div style={{color:C.sub,fontSize:16,textAlign:'center',padding:16}}>Aucune vente</div>
            : data.topProds.map(([name,qty],i)=>(
              <div key={name} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:'flex',gap:10,alignItems:'center'}}>
                  <span style={{color:C.muted,fontSize:13,minWidth:16}}>#{i+1}</span>
                  <span style={{fontSize:16,fontWeight:600}}>{name}</span>
                </div>
                <span style={{color:C.accent,fontWeight:700}}>{qty} vendus</span>
              </div>
            ))}
        </Card>
        <Card>
          <div style={{fontWeight:700,fontSize:14,marginBottom:14,fontFamily:C.fontDisplay}}>👥 Top clients</div>
          {data.topClients.length===0
            ? <div style={{color:C.sub,fontSize:16,textAlign:'center',padding:16}}>Aucun client</div>
            : data.topClients.map(([name,ca],i)=>(
              <div key={name} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:'flex',gap:10,alignItems:'center'}}>
                  <span style={{color:C.muted,fontSize:13,minWidth:16}}>#{i+1}</span>
                  <span style={{fontSize:16,fontWeight:600}}>{name}</span>
                </div>
                <span style={{color:C.green,fontWeight:700}}>{fmt(ca)}</span>
              </div>
            ))}
        </Card>
      </div>

      <Card>
        <div style={{fontWeight:800,fontSize:16,marginBottom:14,fontFamily:C.fontDisplay}}>Rapport avance</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
          <div>
            <div style={{fontSize:13,fontWeight:900,color:C.accent,marginBottom:8}}>Marge par categorie</div>
            {(data.advanced.categoryMargin||[]).slice(0,5).map(([cat,row])=>(
              <div key={cat} style={{fontSize:14,display:'flex',justifyContent:'space-between',borderBottom:`1px solid ${C.border}`,padding:'5px 0'}}><span>{cat}</span><b style={{color:row.profit>=0?C.green:C.red}}>{fmt(row.profit)}</b></div>
            ))}
          </div>
          <div>
            <div style={{fontSize:13,fontWeight:900,color:C.blue,marginBottom:8}}>Vendeurs</div>
            {(data.advanced.sellerRanking||[]).slice(0,5).map(([name,total],i)=>(
              <div key={name} style={{fontSize:14,display:'flex',justifyContent:'space-between',borderBottom:`1px solid ${C.border}`,padding:'5px 0'}}><span>#{i+1} {name}</span><b>{fmt(total)}</b></div>
            ))}
          </div>
          <div>
            <div style={{fontSize:13,fontWeight:900,color:C.red,marginBottom:8}}>Faible marge</div>
            {(data.advanced.lowMargin||[]).slice(0,5).map(p=>(
              <div key={p.name} style={{fontSize:14,display:'flex',justifyContent:'space-between',borderBottom:`1px solid ${C.border}`,padding:'5px 0'}}><span>{p.name}</span><b style={{color:p.margin<10?C.red:C.amber}}>{p.margin.toFixed(1)}%</b></div>
            ))}
          </div>
          <div>
            <div style={{fontSize:13,fontWeight:900,color:C.amber,marginBottom:8}}>Stock dormant periode</div>
            {(data.advanced.dormantProducts||[]).slice(0,5).map(p=>(
              <div key={p.id} style={{fontSize:14,display:'flex',justifyContent:'space-between',borderBottom:`1px solid ${C.border}`,padding:'5px 0'}}><span>{p.name}</span><b>{p.stock||0}</b></div>
            ))}
          </div>
        </div>
      </Card>
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
    const missing = [];
    for(const i of items){
      const p=await db.products.get(i.productId);
      if(!p || Number(p.stock||0)<Number(i.qty||0)) missing.push(`${i.productName} (${p?.stock||0}/${i.qty})`);
    }
    if(missing.length){
      alert(`Stock insuffisant pour convertir ce devis:\n- ${missing.join('\n- ')}`);
      return;
    }
    const saleId=await db.sales.add({
      clientName:quote.clientName,clientId:quote.clientId,
      total:quote.total,paid:quote.total,status:'payé',
      note:`Devis ${quote.number}`,createdAt:nowISO()
    });
    await db.saleItems.bulkAdd(items.map(i=>({...i,saleId})));
    for(const i of items){
      const p=await db.products.get(i.productId);
      if(p) await db.products.update(i.productId,{stock:Number(p.stock||0)-Number(i.qty||0)});
    }
    await db.quotes.update(quote.id,{status:'converti'});
    invalidateCache();
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
            <TD style={{fontFamily:C.fontMono,fontSize:14,color:C.accent}}>{q.number}</TD>
            <TD style={{fontWeight:600}}>{q.clientName}</TD>
            <TD style={{fontWeight:700,color:C.accent}}>{fmt(q.total)}</TD>
            <TD><Badge color={q.status==='converti'?'green':q.status==='refusé'?'red':'amber'} small>{q.status}</Badge></TD>
            <TD style={{color:C.sub,fontSize:13}}>{new Date(q.createdAt).toLocaleDateString('fr-DZ')}</TD>
            <TD>
              <div style={{display:'flex',gap:5}}>
                <button onClick={()=>printQuote(q)} style={{background:C.accentLo,border:'none',borderRadius:7,padding:'4px 9px',color:C.accent,cursor:'pointer',fontSize:13}}>🖨 Imprimer</button>
                {q.status==='en attente'&&<button onClick={()=>convertToSale(q)} style={{background:C.greenLo,border:'none',borderRadius:7,padding:'4px 9px',color:C.green,cursor:'pointer',fontSize:13,fontWeight:700}}>✓ Convertir</button>}
                <button onClick={async()=>{if(window.confirm('Supprimer ?')){await db.quotes.delete(q.id);await load();}}} style={{background:C.redLo,border:'none',borderRadius:7,padding:'4px 9px',color:C.red,cursor:'pointer',fontSize:13}}>🗑</button>
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
                  <select value={clientId} onChange={e=>setClientId(e.target.value)} style={{width:'100%',background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:'9px 12px',color:C.text,fontSize:16,outline:'none'}}>
                    <option value="">Sélectionner...</option>
                    {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{color:C.sub,fontSize:10,fontWeight:700,marginBottom:5,textTransform:'uppercase',letterSpacing:.6}}>Ou nom libre</div>
                  <input value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="Client externe..." style={{width:'100%',background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:'9px 12px',color:C.text,fontSize:16,outline:'none'}}/>
                </div>
              </div>
              <div style={{marginBottom:14,position:'relative'}}>
                <div style={{color:C.sub,fontSize:10,fontWeight:700,marginBottom:5,textTransform:'uppercase',letterSpacing:.6}}>Ajouter produit</div>
                <div style={{display:'flex',gap:8}}>
                  <div style={{position:'relative',flex:1}}>
                    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Rechercher..." style={{width:'100%',background:C.bg,border:`1px solid ${C.accent}50`,borderRadius:10,padding:'9px 12px',color:C.text,fontSize:16,outline:'none'}}/>
                    {filteredProds.length>0&&(
                      <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:10,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,boxShadow:C.shadow,marginTop:4}}>
                        {filteredProds.map(p=>(
                          <div key={p.id} onClick={()=>addToCart(p)} style={{padding:'10px 14px',cursor:'pointer',display:'flex',justifyContent:'space-between',borderBottom:`1px solid ${C.border}`}} onMouseEnter={e=>e.currentTarget.style.background=C.accentLo} onMouseLeave={e=>e.currentTarget.style.background='none'}>
                            <span style={{fontSize:16,fontWeight:600}}>{p.name}</span>
                            <span style={{color:C.accent,fontWeight:700}}>{fmt(p.sellPrice)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="number" value={qty} min={1} onChange={e=>setQty(Number(e.target.value))} style={{width:60,background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:'9px 8px',color:C.text,fontSize:16,outline:'none',textAlign:'center'}}/>
                </div>
              </div>
              <div style={{background:C.bg,borderRadius:12,padding:14,marginBottom:14}}>
                {cart.map(i=>(
                  <div key={i.productId} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 0',borderBottom:`1px solid ${C.border}`}}>
                    <span style={{flex:1,fontSize:16}}>{i.productName}</span>
                    <span style={{color:C.sub,fontSize:14}}>×{i.qty}</span>
                    <span style={{color:C.accent,fontWeight:700,fontSize:16}}>{fmt(i.unitPrice*i.qty)}</span>
                    <button onClick={()=>setCart(cart.filter(x=>x.productId!==i.productId))} style={{background:C.redLo,border:'none',color:C.red,cursor:'pointer',borderRadius:6,width:22,height:22,fontSize:13}}>✕</button>
                  </div>
                ))}
                {cart.length===0&&<div style={{color:C.muted,fontSize:16,textAlign:'center',padding:12}}>Panier vide</div>}
                {cart.length>0&&<div style={{display:'flex',justifyContent:'space-between',marginTop:10,fontWeight:900,fontSize:17}}><span>Total</span><span style={{color:C.accent}}>{fmt(total)}</span></div>}
              </div>
              <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Note..." style={{width:'100%',background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:'8px 12px',color:C.text,fontSize:14,outline:'none',marginBottom:16}}/>
              <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                <button onClick={()=>setModal(false)} style={{background:C.card,color:C.sub,border:`1px solid ${C.border}`,borderRadius:10,padding:'9px 18px',cursor:'pointer',fontSize:16}}>Annuler</button>
                <button onClick={saveQuote} disabled={saving||!cart.length} style={{background:'linear-gradient(135deg,#00D4FF,#0085FF)',color:'#000',border:'none',borderRadius:10,padding:'9px 18px',cursor:'pointer',fontSize:16,fontWeight:800,opacity:saving||!cart.length?.5:1}}>{saving?'⏳...':'✓ Créer le devis'}</button>
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
export function Settings({ onLogout }) {
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
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(() => localStorage.getItem('vp_auto_backup_enabled') !== 'false');
  const [autoBackupAt, setAutoBackupAt] = useState(() => localStorage.getItem('vp_auto_backup_at') || '');
  const [activeTab,  setActiveTab]  = useState('boutique');

  function confirmLogout() {
    if (!onLogout) return;
    if (window.confirm('Confirmer la deconnexion ? Vous allez revenir a l ecran de connexion.')) onLogout();
  }

  useEffect(() => {
    (async () => {
      const rows = await db.settings.toArray();
      const map  = {};
      rows.forEach(r => { map[r.key] = r.value; });
      setForm(f => ({ ...f, ...map }));
      // Ne jamais réafficher les mots de passe stockés, même hashés.
      setAdminPwd('');
      setUserPwd('');
      // Lire la clé Groq depuis localStorage
      setGroqKey(localStorage.getItem('groq_key') || '');
      setAutoBackupAt(localStorage.getItem('vp_auto_backup_at') || '');
    })();
  }, []);

  // ── Sauvegarder boutique + impression + mots de passe ─────────────────────
  async function save() {
    for (const [key, value] of Object.entries(form)) {
      await db.settings.put({ key, value });
    }
    if (adminPwd.trim()) {
      await db.settings.put({ key: 'admin_password', value: await serializePassword(adminPwd.trim()) });
    }
    if (userPwd.trim()) {
      await db.settings.put({ key: 'user_password', value: await serializePassword(userPwd.trim()) });
    }
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
    padding:'12px 14px', color:C.text, fontSize:16, outline:'none',
    boxSizing:'border-box',
  };

  const labelStyle = {
    color:C.sub, fontSize:14, fontWeight:900, marginBottom:5,
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
            fontSize:14, fontWeight:activeTab===t.id?800:500,
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
            <div style={{fontWeight:800,fontSize:16,marginBottom:18,fontFamily:C.fontDisplay}}>🏪 Informations boutique</div>
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
            <div style={{fontWeight:800,fontSize:16,marginBottom:18,fontFamily:C.fontDisplay}}>🖨️ Paramètres d'impression</div>
            <div style={{background:C.isLight?'#EFF6FF':C.blueLo,border:`1px solid ${C.blue}30`,borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:14,color:C.blue,fontWeight:600}}>
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
            <div style={{fontWeight:800,fontSize:16,marginBottom:6,fontFamily:C.fontDisplay}}>🔐 Mots de passe</div>
            {/* FIX AUDIT #3 : avertissement que ça modifie vraiment le login */}
            <div style={{background:C.isLight?'#ECFDF5':C.greenLo,border:`1px solid ${C.green}30`,borderRadius:10,padding:'10px 14px',marginBottom:16,fontSize:14,color:C.green,fontWeight:600}}>
              ✅ Ces mots de passe sont maintenant reliés à la page de connexion. La modification prend effet immédiatement après sauvegarde.
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div>
                <label style={labelStyle}>Mot de passe Admin</label>
                <input type={showPwd?'text':'password'} value={adminPwd} onChange={e=>setAdminPwd(e.target.value)} placeholder="Nouveau mot de passe admin" style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>Mot de passe Vendeur</label>
                <input type={showPwd?'text':'password'} value={userPwd} onChange={e=>setUserPwd(e.target.value)} placeholder="Nouveau mot de passe vendeur" style={inputStyle}/>
              </div>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:16,color:C.sub}}>
                <input type="checkbox" checked={showPwd} onChange={e=>setShowPwd(e.target.checked)}/>
                Afficher les mots de passe
              </label>
              <div style={{marginTop:8,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
                <button onClick={confirmLogout} style={{width:'100%',background:C.redLo,color:C.red,border:`1.5px solid ${C.red}45`,borderRadius:10,padding:'13px 16px',fontSize:16,fontWeight:900,cursor:'pointer'}}>
                  Deconnexion
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* ── ONGLET IA & GROQ ── */}
        {activeTab==='ia' && (
          <Card>
            <div style={{fontWeight:800,fontSize:16,marginBottom:6,fontFamily:C.fontDisplay}}>🤖 Configuration IA — Groq</div>
            <div style={{background:C.isLight?'#EFF6FF':C.blueLo,border:`1px solid ${C.blue}30`,borderRadius:10,padding:'12px 14px',marginBottom:16,fontSize:16,color:C.blue,lineHeight:1.6}}>
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
                <button onClick={()=>setShowGroq(!showGroq)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:'0 12px',cursor:'pointer',color:C.sub,fontSize:14,flexShrink:0}}>
                  {showGroq?'🙈':'👁️'}
                </button>
              </div>
            </div>
            {groqKey && (
              <div style={{marginBottom:14,padding:'8px 12px',background:C.greenLo,border:`1px solid ${C.green}30`,borderRadius:8,fontSize:14,color:C.green,fontWeight:600}}>
                ✅ Clé configurée — les Agents IA sont actifs
              </div>
            )}
            <button onClick={saveGroqKey} style={{
              width:'100%',background:groqSaved?C.green:`linear-gradient(135deg,#06B6D4,#3B82F6)`,
              color:'#fff',border:'none',borderRadius:10,padding:'11px',cursor:'pointer',fontSize:16,fontWeight:800,
            }}>
              {groqSaved?'✅ Clé sauvegardée !':'💾 Sauvegarder la clé Groq'}
            </button>
            <div style={{marginTop:10,fontSize:13,color:C.muted,textAlign:'center'}}>
              La clé est stockée localement sur cet appareil uniquement.
            </div>
          </Card>
        )}

        {/* ── ONGLET THÈME ── */}
        {/* FIX AUDIT #6 : ThemeSwitcher maintenant visible dans Settings */}
        {activeTab==='theme' && (
          <Card>
            <div style={{fontWeight:800,fontSize:16,marginBottom:18,fontFamily:C.fontDisplay}}>🎨 Thème & Apparence</div>
            <ThemeSwitcher />
          </Card>
        )}

        {/* ── ONGLET DONNÉES ── */}
        {activeTab==='donnees' && (
          <>
            <Card>
              <div style={{fontWeight:800,fontSize:16,marginBottom:16,fontFamily:C.fontDisplay}}>💾 Sauvegarde & Restauration</div>
              <div style={{color:C.sub,fontSize:16,marginBottom:16,lineHeight:1.7}}>
                Toutes vos données sont stockées localement sur cet appareil. Exportez régulièrement une sauvegarde JSON.
              </div>
              <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:12,marginBottom:14}}>
                <label style={{display:'flex',alignItems:'center',gap:10,fontSize:16,fontWeight:800,color:C.text}}>
                  <input type="checkbox" checked={autoBackupEnabled} onChange={e=>{setAutoBackupEnabled(e.target.checked);localStorage.setItem('vp_auto_backup_enabled',e.target.checked?'true':'false');}}/>
                  Sauvegarde automatique locale
                </label>
                <div style={{color:C.sub,fontSize:14,marginTop:6}}>Derniere sauvegarde: {autoBackupAt?new Date(autoBackupAt).toLocaleString('fr-DZ'):'aucune'}</div>
                <button onClick={async()=>{await saveAutoBackupSnapshot(true);setAutoBackupAt(localStorage.getItem('vp_auto_backup_at')||'');alert('Sauvegarde automatique creee.');}} style={{marginTop:10,background:C.greenLo,color:C.green,border:`1px solid ${C.green}35`,borderRadius:8,padding:'8px 12px',fontWeight:800,cursor:'pointer'}}>Creer sauvegarde auto maintenant</button>
              </div>
              <div style={{display:'flex',gap:12}}>
                <button onClick={async()=>{setExporting(true);await exportBackup();setExporting(false);}}
                  style={{flex:1,background:'linear-gradient(135deg,#00D4FF,#0085FF)',color:'#000',border:'none',borderRadius:10,padding:'10px',cursor:'pointer',fontSize:16,fontWeight:800}}>
                  {exporting?'⏳ Export...':'📤 Exporter backup JSON'}
                </button>
                <label style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:C.violetLo,color:C.violet,border:`1px solid ${C.violet}35`,borderRadius:10,padding:'10px',cursor:'pointer',fontSize:16,fontWeight:700,gap:6}}>
                  📥 Importer backup
                  <input type="file" accept=".json,.gz,.json.gz" onChange={handleImport} style={{display:'none'}}/>
                </label>
              </div>
            </Card>

            <Card>
              <div style={{fontWeight:800,fontSize:16,marginBottom:12,fontFamily:C.fontDisplay}}>ℹ️ À propos</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
                {[['Version','VentePro v3.0'],['Stockage','IndexedDB (local)'],['Mode','Données locales'],['Agents IA','Optionnels via Groq']].map(([k,v])=>(
                  <div key={k} style={{background:C.bg,borderRadius:8,padding:'10px 12px'}}>
                    <div style={{color:C.muted,fontSize:10,textTransform:'uppercase',letterSpacing:.6,marginBottom:3}}>{k}</div>
                    <div style={{fontSize:16,fontWeight:700,color:C.accent}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{color:C.muted,fontSize:13,textAlign:'center'}}>VentePro v3.0 — Fait pour l'Algérie 🇩🇿</div>
            </Card>
          </>
        )}

        {/* Bouton sauvegarder (visible sur tous les onglets sauf thème et données) */}
        {!['theme','donnees'].includes(activeTab) && (
          <button onClick={save} style={{
            width:'100%', background:saved?'#10B981':'linear-gradient(135deg,#00D4FF,#0085FF)',
            color: saved?'#fff':'#000', border:'none', borderRadius:10,
            padding:'13px', cursor:'pointer', fontSize:16, fontWeight:900,
            transition:'background .3s',
          }}>
            {saved ? '✅ Paramètres sauvegardés !' : '💾 Sauvegarder les paramètres'}
          </button>
        )}
      </div>
    </div>
  );
}
