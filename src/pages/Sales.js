import { useState, useEffect, useRef, useMemo } from 'react';
import { useTheme } from '../ThemeContext';
import { db, nowISO, fmt } from '../db';
import { printTicket, printInvoice, printDelivery } from '../components/Ticket';
import DetailedSalesList from './DetailedSalesList';
import salesAgent from '../components/SalesAgent';
import AgentSuggestionPanel from '../components/AgentSuggestionPanel';
import { useToast, useSaleSuccess } from '../components/Feedback';
import { DS } from '../designSystem';
import AIAgentPanel from '../components/AIAgentPanel';

const CATS  = ['Lubrifiants','Filtres','Électrique','Liquides','Distribution','Freinage','Carrosserie','Pneumatiques','Alimentaire','Vêtements','Électronique','Plomberie','Outillage','Divers'];
const UNITS = ['pce','L','kg','m','boîte','carton','sachet','rouleau','paire'];
const PENDING_KEY = 'vp_pending_carts';

function loadPending() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch { return []; }
}
function savePending(list) { localStorage.setItem(PENDING_KEY, JSON.stringify(list)); }

// ─── Horloge ─────────────────────────────────────────────────────────────────
function LiveClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return (
    <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
      <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>
        {t.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color: '#00C9FF', fontFamily: 'monospace', letterSpacing: 1 }}>
        {t.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
    </div>
  );
}

// ─── SVG Barcode mini affichage ───────────────────────────────────────────────
function MiniBarcode({ code, color }) {
  if (!code) return null;
  const bars = Array.from(code).map(c => c.charCodeAt(0));
  return (
    <svg width={80} height={22} style={{ display: 'block' }}>
      {bars.slice(0, 20).map((v, i) => (
        <rect key={i} x={i * 4} y={0} width={v % 3 === 0 ? 3 : 2} height={22}
          fill={color} opacity={v % 5 === 0 ? 0.3 : v % 3 === 0 ? 1 : 0.6} rx={0.5} />
      ))}
    </svg>
  );
}

