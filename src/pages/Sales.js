import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../ThemeContext';
import { db, nowISO, fmt } from '../db';
import { printTicket, printInvoice, printDelivery } from '../components/Ticket';
import DetailedSalesList from './DetailedSalesList';

// ─── Palette identique à Products ────────────────────────────────────────────
const T = {
  bg:       '#F9FAFB',
  white:    '#FFFFFF',
  border:   '#E5E7EB',
  borderLt: '#F3F4F6',
  shadow:   '0 1px 3px rgba(0,0,0,0.08)',
  shadowMd: '0 4px 16px rgba(0,0,0,0.08)',
  R:        14,
  Rs:       8,

  teal:     '#14B8A6',  tealLt:  '#F0FDFA',  tealBd:  '#99F6E4',  tealDk: '#0F766E',
  blue:     '#3B82F6',  blueLt:  '#EFF6FF',  blueBd:  '#BFDBFE',
  amber:    '#F59E0B',  amberLt: '#FEF3C7',  amberBd: '#FDE68A',
  red:      '#EF4444',  redLt:   '#FEF2F2',  redBd:   '#FECACA',
  green:    '#10B981',  greenLt: '#ECFDF5',  greenBd: '#A7F3D0',
  purple:   '#8B5CF6',  purpleLt:'#F5F3FF',  purpleBd:'#DDD6FE',
  txt:      '#111827',
  sub:      '#6B7280',
  muted:    '#9CA3AF',
};

// ─── Card épurée style Products ───────────────────────────────────────────────
const Card = ({ children, style }) => (
  <div style={{
    background: T.white, borderRadius: T.R,
    border: `1px solid ${T.border}`,
    boxShadow: T.shadow,
    ...style,
  }}>{children}</div>
);

// ─── Bouton style Products ────────────────────────────────────────────────────
const Btn = ({ children, onClick, color = T.teal, light, style, disabled }) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding: '8px 18px', borderRadius: T.Rs, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    background: light ? color + '18' : color,
    color: light ? color : '#fff',
    fontWeight: 700, fontSize: 13,
    opacity: disabled ? .5 : 1,
    transition: 'all .15s',
    border: light ? `1px solid ${color}40` : 'none',
    boxShadow: light ? 'none' : `0 2px 8px ${color}40`,
    ...style,
  }}>{children}</button>
);

// ─── Tag filtre style Products ────────────────────────────────────────────────
const Tag = ({ label, active, onClick, color = T.teal }) => (
  <button onClick={onClick} style={{
    padding: '6px 16px', borderRadius: 20,
    border: `1px solid ${active ? color : T.border}`,
    background: active ? color : T.white,
    color: active ? '#fff' : T.sub,
    fontSize: 13, fontWeight: active ? 700 : 500,
    cursor: 'pointer', transition: 'all .15s',
  }}>{label}</button>
);

