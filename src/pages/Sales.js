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
import { generateEAN13Barcode, formatDateTime } from '../productUtils';
import ShoppingListModal from '../components/ShoppingListModal';

const CATS  = ['Lubrifiants','Filtres','Ã‰lectrique','Liquides','Distribution','Freinage','Carrosserie','Pneumatiques','Alimentaire','VÃªtements','Ã‰lectronique','Plomberie','Outillage','Divers'];
const UNITS = ['pce','L','kg','m','boÃ®te','carton','sachet','rouleau','paire'];
const PENDING_KEY = 'vp_pending_carts';

function loadPending() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch { return []; }
}
function savePending(list) { localStorage.setItem(PENDING_KEY, JSON.stringify(list)); }

// â”€â”€â”€ Horloge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ SVG Barcode mini affichage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Item dropdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SearchDropdownItem({ product: p, isHighlighted, index, onSelect, onHover, C }) {
  const stockOut  = p.stock === 0;
  const stockLow  = p.stock > 0 && p.stock <= (p.minStock || 5);
  const stockColor = stockOut ? C.red : stockLow ? C.amber : C.green;
  const margin     = p.buyPrice > 0 ? Math.round(((p.sellPrice - p.buyPrice) / p.buyPrice) * 100) : null;
  const barcode    = p.barcode || (p.barcodes && p.barcodes[0]) || null;

  return (
    <div id={`search-item-${index}`}
      onMouseEnter={() => onHover(index)} onMouseLeave={() => onHover(-1)}
      onClick={() => onSelect(p)}
      style={{
        padding: '9px 13px', cursor: 'pointer',
        background: isHighlighted ? C.accentLo : 'transparent',
        borderBottom: `1px solid ${C.border}`,
        opacity: 1,
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <div style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0, background: stockColor + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
          {stockOut ? 'ðŸ“­' : stockLow ? 'âš ï¸' : ''}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 12.5, color: isHighlighted ? C.accent : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{p.name}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 1 }}>
            {p.ref && <span style={{ fontSize: 9, color: C.muted }}>Ref:{p.ref}</span>}
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
          { l: 'Achat', v: p.buyPrice > 0 ? fmt(p.buyPrice) : 'â€”', c: C.red    },
          { l: 'Vente', v: fmt(p.sellPrice),                         c: C.blue   },
          { l: 'S.Gros', v: p.sellPriceSemiGros > 0 ? fmt(p.sellPriceSemiGros) : 'â€”', c: C.purple || '#8B5CF6' },
          { l: 'Gros',  v: p.sellPriceGros > 0     ? fmt(p.sellPriceGros)     : 'â€”', c: C.green  },
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

// â”€â”€â”€ Modal Nouveau Produit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PROD_EMPTY = { name: '', ref: '', category: 'Divers', unit: 'pce', buyPrice: '', sellPrice: '', sellPriceSemiGros: '', sellPriceGros: '', stock: '', minStock: '5', expiry: '', favorite: false, barcode: '' };

function NewProductModal({ onClose, onSaved, C }) {
  const [form, setForm]     = useState(() => ({ ...PROD_EMPTY, barcode: generateEAN13Barcode() }));
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
        barcode: form.barcode || generateEAN13Barcode(), barcodes: [], createdAt: nowISO(), updatedAt: nowISO(),
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
            <span style={{ fontSize:22 }}></span>
            <div>
              <div style={{ fontWeight:900, fontSize:15, color:'#fff' }}>Creer un nouveau produit</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.7)' }}>AjoutÃ© immÃ©diatement au stock</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.2)', border:'none', borderRadius:8, width:28, height:28, color:'#fff', fontSize:17, cursor:'pointer' }}>Ã—</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'18px 20px', display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:12 }}>
            <div>{lbl('Nom *',C.blue)}<input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Ex: Huile Moteur 5W30" style={{...inp,border:`1.5px solid ${C.blue}40`}} onFocus={e=>{e.target.style.borderColor=C.blue;}} onBlur={e=>{e.target.style.borderColor=C.blue+'40';}}/></div>
            <div>{lbl('RefÃ©rence')}<input value={form.ref} onChange={e=>set('ref',e.target.value)} placeholder="HM-001" style={inp}/></div>
            <div>{lbl('UnitÃ©')}<select value={form.unit} onChange={e=>set('unit',e.target.value)} style={inp}>{UNITS.map(u=><option key={u} value={u}>{u}</option>)}</select></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:10, alignItems:'end' }}>
            <div>{lbl('Code-barres',C.green)}<input value={form.barcode} onChange={e=>set('barcode',e.target.value)} placeholder="Code EAN-13" style={{...inp,fontFamily:'monospace'}}/></div>
            <button onClick={()=>set('barcode', generateEAN13Barcode())} style={{ height:36, padding:'0 14px', borderRadius:9, border:`1.5px solid ${C.green}40`, background:C.greenLo, color:C.green, fontSize:12, fontWeight:800, cursor:'pointer' }}>Generer</button>
          </div>
          <div>{lbl('Categorie')}<select value={form.category} onChange={e=>set('category',e.target.value)} style={inp}>{CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div style={{ background:C.isLight?'#F8FAFC':C.card, border:`1.5px solid ${C.border}`, borderRadius:12, padding:'14px 16px' }}>
            <div style={{ fontSize:11, fontWeight:800, color:C.sub, textTransform:'uppercase', letterSpacing:.8, marginBottom:12 }}>ðŸ’° Grille de prix</div>
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
            <div>{lbl('PÃ©remption')}<input type="date" value={form.expiry} onChange={e=>set('expiry',e.target.value)} style={inp}/></div>
          </div>
          {error && <div style={{ background:C.redLo, border:`1.5px solid ${C.red}40`, borderRadius:9, padding:'9px 14px', color:C.red, fontSize:13, fontWeight:600 }}>âš  {error}</div>}
        </div>
        <div style={{ flexShrink:0, padding:'12px 20px', borderTop:`1.5px solid ${C.border}`, display:'flex', gap:10, background:C.isLight?'#fff':C.surface }}>
          <button onClick={onClose} style={{ flex:1, padding:'11px', background:inputBg, border:`2px solid ${bd}`, borderRadius:11, fontSize:13, fontWeight:700, color:C.sub, cursor:'pointer' }}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ flex:2, padding:'11px', background:saving?C.muted:`linear-gradient(135deg,${C.blue},${C.violet||'#6366F1'})`, border:'none', borderRadius:11, fontSize:14, fontWeight:900, color:'#fff', cursor:saving?'not-allowed':'pointer' }}>
            {saving?'â³ Enregistrement...':'âœ… Creer et ajouter au stock'}
          </button>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Modal Validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PAY_MODES = ['EspÃ¨ces', 'Virement', 'ChÃ¨que', 'Ã€ terme'];