// ─── Item dropdown ────────────────────────────────────────────────────────────
function SearchDropdownItem({ product: p, isHighlighted, index, onSelect, onHover, C }) {
  const stockOut  = p.stock === 0;
  const stockLow  = p.stock > 0 && p.stock <= (p.minStock || 5);
  const stockColor = stockOut ? C.red : stockLow ? C.amber : C.green;
  const margin     = p.buyPrice > 0 ? Math.round(((p.sellPrice - p.buyPrice) / p.buyPrice) * 100) : null;
  const barcode    = p.barcode || (p.barcodes && p.barcodes[0]) || null;

  return (
    <div id={`search-item-${index}`}
      onMouseEnter={() => onHover(index)} onMouseLeave={() => onHover(-1)}
      onClick={() => !stockOut && onSelect(p)}
      style={{
        padding: '9px 13px', cursor: stockOut ? 'not-allowed' : 'pointer',
        background: isHighlighted ? C.accentLo : 'transparent',
        borderBottom: `1px solid ${C.border}`,
        opacity: stockOut ? 0.5 : 1,
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <div style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0, background: stockColor + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
          {stockOut ? '📭' : stockLow ? '⚠️' : '📦'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 12.5, color: isHighlighted ? C.accent : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{p.name}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 1 }}>
            {p.ref && <span style={{ fontSize: 9, color: C.muted }}>Réf:{p.ref}</span>}
            {barcode && <span style={{ fontSize: 9, color: C.muted, fontFamily: 'monospace' }}>|{barcode}|</span>}
          </div>
        </div>
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          <div style={{ background: stockColor + '18', border: `1.5px solid ${stockColor}40`, borderRadius: 12, padding: '1px 8px', fontSize: 10, fontWeight: 800, color: stockColor }}>
            {stockOut ? 'Rupture' : `${p.stock} ${p.unit || 'pce'}`}
          </div>
          {margin !== null && (
            <div style={{ background: margin > 0 ? C.greenLo : C.redLo, borderRadius: 12, padding: '1px 7px', fontSize: 9, fontWeight: 700, color: margin > 0 ? C.green : C.red }}>
              {margin > 0 ? '+' : ''}{margin}%
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
        {[
          { l: 'Achat', v: p.buyPrice > 0 ? fmt(p.buyPrice) : '—', c: C.red    },
          { l: 'Vente', v: fmt(p.sellPrice),                         c: C.blue   },
          { l: 'S.Gros', v: p.sellPriceSemiGros > 0 ? fmt(p.sellPriceSemiGros) : '—', c: C.purple || '#8B5CF6' },
          { l: 'Gros',  v: p.sellPriceGros > 0     ? fmt(p.sellPriceGros)     : '—', c: C.green  },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ background: c + '12', border: `1px solid ${c}20`, borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: c, textTransform: 'uppercase', letterSpacing: .4, marginBottom: 1 }}>{l}</div>
            <div style={{ fontSize: 11, fontWeight: 900, color: c, fontFamily: 'monospace' }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Modal Nouveau Produit ────────────────────────────────────────────────────
const PROD_EMPTY = { name: '', ref: '', category: 'Divers', unit: 'pce', buyPrice: '', sellPrice: '', sellPriceSemiGros: '', sellPriceGros: '', stock: '', minStock: '5', expiry: '', favorite: false };

function NewProductModal({ onClose, onSaved, C }) {
  const [form, setForm]     = useState(PROD_EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const margin = form.buyPrice && form.sellPrice && Number(form.buyPrice) > 0
    ? Math.round(((Number(form.sellPrice) - Number(form.buyPrice)) / Number(form.buyPrice)) * 100) : null;

  async function save() {
    if (!form.name.trim())  { setError('Le nom du produit est requis.'); return; }
    if (!form.sellPrice)    { setError('Le prix de vente est requis.'); return; }
    setSaving(true); setError('');
    try {
      const id = await db.products.add({
        name: form.name.trim(), ref: form.ref.trim(), category: form.category, unit: form.unit,
        buyPrice: Number(form.buyPrice) || 0, sellPrice: Number(form.sellPrice) || 0,
        sellPriceSemiGros: Number(form.sellPriceSemiGros) || 0, sellPriceGros: Number(form.sellPriceGros) || 0,
        stock: Number(form.stock) || 0, minStock: Number(form.minStock) || 5,
        expiry: form.expiry || null, favorite: !!form.favorite,
        barcode: '', barcodes: [], createdAt: nowISO(), updatedAt: nowISO(),
      });
      onSaved(id, form.name.trim());
    } catch (e) { setError('Erreur : ' + e.message); }
    setSaving(false);
  }

  const inputBg = C.isLight ? '#F8FAFC' : C.bg;
  const bd      = C.isLight ? '#E2E8F0' : C.border;
  const inp = { width:'100%', padding:'8px 11px', fontSize:13, fontWeight:600, background:inputBg, border:`1.5px solid ${bd}`, borderRadius:9, color:C.text, outline:'none', boxSizing:'border-box', fontFamily:'inherit' };
  const lbl = (txt, c) => <div style={{ fontSize:9, fontWeight:800, color:c||C.sub, textTransform:'uppercase', letterSpacing:.8, marginBottom:4 }}>{txt}</div>;

  return (
    <div style={{ position:'fixed', inset:0, zIndex:DS.zIndex.modal+20, background:'rgba(0,0,0,.7)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:C.isLight?'#fff':C.surface, border:`2px solid ${C.accent}40`, borderRadius:20, width:660, maxWidth:'96vw', maxHeight:'92vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 30px 80px rgba(0,0,0,.6)' }}>
        <div style={{ background:`linear-gradient(135deg,${C.blue},${C.violet||'#6366F1'})`, padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:22 }}>📦</span>
            <div>
              <div style={{ fontWeight:900, fontSize:15, color:'#fff' }}>Créer un nouveau produit</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.7)' }}>Ajouté immédiatement au stock</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.2)', border:'none', borderRadius:8, width:28, height:28, color:'#fff', fontSize:17, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'18px 20px', display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:12 }}>
            <div>{lbl('Nom *',C.blue)}<input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Ex: Huile Moteur 5W30" style={{...inp,border:`1.5px solid ${C.blue}40`}} onFocus={e=>{e.target.style.borderColor=C.blue;}} onBlur={e=>{e.target.style.borderColor=C.blue+'40';}}/></div>
            <div>{lbl('Référence')}<input value={form.ref} onChange={e=>set('ref',e.target.value)} placeholder="HM-001" style={inp}/></div>
            <div>{lbl('Unité')}<select value={form.unit} onChange={e=>set('unit',e.target.value)} style={inp}>{UNITS.map(u=><option key={u} value={u}>{u}</option>)}</select></div>
          </div>
          <div>{lbl('Catégorie')}<select value={form.category} onChange={e=>set('category',e.target.value)} style={inp}>{CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div style={{ background:C.isLight?'#F8FAFC':C.card, border:`1.5px solid ${C.border}`, borderRadius:12, padding:'14px 16px' }}>
            <div style={{ fontSize:11, fontWeight:800, color:C.sub, textTransform:'uppercase', letterSpacing:.8, marginBottom:12 }}>💰 Grille de prix</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
              <div style={{ background:C.isLight?'#FEF2F2':C.redLo, border:`1.5px solid ${C.red}30`, borderRadius:10, padding:'10px 12px' }}>{lbl('Prix achat (DA)',C.red)}<input type="number" value={form.buyPrice} onChange={e=>set('buyPrice',e.target.value)} placeholder="0" style={{...inp,background:'transparent',border:'none',fontSize:16,fontWeight:900,color:C.red,padding:'4px 0'}}/></div>
              <div style={{ background:C.isLight?'#EFF6FF':C.blueLo, border:`1.5px solid ${C.blue}30`, borderRadius:10, padding:'10px 12px' }}>{lbl('Prix vente * (DA)',C.blue)}<input type="number" value={form.sellPrice} onChange={e=>set('sellPrice',e.target.value)} placeholder="0" style={{...inp,background:'transparent',border:'none',fontSize:16,fontWeight:900,color:C.blue,padding:'4px 0'}}/>{margin!==null&&<div style={{fontSize:10,fontWeight:700,color:margin>0?C.green:C.red,marginTop:3}}>Marge: {margin>0?'+':''}{margin}%</div>}</div>
              <div style={{ background:C.isLight?'#F5F3FF':C.purpleLo||'#1a0a40', border:`1.5px solid ${(C.purple||C.violet)}30`, borderRadius:10, padding:'10px 12px' }}>{lbl('Semi-gros (DA)',C.purple||C.violet)}<input type="number" value={form.sellPriceSemiGros} onChange={e=>set('sellPriceSemiGros',e.target.value)} placeholder="0" style={{...inp,background:'transparent',border:'none',fontSize:16,fontWeight:900,color:C.purple||C.violet,padding:'4px 0'}}/></div>
              <div style={{ background:C.isLight?'#ECFDF5':C.greenLo, border:`1.5px solid ${C.green}30`, borderRadius:10, padding:'10px 12px' }}>{lbl('Gros (DA)',C.green)}<input type="number" value={form.sellPriceGros} onChange={e=>set('sellPriceGros',e.target.value)} placeholder="0" style={{...inp,background:'transparent',border:'none',fontSize:16,fontWeight:900,color:C.green,padding:'4px 0'}}/></div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div style={{ background:C.isLight?'#ECFDF5':C.greenLo, border:`1.5px solid ${C.green}30`, borderRadius:10, padding:'10px 12px' }}>{lbl('Stock initial',C.green)}<input type="number" value={form.stock} onChange={e=>set('stock',e.target.value)} placeholder="0" style={{...inp,background:'transparent',border:'none',fontSize:18,fontWeight:900,color:C.green,padding:'4px 0'}}/></div>
            <div style={{ background:C.isLight?'#FFFBEB':C.amberLo, border:`1.5px solid ${C.amber}30`, borderRadius:10, padding:'10px 12px' }}>{lbl('Stock minimum',C.amber)}<input type="number" value={form.minStock} onChange={e=>set('minStock',e.target.value)} placeholder="5" style={{...inp,background:'transparent',border:'none',fontSize:18,fontWeight:900,color:C.amber,padding:'4px 0'}}/></div>
            <div>{lbl('Péremption')}<input type="date" value={form.expiry} onChange={e=>set('expiry',e.target.value)} style={inp}/></div>
          </div>
          {error && <div style={{ background:C.redLo, border:`1.5px solid ${C.red}40`, borderRadius:9, padding:'9px 14px', color:C.red, fontSize:13, fontWeight:600 }}>⚠ {error}</div>}
        </div>
        <div style={{ flexShrink:0, padding:'12px 20px', borderTop:`1.5px solid ${C.border}`, display:'flex', gap:10, background:C.isLight?'#fff':C.surface }}>
          <button onClick={onClose} style={{ flex:1, padding:'11px', background:inputBg, border:`2px solid ${bd}`, borderRadius:11, fontSize:13, fontWeight:700, color:C.sub, cursor:'pointer' }}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ flex:2, padding:'11px', background:saving?C.muted:`linear-gradient(135deg,${C.blue},${C.violet||'#6366F1'})`, border:'none', borderRadius:11, fontSize:14, fontWeight:900, color:'#fff', cursor:saving?'not-allowed':'pointer' }}>
            {saving?'⏳ Enregistrement...':'✅ Créer et ajouter au stock'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Validation ─────────────────────────────────────────────────────────
const PAY_MODES = ['Espèces', 'Virement', 'Chèque', 'À terme'];
const PAY_ICONS = ['💵', '🏦', '💳', '⏳'];
const TVA_RATES = ['0%', '9%', '19%'];

function ValidationModal({ totalHT, discount, onConfirm, onCancel, C }) {
  const [selectedTva, setSelectedTva] = useState('0%');
  const [selectedPay, setSelectedPay] = useState(0);
  const [paidAmount, setPaidAmount]   = useState('');
  const [userEdited, setUserEdited]   = useState(false);
  const paidRef = useRef();
  const tvaRate    = parseInt(selectedTva) || 0;
  const baseHT     = totalHT - discount;
  const tvaAmount  = Math.round(baseHT * tvaRate / 100);
  const grandTotal = baseHT + tvaAmount;
  useEffect(() => { if (!userEdited) setPaidAmount(String(grandTotal)); }, [grandTotal, userEdited]);
  useEffect(() => { setTimeout(() => paidRef.current?.select(), 80); }, []);
  const paid     = Number(paidAmount) || 0;
  const isCredit = paid < grandTotal;
  const isOver   = paid > grandTotal;
  const inputBg  = C.isLight ? '#F8FAFC' : C.bg;
  const bdColor  = C.isLight ? '#E2E8F0' : C.border;
  return (
    <div style={{ position:'fixed', inset:0, zIndex:DS.zIndex.modal+10, background:'rgba(0,0,0,.65)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => e.target===e.currentTarget && onCancel()}>
      <div style={{ background:C.isLight?'#fff':C.surface, border:`2px solid ${C.green}40`, borderRadius:20, width:500, maxWidth:'96vw', overflow:'hidden', boxShadow:'0 32px 80px rgba(0,0,0,.5)' }}>
        <div style={{ background:`linear-gradient(135deg,${C.green},#059669)`, padding:'13px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}><span style={{ fontSize:20 }}>🧾</span><div><div style={{ fontWeight:900, fontSize:14, color:'#fff' }}>Valider la vente</div><div style={{ fontSize:10, color:'rgba(255,255,255,.75)' }}>Confirmer le paiement</div></div></div>
          <button onClick={onCancel} style={{ background:'rgba(255,255,255,.2)', border:'none', borderRadius:8, width:28, height:28, color:'#fff', fontSize:17, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ padding:'16px 18px', display:'flex', flexDirection:'column', gap:13 }}>
          <div style={{ background:C.isLight?'#F0FDF4':C.greenLo, border:`1.5px solid ${C.green}40`, borderRadius:11, padding:'11px 14px' }}>
            {(discount>0||tvaRate>0)&&(
              <div style={{ marginBottom:7, display:'flex', flexDirection:'column', gap:3 }}>
                {discount>0&&<div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:C.sub }}><span>Sous-total</span><span style={{ fontFamily:'monospace' }}>{fmt(totalHT)}</span></div>}
                {discount>0&&<div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:C.amber }}><span>Remise</span><span style={{ fontFamily:'monospace' }}>− {fmt(discount)}</span></div>}
                {tvaRate>0&&<div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:C.sub }}><span>TVA {selectedTva}</span><span style={{ fontFamily:'monospace' }}>+ {fmt(tvaAmount)}</span></div>}
                <div style={{ borderTop:`1px solid ${C.green}30`, marginTop:3 }}/>
              </div>
            )}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontWeight:900, fontSize:12, color:C.green, textTransform:'uppercase', letterSpacing:.6 }}>TOTAL TTC</span>
              <span style={{ fontSize:30, fontWeight:900, color:C.green, fontFamily:'monospace' }}>{fmt(grandTotal).replace(' DA','')} <span style={{ fontSize:13, color:C.sub }}>DA</span></span>
            </div>
          </div>
          <div>
            <div style={{ fontSize:9, fontWeight:800, color:C.sub, textTransform:'uppercase', letterSpacing:1, marginBottom:5 }}>TVA</div>
            <div style={{ display:'flex', gap:6 }}>
              {TVA_RATES.map(t=>(
                <button key={t} onClick={()=>{setSelectedTva(t);setUserEdited(false);}}
                  style={{ flex:1, padding:'7px', borderRadius:9, border:selectedTva===t?'none':`2px solid ${bdColor}`, background:selectedTva===t?(C.violet||'#6D28D9'):inputBg, color:selectedTva===t?'#fff':C.sub, fontSize:13, fontWeight:800, cursor:'pointer' }}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize:9, fontWeight:800, color:C.sub, textTransform:'uppercase', letterSpacing:1, marginBottom:5 }}>MODE DE PAIEMENT</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
              {PAY_MODES.map((mode,i)=>(
                <button key={i} onClick={()=>setSelectedPay(i)}
                  style={{ padding:'7px 3px', borderRadius:9, border:selectedPay===i?'none':`2px solid ${bdColor}`, background:selectedPay===i?C.blue:inputBg, color:selectedPay===i?'#fff':C.sub, fontSize:9, fontWeight:800, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                  <span style={{ fontSize:17 }}>{PAY_ICONS[i]}</span>{mode}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize:9, fontWeight:800, color:C.sub, textTransform:'uppercase', letterSpacing:1, marginBottom:5 }}>MONTANT VERSÉ (DA)</div>
            <input ref={paidRef} type="number" value={paidAmount}
              onChange={e=>{setPaidAmount(e.target.value);setUserEdited(true);}}
              onFocus={e=>e.target.select()}
              style={{ width:'100%', padding:'11px 13px', fontSize:24, fontWeight:900, fontFamily:'monospace', textAlign:'center', background:isCredit?(C.isLight?'#FFF7ED':C.amberLo):isOver?(C.isLight?'#ECFDF5':C.greenLo):inputBg, border:`2.5px solid ${isCredit?C.amber:isOver?C.green:C.blue}`, borderRadius:11, color:isCredit?C.amber:isOver?C.green:C.blue, outline:'none', boxSizing:'border-box' }}/>
            {paidAmount!==''&&(
              <div style={{ marginTop:5, display:'flex', justifyContent:'center' }}>
                {isCredit&&<div style={{ background:C.amberLo, border:`1px solid ${C.amber}40`, borderRadius:7, padding:'3px 11px', fontSize:11, fontWeight:700, color:C.amber }}>⏳ Crédit — Reste: {fmt(grandTotal-paid)}</div>}
                {isOver&&<div style={{ background:C.greenLo, border:`1px solid ${C.green}40`, borderRadius:7, padding:'3px 11px', fontSize:11, fontWeight:700, color:C.green }}>💵 Rendu: {fmt(paid-grandTotal)}</div>}
                {!isCredit&&!isOver&&paid>0&&<div style={{ background:C.greenLo, border:`1px solid ${C.green}40`, borderRadius:7, padding:'3px 11px', fontSize:11, fontWeight:700, color:C.green }}>✅ Paiement exact</div>}
              </div>
            )}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onCancel} style={{ flex:1, padding:'11px', background:inputBg, border:`2px solid ${bdColor}`, borderRadius:11, fontSize:13, fontWeight:700, color:C.sub, cursor:'pointer' }}>Annuler</button>
            <button onClick={()=>onConfirm({tvaRate,tvaAmount,grandTotal,paid,payMode:PAY_MODES[selectedPay],status:isCredit?'crédit':'payé'})}
              style={{ flex:2, padding:'11px', background:`linear-gradient(135deg,${C.green},#059669)`, border:'none', borderRadius:11, fontSize:13, fontWeight:900, color:'#fff', cursor:'pointer' }}>
              ✅ {isCredit?'Enregistrer en crédit':'Confirmer la vente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Attente ────────────────────────────────────────────────────────────
function PendingModal({ pending, onRestore, onDelete, onClose, C }) {
  const cardBg  = C.isLight ? '#fff' : C.card;
  const bd      = C.isLight ? '#E2E8F0' : C.border;
  return (
    <div style={{ position:'fixed', inset:0, zIndex:DS.zIndex.modal+5, background:'rgba(0,0,0,.65)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:C.isLight?'#fff':C.surface, border:`2px solid ${C.sub}40`, borderRadius:20, width:520, maxWidth:'96vw', maxHeight:'80vh', overflow:'hidden', boxShadow:'0 32px 80px rgba(0,0,0,.5)', display:'flex', flexDirection:'column' }}>
        <div style={{ background:`linear-gradient(135deg,${C.sub},#475569)`, padding:'13px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}><span style={{ fontSize:20 }}>📁</span><div><div style={{ fontWeight:900, fontSize:14, color:'#fff' }}>Paniers en attente</div><div style={{ fontSize:10, color:'rgba(255,255,255,.75)' }}>{pending.length} panier(s)</div></div></div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.2)', border:'none', borderRadius:8, width:28, height:28, color:'#fff', fontSize:17, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:16 }}>
          {pending.length===0?(
            <div style={{ textAlign:'center', padding:40, color:C.muted }}><div style={{ fontSize:40, marginBottom:10 }}>📭</div><div style={{ fontSize:14, fontWeight:600 }}>Aucun panier en attente</div></div>
          ):pending.map(cart=>(
            <div key={cart.id} style={{ background:cardBg, border:`1.5px solid ${bd}`, borderRadius:12, padding:14, marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                <div>
                  <div style={{ fontWeight:800, fontSize:14, color:C.text }}>{cart.clientName||'Passage'}</div>
                  <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{new Date(cart.savedAt).toLocaleString('fr-DZ',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</div>
                </div>
                <div style={{ fontWeight:900, fontSize:18, color:C.accent, fontFamily:'monospace' }}>{fmt(cart.total)}</div>
              </div>
              <div style={{ fontSize:12, color:C.sub, marginBottom:10 }}>
                {cart.items.slice(0,3).map(i=>`${i.name} ×${i.qty}`).join(' · ')}
                {cart.items.length>3&&` … +${cart.items.length-3}`}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>onRestore(cart)} style={{ flex:2, background:`linear-gradient(135deg,${C.accent},${C.blue})`, border:'none', borderRadius:9, padding:'8px', color:'#000', fontWeight:800, fontSize:12, cursor:'pointer' }}>↩ Restaurer</button>
                <button onClick={()=>onDelete(cart.id)} style={{ flex:1, background:C.redLo, border:`1px solid ${C.red}40`, borderRadius:9, padding:'8px', color:C.red, fontWeight:700, fontSize:12, cursor:'pointer' }}>🗑 Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PAGE VENTES
// ════════════════════════════════════════════════════════════════════════════
export default function Sales({ user }) {
  const { theme: C } = useTheme();

  const [items,          setItems]          = useState([]);
  const [client,         setClient]         = useState({ name:'Passage', id:null });
  const [discount,       setDiscount]       = useState(0);
  const [products,       setProducts]       = useState([]);
  const [clients,        setClients]        = useState([]);
  const [employees,      setEmployees]      = useState([]);
  const [seller,         setSeller]         = useState({ name:'', id:null });
  const [unpaidSales,    setUnpaidSales]    = useState([]);
  const [suggestions,    setSuggestions]    = useState([]);
  const [agentInsights,  setAgentInsights]  = useState({ alerts: [], suggestions: [], suggestedDiscount: null, metrics: null });
  const [showUnpaid,     setShowUnpaid]     = useState(false);
  const [showHistory,    setShowHistory]    = useState(false);
  const [showValidModal, setShowValidModal] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [showAIPanel,    setShowAIPanel]    = useState(false);
  const [pendingCarts,   setPendingCarts]   = useState(() => loadPending());
  const [showPending,    setShowPending]    = useState(false);

  // ── Recherche ───────────────────────────────────────────────────────────────
  const [searchMode,       setSearchMode]       = useState('name');      // 'name' | 'barcode' | 'category'
  const [search,           setSearch]           = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProduct,  setSelectedProduct]  = useState(null);
  const [qty,              setQty]              = useState(1);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showDropdown,     setShowDropdown]      = useState(false);

  const toastMsg = useToast();
  const { triggerSaleSuccess, SaleSuccessOverlay } = useSaleSuccess();
  const searchRef          = useRef();
  const qtyRef             = useRef();
  const searchContainerRef = useRef();

  const total    = items.reduce((s, i) => s + i.sellPrice * i.qty, 0);
  const totalTTC = total - discount;
  const hasItems = items.length > 0;
  const totalAchats = items.reduce((s, i) => s + (i.buyPrice || 0) * i.qty, 0);
  const benefice    = totalTTC - totalAchats;
  const isRetour    = qty < 0;
  const canAdd      = !!selectedProduct;

  // Catégories disponibles depuis le stock
  const categories = useMemo(() => [...new Set(products.map(p => p.category || 'Divers'))].sort(), [products]);

  // ── Produits filtrés selon le mode de recherche ─────────────────────────────
  const filteredProds = useMemo(() => {
    if (searchMode === 'barcode') {
      if (!search.trim()) return [];
      return products.filter(p =>
        (p.barcode || '').includes(search) ||
        (p.barcodes || []).some(b => b.includes(search)) ||
        (p.ref || '').toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8);
    }
    if (searchMode === 'category') {
      if (!selectedCategory) return [];
      const catProds = products.filter(p => (p.category || 'Divers') === selectedCategory);
      if (!search.trim()) return catProds.slice(0, 16);
      return catProds.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 16);
    }
    // mode 'name' (défaut)
    if (!search.trim()) return [];
    return products.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode || '').includes(search) ||
      (p.ref || '').toLowerCase().includes(search.toLowerCase())
    ).slice(0, 8);
  }, [products, search, searchMode, selectedCategory]);

  // ── Fermer dropdown au clic extérieur ──────────────────────────────────────
  useEffect(() => {
    const h = e => { if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) { setShowDropdown(false); setHighlightedIndex(-1); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // ── Scroll vers le highlighted item ────────────────────────────────────────
  useEffect(() => {
    if (highlightedIndex >= 0) document.getElementById(`search-item-${highlightedIndex}`)?.scrollIntoView({ block:'nearest', behavior:'smooth' });
  }, [highlightedIndex]);

  // ── Suggestions upsell ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    if (!hasItems) {
      setSuggestions([]);
      setAgentInsights({ alerts: [], suggestions: [], suggestedDiscount: null, metrics: null });
      return;
    }
    salesAgent.analyzeCart({ items, clientId: client.id, discount }).then(result => {
      if (cancelled) return;
      setSuggestions(result.suggestions || []);
      setAgentInsights(result);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [items, client.id, discount, hasItems]);

  // ── Raccourcis clavier ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = e => {
      if (showValidModal || showNewProduct) return;
      if (e.key === 'F1')                  { e.preventDefault(); searchRef.current?.focus(); return; }
      if ((e.ctrlKey && e.key==='Enter') || e.key==='F8') { e.preventDefault(); if (hasItems) setShowValidModal(true); return; }
      if (e.ctrlKey && e.key==='n')        { e.preventDefault(); resetTicket(); toastMsg.info('Nouveau ticket'); return; }
      if (e.ctrlKey && e.key==='h')        { e.preventDefault(); setShowHistory(true); return; }
      if (e.key==='Escape')                { setShowHistory(false); setShowUnpaid(false); setShowDropdown(false); setHighlightedIndex(-1); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasItems, showValidModal, showNewProduct]); // eslint-disable-line

  async function loadData() {
    const [p, c, e, u] = await Promise.all([
      db.products.toArray(),
      db.clients.toArray(),
      db.employees.toArray().catch(() => []),
      db.sales.where('status').equals('crédit').toArray(),
    ]);
    const activeEmployees = e.filter(emp => emp.active !== false);
    setProducts(p); setClients(c); setEmployees(activeEmployees); setUnpaidSales(u);
    setSeller(current => {
      if (current.id && activeEmployees.some(emp => emp.id === current.id)) return current;
      const fallback = activeEmployees[0];
      return fallback ? { name: fallback.name, id: fallback.id } : { name: user?.name || '', id: null };
    });
  }
  useEffect(() => { loadData(); }, []); // eslint-disable-line

  function resetTicket() {
    setItems([]); setDiscount(0); setClient({ name:'Passage', id:null });
    setSelectedProduct(null); setSearch(''); setQty(1);
  }

  function selectProduct(p) {
    setSelectedProduct(p); setSearch(p.name); setShowDropdown(false); setHighlightedIndex(-1); setQty(1);
    setTimeout(() => qtyRef.current?.select(), 60);
  }

  function addToCart() {
    if (!selectedProduct) return;
    const p = selectedProduct;
    const q = qty || 1;
    if (q > 0 && p.stock < q) { toastMsg.warning(`Stock insuffisant: ${p.stock} ${p.unit||'pce'}`); return; }
    const existing = items.find(x => x.id === p.id);
    if (existing) setItems(items.map(x => x.id===p.id ? { ...x, qty:x.qty+q } : x));
    else setItems([...items, { ...p, qty:q }]);
    setSelectedProduct(null); setSearch(''); setQty(1);
    searchRef.current?.focus();
  }

  async function addProductToCartByAgent(product, requestedQty = 1) {
    const fresh = await db.products.get(product.id);
    const p = fresh || product;
    const q = Number(requestedQty) || 1;
    if (q > 0 && Number(p.stock || 0) < q) {
      toastMsg.warning(`Stock insuffisant: ${p.stock} ${p.unit || 'pce'}`);
      return;
    }
    setItems(current => {
      const existing = current.find(x => x.id === p.id);
      if (existing) return current.map(x => x.id === p.id ? { ...x, qty: x.qty + q } : x);
      return [...current, { ...p, qty: q }];
    });
    toastMsg.success(`IA: ${q} x ${p.name} ajoute`);
  }

  async function handleProductSaved(newId, newName) {
    await loadData();
    const newProd = await db.products.get(newId);
    if (newProd) { selectProduct(newProd); toastMsg.success(`"${newName}" créé !`); }
    setShowNewProduct(false);
  }

  function putOnHold() {
    if (!hasItems) return;
    const cart = { id:Date.now(), clientName:client.name, clientId:client.id, items, discount, total:totalTTC, savedAt:new Date().toISOString() };
    const updated = [cart, ...pendingCarts];
    setPendingCarts(updated); savePending(updated); resetTicket();
    toastMsg.info(`Panier mis en attente — ${updated.length} en attente`);
  }

  function restoreCart(cart) {
    if (hasItems && !window.confirm('Remplacer le panier actuel ?')) return;
    setItems(cart.items); setClient({ name:cart.clientName||'Passage', id:cart.clientId||null }); setDiscount(cart.discount||0);
    const updated = pendingCarts.filter(c => c.id!==cart.id);
    setPendingCarts(updated); savePending(updated); setShowPending(false);
    toastMsg.success('Panier restauré !');
  }

  function deletePending(id) {
    const updated = pendingCarts.filter(c => c.id!==id);
    setPendingCarts(updated); savePending(updated);
    if (updated.length===0) setShowPending(false);
  }

  async function finishSale({ tvaRate, tvaAmount, grandTotal, paid, payMode, status }) {
    if (!hasItems) return;
    try {
      await salesAgent.executeSale({
        items,
        client,
        seller,
        userName: user?.name || '',
        totals: { subtotal: totalTTC, discount: Number(discount) || 0, cost: totalAchats },
        payment: { tvaRate, tvaAmount, grandTotal, paid, payMode, status },
      });
      setShowValidModal(false); triggerSaleSuccess(grandTotal);
      toastMsg.success(status==='crédit'?'Vente en crédit enregistrée !':'Vente enregistrée !');
      resetTicket(); loadData();
    } catch (err) { toastMsg.error('Erreur: '+err.message); }
  }

  function handleSearchKeyDown(e) {
    if (e.key==='ArrowDown') { e.preventDefault(); setHighlightedIndex(i => Math.min(i+1,filteredProds.length-1)); return; }
    if (e.key==='ArrowUp')   { e.preventDefault(); setHighlightedIndex(i => Math.max(i-1,0)); return; }
    if (e.key==='Escape')    { setShowDropdown(false); setHighlightedIndex(-1); return; }
    if (e.key==='Enter')     { e.preventDefault(); const t = highlightedIndex>=0 ? filteredProds[highlightedIndex] : filteredProds[0]; if (t) selectProduct(t); }
  }

  function switchSearchMode(mode) {
    setSearchMode(mode);
    setSearch('');
    setSelectedProduct(null);
    setSelectedCategory('');
    setShowDropdown(false);
    setHighlightedIndex(-1);
    setTimeout(() => searchRef.current?.focus(), 60);
  }

  // Barcode du produit sélectionné
  const selectedBarcode = selectedProduct
    ? (selectedProduct.barcode || (selectedProduct.barcodes && selectedProduct.barcodes[0]) || null)
    : null;

  // Coleurs UI
  const headerBg = C.isLight ? '#FFFFFF' : C.surface;
  const headerBd = C.isLight ? '#E2E8F0' : C.border;
  const rowAlt   = C.isLight ? '#FAFAFA' : '#ffffff05';
  const btnBase  = C.isLight ? '#F8FAFC' : C.card;

  // Couleur du mode de recherche
  const modeColors = { name:'#3B82F6', barcode:'#10B981', category:'#A855F7' };
  const modeColor  = modeColors[searchMode] || C.blue;
  const makeDraftSale = (extra = {}) => ({
    id: Date.now(),
    clientName: client.name,
    clientId: client.id,
    total: totalTTC,
    paid: 0,
    discount,
    status: 'provisoire',
    createdAt: new Date().toISOString(),
    ...extra,
  });
  const draftItems = () => items.map(i => ({ productName: i.name, qty: i.qty, unitPrice: i.sellPrice }));

  // ── Définition des boutons d'action (sidebar droite) ───────────────────────
  const ACTION_BTNS = [
    { icon:'🗑️', label:'Supprimer\nVente',       color:'#EF4444', action:() => setItems([]),             disabled:!hasItems,         section:null },
    { icon:'🧾', label:'Ticket\nAperçu',          color:C.blue,   action:async()=>{ if(!hasItems)return; await printTicket(makeDraftSale(), draftItems()); }, disabled:!hasItems },
    { icon:'📋', label:'BL\nA4',                  color:C.blue,   action:async()=>{ if(!hasItems)return; const cl=client.id?await db.clients.get(client.id).catch(()=>null):null; await printDelivery(makeDraftSale(), draftItems(), cl); }, disabled:!hasItems },
    { icon:'📋', label:'BL\nA5',                  color:C.blue,   action:async()=>{ if(!hasItems)return; const cl=client.id?await db.clients.get(client.id).catch(()=>null):null; await printDelivery(makeDraftSale({formatA5:true}), draftItems(), cl); }, disabled:!hasItems },
    { icon:'📄', label:'Facture\nAperçu',         color:'#8B5CF6', action:async()=>{ if(!hasItems)return; const cl=client.id?await db.clients.get(client.id).catch(()=>null):null; await printInvoice(makeDraftSale(), draftItems(), cl); }, disabled:!hasItems },
    { icon:'📄', label:'Proforma',                 color:'#8B5CF6', action:async()=>{ if(!hasItems)return; const cl=client.id?await db.clients.get(client.id).catch(()=>null):null; await printInvoice(makeDraftSale({proforma:true}), draftItems(), cl); }, disabled:!hasItems },
    { icon:'📊', label:'Liste\nVentes',            color:C.green,  action:() => setShowHistory(true),        disabled:false,         divider:true },
    { icon:'📈', label:'Analyse\nIA',              color:C.amber,  action:() => setShowAIPanel(true),        disabled:false },
    { icon:'⏸️', label:'Mettre\nAttente',          color:C.sub,    action:putOnHold,                         disabled:!hasItems,     divider:true },
    { icon:'📁', label:`Attente\n(${pendingCarts.length})`, color:pendingCarts.length>0?C.amber:C.sub, action:()=>setShowPending(true), disabled:false, badge:pendingCarts.length },
    { icon:'💳', label:'Versement\nClient',        color:C.red,    action:() => setShowUnpaid(true),         disabled:false,         divider:true },
    { icon:'✅', label:'[F8]\nValider',            color:C.green,  action:() => hasItems&&setShowValidModal(true), disabled:!hasItems, isValidate:true },
    { icon:'➕', label:'Nouvelle\nVente',          color:C.blue,   action:resetTicket,                       disabled:false,         isNew:true },
  ];

  return (
    <div style={{ width:'100vw', height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden', background:C.isLight?'#F1F5F9':C.bg, fontFamily:"'Segoe UI',system-ui,sans-serif", color:C.text }}>

      {/* ══════════════════════════════════════════════════════════════════════
          HEADER
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ flexShrink:0, background:headerBg, borderBottom:`2px solid ${headerBd}`, padding:'0 16px', minHeight:98, display:'flex', alignItems:'center', gap:10, boxSizing:'border-box', flexWrap:'wrap' }}>

        {/* CLIENT */}
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <div style={{ width:36, height:36, borderRadius:9, background:`linear-gradient(135deg,${C.violet||'#6D28D9'},${C.purple||'#7C3AED'})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:'#fff' }}>👤</div>
          <div>
            <div style={{ fontSize:8, fontWeight:800, color:C.sub, textTransform:'uppercase', letterSpacing:1, marginBottom:3 }}>CLIENT</div>
            <select value={client.id||'passage'}
              onChange={e => { if(e.target.value==='passage') setClient({name:'Passage',id:null}); else { const s=clients.find(c=>c.id===parseInt(e.target.value)); if(s) setClient({name:s.name,id:s.id}); } }}
              style={{ fontSize:12, border:`2px solid ${headerBd}`, borderRadius:8, padding:'5px 8px', background:C.isLight?'#F8FAFC':C.bg, color:C.text, outline:'none', minWidth:130, fontWeight:700, cursor:'pointer' }}>
              <option value="passage">COMPTOIR</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ width:1, height:42, background:headerBd, flexShrink:0 }}/>

        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <div style={{ width:36, height:36, borderRadius:9, background:`linear-gradient(135deg,${C.green},#059669)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:'#fff' }}>👨‍💼</div>
          <div>
            <div style={{ fontSize:8, fontWeight:800, color:C.sub, textTransform:'uppercase', letterSpacing:1, marginBottom:3 }}>VENDEUR</div>
            <select value={seller.id || 'login'}
              onChange={e => {
                if(e.target.value === 'login') setSeller({ name:user?.name || '', id:null });
                else {
                  const s = employees.find(emp => emp.id === parseInt(e.target.value));
                  if(s) setSeller({ name:s.name, id:s.id });
                }
              }}
              style={{ fontSize:12, border:`2px solid ${headerBd}`, borderRadius:8, padding:'5px 8px', background:C.isLight?'#F8FAFC':C.bg, color:C.text, outline:'none', minWidth:135, fontWeight:700, cursor:'pointer' }}>
              {employees.length === 0 && <option value="login">{user?.name || 'Vendeur'}</option>}
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ width:1, height:42, background:headerBd, flexShrink:0 }}/>

        {/* ZONE RECHERCHE */}
        <div ref={searchContainerRef} style={{ flex:'1 1 auto', maxWidth:500, position:'relative' }}>

          {/* Sélecteur de mode */}
          <div style={{ display:'flex', gap:4, marginBottom:5, alignItems:'center' }}>
            <span style={{ fontSize:9, fontWeight:800, color:C.sub, textTransform:'uppercase', letterSpacing:.8, marginRight:2 }}>Mode:</span>
            {[
              { id:'name',     icon:'🔤', label:'Nom',       hint:'[F1]' },
              { id:'barcode',  icon:'📊', label:'Code-barre', hint:'' },
              { id:'category', icon:'📁', label:'Catégorie',  hint:'' },
            ].map(m => (
              <button key={m.id} onClick={() => switchSearchMode(m.id)} style={{
                display:'flex', alignItems:'center', gap:4,
                padding:'3px 9px', borderRadius:6, border:'none',
                background: searchMode===m.id ? modeColors[m.id] : (C.isLight?'#F1F5F9':C.card),
                color: searchMode===m.id ? '#fff' : C.sub,
                fontSize:10, fontWeight:searchMode===m.id?800:600, cursor:'pointer',
                boxShadow: searchMode===m.id ? `0 2px 8px ${modeColors[m.id]}40` : 'none',
                transition:'all .15s',
              }}>
                <span style={{ fontSize:11 }}>{m.icon}</span>
                {m.label}
                {m.hint && <span style={{ fontSize:8, opacity:.7 }}>{m.hint}</span>}
              </button>
            ))}
          </div>

          {/* Sélecteur de catégorie (mode category) */}
          {searchMode === 'category' && (
            <div style={{ marginBottom:5 }}>
              <select value={selectedCategory}
                onChange={e => { setSelectedCategory(e.target.value); setShowDropdown(true); }}
                style={{ width:'100%', background:C.isLight?'#F5F3FF':'rgba(168,85,247,0.08)', border:`2px solid ${modeColor}40`, borderRadius:9, padding:'7px 11px', color:C.text, fontSize:12, fontWeight:700, outline:'none', cursor:'pointer' }}>
                <option value="">📁 Choisir une catégorie...</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat} ({products.filter(p=>(p.category||'Divers')===cat).length} produits)</option>
                ))}
              </select>
            </div>
          )}

          {/* Input principal */}
          <div style={{ display:'flex', gap:6 }}>
            <div style={{ flex:1, position:'relative' }}>
              {searchMode==='barcode' && (
                <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', fontSize:14, pointerEvents:'none' }}>📊</span>
              )}
              <input ref={searchRef} type={searchMode==='barcode'?'number':'text'}
                placeholder={
                  searchMode==='barcode'   ? 'Scanner ou taper le code-barres...' :
                  searchMode==='category'  ? (selectedCategory ? `Filtrer dans ${selectedCategory}...` : 'Sélectionnez d\'abord une catégorie') :
                  'Rechercher par nom, code-barres, réf...'
                }
                value={search}
                onChange={e => { setSearch(e.target.value); setSelectedProduct(null); setHighlightedIndex(-1); const v=e.target.value.trim(); setShowDropdown(v.length>0||(searchMode==='category'&&!!selectedCategory)); }}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => { if((search.trim().length>0||( searchMode==='category'&&selectedCategory))&&!selectedProduct) setShowDropdown(true); }}
                disabled={searchMode==='category'&&!selectedCategory}
                style={{
                  width:'100%', padding:`8px 11px 8px ${searchMode==='barcode'?'32px':'11px'}`,
                  fontSize:13, fontWeight:selectedProduct?800:500,
                  border:`2px solid ${selectedProduct?C.green:showDropdown&&filteredProds.length>0?modeColor:headerBd}`,
                  borderRadius: showDropdown&&filteredProds.length>0&&!selectedProduct?'9px 9px 0 0':9,
                  outline:'none',
                  background: selectedProduct ? (C.isLight?'#ECFDF5':C.greenLo) : (searchMode==='barcode'?(C.isLight?'#ECFDF5':'rgba(16,185,129,0.08)'):(C.isLight?'#F8FAFC':C.bg)),
                  color: selectedProduct?C.green:C.text,
                  boxSizing:'border-box', transition:'all .15s', fontFamily:'monospace',
                }}/>
            </div>
            <button onClick={() => { setShowNewProduct(true); }} title="Créer un nouveau produit"
              style={{ flexShrink:0, padding:'0 12px', background:`linear-gradient(135deg,${C.blue},${C.violet||'#6366F1'})`, border:'none', borderRadius:9, color:'#fff', fontSize:12, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', gap:5, boxShadow:`0 3px 10px ${C.blue}35`, whiteSpace:'nowrap' }}>
              <span style={{ fontSize:15 }}>📦</span>+ Nouveau
            </button>
          </div>

          {/* Affichage code-barres du produit sélectionné */}
          {selectedProduct && (
            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4, padding:'4px 9px', background:C.isLight?'#ECFDF5':C.greenLo, border:`1px solid ${C.green}30`, borderRadius:7 }}>
              <MiniBarcode code={selectedProduct.barcode || selectedProduct.name} color={C.green} />
              <div>
                <div style={{ fontSize:10, color:C.green, fontWeight:800 }}>✓ {selectedProduct.name}</div>
                <div style={{ fontSize:9, color:C.sub, fontFamily:'monospace' }}>
                  {selectedProduct.barcode ? `|${selectedProduct.barcode}|` : 'Pas de code-barres'}
                  {selectedProduct.ref ? ` · Réf: ${selectedProduct.ref}` : ''}
                </div>
              </div>
              <button onClick={() => { setSelectedProduct(null); setSearch(''); searchRef.current?.focus(); }}
                style={{ marginLeft:'auto', background:C.redLo, border:'none', borderRadius:5, width:18, height:18, cursor:'pointer', color:C.red, fontSize:10, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>
          )}

          {/* Dropdown résultats */}
          {showDropdown && !selectedProduct && filteredProds.length > 0 && (
            <div style={{ position:'absolute', top:'100%', left:0, right:0, background:DS.colors.surface, border:`2px solid ${modeColor}`, borderTop:'none', borderRadius:'0 0 12px 12px', boxShadow:DS.shadows.md, zIndex:DS.zIndex.top, maxHeight:400, overflowY:'auto' }}>
              <div style={{ padding:'4px 13px', background:modeColor+'12', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:10, fontWeight:700, color:modeColor }}>{filteredProds.length} résultat(s) · ↑↓ naviguer · ↵ sélectionner</span>
                {searchMode==='category'&&selectedCategory&&<span style={{ fontSize:9, color:modeColor, fontWeight:700 }}>📁 {selectedCategory}</span>}
              </div>
              {filteredProds.map((p, i) => (
                <SearchDropdownItem key={p.id} product={p} isHighlighted={i===highlightedIndex} index={i} onSelect={selectProduct} onHover={setHighlightedIndex} C={C}/>
              ))}
              <div onClick={() => { setShowDropdown(false); setShowNewProduct(true); }}
                style={{ padding:'9px 13px', cursor:'pointer', background:C.isLight?'#EFF6FF':'rgba(59,130,246,0.08)', borderTop:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:8 }}
                onMouseEnter={e=>{e.currentTarget.style.background=C.accent+'15';}} onMouseLeave={e=>{e.currentTarget.style.background=C.isLight?'#EFF6FF':'rgba(59,130,246,0.08)';}}>
                <span style={{ fontSize:14 }}>📦</span>
                <div><div style={{ fontSize:11, fontWeight:800, color:C.accent }}>Créer «{search||selectedCategory}» comme nouveau produit</div><div style={{ fontSize:9, color:C.sub }}>Ajouter au stock et sélectionner immédiatement</div></div>
              </div>
            </div>
          )}
          {showDropdown && !selectedProduct && filteredProds.length===0 && search.trim().length>0 && (
            <div style={{ position:'absolute', top:'100%', left:0, right:0, background:DS.colors.surface, border:`2px solid ${C.border}`, borderTop:'none', borderRadius:'0 0 10px 10px', boxShadow:DS.shadows.md, zIndex:DS.zIndex.top, overflow:'hidden' }}>
              <div style={{ padding:'10px 13px', textAlign:'center', color:C.muted, fontSize:12 }}>Aucun produit pour «{search}»</div>
              <div onClick={() => { setShowDropdown(false); setShowNewProduct(true); }}
                style={{ padding:'9px 13px', cursor:'pointer', background:C.isLight?'#EFF6FF':C.blueLo, borderTop:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:8 }}
                onMouseEnter={e=>{e.currentTarget.style.background=C.accent+'20';}} onMouseLeave={e=>{e.currentTarget.style.background=C.isLight?'#EFF6FF':C.blueLo;}}>
                <span style={{ fontSize:14 }}>➕</span>
                <div><div style={{ fontSize:11, fontWeight:800, color:C.blue }}>Créer «{search}»</div><div style={{ fontSize:9, color:C.sub }}>Ajouter au stock maintenant</div></div>
              </div>
            </div>
          )}
        </div>

        {/* QTITÉ */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
          <div style={{ fontSize:8, fontWeight:800, color:isRetour?C.amber:C.violet, textTransform:'uppercase', letterSpacing:1, marginBottom:3 }}>{isRetour?'↩ RETOUR':'QTITÉ'}</div>
          <div style={{ display:'flex', alignItems:'center', gap:3, background:isRetour?(C.isLight?'#FFF7ED':C.amberLo):(C.isLight?'#F5F3FF':C.purpleLo||'#2A1060'), border:`2px solid ${isRetour?C.amber+'60':C.violet+'40'}`, borderRadius:9, padding:'3px 6px' }}>
            <button onClick={()=>setQty(q=>q-1)} style={{ width:22,height:22,borderRadius:5,border:`1px solid ${isRetour?C.amber+'50':C.violet+'40'}`,background:'transparent',cursor:'pointer',color:isRetour?C.amber:C.violet,fontSize:15,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center' }}>−</button>
            <input ref={qtyRef} type="number" value={qty} onChange={e=>setQty(Number(e.target.value)||0)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addToCart();}}} onFocus={e=>e.target.select()}
              style={{ width:42,background:'transparent',border:'none',outline:'none',fontSize:19,fontWeight:900,color:isRetour?C.amber:C.violet,textAlign:'center',padding:0 }}/>
            <button onClick={()=>setQty(q=>q+1)} style={{ width:22,height:22,borderRadius:5,border:`1px solid ${isRetour?C.amber+'50':C.violet+'40'}`,background:'transparent',cursor:'pointer',color:isRetour?C.amber:C.violet,fontSize:15,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center' }}>+</button>
          </div>
        </div>

        {/* AJOUTER */}
        <button onClick={addToCart} disabled={!canAdd}
          style={{ padding:'9px 14px', flexShrink:0, background:!canAdd?(C.isLight?'#F1F5F9':C.card):isRetour?`linear-gradient(135deg,${C.amber},#D97706)`:C.green, color:!canAdd?C.muted:'#fff', border:!canAdd?`2px solid ${headerBd}`:'none', borderRadius:10, fontSize:13, fontWeight:900, cursor:canAdd?'pointer':'not-allowed', whiteSpace:'nowrap', boxShadow:canAdd?`0 4px 12px ${isRetour?C.amber:C.green}40`:'none', alignSelf:'flex-end', marginBottom:2 }}>
          {isRetour?'↩ Retour':'+ Ajouter'}
        </button>

        <div style={{ width:1, height:42, background:headerBd, flexShrink:0 }}/>

        {/* REMISE */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
          <div style={{ fontSize:8, fontWeight:800, color:C.amber, textTransform:'uppercase', letterSpacing:1, marginBottom:3 }}>REMISE (DA)</div>
          <input type="number" value={discount} onChange={e=>setDiscount(Number(e.target.value)||0)}
            style={{ width:65, background:C.isLight?'#FFFBEB':C.amberLo, border:`2px solid ${C.amber}40`, borderRadius:9, outline:'none', fontSize:17, fontWeight:900, color:C.amber, textAlign:'center', padding:'5px 3px' }}/>
        </div>

        <div style={{ flex:1 }}/>

        {/* TOTAL + CLOCK */}
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div style={{ fontSize:8, fontWeight:700, color:C.sub, textTransform:'uppercase', letterSpacing:1 }}>TOTAL TTC</div>
          <div style={{ fontSize:30, fontWeight:900, color:C.text, fontFamily:'monospace', lineHeight:1 }}>
            {fmt(totalTTC).replace(' DA','')}<span style={{ fontSize:12, color:C.sub, marginLeft:3 }}>DA</span>
          </div>
        </div>
        <div style={{ width:2, height:42, background:headerBd, flexShrink:0 }}/>
        <LiveClock/>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ZONE PRINCIPALE = CONTENU GAUCHE + SIDEBAR DROITE
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* ── GAUCHE : Upsell + Panier ───────────────────────────────────── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

          <AgentSuggestionPanel
            title="Agent Ventes integre"
            subtitle={agentInsights?.metrics ? `Marge estimee: ${fmt(agentInsights.metrics.profit)}` : 'Analyse panier en direct'}
            compact
            suggestions={[
              ...(agentInsights.alerts || []),
              ...(agentInsights.suggestedDiscount ? [agentInsights.suggestedDiscount] : []),
            ].slice(0, 3)}
            onApply={(item) => {
              if (item.value) {
                setDiscount(item.value);
                toastMsg.success('Suggestion IA appliquee');
              }
            }}
            style={{ margin: '6px 16px 0', flexShrink: 0 }}
          />

          {/* Suggestions Upsell */}
          {suggestions.length > 0 && (
            <div style={{ flexShrink:0, background:C.isLight?'#FFFBEB':C.amberLo, borderBottom:`2px solid ${C.amber}40`, padding:'5px 16px', display:'flex', gap:7, alignItems:'center', overflowX:'auto' }}>
              <span style={{ fontSize:11, fontWeight:800, color:C.amber, flexShrink:0 }}>💡 Souvent achetés ensemble:</span>
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => selectProduct(s.product)}
                  style={{ background:headerBg, border:`2px solid ${C.amber}40`, borderRadius:7, padding:'4px 10px', cursor:'pointer', flexShrink:0, transition:'border-color .12s' }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=C.amber;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.amber+'40';}}>
                  <span style={{ fontSize:11, fontWeight:800, color:C.text }}>+ {s.product.name}</span>
                  <span style={{ fontSize:10, color:C.amber, marginLeft:5 }}>{s.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* PANIER */}
          <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', background:headerBg }}>
            {!hasItems ? (
              <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10 }}>
                <div style={{ fontSize:60, opacity:0.08 }}>🛒</div>
                <div style={{ fontSize:16, fontWeight:800, color:C.muted }}>Panier vide</div>
                <div style={{ fontSize:12, color:C.muted }}>Recherchez et sélectionnez un produit en haut</div>
              </div>
            ) : (
              <div style={{ flex:1, overflowY:'auto' }}>
                {items.some(i=>i.qty<0) && (
                  <div style={{ background:C.amberLo, borderBottom:`1px solid ${C.amber}30`, padding:'5px 20px', fontSize:11, fontWeight:700, color:C.amber }}>
                    ↩ Ce ticket contient des retours
                  </div>
                )}
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead style={{ position:'sticky', top:0, background:C.isLight?'#F8FAFC':C.surface, zIndex:1 }}>
                    <tr style={{ borderBottom:`2px solid ${headerBd}` }}>
                      {['Produit','Code-barres','Prix U.','Qté','Total TTC',''].map((h,idx) => (
                        <th key={idx} style={{ padding:'9px 16px', fontSize:10, fontWeight:900, color:C.sub, textTransform:'uppercase', textAlign:idx>=4?'right':idx===3?'center':'left', letterSpacing:.5 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => {
                      const isRet = item.qty < 0;
                      const bc = item.barcode || (item.barcodes && item.barcodes[0]) || null;
                      return (
                        <tr key={item.id} style={{ borderBottom:`1px solid ${headerBd}`, background:isRet?(C.isLight?'#FFF7ED':C.amberLo+'80'):i%2===0?headerBg:rowAlt }}>
                          <td style={{ padding:'9px 16px', fontSize:13, fontWeight:700, color:C.text }}>
                            {item.name}
                            {isRet && <span style={{ marginLeft:8, fontSize:9, fontWeight:800, color:C.amber, background:C.amberLo, border:`1px solid ${C.amber}40`, borderRadius:5, padding:'1px 6px' }}>↩ Retour</span>}
                          </td>
                          <td style={{ padding:'9px 16px' }}>
                            {bc ? (
                              <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                                <MiniBarcode code={bc} color={C.accent} />
                                <span style={{ fontSize:9, color:C.muted, fontFamily:'monospace' }}>{bc}</span>
                              </div>
                            ) : <span style={{ fontSize:10, color:C.muted }}>—</span>}
                          </td>
                          <td style={{ padding:'9px 16px', fontSize:12, color:C.sub, fontWeight:600 }}>{fmt(item.sellPrice)}</td>
                          <td style={{ padding:'9px 16px', textAlign:'center' }}>
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                              <button onClick={()=>setItems(items.map(x=>x.id===item.id?{...x,qty:x.qty-1}:x).filter(x=>x.qty!==0))} style={{ width:25,height:25,borderRadius:5,border:`1.5px solid ${headerBd}`,background:headerBg,cursor:'pointer',fontWeight:900,color:C.sub,fontSize:13 }}>−</button>
                              <input type="number" value={item.qty} onChange={e=>{const v=Number(e.target.value);if(v===0)setItems(items.filter(x=>x.id!==item.id));else setItems(items.map(x=>x.id===item.id?{...x,qty:v}:x));}}
                                style={{ width:42,background:'transparent',border:`1.5px solid ${isRet?C.amber+'60':headerBd}`,borderRadius:5,outline:'none',fontSize:13,fontWeight:900,color:isRet?C.amber:C.text,textAlign:'center',padding:'2px' }}/>
                              <button onClick={()=>setItems(items.map(x=>x.id===item.id?{...x,qty:x.qty+1}:x))} style={{ width:25,height:25,borderRadius:5,border:`1.5px solid ${C.green}40`,background:C.greenLo,cursor:'pointer',fontWeight:900,color:C.green,fontSize:13 }}>+</button>
                            </div>
                          </td>
                          <td style={{ padding:'9px 16px', fontSize:13, fontWeight:800, color:isRet?C.amber:C.green, textAlign:'right' }}>{fmt(item.sellPrice*item.qty)}</td>
                          <td style={{ padding:'9px 16px', textAlign:'right' }}>
                            <button onClick={()=>setItems(items.filter(x=>x.id!==item.id))} style={{ width:25,height:25,borderRadius:5,background:C.redLo,border:`1.5px solid ${C.red}40`,color:C.red,cursor:'pointer',fontWeight:900,fontSize:11 }}>✕</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* FOOTER */}
          <div style={{ flexShrink:0, background:C.isLight?`linear-gradient(135deg,${C.violet||'#6D28D9'},${C.purple||'#7C3AED'})`:C.violet?`linear-gradient(135deg,${C.violet+'AA'},${C.purple+'AA'})`:'linear-gradient(135deg,#3D1A6E,#4A2080)', padding:'0 16px', height:58, display:'flex', alignItems:'center', justifyContent:'space-between', color:'#fff' }}>
            <div style={{ display:'flex', alignItems:'center', gap:18 }}>
              {[
                { label:'ACHATS',    value:fmt(totalAchats) },
                { label:'VENTES',    value:fmt(total) },
                { label:'REMISE',    value:fmt(discount) },
                { label:'TOTAL TTC', value:fmt(totalTTC), big:true, color:'#FCD34D' },
                { label:'BÉNÉFICE',  value:fmt(benefice), big:true, color:'#4ADE80' },
              ].map(({ label, value, big, color }) => (
                <div key={label} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:8, fontWeight:900, opacity:.7, textTransform:'uppercase', letterSpacing:1.2, marginBottom:1 }}>{label}</div>
                  <div style={{ fontSize:big?18:12, fontWeight:900, fontFamily:'monospace', color:color||'#fff', lineHeight:1 }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,.6)', textAlign:'right' }}>
              {items.length} article(s) · Impayés:&nbsp;
              <span style={{ color:'#FCA5A5', fontWeight:800 }}>{fmt(unpaidSales.reduce((s,v)=>s+Math.max(0,Number(v.total||0)-Number(v.paid||0)),0))}</span>
            </div>
          </div>
        </div>

        {/* ══ SIDEBAR DROITE — Boutons d'action verticaux ═══════════════════ */}
        <div style={{
          width: 102, flexShrink: 0,
          background: C.isLight ? '#FFFFFF' : C.surface,
          borderLeft: `2px solid ${headerBd}`,
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto', overflowX: 'hidden',
          boxShadow: C.isLight ? '-4px 0 16px rgba(0,0,0,0.06)' : '-4px 0 20px rgba(0,0,0,0.3)',
        }}>
          {/* Label sidebar */}
          <div style={{ flexShrink:0, padding:'8px 4px', textAlign:'center', borderBottom:`1px solid ${headerBd}` }}>
            <div style={{ fontSize:8, fontWeight:900, color:C.sub, textTransform:'uppercase', letterSpacing:.8 }}>Actions</div>
          </div>

          <div style={{ flex:1, padding:'6px 5px', display:'flex', flexDirection:'column', gap:4, overflowY:'auto' }}>
            {ACTION_BTNS.map((btn, i) => (
              <div key={i}>
                {btn.divider && <div style={{ height:1, background:headerBd, margin:'3px 4px' }}/>}
                <button
                  onClick={btn.disabled ? undefined : btn.action}
                  title={btn.label.replace('\n', ' ')}
                  style={{
                    width:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
                    padding:'7px 3px', borderRadius:9, border:'none', cursor:btn.disabled?'not-allowed':'pointer',
                    background:
                      btn.isValidate ? (hasItems ? C.green+'18' : (C.isLight?'#F8FAFC':C.card)) :
                      btn.isNew      ? C.blue+'12' :
                      (C.isLight?'#F8FAFC':C.card),
                    outline: btn.isValidate && hasItems ? `2px solid ${C.green}40` : btn.isNew ? `1.5px solid ${C.blue}30` : 'none',
                    opacity: btn.disabled ? 0.3 : 1,
                    transition: 'all .13s',
                    minHeight: 58,
                    position: 'relative',
                  }}
                  onMouseEnter={e => { if (!btn.disabled) { e.currentTarget.style.background = btn.color + '18'; e.currentTarget.style.transform = 'scale(1.03)'; } }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background =
                      btn.isValidate ? (hasItems?C.green+'18':(C.isLight?'#F8FAFC':C.card)) :
                      btn.isNew ? C.blue+'12' : (C.isLight?'#F8FAFC':C.card);
                    e.currentTarget.style.transform = 'none';
                  }}>
                  {btn.badge > 0 && (
                    <div style={{ position:'absolute', top:2, right:4, background:btn.color, color:'#000', fontSize:8, fontWeight:900, borderRadius:10, padding:'1px 5px', minWidth:14, textAlign:'center' }}>
                      {btn.badge}
                    </div>
                  )}
                  {btn.isNew && (
                    <div style={{ position:'absolute', top:2, left:4, background:C.blue, color:'#fff', fontSize:7, fontWeight:900, borderRadius:4, padding:'1px 4px' }}>NEW</div>
                  )}
                  <div style={{ fontSize:20 }}>{btn.icon}</div>
                  <div style={{ fontSize:8.5, fontWeight:800, color:btn.disabled?C.muted:btn.color, whiteSpace:'pre', textAlign:'center', lineHeight:1.3, letterSpacing:.1 }}>
                    {btn.label}
                  </div>
                </button>
              </div>
            ))}
          </div>

          {/* Agent IA en bas */}
          <div style={{ flexShrink:0, padding:'6px 5px', borderTop:`1px solid ${headerBd}` }}>
            <button onClick={() => setShowAIPanel(true)}
              style={{ width:'100%', borderRadius:10, border:'none', padding:'9px 3px', cursor:'pointer', background:`linear-gradient(135deg,${C.blue},${C.violet||'#6366F1'})`, display:'flex', flexDirection:'column', alignItems:'center', gap:3, boxShadow:`0 3px 12px ${C.blue}40` }}>
              <span style={{ fontSize:20 }}>🤖</span>
              <span style={{ fontSize:9, fontWeight:900, color:'#fff', textAlign:'center' }}>Agent IA</span>
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODALES
      ══════════════════════════════════════════════════════════════════════ */}
      {showNewProduct  && <NewProductModal onClose={()=>setShowNewProduct(false)} onSaved={handleProductSaved} C={C}/>}
      {showValidModal  && <ValidationModal totalHT={total} discount={discount} onConfirm={finishSale} onCancel={()=>setShowValidModal(false)} C={C}/>}
      {showPending     && <PendingModal pending={pendingCarts} onRestore={restoreCart} onDelete={deletePending} onClose={()=>setShowPending(false)} C={C}/>}

      {showAIPanel && (
        <AIAgentPanel
          onClose={()=>setShowAIPanel(false)}
          liveData={{products,clients,sales:unpaidSales}}
          userRole="admin"
          defaultAgentId="sales"
          moduleActions={{
            addProductToCart: addProductToCartByAgent,
            applyDiscount: value => setDiscount(Number(value) || 0),
            openValidation: () => { if (hasItems) setShowValidModal(true); },
          }}
        />
      )}

      {showUnpaid && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:DS.zIndex.modal }}>
          <div style={{ background:headerBg, borderRadius:15, width:460, maxHeight:'80vh', overflow:'auto', boxShadow:DS.shadows.lg, border:`1px solid ${headerBd}` }}>
            <div style={{ padding:'15px 19px', borderBottom:`1.5px solid ${C.red}30`, display:'flex', justifyContent:'space-between', alignItems:'center', background:C.redLo }}>
              <h3 style={{ margin:0, color:C.red, fontWeight:900, fontSize:15 }}>🔴 Ventes à crédit ({unpaidSales.length})</h3>
              <button onClick={()=>setShowUnpaid(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:C.red }}>✕</button>
            </div>
            <div style={{ padding:13 }}>
              {unpaidSales.length===0
                ?<div style={{ textAlign:'center', padding:22, color:C.green, fontWeight:800 }}>✅ Aucun impayé !</div>
                :unpaidSales.map(s=>(
                  <div key={s.id} style={{ padding:'9px 12px', marginBottom:6, borderRadius:8, border:`1.5px solid ${C.red}30`, background:C.redLo }}>
                    <div style={{ fontWeight:800, fontSize:13, color:C.text }}>{s.clientName||'Passage'}</div>
                    <div style={{ display:'flex', gap:12, marginTop:3, fontSize:11 }}>
                      <span style={{ color:C.sub }}>Total: {fmt(s.total)}</span>
                      <span style={{ color:C.green, fontWeight:700 }}>Payé: {fmt(s.paid)}</span>
                      <span style={{ color:C.red, fontWeight:800 }}>Reste: {fmt(Number(s.total)-Number(s.paid))}</span>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {showHistory && <DetailedSalesList onClose={()=>setShowHistory(false)} currentClient={client} currentTotal={totalTTC}/>}
      {SaleSuccessOverlay}
    </div>
  );
}