// ════════════════════════════════════════════════════════════════════════════
export default function Sales() {
  // ── TOUT LE STATE EST IDENTIQUE ────────────────────────────────────────────
  const [items,        setItems]        = useState([]);
  const [client,       setClient]       = useState({ name:'Passage', id:null });
  const [payMode,      setPayMode]      = useState('Espèces');
  const [discount,     setDiscount]     = useState(0);
  const [paid,         setPaid]         = useState('');
  const [products,     setProducts]     = useState([]);
  const [clients,      setClients]      = useState([]);
  const [search,       setSearch]       = useState('');
  const [showPayModal, setShowPayModal] = useState(null);
  const [showUnpaid,   setShowUnpaid]   = useState(false);
  const [unpaidSales,  setUnpaidSales]  = useState([]);
  const [showHistory,  setShowHistory]  = useState(false);
  const [filterStock,  setFilterStock]  = useState('tous');

  const barcodeRef = useRef();

  useEffect(() => {
    loadData();
    const handleF1 = (e) => { if (e.key === 'F1') barcodeRef.current?.focus(); };
    window.addEventListener('keydown', handleF1);
    return () => window.removeEventListener('keydown', handleF1);
  }, []);

  // ── TOUTE LA LOGIQUE EST IDENTIQUE ────────────────────────────────────────
  async function loadData() {
    const [p, c, u] = await Promise.all([
      db.products.toArray(),
      db.clients.toArray(),
      db.sales.where('status').equals('crédit').toArray()
    ]);
    setProducts(p);
    setClients(c);
    setUnpaidSales(u);
  }

  const total    = items.reduce((sum, i) => sum + (i.sellPrice * i.qty), 0);
  const totalTTC = total - discount;

  const addItem = (p) => {
    const existing = items.find(x => x.id === p.id);
    if (existing) {
      setItems(items.map(x => x.id === p.id ? { ...x, qty: x.qty + 1 } : x));
    } else {
      setItems([...items, { ...p, qty: 1 }]);
    }
  };

  async function finishSale() {
    if (items.length === 0) return;
    const saleId = await db.sales.add({
      clientName: client.name,
      clientId:   client.id,
      total:      totalTTC,
      paid:       Number(paid) || 0,
      discount:   Number(discount) || 0,
      payMode,
      status:     (Number(paid) || 0) >= totalTTC ? 'payé' : 'crédit',
      createdAt:  nowISO()
    });
    for (const item of items) {
      await db.saleItems.add({
        saleId,
        productId:   item.id,
        productName: item.name,
        qty:         item.qty,
        buyPrice:    item.buyPrice,
        unitPrice:   item.sellPrice
      });
      await db.products.update(item.id, { stock: item.stock - item.qty });
    }
    setItems([]); setPaid(''); setDiscount(0);
    setClient({ name:'Passage', id:null });
    loadData();
    alert('Vente enregistrée !');
  }

  // Filtre produits
  const filteredProds = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    if (filterStock === 'dispo')   return matchSearch && p.stock > 0;
    if (filterStock === 'rupture') return matchSearch && p.stock === 0;
    return matchSearch;
  });

  // ── RENDU ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: T.bg, fontFamily: "'Segoe UI', system-ui, sans-serif",
      color: T.txt,
    }}>

      {/* ══ HEADER — style Products ══ */}
      <div style={{
        background: T.white, borderBottom: `1px solid ${T.border}`,
        padding: '0 24px', height: 56, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: T.shadow,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{
            width:34, height:34, borderRadius:10,
            background:`linear-gradient(135deg,${T.teal},${T.tealDk})`,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:18, boxShadow:`0 3px 10px ${T.teal}50`,
          }}>🧾</div>
          <div>
            <div style={{ fontWeight:800, fontSize:16, letterSpacing:-.3 }}>Vente Comptoir</div>
            <div style={{ fontSize:11, color:T.sub }}>{items.length} article{items.length>1?'s':''} · {fmt(totalTTC)}</div>
          </div>
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <Btn onClick={()=>setShowUnpaid(true)} color={T.red} light>
            🔴 Impayés ({unpaidSales.length})
          </Btn>
          <Btn onClick={()=>setShowHistory(true)} color={T.blue} light>
            📋 Liste des Ventes
          </Btn>
        </div>
      </div>

      {/* ══ CORPS ══ */}
      <div style={{ flex:1, display:'flex', overflow:'hidden', padding:'16px', gap:14 }}>

        {/* ── COLONNE GAUCHE — Panier ── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:12 }}>

          {/* Panier card */}
          <Card style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{
              padding:'14px 18px', borderBottom:`1px solid ${T.borderLt}`,
              display:'flex', justifyContent:'space-between', alignItems:'center',
            }}>
              <div style={{ fontWeight:800, fontSize:15 }}>
                🛒 Articles
                <span style={{
                  marginLeft:8, background:T.tealLt, color:T.teal,
                  border:`1px solid ${T.tealBd}`, borderRadius:20,
                  padding:'1px 9px', fontSize:12, fontWeight:700,
                }}>{items.length}</span>
              </div>
              <button onClick={()=>setItems([])}
                style={{ color:T.red, background:'none', border:'none', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                Vider le panier
              </button>
            </div>

            {/* Table panier */}
            <div style={{ flex:1, overflow:'auto' }}>
              {items.length === 0 ? (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
                  flexDirection:'column', gap:10, height:'100%', color:T.muted }}>
                  <div style={{ fontSize:44, opacity:.3 }}>🛒</div>
                  <div style={{ fontSize:14 }}>Panier vide</div>
                  <div style={{ fontSize:12 }}>Recherchez un produit à droite</div>
                </div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead style={{ position:'sticky', top:0, background:T.white, zIndex:2 }}>
                    <tr style={{ fontSize:11, color:T.sub, textTransform:'uppercase', letterSpacing:.8 }}>
                      <th style={{ padding:'10px 16px', textAlign:'left', borderBottom:`1px solid ${T.border}`, fontWeight:700 }}>Désignation</th>
                      <th style={{ padding:'10px 12px', textAlign:'left', borderBottom:`1px solid ${T.border}`, fontWeight:700 }}>Prix unit.</th>
                      <th style={{ padding:'10px 12px', textAlign:'center', borderBottom:`1px solid ${T.border}`, fontWeight:700 }}>Quantité</th>
                      <th style={{ padding:'10px 16px', textAlign:'right', borderBottom:`1px solid ${T.border}`, fontWeight:700 }}>Total</th>
                      <th style={{ padding:'10px 12px', borderBottom:`1px solid ${T.border}` }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={item.id} style={{
                        borderBottom:`1px solid ${T.borderLt}`,
                        background: i%2===0 ? T.white : T.bg,
                        transition:'background .1s',
                      }}
                        onMouseEnter={e=>e.currentTarget.style.background=T.tealLt}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?T.white:T.bg}>
                        <td style={{ padding:'11px 16px', fontWeight:600, fontSize:14 }}>{item.name}</td>
                        <td style={{ padding:'11px 12px', color:T.sub, fontSize:13 }}>{fmt(item.sellPrice)}</td>
                        <td style={{ padding:'11px 12px', textAlign:'center' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'center' }}>
                            <button onClick={()=>addItem({...item,qty:-2})} style={{
                              width:26, height:26, borderRadius:7, border:`1px solid ${T.border}`,
                              background:T.white, cursor:'pointer', fontSize:15, fontWeight:700,
                              color:T.sub, display:'flex', alignItems:'center', justifyContent:'center',
                            }}>−</button>
                            <span style={{ fontWeight:800, minWidth:22, textAlign:'center', fontSize:14 }}>{item.qty}</span>
                            <button onClick={()=>addItem(item)} style={{
                              width:26, height:26, borderRadius:7, border:`1px solid ${T.tealBd}`,
                              background:T.tealLt, cursor:'pointer', fontSize:15, fontWeight:700,
                              color:T.teal, display:'flex', alignItems:'center', justifyContent:'center',
                            }}>+</button>
                          </div>
                        </td>
                        <td style={{ padding:'11px 16px', textAlign:'right', fontWeight:800, fontSize:14, color:T.teal }}>
                          {fmt(item.sellPrice * item.qty)}
                        </td>
                        <td style={{ padding:'11px 12px', textAlign:'center' }}>
                          <button onClick={()=>setItems(items.filter(x=>x.id!==item.id))} style={{
                            width:26, height:26, borderRadius:7,
                            background:T.redLt, border:`1px solid ${T.redBd}`,
                            color:T.red, cursor:'pointer', fontSize:14, fontWeight:800,
                            display:'flex', alignItems:'center', justifyContent:'center',
                          }}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>

          {/* ── Barre totaux + Valider ── */}
          <div style={{
            background: T.white, borderRadius: T.R, border:`1px solid ${T.border}`,
            padding:'16px 20px', display:'flex', alignItems:'center', justifyContent:'space-between',
            boxShadow: T.shadowMd, flexShrink:0,
          }}>
            <div>
              <div style={{ fontSize:12, color:T.sub, fontWeight:600, marginBottom:3 }}>Net à payer</div>
              <div style={{ fontSize:36, fontWeight:900, letterSpacing:-1,
                color: items.length ? T.tealDk : T.muted, fontFamily:'monospace' }}>
                {fmt(totalTTC)}
              </div>
            </div>

            {/* Remise inline */}
            <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'center' }}>
              <div style={{ fontSize:11, color:T.sub, fontWeight:600, textTransform:'uppercase', letterSpacing:.6 }}>Remise</div>
              <input type="number" value={discount} onChange={e=>setDiscount(Number(e.target.value)||0)}
                placeholder="0"
                style={{ width:80, textAlign:'center', padding:'7px 8px', borderRadius:T.Rs,
                  border:`1px solid ${T.amberBd}`, background:T.amberLt,
                  color:T.amber, fontWeight:800, fontSize:14, outline:'none' }}/>
            </div>

            {/* Bouton Valider — style "Agent Stock" flottant */}
            <button onClick={finishSale} disabled={items.length===0}
              style={{
                background: items.length
                  ? `linear-gradient(135deg,${T.teal},${T.tealDk})`
                  : T.border,
                border: 'none', borderRadius: T.R,
                padding: '14px 36px', color: items.length ? '#fff' : T.muted,
                fontSize: 16, fontWeight: 900, cursor: items.length ? 'pointer' : 'not-allowed',
                boxShadow: items.length ? `0 6px 20px ${T.teal}50` : 'none',
                transition: 'all .2s', letterSpacing: -.2,
              }}
              onMouseEnter={e=>{ if(items.length) e.currentTarget.style.transform='translateY(-2px)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.transform='none'; }}>
              ✓ Valider la vente
            </button>
          </div>
        </div>

        {/* ── COLONNE DROITE — Client + Produits ── */}
        <div style={{ width:360, display:'flex', flexDirection:'column', gap:12 }}>

          {/* Client */}
          <Card style={{ padding:'14px 16px' }}>
            <label style={{ fontSize:11, fontWeight:700, color:T.sub,
              textTransform:'uppercase', letterSpacing:.8, display:'block', marginBottom:8 }}>
              👤 Client
            </label>
            <select
              value={client.id || ''}
              onChange={e => {
                const c = clients.find(x => x.id == e.target.value);
                setClient(c ? { name:c.name, id:c.id } : { name:'Passage', id:null });
              }}
              style={{
                width:'100%', padding:'9px 12px', borderRadius:T.Rs,
                border:`1px solid ${T.border}`, outline:'none', fontWeight:600,
                background:T.bg, color:T.txt, fontSize:13,
              }}>
              <option value="">Client de passage</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Card>

          {/* Mode paiement */}
          <Card style={{ padding:'12px 16px' }}>
            <label style={{ fontSize:11, fontWeight:700, color:T.sub,
              textTransform:'uppercase', letterSpacing:.8, display:'block', marginBottom:8 }}>
              💳 Mode de paiement
            </label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {['Espèces','Chèque','Crédit','Virement'].map(m => (
                <button key={m} onClick={()=>setPayMode(m)} style={{
                  padding:'6px 12px', borderRadius:20,
                  border:`1px solid ${payMode===m ? T.teal : T.border}`,
                  background: payMode===m ? T.teal : T.white,
                  color: payMode===m ? '#fff' : T.sub,
                  fontSize:12, fontWeight:payMode===m?700:500, cursor:'pointer', transition:'all .15s',
                }}>{m}</button>
              ))}
            </div>
          </Card>

          {/* Recherche produits */}
          <Card style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'12px 14px', borderBottom:`1px solid ${T.borderLt}` }}>
              <div style={{ position:'relative' }}>
                <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)',
                  color:T.muted, fontSize:14 }}>🔍</span>
                <input
                  ref={barcodeRef}
                  placeholder="Rechercher un produit..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    width:'100%', padding:'9px 12px 9px 34px',
                    borderRadius:T.Rs, border:`1px solid ${T.border}`,
                    outline:'none', background:T.bg, fontSize:13,
                    boxSizing:'border-box',
                  }}/>
              </div>
              {/* Filtres stock */}
              <div style={{ display:'flex', gap:6, marginTop:8 }}>
                {[['tous','Tous'],['dispo','En stock'],['rupture','Rupture']].map(([k,l])=>(
                  <Tag key={k} label={l} active={filterStock===k}
                    onClick={()=>setFilterStock(k)}
                    color={k==='rupture'?T.red:T.teal}/>
                ))}
                <span style={{ marginLeft:'auto', fontSize:12, color:T.muted, alignSelf:'center' }}>
                  {filteredProds.length}
                </span>
              </div>
            </div>

            {/* Liste produits */}
            <div style={{ flex:1, overflow:'auto', padding:'8px 10px' }}>
              {filteredProds.map((p, i) => (
                <div key={p.id} onClick={()=>addItem(p)}
                  style={{
                    padding:'10px 12px', borderRadius:T.Rs, marginBottom:6,
                    border:`1px solid ${T.border}`,
                    background: p.stock <= 0 ? T.redLt : T.white,
                    cursor:'pointer', transition:'all .15s',
                  }}
                  onMouseEnter={e=>{ e.currentTarget.style.borderColor=T.teal; e.currentTarget.style.boxShadow=`0 2px 8px ${T.teal}20`; }}
                  onMouseLeave={e=>{ e.currentTarget.style.borderColor=T.border; e.currentTarget.style.boxShadow='none'; }}>
                  <div style={{ fontWeight:700, fontSize:13, color:T.txt, marginBottom:4 }}>{p.name}</div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontWeight:800, color:T.teal, fontSize:14 }}>{fmt(p.sellPrice)}</span>
                    <span style={{
                      fontSize:11, fontWeight:700,
                      color: p.stock<=0 ? T.red : p.stock<=5 ? T.amber : T.green,
                      background: p.stock<=0 ? T.redLt : p.stock<=5 ? T.amberLt : T.greenLt,
                      border:`1px solid ${p.stock<=0?T.redBd:p.stock<=5?T.amberBd:T.greenBd}`,
                      borderRadius:20, padding:'2px 8px',
                    }}>
                      {p.stock<=0?'Rupture':`Stock: ${p.stock}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ══ MODAL IMPAYÉS ══ */}
      {showUnpaid && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.35)',
          backdropFilter:'blur(4px)', display:'flex', alignItems:'center',
          justifyContent:'center', zIndex:400 }}>
          <Card style={{ width:500, maxHeight:'75vh', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'16px 20px', borderBottom:`1px solid ${T.border}`,
              display:'flex', justifyContent:'space-between', alignItems:'center',
              background:T.redLt, borderRadius:`${T.R}px ${T.R}px 0 0` }}>
              <h3 style={{ margin:0, color:T.red, fontWeight:800, fontSize:15 }}>🔴 Ventes à crédit ({unpaidSales.length})</h3>
              <button onClick={()=>setShowUnpaid(false)}
                style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:T.red }}>✕</button>
            </div>
            <div style={{ flex:1, overflow:'auto', padding:14 }}>
              {unpaidSales.length===0
                ? <div style={{ textAlign:'center', padding:30, color:T.green, fontWeight:700 }}>✅ Aucun impayé !</div>
                : unpaidSales.map(s => (
                  <div key={s.id} style={{ padding:'12px 14px', marginBottom:8, borderRadius:T.Rs,
                    border:`1px solid ${T.redBd}`, background:T.redLt,
                    display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:13, color:T.txt }}>{s.clientName||'Passage'}</div>
                      <div style={{ display:'flex', gap:12, marginTop:3, fontSize:11 }}>
                        <span style={{ color:T.sub }}>Total: {fmt(s.total)}</span>
                        <span style={{ color:T.green }}>Payé: {fmt(s.paid)}</span>
                        <span style={{ color:T.red, fontWeight:700 }}>Reste: {fmt(Number(s.total)-Number(s.paid))}</span>
                      </div>
                    </div>
                    <Btn color={T.amber}>💳 Versement</Btn>
                  </div>
                ))
              }
            </div>
          </Card>
        </div>
      )}

      {/* ══ LISTE DES VENTES ══ */}
      {showHistory && (
        <DetailedSalesList
          onClose={()=>setShowHistory(false)}
          currentClient={client}
          currentTotal={totalTTC}
        />
      )}
    </div>
  );
}