const PAY_ICONS = ['ðŸ’µ', 'ðŸ¦', 'ðŸ’³', 'â³'];
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
          <div style={{ display:'flex', alignItems:'center', gap:9 }}><span style={{ fontSize:20 }}>ðŸ§¾</span><div><div style={{ fontWeight:900, fontSize:14, color:'#fff' }}>Valider la vente</div><div style={{ fontSize:10, color:'rgba(255,255,255,.75)' }}>Confirmer le paiement</div></div></div>
          <button onClick={onCancel} style={{ background:'rgba(255,255,255,.2)', border:'none', borderRadius:8, width:28, height:28, color:'#fff', fontSize:17, cursor:'pointer' }}>Ã—</button>
        </div>
        <div style={{ padding:'16px 18px', display:'flex', flexDirection:'column', gap:13 }}>
          <div style={{ background:C.isLight?'#F0FDF4':C.greenLo, border:`1.5px solid ${C.green}40`, borderRadius:11, padding:'11px 14px' }}>
            {(discount>0||tvaRate>0)&&(
              <div style={{ marginBottom:7, display:'flex', flexDirection:'column', gap:3 }}>
                {discount>0&&<div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:C.sub }}><span>Sous-total</span><span style={{ fontFamily:'monospace' }}>{fmt(totalHT)}</span></div>}
                {discount>0&&<div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:C.amber }}><span>Remise</span><span style={{ fontFamily:'monospace' }}>- {fmt(discount)}</span></div>}
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
            <div style={{ fontSize:9, fontWeight:800, color:C.sub, textTransform:'uppercase', letterSpacing:1, marginBottom:5 }}>MONTANT VERSÃ‰ (DA)</div>
            <input ref={paidRef} type="number" value={paidAmount}
              onChange={e=>{setPaidAmount(e.target.value);setUserEdited(true);}}
              onFocus={e=>e.target.select()}
              style={{ width:'100%', padding:'11px 13px', fontSize:24, fontWeight:900, fontFamily:'monospace', textAlign:'center', background:isCredit?(C.isLight?'#FFF7ED':C.amberLo):isOver?(C.isLight?'#ECFDF5':C.greenLo):inputBg, border:`2.5px solid ${isCredit?C.amber:isOver?C.green:C.blue}`, borderRadius:11, color:isCredit?C.amber:isOver?C.green:C.blue, outline:'none', boxSizing:'border-box' }}/>
            {paidAmount!==''&&(
              <div style={{ marginTop:5, display:'flex', justifyContent:'center' }}>
                {isCredit&&<div style={{ background:C.amberLo, border:`1px solid ${C.amber}40`, borderRadius:7, padding:'3px 11px', fontSize:11, fontWeight:700, color:C.amber }}>â³ CrÃ©dit â€” Reste: {fmt(grandTotal-paid)}</div>}
                {isOver&&<div style={{ background:C.greenLo, border:`1px solid ${C.green}40`, borderRadius:7, padding:'3px 11px', fontSize:11, fontWeight:700, color:C.green }}>ðŸ’µ Rendu: {fmt(paid-grandTotal)}</div>}
                {!isCredit&&!isOver&&paid>0&&<div style={{ background:C.greenLo, border:`1px solid ${C.green}40`, borderRadius:7, padding:'3px 11px', fontSize:11, fontWeight:700, color:C.green }}>âœ… Paiement exact</div>}
              </div>
            )}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onCancel} style={{ flex:1, padding:'11px', background:inputBg, border:`2px solid ${bdColor}`, borderRadius:11, fontSize:13, fontWeight:700, color:C.sub, cursor:'pointer' }}>Annuler</button>
            <button onClick={()=>onConfirm({tvaRate,tvaAmount,grandTotal,paid,payMode:PAY_MODES[selectedPay],status:isCredit?'crédit':'payé'})}
              style={{ flex:2, padding:'11px', background:`linear-gradient(135deg,${C.green},#059669)`, border:'none', borderRadius:11, fontSize:13, fontWeight:900, color:'#fff', cursor:'pointer' }}>
              âœ… {isCredit?'Enregistrer en crÃ©dit':'Confirmer la vente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Modal Attente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PendingModal({ pending, onRestore, onDelete, onClose, C }) {
  const cardBg  = C.isLight ? '#fff' : C.card;
  const bd      = C.isLight ? '#E2E8F0' : C.border;
  return (
    <div style={{ position:'fixed', inset:0, zIndex:DS.zIndex.modal+5, background:'rgba(0,0,0,.65)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:C.isLight?'#fff':C.surface, border:`2px solid ${C.sub}40`, borderRadius:20, width:520, maxWidth:'96vw', maxHeight:'80vh', overflow:'hidden', boxShadow:'0 32px 80px rgba(0,0,0,.5)', display:'flex', flexDirection:'column' }}>
        <div style={{ background:`linear-gradient(135deg,${C.sub},#475569)`, padding:'13px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}><span style={{ fontSize:20 }}>ðŸ“</span><div><div style={{ fontWeight:900, fontSize:14, color:'#fff' }}>Paniers en attente</div><div style={{ fontSize:10, color:'rgba(255,255,255,.75)' }}>{pending.length} panier(s)</div></div></div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.2)', border:'none', borderRadius:8, width:28, height:28, color:'#fff', fontSize:17, cursor:'pointer' }}>Ã—</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:16 }}>
          {pending.length===0?(
            <div style={{ textAlign:'center', padding:40, color:C.muted }}><div style={{ fontSize:40, marginBottom:10 }}>ðŸ“­</div><div style={{ fontSize:14, fontWeight:600 }}>Aucun panier en attente</div></div>
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
                {cart.items.slice(0,3).map(i=>`${i.name} Ã—${i.qty}`).join(' - ')}
                {cart.items.length>3&&` â€¦ +${cart.items.length-3}`}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>onRestore(cart)} style={{ flex:2, background:`linear-gradient(135deg,${C.accent},${C.blue})`, border:'none', borderRadius:9, padding:'8px', color:'#000', fontWeight:800, fontSize:12, cursor:'pointer' }}>â†© Restaurer</button>
                <button onClick={()=>onDelete(cart.id)} style={{ flex:1, background:C.redLo, border:`1px solid ${C.red}40`, borderRadius:9, padding:'8px', color:C.red, fontWeight:700, fontSize:12, cursor:'pointer' }}>ðŸ—‘ Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PAGE VENTES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export default function Sales({ user }) {
  const { theme: C } = useTheme();

  const [items,          setItems]          = useState([]);
  const [client,         setClient]         = useState({ name:'Passage', id:null });
  const [discount,       setDiscount]       = useState(0);
  const [products,       setProducts]       = useState([]);
  const [saleItems,      setSaleItems]      = useState([]);
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
  const [showShoppingList, setShowShoppingList] = useState(false);
  const [showTemplates,  setShowTemplates]  = useState(false);
  const [saleTemplates,  setSaleTemplates]  = useState([]);
  const [pendingCarts,   setPendingCarts]   = useState(() => loadPending());
  const [showPending,    setShowPending]    = useState(false);

  // â”€â”€ Recherche â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [searchMode,       setSearchMode]       = useState('name');      // 'name' | 'barcode' | 'category'
  const [search,           setSearch]           = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedProduct,  setSelectedProduct]  = useState(null);
  const [selectedEdit,     setSelectedEdit]     = useState(null);
  const [savingSelected,   setSavingSelected]   = useState(false);
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

  // Categories disponibles depuis le stock
  const categories = useMemo(() => [...new Set(products.map(p => p.category || 'Divers'))].sort(), [products]);

  const productUsage = useMemo(() => {
    const usage = new Map();
    saleItems.forEach(item => {
      const key = item.productId || item.productName;
      if (!key) return;
      const row = usage.get(key) || { qty: 0, count: 0, lastAt: '' };
      row.qty += Math.abs(Number(item.qty || 0));
      row.count += 1;
      row.lastAt = item.createdAt && item.createdAt > row.lastAt ? item.createdAt : row.lastAt;
      usage.set(key, row);
    });
    return usage;
  }, [saleItems]);

  const productSuggestions = useMemo(() => {
    return products
      .map(product => {
        const usage = productUsage.get(product.id) || productUsage.get(product.name) || { qty: 0, count: 0, lastAt: '' };
        return { product, score: usage.qty * 6 + usage.count * 3 + (product.favorite ? 100 : 0) };
      })
      .sort((a, b) => b.score - a.score || String(a.product.name || '').localeCompare(String(b.product.name || '')))
      .map(row => row.product);
  }, [products, productUsage]);

  // â”€â”€ Produits filtrÃ©s selon le mode de recherche â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    // mode 'name' (dÃ©faut)
    if (!search.trim()) return productSuggestions.slice(0, 12);
    return products.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode || '').includes(search) ||
      (p.ref || '').toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => {
      const au = productUsage.get(a.id)?.qty || 0;
      const bu = productUsage.get(b.id)?.qty || 0;
      return bu - au;
    }).slice(0, 12);
  }, [products, productSuggestions, productUsage, search, searchMode, selectedCategory]);

  // â”€â”€ Fermer dropdown au clic extÃ©rieur â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const h = e => { if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) { setShowDropdown(false); setHighlightedIndex(-1); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // â”€â”€ Scroll vers le highlighted item â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (highlightedIndex >= 0) document.getElementById(`search-item-${highlightedIndex}`)?.scrollIntoView({ block:'nearest', behavior:'smooth' });
  }, [highlightedIndex]);

  // â”€â”€ Suggestions upsell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Raccourcis clavier â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const handler = e => {
      if (showValidModal || showNewProduct) return;
      if (e.key === 'F1')                  { e.preventDefault(); searchRef.current?.focus(); return; }
      if ((e.ctrlKey && e.key==='Enter') || e.key==='F8') { e.preventDefault(); if (hasItems && validateCreditPolicy()) setShowValidModal(true); return; }
      if (e.ctrlKey && e.key==='n')        { e.preventDefault(); resetTicket(); toastMsg.info('Nouveau ticket'); return; }
      if (e.ctrlKey && e.key==='h')        { e.preventDefault(); setShowHistory(true); return; }
      if (e.key==='Escape')                { setShowHistory(false); setShowUnpaid(false); setShowDropdown(false); setHighlightedIndex(-1); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasItems, showValidModal, showNewProduct]); // eslint-disable-line

  async function loadData() {
    const [p, si, c, e, u] = await Promise.all([
      db.products.toArray(),
      db.saleItems.toArray().catch(() => []),
      db.clients.toArray(),
      db.employees.toArray().catch(() => []),
      db.sales.where('status').equals('crédit').toArray(),
    ]);
    const activeEmployees = e.filter(emp => emp.active !== false);
    const clientDue = new Map();
    u.forEach(s => clientDue.set(s.clientId, (clientDue.get(s.clientId) || 0) + Math.max(0, Number(s.total || 0) - Number(s.paid || 0))));
    setProducts(p); setSaleItems(si); setClients(c.map(cl => ({ ...cl, totalDue: clientDue.get(cl.id) || 0 }))); setEmployees(activeEmployees); setUnpaidSales(u);
    setSeller(current => {
      if (current.id && activeEmployees.some(emp => emp.id === current.id)) return current;
      const fallback = activeEmployees[0];
      return fallback ? { name: fallback.name, id: fallback.id } : { name: user?.name || '', id: null };
    });
  }
  useEffect(() => { loadData(); }, []); // eslint-disable-line

  function resetTicket() {
    setItems([]); setDiscount(0); setClient({ name:'Passage', id:null });
    setSelectedProduct(null); setSelectedEdit(null); setSearch(''); setQty(1);
  }

  function selectProduct(p) {
    setSelectedProduct(p); setSearch(p.name); setShowDropdown(false); setHighlightedIndex(-1); setQty(1);
    setSelectedEdit({
      name: p.name || '',
      barcode: p.barcode || '',
      stock: Number(p.stock || 0),
      sellPrice: Number(p.sellPrice || 0),
    });
    setTimeout(() => qtyRef.current?.select(), 60);
  }

  async function saveSelectedProductChanges() {
    if (!selectedProduct || !selectedEdit) return;
    if (!selectedEdit.name.trim()) return toastMsg.error('Nom produit requis');
    setSavingSelected(true);
    const current = await db.products.get(selectedProduct.id);
    if (!current) {
      setSavingSelected(false);
      return toastMsg.error('Produit introuvable');
    }
    const now = nowISO();
    const oldStock = Number(current.stock || 0);
    const newStock = Number(selectedEdit.stock || 0);
    const stockHistory = [...(current.stockHistory || [])];
    if (oldStock !== newStock) {
      stockHistory.push({
        at: now,
        before: oldStock,
        after: newStock,
        delta: newStock - oldStock,
        source: 'vente',
        note: 'Modification depuis la caisse avant ajout au panier',
      });
    }
    const modificationHistory = [...(current.modificationHistory || []), {
      at: now,
      source: 'vente',
      changes: {
        name: current.name !== selectedEdit.name.trim() ? { before: current.name, after: selectedEdit.name.trim() } : null,
        barcode: (current.barcode || '') !== selectedEdit.barcode.trim() ? { before: current.barcode || '', after: selectedEdit.barcode.trim() } : null,
        stock: oldStock !== newStock ? { before: oldStock, after: newStock } : null,
        sellPrice: Number(current.sellPrice || 0) !== Number(selectedEdit.sellPrice || 0) ? { before: Number(current.sellPrice || 0), after: Number(selectedEdit.sellPrice || 0) } : null,
      },
    }];
    const patch = {
      name: selectedEdit.name.trim(),
      barcode: selectedEdit.barcode.trim(),
      stock: newStock,
      sellPrice: Number(selectedEdit.sellPrice || 0),
      stockHistory,
      modificationHistory,
      updatedAt: now,
    };
    await db.products.update(selectedProduct.id, patch);
    const updated = { ...current, ...patch };
    setSelectedProduct(updated);
    setProducts(list => list.map(p => p.id === updated.id ? updated : p));
    setItems(list => list.map(item => item.id === updated.id ? { ...item, ...patch } : item));
    setSavingSelected(false);
    toastMsg.success('Produit mis a jour dans le menu Produits');
  }

  function addToCart() {
    if (!selectedProduct) return;
    const p = selectedProduct;
    const q = qty || 1;
    const existing = items.find(x => x.id === p.id);
    const nextQty = Number(existing?.qty || 0) + q;
    if (q > 0 && Number(p.stock || 0) < nextQty) {
      toastMsg.warning(`Stock insuffisant: stock ${p.stock} ${p.unit||'pce'}, vente acceptee avec stock negatif`);
    }
    if (existing) setItems(items.map(x => x.id===p.id ? { ...x, qty:x.qty+q } : x));
    else setItems([...items, { ...p, qty:q }]);
    setSelectedProduct(null); setSelectedEdit(null); setSearch(''); setQty(1);
    searchRef.current?.focus();
  }

  async function addProductToCartByAgent(product, requestedQty = 1) {
    const fresh = await db.products.get(product.id);
    const p = fresh || product;
    const q = Number(requestedQty) || 1;
    if (q > 0 && Number(p.stock || 0) < q) toastMsg.warning(`Stock insuffisant: ${p.stock} ${p.unit || 'pce'}, vente acceptee`);
    setItems(current => {
      const existing = current.find(x => x.id === p.id);
      const nextQty = Number(existing?.qty || 0) + q;
      if (q > 0 && Number(p.stock || 0) < nextQty) toastMsg.warning(`Stock insuffisant: stock negatif apres vente`);
      if (existing) return current.map(x => x.id === p.id ? { ...x, qty: x.qty + q } : x);
      return [...current, { ...p, qty: q }];
    });
    toastMsg.success(q < 0 ? `IA: retour ${Math.abs(q)} x ${p.name}` : `IA: ${q} x ${p.name} ajoute`);
  }

  async function handleProductSaved(newId, newName) {
    await loadData();
    const newProd = await db.products.get(newId);
    if (newProd) { selectProduct(newProd); toastMsg.success(`"${newName}" crÃ©Ã© !`); }
    setShowNewProduct(false);
  }

  function putOnHold() {
    if (!hasItems) return;
    const cart = { id:Date.now(), clientName:client.name, clientId:client.id, items, discount, total:totalTTC, savedAt:new Date().toISOString() };
    const updated = [cart, ...pendingCarts];
    setPendingCarts(updated); savePending(updated); resetTicket();
    toastMsg.info(`Panier mis en attente â€” ${updated.length} en attente`);
  }

  function restoreCart(cart) {
    if (hasItems && !window.confirm('Remplacer le panier actuel ?')) return;
    setItems(cart.items); setClient({ name:cart.clientName||'Passage', id:cart.clientId||null }); setDiscount(cart.discount||0);
    const updated = pendingCarts.filter(c => c.id!==cart.id);
    setPendingCarts(updated); savePending(updated); setShowPending(false);
    toastMsg.success('Panier restaurÃ© !');
  }

  function deletePending(id) {
    const updated = pendingCarts.filter(c => c.id!==id);
    setPendingCarts(updated); savePending(updated);
    if (updated.length===0) setShowPending(false);
  }

  function validateCreditPolicy() {
    if (!client.id) return true;
    const selected = clients.find(c => c.id === client.id);
    const overdue = selected?.creditDueDate && selected.creditDueDate < new Date().toISOString().slice(0, 10) && Number(selected.totalDue || 0) > 0;
    if (!overdue) return true;
    if (selected.creditPolicy === 'block') {
      toastMsg.error(`Credit en retard pour ${selected.name}. Vente bloquee jusqu'a versement.`);
      return false;
    }
    return window.confirm(`Credit en retard pour ${selected.name} (${fmt(selected.totalDue)}). Continuer la vente ?`);
  }

  async function openTemplateModal() {
    const templates = await db.saleTemplates.orderBy('createdAt').reverse().toArray().catch(() => []);
    const enriched = await Promise.all(templates.map(async t => ({
      ...t,
      items: await db.saleTemplateItems.where('templateId').equals(t.id).toArray().catch(() => []),
    })));
    setSaleTemplates(enriched);
    setShowTemplates(true);
  }

  async function saveTemplateFromCart() {
    if (!hasItems) return;
    const name = window.prompt('Nom de la vente standard ?', `Vente standard ${new Date().toLocaleDateString('fr-DZ')}`);
    if (!name) return;
    const id = await db.saleTemplates.add({ name, total: totalTTC, discount, itemCount: items.length, createdAt: nowISO(), updatedAt: nowISO() });
    await db.saleTemplateItems.bulkAdd(items.map(i => ({
      templateId: id, productId: i.id, productName: i.name, qty: i.qty, unitPrice: i.sellPrice, buyPrice: i.buyPrice || 0,
    })));
    toastMsg.success('Vente standard enregistree');
    openTemplateModal();
  }

  async function applyTemplate(tpl) {
    const tplItems = tpl.items || await db.saleTemplateItems.where('templateId').equals(tpl.id).toArray();
    const next = [];
    const missing = [];
    for (const item of tplItems) {
      const p = await db.products.get(item.productId);
      if (!p) { missing.push(item.productName); continue; }
      if (Number(p.stock || 0) < Number(item.qty || 0)) toastMsg.warning(`${item.productName}: stock ${p.stock}/${item.qty}, stock negatif accepte`);
      next.push({ ...p, qty: Number(item.qty || 1), sellPrice: Number(item.unitPrice || p.sellPrice || 0) });
    }
    if (missing.length) alert(`Certains articles ne peuvent pas etre ajoutes:\n- ${missing.join('\n- ')}`);
    if (next.length) setItems(current => [...current, ...next]);
    setDiscount(Number(tpl.discount || 0));
    setShowTemplates(false);
    toastMsg.success('Vente standard ajoutee au panier');
  }

  async function finishSale({ tvaRate, tvaAmount, grandTotal, paid, payMode, status }) {
    if (!hasItems) return;
    if (!validateCreditPolicy()) return;
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

  // Barcode du produit sÃ©lectionnÃ©
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

  // â”€â”€ DÃ©finition des boutons d'action (sidebar droite) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const ACTION_BTNS = [
    { icon:'ðŸ—‘ï¸', label:'Supprimer\nVente',       color:'#EF4444', action:() => setItems([]),             disabled:!hasItems,         section:null },
    { icon:'ðŸ§¾', label:'Ticket\nAperÃ§u',          color:C.blue,   action:async()=>{ if(!hasItems)return; await printTicket(makeDraftSale(), draftItems()); }, disabled:!hasItems },
    { icon:'ðŸ“‹', label:'BL\nA4',                  color:C.blue,   action:async()=>{ if(!hasItems)return; const cl=client.id?await db.clients.get(client.id).catch(()=>null):null; await printDelivery(makeDraftSale(), draftItems(), cl); }, disabled:!hasItems },
    { icon:'ðŸ“‹', label:'BL\nA5',                  color:C.blue,   action:async()=>{ if(!hasItems)return; const cl=client.id?await db.clients.get(client.id).catch(()=>null):null; await printDelivery(makeDraftSale({formatA5:true}), draftItems(), cl); }, disabled:!hasItems },
    { icon:'ðŸ“„', label:'Facture\nAperÃ§u',         color:'#8B5CF6', action:async()=>{ if(!hasItems)return; const cl=client.id?await db.clients.get(client.id).catch(()=>null):null; await printInvoice(makeDraftSale(), draftItems(), cl); }, disabled:!hasItems },
    { icon:'ðŸ“„', label:'Proforma',                 color:'#8B5CF6', action:async()=>{ if(!hasItems)return; const cl=client.id?await db.clients.get(client.id).catch(()=>null):null; await printInvoice(makeDraftSale({proforma:true}), draftItems(), cl); }, disabled:!hasItems },
    { icon:'ðŸ“Š', label:'Liste\nVentes',            color:C.green,  action:() => setShowHistory(true),        disabled:false,         divider:true },
    { icon:'IA', label:'Agent\nIA',                 color:C.blue,   action:() => setShowAIPanel(true),        disabled:false },
    { icon:'LC', label:'Liste\nCourses',            color:C.green,  action:() => setShowShoppingList(true),   disabled:false },
    { icon:'VS', label:'Vente\nStandard',           color:C.violet, action:openTemplateModal,                 disabled:false },
    { icon:'â¸ï¸', label:'Mettre\nAttente',          color:C.sub,    action:putOnHold,                         disabled:!hasItems,     divider:true },
    { icon:'ðŸ“', label:`Attente\n(${pendingCarts.length})`, color:pendingCarts.length>0?C.amber:C.sub, action:()=>setShowPending(true), disabled:false, badge:pendingCarts.length },
    { icon:'ðŸ’³', label:'Versement\nClient',        color:C.red,    action:() => setShowUnpaid(true),         disabled:false,         divider:true },
    { icon:'âœ…', label:'[F8]\nValider',            color:C.green,  action:() => hasItems&&validateCreditPolicy()&&setShowValidModal(true), disabled:!hasItems, isValidate:true },
    { icon:'', label:'Nouvelle\nVente',          color:C.blue,   action:resetTicket,                       disabled:false,         isNew:true },
  ];

  const CLEAN_ACTION_LABELS = [
    'Supprimer\nVente', 'Ticket\nApercu', 'BL\nA4', 'BL\nA5', 'Facture\nApercu', 'Proforma',
    'Liste\nVentes', 'Agent\nIA', 'Liste\nCourses', 'Vente\nStandard', 'Mettre\nAttente',
    `Attente\n(${pendingCarts.length})`, 'Versement\nClient', '[F8]\nValider', 'Nouvelle\nVente',
  ];
  const cleanActionBtns = ACTION_BTNS.map((btn, index) => ({
    ...btn,
    icon: '',
    label: CLEAN_ACTION_LABELS[index] || btn.label,
  }));

  return (
    <div style={{ width:'100vw', height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden', background:C.isLight?'#F1F5F9':C.bg, fontFamily:"'Segoe UI',system-ui,sans-serif", color:C.text }}>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          HEADER
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div style={{ flexShrink:0, background:headerBg, borderBottom:`2px solid ${headerBd}`, padding:'0 16px', minHeight:98, display:'flex', alignItems:'center', gap:10, boxSizing:'border-box', flexWrap:'wrap' }}>

        {/* CLIENT */}
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <div style={{ width:36, height:36, borderRadius:9, background:`linear-gradient(135deg,${C.violet||'#6D28D9'},${C.purple||'#7C3AED'})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:900, color:'#fff' }}>CL</div>
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
          <div style={{ width:36, height:36, borderRadius:9, background:`linear-gradient(135deg,${C.green},#059669)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:900, color:'#fff' }}>VD</div>
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

          {/* SÃ©lecteur de mode */}
          <div style={{ display:'flex', gap:4, marginBottom:5, alignItems:'center' }}>
            <span style={{ fontSize:9, fontWeight:800, color:C.sub, textTransform:'uppercase', letterSpacing:.8, marginRight:2 }}>Mode:</span>
            {[
              { id:'name',     icon:'', label:'Nom',       hint:'[F1]' },
              { id:'barcode',  icon:'', label:'Code-barre', hint:'' },
              { id:'category', icon:'', label:'Categorie',  hint:'' },
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
                {m.icon && <span style={{ fontSize:11 }}>{m.icon}</span>}
                {m.label}
                {m.hint && <span style={{ fontSize:8, opacity:.7 }}>{m.hint}</span>}
              </button>
            ))}
          </div>

          {/* SÃ©lecteur de catÃ©gorie (mode category) */}
          {searchMode === 'category' && (
            <div style={{ marginBottom:5 }}>
              <select value={selectedCategory}
                onChange={e => { setSelectedCategory(e.target.value); setShowDropdown(true); }}
                style={{ width:'100%', background:C.isLight?'#F5F3FF':'rgba(168,85,247,0.08)', border:`2px solid ${modeColor}40`, borderRadius:9, padding:'7px 11px', color:C.text, fontSize:12, fontWeight:700, outline:'none', cursor:'pointer' }}>
                <option value="">Choisir une categorie...</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat} ({products.filter(p=>(p.category||'Divers')===cat).length} produits)</option>
                ))}
              </select>
            </div>
          )}

          {/* Input principal */}
          <div style={{ display:'flex', gap:6 }}>
            <div style={{ flex:1, position:'relative' }}>
              {false && searchMode==='barcode' && (
                <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', fontSize:14, pointerEvents:'none' }} />
              )}
              <input ref={searchRef} type={searchMode==='barcode'?'number':'text'}
                placeholder={
                  searchMode==='barcode'   ? 'Scanner ou taper le code-barres...' :
                  searchMode==='category'  ? (selectedCategory ? `Filtrer dans ${selectedCategory}...` : 'SÃ©lectionnez d\'abord une catÃ©gorie') :
                  'Rechercher par nom, code-barres, ref...'
                }
                value={search}
                onChange={e => { setSearch(e.target.value); setSelectedProduct(null); setSelectedEdit(null); setHighlightedIndex(-1); setShowDropdown(searchMode!=='category'||!!selectedCategory); }}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => { if((searchMode!=='category'||selectedCategory)&&!selectedProduct) setShowDropdown(true); }}
                disabled={searchMode==='category'&&!selectedCategory}
                style={{
                  width:'100%', padding:'8px 11px',
                  fontSize:13, fontWeight:selectedProduct?800:500,
                  border:`2px solid ${selectedProduct?C.green:showDropdown&&filteredProds.length>0?modeColor:headerBd}`,
                  borderRadius: showDropdown&&filteredProds.length>0&&!selectedProduct?'9px 9px 0 0':9,
                  outline:'none',
                  background: selectedProduct ? (C.isLight?'#ECFDF5':C.greenLo) : (searchMode==='barcode'?(C.isLight?'#ECFDF5':'rgba(16,185,129,0.08)'):(C.isLight?'#F8FAFC':C.bg)),
                  color: selectedProduct?C.green:C.text,
                  boxSizing:'border-box', transition:'all .15s', fontFamily:'monospace',
                }}/>
            </div>
            <button onClick={() => { setShowNewProduct(true); }} title="Creer un nouveau produit"
              style={{ flexShrink:0, padding:'0 12px', background:`linear-gradient(135deg,${C.blue},${C.violet||'#6366F1'})`, border:'none', borderRadius:9, color:'#fff', fontSize:12, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', gap:5, boxShadow:`0 3px 10px ${C.blue}35`, whiteSpace:'nowrap' }}>
              + Nouveau
            </button>
          </div>

          {/* Affichage code-barres du produit sÃ©lectionnÃ© */}
          {selectedProduct && (
            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4, padding:'4px 9px', background:C.isLight?'#ECFDF5':C.greenLo, border:`1px solid ${C.green}30`, borderRadius:7 }}>
              <MiniBarcode code={selectedProduct.barcode || selectedProduct.name} color={C.green} />
              <div>
                <div style={{ fontSize:10, color:C.green, fontWeight:800 }}>OK {selectedProduct.name}</div>
                <div style={{ fontSize:9, color:C.sub, fontFamily:'monospace' }}>
                  {selectedProduct.barcode ? `|${selectedProduct.barcode}|` : 'Pas de code-barres'}
                  {selectedProduct.ref ? ` - Ref: ${selectedProduct.ref}` : ''}
                </div>
              </div>
              <button onClick={() => { setSelectedProduct(null); setSelectedEdit(null); setSearch(''); searchRef.current?.focus(); }}
                style={{ marginLeft:'auto', background:C.redLo, border:'none', borderRadius:5, width:18, height:18, cursor:'pointer', color:C.red, fontSize:10, display:'flex', alignItems:'center', justifyContent:'center' }}>Ã—</button>
            </div>
          )}

          {selectedProduct && selectedEdit && (
            <div style={{ marginTop:6, background:C.isLight?'#FFFFFF':C.card, border:`1.5px solid ${C.blue}35`, borderRadius:10, padding:10, boxShadow:C.isLight?'0 6px 18px rgba(15,23,42,.08)':'0 8px 22px rgba(0,0,0,.25)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:8 }}>
                <div style={{ fontSize:12, fontWeight:900, color:C.blue }}>Modifier le produit avant ajout</div>
                <div style={{ fontSize:11, fontWeight:800, color:Number(selectedEdit.stock || 0) < 0 ? C.red : C.sub }}>
                  Cree: {formatDateTime(selectedProduct.createdAt) || '-'} | Modifie: {formatDateTime(selectedProduct.updatedAt) || '-'}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr .7fr .8fr auto', gap:8, alignItems:'end' }}>
                <label style={{ fontSize:10, fontWeight:900, color:C.sub }}>Nom
                  <input value={selectedEdit.name} onChange={e=>setSelectedEdit(f=>({...f,name:e.target.value}))} style={{ width:'100%', marginTop:3, padding:'8px 9px', border:`1.5px solid ${C.border}`, borderRadius:8, color:C.text, background:C.isLight?'#F8FAFC':C.bg, fontSize:13, fontWeight:800, boxSizing:'border-box' }}/>
                </label>
                <label style={{ fontSize:10, fontWeight:900, color:C.sub }}>Code-barres
                  <input value={selectedEdit.barcode} onChange={e=>setSelectedEdit(f=>({...f,barcode:e.target.value}))} style={{ width:'100%', marginTop:3, padding:'8px 9px', border:`1.5px solid ${C.border}`, borderRadius:8, color:C.text, background:C.isLight?'#F8FAFC':C.bg, fontSize:13, fontWeight:800, boxSizing:'border-box' }}/>
                </label>
                <label style={{ fontSize:10, fontWeight:900, color:C.sub }}>Stock
                  <input type="number" value={selectedEdit.stock} onChange={e=>setSelectedEdit(f=>({...f,stock:e.target.value}))} style={{ width:'100%', marginTop:3, padding:'8px 9px', border:`1.5px solid ${Number(selectedEdit.stock || 0)<0?C.red:C.border}`, borderRadius:8, color:Number(selectedEdit.stock || 0)<0?C.red:C.text, background:C.isLight?'#F8FAFC':C.bg, fontSize:13, fontWeight:900, boxSizing:'border-box' }}/>
                </label>
                <label style={{ fontSize:10, fontWeight:900, color:C.sub }}>Prix
                  <input type="number" value={selectedEdit.sellPrice} onChange={e=>setSelectedEdit(f=>({...f,sellPrice:e.target.value}))} style={{ width:'100%', marginTop:3, padding:'8px 9px', border:`1.5px solid ${C.border}`, borderRadius:8, color:C.blue, background:C.isLight?'#F8FAFC':C.bg, fontSize:13, fontWeight:900, boxSizing:'border-box' }}/>
                </label>
                <button onClick={saveSelectedProductChanges} disabled={savingSelected} style={{ height:36, padding:'0 12px', border:'none', borderRadius:8, background:savingSelected?C.muted:C.blue, color:'#fff', fontSize:12, fontWeight:900, cursor:savingSelected?'not-allowed':'pointer' }}>
                  Enregistrer
                </button>
              </div>
              {qty > Number(selectedProduct.stock || 0) && (
                <div style={{ marginTop:8, padding:'7px 9px', borderRadius:8, background:C.amberLo, color:C.amber, fontSize:12, fontWeight:800 }}>
                  Stock depasse: la vente sera acceptee et le stock deviendra {Number(selectedProduct.stock || 0) - Number(qty || 0)}.
                </div>
              )}
            </div>
          )}

          {/* Dropdown resultats */}
          {showDropdown && !selectedProduct && filteredProds.length > 0 && (
            <div style={{ position:'absolute', top:'100%', left:0, right:0, background:DS.colors.surface, border:`2px solid ${modeColor}`, borderTop:'none', borderRadius:'0 0 12px 12px', boxShadow:DS.shadows.md, zIndex:DS.zIndex.top, maxHeight:400, overflowY:'auto' }}>
              <div style={{ padding:'4px 13px', background:modeColor+'12', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:10, fontWeight:700, color:modeColor }}>{filteredProds.length} resultat(s) - â†‘â†“ naviguer - â†µ selectionner</span>
                {searchMode==='category'&&selectedCategory&&<span style={{ fontSize:9, color:modeColor, fontWeight:700 }}>{selectedCategory}</span>}
              </div>
              {filteredProds.map((p, i) => (
                <SearchDropdownItem key={p.id} product={p} isHighlighted={i===highlightedIndex} index={i} onSelect={selectProduct} onHover={setHighlightedIndex} C={C}/>
              ))}
              <div onClick={() => { setShowDropdown(false); setShowNewProduct(true); }}
                style={{ padding:'9px 13px', cursor:'pointer', background:C.isLight?'#EFF6FF':'rgba(59,130,246,0.08)', borderTop:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:8 }}
                onMouseEnter={e=>{e.currentTarget.style.background=C.accent+'15';}} onMouseLeave={e=>{e.currentTarget.style.background=C.isLight?'#EFF6FF':'rgba(59,130,246,0.08)';}}>
                <span style={{ fontSize:14 }}></span>
                <div><div style={{ fontSize:11, fontWeight:800, color:C.accent }}>Creer "{search||selectedCategory}" comme nouveau produit</div><div style={{ fontSize:9, color:C.sub }}>Ajouter au stock et selectionner immÃ©diatement</div></div>
              </div>
            </div>
          )}
          {showDropdown && !selectedProduct && filteredProds.length===0 && search.trim().length>0 && (
            <div style={{ position:'absolute', top:'100%', left:0, right:0, background:DS.colors.surface, border:`2px solid ${C.border}`, borderTop:'none', borderRadius:'0 0 10px 10px', boxShadow:DS.shadows.md, zIndex:DS.zIndex.top, overflow:'hidden' }}>
              <div style={{ padding:'10px 13px', textAlign:'center', color:C.muted, fontSize:12 }}>Aucun produit pour "{search}"</div>
              <div onClick={() => { setShowDropdown(false); setShowNewProduct(true); }}
                style={{ padding:'9px 13px', cursor:'pointer', background:C.isLight?'#EFF6FF':C.blueLo, borderTop:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:8 }}
                onMouseEnter={e=>{e.currentTarget.style.background=C.accent+'20';}} onMouseLeave={e=>{e.currentTarget.style.background=C.isLight?'#EFF6FF':C.blueLo;}}>
                <span style={{ fontSize:14 }}></span>
                <div><div style={{ fontSize:11, fontWeight:800, color:C.blue }}>Creer "{search}"</div><div style={{ fontSize:9, color:C.sub }}>Ajouter au stock maintenant</div></div>
              </div>
            </div>
          )}
        </div>

        {/* QUANTITE */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
          <div style={{ fontSize:8, fontWeight:800, color:isRetour?C.amber:C.violet, textTransform:'uppercase', letterSpacing:1, marginBottom:3 }}>{isRetour?'RETOUR':'QUANTITE'}</div>
          <div style={{ display:'flex', alignItems:'center', gap:3, background:isRetour?(C.isLight?'#FFF7ED':C.amberLo):(C.isLight?'#F5F3FF':C.purpleLo||'#2A1060'), border:`2px solid ${isRetour?C.amber+'60':C.violet+'40'}`, borderRadius:9, padding:'3px 6px' }}>
            <button onClick={()=>setQty(q=>q-1)} style={{ width:22,height:22,borderRadius:5,border:`1px solid ${isRetour?C.amber+'50':C.violet+'40'}`,background:'transparent',cursor:'pointer',color:isRetour?C.amber:C.violet,fontSize:15,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center' }}>-</button>
            <input ref={qtyRef} type="number" value={qty} onChange={e=>setQty(Number(e.target.value)||0)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addToCart();}}} onFocus={e=>e.target.select()}
              style={{ width:42,background:'transparent',border:'none',outline:'none',fontSize:19,fontWeight:900,color:isRetour?C.amber:C.violet,textAlign:'center',padding:0 }}/>
            <button onClick={()=>setQty(q=>q+1)} style={{ width:22,height:22,borderRadius:5,border:`1px solid ${isRetour?C.amber+'50':C.violet+'40'}`,background:'transparent',cursor:'pointer',color:isRetour?C.amber:C.violet,fontSize:15,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center' }}>+</button>
          </div>
        </div>

        {/* AJOUTER */}
        <button onClick={addToCart} disabled={!canAdd}
          style={{ padding:'9px 14px', flexShrink:0, background:!canAdd?(C.isLight?'#F1F5F9':C.card):isRetour?`linear-gradient(135deg,${C.amber},#D97706)`:C.green, color:!canAdd?C.muted:'#fff', border:!canAdd?`2px solid ${headerBd}`:'none', borderRadius:10, fontSize:13, fontWeight:900, cursor:canAdd?'pointer':'not-allowed', whiteSpace:'nowrap', boxShadow:canAdd?`0 4px 12px ${isRetour?C.amber:C.green}40`:'none', alignSelf:'flex-end', marginBottom:2 }}>
          {isRetour?'Retour':'+ Ajouter'}
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

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          ZONE PRINCIPALE = CONTENU GAUCHE + SIDEBAR DROITE
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* â”€â”€ GAUCHE : Upsell + Panier â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
              <span style={{ fontSize:11, fontWeight:800, color:C.amber, flexShrink:0 }}>Souvent achetÃ©s ensemble:</span>
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
                <div style={{ fontSize:40, opacity:0.08, fontWeight:900 }}>PANIER</div>
                <div style={{ fontSize:16, fontWeight:800, color:C.muted }}>Panier vide</div>
                <div style={{ fontSize:12, color:C.muted }}>Recherchez et selectionnez un produit en haut</div>
              </div>
            ) : (
              <div style={{ flex:1, overflowY:'auto' }}>
                {items.some(i=>i.qty<0) && (
                  <div style={{ background:C.amberLo, borderBottom:`1px solid ${C.amber}30`, padding:'5px 20px', fontSize:11, fontWeight:700, color:C.amber }}>
                    â†© Ce ticket contient des retours
                  </div>
                )}
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead style={{ position:'sticky', top:0, background:C.isLight?'#F8FAFC':C.surface, zIndex:1 }}>
                    <tr style={{ borderBottom:`2px solid ${headerBd}` }}>
                      {['Produit','Code-barres','Prix U.','Qte','Total TTC',''].map((h,idx) => (
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
                            {isRet && <span style={{ marginLeft:8, fontSize:9, fontWeight:800, color:C.amber, background:C.amberLo, border:`1px solid ${C.amber}40`, borderRadius:5, padding:'1px 6px' }}>Retour</span>}
                          </td>
                          <td style={{ padding:'9px 16px' }}>
                            {bc ? (
                              <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                                <MiniBarcode code={bc} color={C.accent} />
                                <span style={{ fontSize:9, color:C.muted, fontFamily:'monospace' }}>{bc}</span>
                              </div>
                            ) : <span style={{ fontSize:10, color:C.muted }}>â€”</span>}
                          </td>
                          <td style={{ padding:'9px 16px', fontSize:12, color:C.sub, fontWeight:600 }}>{fmt(item.sellPrice)}</td>
                          <td style={{ padding:'9px 16px', textAlign:'center' }}>
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                              <button onClick={()=>setItems(items.map(x=>x.id===item.id?{...x,qty:x.qty-1}:x).filter(x=>x.qty!==0))} style={{ width:25,height:25,borderRadius:5,border:`1.5px solid ${headerBd}`,background:headerBg,cursor:'pointer',fontWeight:900,color:C.sub,fontSize:13 }}>-</button>
                              <input type="number" value={item.qty} onChange={e=>{const v=Number(e.target.value);if(v===0)setItems(items.filter(x=>x.id!==item.id));else setItems(items.map(x=>x.id===item.id?{...x,qty:v}:x));}}
                                style={{ width:42,background:'transparent',border:`1.5px solid ${isRet?C.amber+'60':headerBd}`,borderRadius:5,outline:'none',fontSize:13,fontWeight:900,color:isRet?C.amber:C.text,textAlign:'center',padding:'2px' }}/>
                              <button onClick={()=>setItems(items.map(x=>x.id===item.id?{...x,qty:x.qty+1}:x))} style={{ width:25,height:25,borderRadius:5,border:`1.5px solid ${C.green}40`,background:C.greenLo,cursor:'pointer',fontWeight:900,color:C.green,fontSize:13 }}>+</button>
                            </div>
                          </td>
                          <td style={{ padding:'9px 16px', fontSize:13, fontWeight:800, color:isRet?C.amber:C.green, textAlign:'right' }}>{fmt(item.sellPrice*item.qty)}</td>
                          <td style={{ padding:'9px 16px', textAlign:'right' }}>
                            <button onClick={()=>setItems(items.filter(x=>x.id!==item.id))} style={{ width:25,height:25,borderRadius:5,background:C.redLo,border:`1.5px solid ${C.red}40`,color:C.red,cursor:'pointer',fontWeight:900,fontSize:11 }}>x</button>
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
                { label:'BÃ‰NÃ‰FICE',  value:fmt(benefice), big:true, color:'#4ADE80' },
              ].map(({ label, value, big, color }) => (
                <div key={label} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:8, fontWeight:900, opacity:.7, textTransform:'uppercase', letterSpacing:1.2, marginBottom:1 }}>{label}</div>
                  <div style={{ fontSize:big?18:12, fontWeight:900, fontFamily:'monospace', color:color||'#fff', lineHeight:1 }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,.6)', textAlign:'right' }}>
              {items.length} article(s) - ImpayÃ©s:&nbsp;
              <span style={{ color:'#FCA5A5', fontWeight:800 }}>{fmt(unpaidSales.reduce((s,v)=>s+Math.max(0,Number(v.total||0)-Number(v.paid||0)),0))}</span>
            </div>
          </div>
        </div>

        {/* â•â• SIDEBAR DROITE â€” Boutons d'action verticaux â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <div style={{
          width: 188, flexShrink: 0,
          background: C.isLight ? '#FFFFFF' : C.surface,
          borderLeft: `2px solid ${headerBd}`,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: C.isLight ? '-4px 0 16px rgba(0,0,0,0.06)' : '-4px 0 20px rgba(0,0,0,0.3)',
        }}>
          {/* Label sidebar */}
          <div style={{ flexShrink:0, padding:'8px 4px', textAlign:'center', borderBottom:`1px solid ${headerBd}` }}>
            <div style={{ fontSize:8, fontWeight:900, color:C.sub, textTransform:'uppercase', letterSpacing:.8 }}>Actions</div>
          </div>

          <div style={{ flex:1, padding:'6px', display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', alignContent:'start', gap:5, overflow:'hidden' }}>
            {cleanActionBtns.map((btn, i) => (
              <div key={i}>
                {btn.divider && <div style={{ height:1, background:headerBd, margin:'2px 4px', gridColumn:'1 / -1' }}/>}
                <button
                  onClick={btn.disabled ? undefined : btn.action}
                  title={btn.label.replace('\n', ' ')}
                  style={{
                    width:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
                    padding:'6px 3px', borderRadius:9, border:'none', cursor:btn.disabled?'not-allowed':'pointer',
                    background:
                      btn.isValidate ? (hasItems ? C.green+'18' : (C.isLight?'#F8FAFC':C.card)) :
                      btn.isNew      ? C.blue+'12' :
                      (C.isLight?'#F8FAFC':C.card),
                    outline: btn.isValidate && hasItems ? `2px solid ${C.green}40` : btn.isNew ? `1.5px solid ${C.blue}30` : 'none',
                    opacity: btn.disabled ? 0.3 : 1,
                    transition: 'all .13s',
                    minHeight: 48,
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
                  {btn.icon && <div style={{ fontSize:17, fontWeight:900, color:btn.disabled?C.muted:btn.color }}>{btn.icon}</div>}
                  <div style={{ fontSize:8, fontWeight:800, color:btn.disabled?C.muted:btn.color, whiteSpace:'pre', textAlign:'center', lineHeight:1.2, letterSpacing:.1 }}>
                    {btn.label}
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          MODALES
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {showNewProduct  && <NewProductModal onClose={()=>setShowNewProduct(false)} onSaved={handleProductSaved} C={C}/>}
      {showShoppingList && <ShoppingListModal onClose={()=>setShowShoppingList(false)} onSaved={loadData} />}
      {showValidModal  && <ValidationModal totalHT={total} discount={discount} onConfirm={finishSale} onCancel={()=>setShowValidModal(false)} C={C}/>}
      {showPending     && <PendingModal pending={pendingCarts} onRestore={restoreCart} onDelete={deletePending} onClose={()=>setShowPending(false)} C={C}/>}

      {showTemplates && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:DS.zIndex.modal }}>
          <div style={{ background:headerBg, borderRadius:15, width:560, maxHeight:'82vh', overflow:'auto', boxShadow:DS.shadows.lg, border:`1px solid ${headerBd}` }}>
            <div style={{ padding:'14px 18px', borderBottom:`1.5px solid ${C.violet}30`, display:'flex', justifyContent:'space-between', alignItems:'center', background:C.violetLo }}>
              <h3 style={{ margin:0, color:C.violet, fontWeight:900, fontSize:15 }}>Ventes standards et devis prets</h3>
              <button onClick={()=>setShowTemplates(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:C.violet }}>x</button>
            </div>
            <div style={{ padding:14 }}>
              <button onClick={saveTemplateFromCart} disabled={!hasItems} style={{ width:'100%', background:hasItems?C.green:C.muted, color:'#fff', border:'none', borderRadius:10, padding:11, fontWeight:900, cursor:hasItems?'pointer':'not-allowed', marginBottom:12 }}>
                Enregistrer le panier actuel comme vente standard
              </button>
              {saleTemplates.length===0 ? (
                <div style={{ textAlign:'center', padding:24, color:C.sub }}>Aucune vente standard enregistree.</div>
              ) : saleTemplates.map(t => (
                <div key={t.id} style={{ border:`1px solid ${C.border}`, borderRadius:10, padding:12, marginBottom:10, background:C.isLight?'#fff':C.card }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:12, alignItems:'center' }}>
                    <div>
                      <div style={{ fontWeight:900, color:C.text }}>{t.name}</div>
                      <div style={{ fontSize:11, color:C.sub }}>{t.items?.length || t.itemCount || 0} articles · {fmt(t.total || 0)}</div>
                    </div>
                    <button onClick={()=>applyTemplate(t)} style={{ background:C.violetLo, border:`1px solid ${C.violet}40`, borderRadius:8, padding:'7px 12px', color:C.violet, fontWeight:800, cursor:'pointer' }}>Ajouter</button>
                  </div>
                  {(t.items || []).slice(0, 4).map(i => <div key={`${t.id}-${i.productId}`} style={{ fontSize:11, color:C.sub, marginTop:4 }}>{i.qty} x {i.productName}</div>)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showAIPanel && (
        <AIAgentPanel
          onClose={()=>setShowAIPanel(false)}
          liveData={{products,clients,sales:unpaidSales}}
          userRole="admin"
          defaultAgentId="sales"
          moduleActions={{
            addProductToCart: addProductToCartByAgent,
            applyDiscount: value => setDiscount(Number(value) || 0),
            openValidation: () => { if (hasItems && validateCreditPolicy()) setShowValidModal(true); },
          }}
        />
      )}

      {showUnpaid && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:DS.zIndex.modal }}>
          <div style={{ background:headerBg, borderRadius:15, width:460, maxHeight:'80vh', overflow:'auto', boxShadow:DS.shadows.lg, border:`1px solid ${headerBd}` }}>
            <div style={{ padding:'15px 19px', borderBottom:`1.5px solid ${C.red}30`, display:'flex', justifyContent:'space-between', alignItems:'center', background:C.redLo }}>
              <h3 style={{ margin:0, color:C.red, fontWeight:900, fontSize:15 }}>ðŸ”´ Ventes Ã  crÃ©dit ({unpaidSales.length})</h3>
              <button onClick={()=>setShowUnpaid(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:C.red }}>x</button>
            </div>
            <div style={{ padding:13 }}>
              {unpaidSales.length===0
                ?<div style={{ textAlign:'center', padding:22, color:C.green, fontWeight:800 }}>âœ… Aucun impayÃ© !</div>
                :unpaidSales.map(s=>(
                  <div key={s.id} style={{ padding:'9px 12px', marginBottom:6, borderRadius:8, border:`1.5px solid ${C.red}30`, background:C.redLo }}>
                    <div style={{ fontWeight:800, fontSize:13, color:C.text }}>{s.clientName||'Passage'}</div>
                    <div style={{ display:'flex', gap:12, marginTop:3, fontSize:11 }}>
                      <span style={{ color:C.sub }}>Total: {fmt(s.total)}</span>
                      <span style={{ color:C.green, fontWeight:700 }}>PayÃ©: {fmt(s.paid)}</span>
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
