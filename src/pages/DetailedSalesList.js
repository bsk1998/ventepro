import { useState, useEffect, useMemo, useRef } from 'react';
import { db, fmt, nowISO } from '../db';
import { printTicket, printInvoice, printDelivery } from '../components/Ticket';

// ─── Palette POS sombre ───────────────────────────────────────────────────────
const P = {
  bg:      '#0A0F1A',
  hdr:     '#0D1526',
  surface: '#111827',
  card:    '#1A2232',
  hover:   '#1E2D42',
  sel:     '#1B3A5C',
  selBd:   '#2F81F7',
  border:  '#1E293B',
  bdrLt:   '#1A2535',
  txt:     '#E2E8F0',
  sub:     '#7A8FA6',
  muted:   '#3D5068',

  blue:   '#2F81F7',
  blueDk: '#1B4FD8',
  blueHd: '#1E3A5F',
  green:  '#22C55E',
  amber:  '#F59E0B',
  red:    '#EF4444',
  redDk:  '#991B1B',
  cyan:   '#22D3EE',
  orange: '#FB923C',
  yellow: '#FCD34D',
  white:  '#F1F5F9',
};

// ─── Horloge ──────────────────────────────────────────────────────────────────
function Clock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return (
    <div style={{ textAlign:'center', lineHeight:1.2 }}>
      <div style={{ fontSize:11, color:P.sub, letterSpacing:.5 }}>
        {t.toLocaleDateString('fr-DZ',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'})}
        &nbsp;{t.toLocaleTimeString('fr-DZ')}
      </div>
    </div>
  );
}

// ─── Bouton action ─────────────────────────────────────────────────────────────
function Btn({ icon, label, color, bg, onClick, disabled, wide }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', gap:3,
        padding: wide ? '7px 16px' : '6px 10px',
        background: disabled ? P.card : hov ? color : bg || color+'25',
        border:`1px solid ${disabled ? P.border : hov ? color : color+'50'}`,
        borderRadius:6, cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? P.muted : '#fff',
        fontSize:10, fontWeight:800, lineHeight:1.25,
        opacity: disabled ? .4 : 1,
        minWidth: wide ? 90 : 68, minHeight:48,
        transition:'all .12s',
        boxShadow: hov && !disabled ? `0 3px 10px ${color}45` : 'none',
        whiteSpace:'pre-line', textAlign:'center', flexShrink:0,
      }}>
      <span style={{ fontSize:18 }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ─── Modal Versement ───────────────────────────────────────────────────────────
function PayModal({ sale, onClose, onDone }) {
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const reste = Number(sale.total) - Number(sale.paid);
  async function save() {
    if (!amount || Number(amount) <= 0) return;
    setSaving(true);
    const np = Number(sale.paid) + Number(amount);
    await db.sales.update(sale.id, { paid:np, status: np >= Number(sale.total) ? 'payé' : 'crédit' });
    try { await db.payments.add({ saleId:sale.id, clientId:sale.clientId, amount:Number(amount), note:'Versement', createdAt:nowISO() }); } catch(_) {}
    onDone(); onClose(); setSaving(false);
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:10000,
      display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:P.card, border:`1px solid ${P.amber}40`, borderRadius:10,
        width:340, overflow:'hidden', boxShadow:'0 30px 80px rgba(0,0,0,.7)' }}>
        <div style={{ background:'#92400E', padding:'10px 16px', display:'flex',
          justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontWeight:900, fontSize:14, color:'#fff' }}>💳 Versement — {sale.clientName}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,.7)', fontSize:20, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ padding:16 }}>
          <div style={{ background:P.surface, border:`1px solid ${P.border}`, borderRadius:7,
            padding:'10px 12px', marginBottom:14 }}>
            {[['Total',fmt(sale.total),P.txt],['Payé',fmt(sale.paid),P.green],['Reste',fmt(reste),P.amber]].map(([l,v,c])=>(
              <div key={l} style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:13 }}>
                <span style={{ color:P.sub }}>{l}</span><span style={{ fontWeight:700, color:c }}>{v}</span>
              </div>
            ))}
          </div>
          <label style={{ fontSize:10, fontWeight:700, color:P.sub, display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:.6 }}>Montant versé (DA)</label>
          <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} autoFocus
            onKeyDown={e=>e.key==='Enter'&&save()}
            style={{ width:'100%', background:P.bg, border:`2px solid ${P.amber}`, borderRadius:7,
              padding:'10px', color:P.yellow, fontSize:20, fontWeight:900, outline:'none',
              boxSizing:'border-box', textAlign:'center', marginBottom:8 }}/>
          {amount&&Number(amount)>0&&(
            <div style={{ fontSize:11, color:Number(amount)>=reste?P.green:P.amber, fontWeight:700,
              textAlign:'center', marginBottom:10 }}>
              {Number(amount)>=reste?'✅ Solde soldé':'Reste: '+fmt(reste-Number(amount))}
            </div>
          )}
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onClose} style={{ flex:1, background:P.hover, border:`1px solid ${P.border}`,
              borderRadius:7, padding:'9px', cursor:'pointer', fontSize:12, color:P.sub }}>Annuler</button>
            <button onClick={save} disabled={saving||!amount}
              style={{ flex:2, background:'#16A34A', border:'none', borderRadius:7, padding:'9px',
                color:'#fff', fontWeight:800, cursor:'pointer', fontSize:14 }}>
              {saving?'⏳...':'✓ Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════════
export default function DetailedSalesList({ onClose, currentClient, currentTotal }) {
  const [sales,      setSales]      = useState([]);
  const [products,   setProducts]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [search,      setSearch]     = useState('');
  const [filter,      setFilter]     = useState('jour');

  const [prodSearch, setProdSearch] = useState('');
  const [barcode,    setBarcode]    = useState('');
  const [qty,        setQty]        = useState(1);

  const [payModal,   setPayModal]   = useState(null);
  const [confirm,    setConfirm]    = useState(null);

  const prodRef = useRef();
  const barcodeRef = useRef();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [v, p] = await Promise.all([
      db.sales.orderBy('createdAt').reverse().limit(300).toArray(),
      db.products.toArray(),
    ]);
    const enriched = await Promise.all(v.map(async s => {
      const items = await db.saleItems.where('saleId').equals(s.id).toArray();
      return { ...s, items };
    }));
    setSales(enriched);
    setProducts(p);
    const today = new Date().toISOString().slice(0,10);
    const first = enriched.find(s => s.createdAt?.startsWith(today));
    if (first) setSelectedId(first.id);
    else if (enriched.length > 0) setSelectedId(enriched[0].id);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0,10);
    let list = [...sales];
    if (search) list = list.filter(s =>
      s.clientName?.toLowerCase().includes(search.toLowerCase()) || String(s.id).includes(search)
    );
    if (filter==='jour')   list = list.filter(s => s.createdAt?.startsWith(today));
    if (filter==='payé')   list = list.filter(s => s.status==='payé');
    if (filter==='crédit') list = list.filter(s => s.status==='crédit');
    return list;
  }, [sales, search, filter]);

  const selected     = sales.find(s => s.id === selectedId);
  const selItems     = selected?.items || [];

  const foundProd = useMemo(() => {
    if (!prodSearch && !barcode) return null;
    const q = (prodSearch||barcode).toLowerCase();
    return products.find(p =>
      p.name?.toLowerCase().includes(q) ||
      p.barcode?.includes(q) ||
      p.ref?.toLowerCase().includes(q)
    ) || null;
  }, [prodSearch, barcode, products]);

  const stats = useMemo(() => {
    const list = filtered;
    const totalVentes = list.reduce((s,v) => s+Number(v.total||0), 0);
    const totalAchats = list.reduce((s,v) =>
      s+(v.items||[]).reduce((a,i)=>a+(i.buyPrice||0)*i.qty, 0), 0);
    const remise = list.reduce((s,v) => s+Number(v.discount||0), 0);
    return { totalVentes, totalAchats, remise, benefice:totalVentes-totalAchats, count:list.length };
  }, [filtered]);

  async function deleteSale() {
    if (!selected) return;
    await db.saleItems.where('saleId').equals(selected.id).delete();
    await db.sales.delete(selected.id);
    setSelectedId(null); setConfirm(null); await load();
  }

  async function deleteLastItem() {
    if (!selItems.length) return;
    await db.saleItems.delete(selItems[selItems.length-1].id);
    setConfirm(null); await load();
  }

  function fD(iso) { try { return new Date(iso).toLocaleDateString('fr-DZ',{day:'2-digit',month:'2-digit',year:'2-digit'}); } catch { return ''; } }
  function fT(iso) { try { return new Date(iso).toLocaleTimeString('fr-DZ',{hour:'2-digit',minute:'2-digit',second:'2-digit'}); } catch { return ''; } }

  const TH = (extra={}) => ({
    padding:'6px 9px', fontSize:10, fontWeight:800, color:'#CBD5E1',
    background:P.blueHd, textTransform:'uppercase', letterSpacing:.6,
    textAlign:'left', whiteSpace:'nowrap',
    borderRight:`1px solid rgba(255,255,255,.07)`,
    position:'sticky', top:0, zIndex:2,
    ...extra,
  });
  const TD = (alt=false, extra={}) => ({
    padding:'4px 9px', fontSize:12, color:P.txt,
    background: alt ? '#111827' : 'transparent',
    borderBottom:`1px solid ${P.bdrLt}`,
    borderRight:`1px solid ${P.bdrLt}`,
    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
    ...extra,
  });

  const inpStyle = {
    background:'#0A0F1A', border:`1px solid ${P.border}`, borderRadius:4,
    padding:'4px 8px', color:P.txt, fontSize:12, outline:'none',
    fontFamily:'inherit',
  };

  if (loading) return (
    <div style={{ position:'fixed', inset:0, background:P.bg, zIndex:9999,
      display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, color:P.sub }}>
      <div style={{ fontSize:36 }}>⏳</div>
      <div>Chargement...</div>
    </div>
  );

  return (
    <div style={{
      position:'fixed', // <--- CORRECTION PLEIN ÉCRAN
      inset:0,          // <--- PREND TOUTE LA PLACE
      zIndex:9000,      // <--- PASSE DEVANT TOUT LE RESTE
      display:'flex', 
      flexDirection:'column',
      background:P.bg, 
      color:P.txt,
      fontFamily:"'Segoe UI',Consolas,system-ui",
      fontSize:12, 
      overflow:'hidden',
    }}>

      {/* HEADER */}
      <div style={{ background:P.hdr, borderBottom:`2px solid ${P.blueDk}`,
        padding:'7px 14px', flexShrink:0 }}>
        <div style={{ display:'grid', gridTemplateColumns:'280px 1fr auto', gap:14, alignItems:'center' }}>

          {/* GAUCHE — Client + Total */}
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <div style={{ background:P.blueDk, borderRadius:5, padding:'3px 10px',
                fontSize:11, fontWeight:800, color:'#fff' }}>CLIENT</div>
              <div style={{ fontWeight:900, fontSize:14, color:P.cyan }}>
                {currentClient?.name || 'C1  COMPTOIR'}
              </div>
            </div>
            <Clock/>
            <div style={{ marginTop:6 }}>
              <div style={{ fontSize:9, color:P.sub, textTransform:'uppercase', letterSpacing:.8 }}>Total vente en cours</div>
              <div style={{ fontSize:34, fontWeight:900, color:P.orange, fontFamily:'monospace', lineHeight:1 }}>
                {fmt(currentTotal || 0).replace(' DA','')}
                <span style={{ fontSize:14, color:P.sub, marginLeft:4 }}>DA</span>
              </div>
            </div>
          </div>

          {/* CENTRE — Totaux jour */}
          <div style={{ background:P.card, border:`1px solid ${P.border}`, borderRadius:8, padding:'10px 14px' }}>
            <div style={{ fontSize:9, color:P.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:.8, marginBottom:8 }}>
              Récapitulatif · {filter==='jour'?"Aujourd'hui":filter}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
              {[
                {l:'Ventes',   v:stats.count,               c:P.cyan},
                {l:'CA Total', v:fmt(stats.totalVentes),   c:P.blue},
                {l:'Crédits',  v:filtered.filter(s=>s.status==='crédit').length, c:P.amber},
                {l:'Bénéfice', v:fmt(stats.benefice),      c:P.yellow},
              ].map(s=>(
                <div key={s.l}>
                  <div style={{ fontSize:9, color:P.sub, textTransform:'uppercase', letterSpacing:.5 }}>{s.l}</div>
                  <div style={{ fontSize:14, fontWeight:900, color:s.c, fontFamily:'monospace' }}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* DROITE — Recherche produit rapide */}
          <div style={{ background:P.card, border:`1px solid ${P.border}`, borderRadius:8, padding:'10px 14px', minWidth:280 }}>
            <div style={{ fontSize:9, color:P.sub, fontWeight:700, textTransform:'uppercase', letterSpacing:.8, marginBottom:8 }}>
              Recherche produit
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <span style={{ fontSize:9, color:P.sub, fontWeight:700, width:90, flexShrink:0 }}>NOM [F1] :</span>
                <input ref={prodRef} value={prodSearch} onChange={e=>setProdSearch(e.target.value)}
                  placeholder="Rechercher..."
                  style={{ ...inpStyle, flex:1 }}/>
              </div>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <span style={{ fontSize:9, color:P.sub, fontWeight:700, width:90, flexShrink:0 }}>CODE [F2] :</span>
                <input ref={barcodeRef} value={barcode} onChange={e=>setBarcode(e.target.value)}
                  placeholder="Code-barres..."
                  style={{ ...inpStyle, flex:1 }}/>
              </div>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <span style={{ fontSize:9, color:P.sub, fontWeight:700, width:90, flexShrink:0 }}>QTITÉ :</span>
                <input type="number" value={qty} onChange={e=>setQty(Number(e.target.value)||1)} min={1}
                  style={{ ...inpStyle, width:60, textAlign:'center', color:P.yellow, fontWeight:700 }}/>
                <div style={{ flex:1, fontSize:10, color:foundProd ? (foundProd.stock<=0?P.red:P.green) : P.muted, fontWeight:700 }}>
                  {foundProd ? `Stock: ${foundProd.stock} ${foundProd.unit}` : '—'}
                </div>
              </div>
              {foundProd && (
                <div style={{ background:P.blueHd, border:`1px solid ${P.blue}30`, borderRadius:5,
                  padding:'4px 8px', fontSize:11 }}>
                  <span style={{ color:P.txt, fontWeight:700 }}>{foundProd.name}</span>
                  <span style={{ color:P.blue, fontWeight:800, marginLeft:10 }}>{fmt(foundProd.sellPrice)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BARRE D'ACTIONS */}
      <div style={{ background:'#0D1526', borderBottom:`1px solid ${P.border}`,
        padding:'6px 12px', display:'flex', gap:5, alignItems:'center',
        flexShrink:0, overflowX:'auto' }}>

        <Btn icon="🗑️" label={"Supprimer\nProduit"} color={P.red}   bg="#7F1D1D"
          disabled={!selected||selItems.length===0} onClick={()=>setConfirm('item')}/>
        <Btn icon="🗑️" label={"Supprimer\nVente"}   color={P.red}   bg="#7F1D1D"
          disabled={!selected}                       onClick={()=>setConfirm('sale')}/>

        <div style={{ width:1, height:44, background:P.border, margin:'0 3px' }}/>

        <Btn icon="🧾" label={"Ticket"}              color="#fff" bg={P.blueDk}
          disabled={!selected}
          onClick={async()=>{ if(selected) await printTicket(selected,selItems); }}/>
        <Btn icon="📋" label={"B.Livraison\nA4"}     color="#fff" bg={P.blueDk}
          disabled={!selected}
          onClick={async()=>{
            if(!selected) return;
            const cl=selected.clientId?await db.clients.get(selected.clientId).catch(()=>null):null;
            await printDelivery(selected,selItems,cl);
          }}/>
        <Btn icon="📄" label={"Facture"}              color="#fff" bg={P.blueDk}
          disabled={!selected}
          onClick={async()=>{
            if(!selected) return;
            const cl=selected.clientId?await db.clients.get(selected.clientId).catch(()=>null):null;
            await printInvoice(selected,selItems,cl);
          }}/>

        <div style={{ width:1, height:44, background:P.border, margin:'0 3px' }}/>

        <Btn icon="📊" label={"Ventes\ndétaillées"}  color={P.txt} bg={P.cyan+'22'}
          disabled={!selected}
          onClick={()=>{ if(selected) alert(`Vente VX-${String(selected.id).padStart(4,'0')}\nClient: ${selected.clientName||'Passage'}\nTotal: ${fmt(selected.total)}\n${selItems.length} article(s)`); }}/>
        <Btn icon="💳" label={"Versement\nclient"}    color={P.txt} bg={P.cyan+'22'}
          disabled={!selected||selected.status==='payé'}
          onClick={()=>setPayModal(selected)}/>

        {/* Filtre rapide */}
        <div style={{ display:'flex', gap:4, marginLeft:8 }}>
          {[['jour',"Aujourd'hui"],['tous','Tous'],['payé','Payé'],['crédit','Crédit']].map(([k,l])=>(
            <button key={k} onClick={()=>setFilter(k)} style={{
              padding:'5px 11px', border:`1px solid ${filter===k?P.blue:P.border}`,
              borderRadius:5, cursor:'pointer', fontSize:10, fontWeight:700,
              background:filter===k?P.blue:P.card,
              color:filter===k?'#fff':P.sub, transition:'all .12s',
            }}>{l}</button>
          ))}
        </div>

        <div style={{ position:'relative', marginLeft:4 }}>
          <span style={{ position:'absolute', left:7, top:'50%', transform:'translateY(-50%)', color:P.muted, fontSize:12 }}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="N°, client..."
            style={{ ...inpStyle, paddingLeft:24, width:160 }}/>
        </div>

        <div style={{ flex:1 }}/>

        <Btn icon="🚪" label={"[FIN]\nQuitter"} color="#fff" bg={P.redDk}
          onClick={onClose} wide/>
      </div>

      {/* MASTER — Tableau ventes */}
      <div style={{ flex:'0 0 40%', overflow:'hidden', display:'flex', flexDirection:'column',
        borderBottom:`2px solid ${P.border}` }}>
        <div style={{ flex:1, overflowY:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['N°','Client','Date','Heure','Mode','M TTC','Versement','Statut'].map(h=>(
                  <th key={h} style={TH()}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s,i)=>{
                const isSel = s.id===selectedId;
                return (
                  <tr key={s.id} onClick={()=>setSelectedId(s.id)}
                    style={{
                      cursor:'pointer',
                      background: isSel ? P.sel : i%2===0 ? 'transparent' : P.surface,
                    }}>
                    <td style={TD(i%2!==0,{color:P.cyan,fontFamily:'monospace',fontWeight:800})}>{String(s.id).padStart(4,'0')}</td>
                    <td style={TD(i%2!==0,{fontWeight:600})}>{s.clientName||'Passage'}</td>
                    <td style={TD(i%2!==0)}>{fD(s.createdAt)}</td>
                    <td style={TD(i%2!==0)}>{fT(s.createdAt)}</td>
                    <td style={TD(i%2!==0)}>{s.payMode}</td>
                    <td style={TD(i%2!==0,{fontWeight:900,color:P.blue})}>{fmt(s.total)}</td>
                    <td style={TD(i%2!==0,{color:P.green})}>{fmt(s.paid)}</td>
                    <td style={TD(i%2!==0)}>
                      <span style={{ background:s.status==='payé'?'#14532D':'#78350F', padding:'2px 8px', borderRadius:4, fontSize:10 }}>{s.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL — Articles */}
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <div style={{ background:P.blueHd, padding:'5px 12px', flexShrink:0, borderBottom:`1px solid ${P.border}`, display:'flex', justifyContent:'space-between' }}>
          <div style={{ fontWeight:800, fontSize:11, color:P.sub }}>DÉTAIL TICKET</div>
          {selected && <div style={{ fontWeight:900 }}>TOTAL : {fmt(selected.total)}</div>}
        </div>
        <div style={{ flex:1, overflowY:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:P.card }}>
                {['Produit','P.Vente','Qté','Total'].map(h=>(
                  <th key={h} style={TH({background:P.card})}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selItems.map((item, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : P.surface }}>
                  <td style={TD(i % 2 !== 0)}>{item.productName}</td>
                  <td style={TD(i % 2 !== 0)}>{fmt(item.unitPrice)}</td>
                  <td style={TD(i % 2 !== 0)}>{item.qty}</td>
                  <td style={TD(i % 2 !== 0, { textAlign: 'right', fontWeight: 900 })}>{fmt(item.unitPrice * item.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ background:'#0B1628', borderTop:`2px solid ${P.blueDk}`,
        padding:'7px 18px', flexShrink:0, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', gap:32 }}>
          <StatItem label="Achats" value={fmt(stats.totalAchats)} color="#93C5FD"/>
          <StatItem label="Ventes" value={fmt(stats.totalVentes)} color="#6EE7B7"/>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:9, color:P.sub }}>BÉNÉFICE JOUR</div>
          <div style={{ fontSize:26, fontWeight:900, color:P.yellow, fontFamily:'monospace' }}>{fmt(stats.benefice)}</div>
        </div>
      </div>

      {/* Modals */}
      {payModal && <PayModal sale={payModal} onClose={()=>setPayModal(null)} onDone={load}/>}
      {confirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.8)', zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:P.card, padding:24, borderRadius:10, width:340, textAlign:'center' }}>
            <div style={{ fontWeight:900, marginBottom:20 }}>Confirmer la suppression ?</div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setConfirm(null)} style={{ flex:1, padding:10, borderRadius:7 }}>Annuler</button>
              <button onClick={()=>confirm==='sale'?deleteSale():deleteLastItem()} style={{ flex:1, background:P.red, color:'#fff', border:'none', borderRadius:7 }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatItem({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize:13, fontWeight:900, color, fontFamily:'monospace' }}>{value}</div>
      <div style={{ fontSize:9, color:'rgba(255,255,255,.35)', textTransform:'uppercase' }}>{label}</div>
    </div>
  );
}