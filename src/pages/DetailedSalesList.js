import { useState, useEffect, useMemo, useRef } from 'react';
import { db, fmt, nowISO } from '../db';
import { printTicket, printInvoice, printDelivery } from '../components/Ticket';
import { useTheme } from '../ThemeContext';
import { DS } from '../designSystem';
import AIAgentPanel from '../components/AIAgentPanel';

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

function toInputDate(value) {
  if (!value) return '';
  const [y, m, d] = value.split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function parseInputDate(value) {
  const trimmed = value.trim();
  const fr = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fr) {
    const [, d, m, y] = fr;
    const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : '';
  }
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return iso ? trimmed : '';
}

function HybridDatePicker({ label, value, onChange, C }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(toInputDate(value));
  const baseDate = value ? new Date(`${value}T12:00:00`) : new Date();
  const [cursor, setCursor] = useState(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));

  useEffect(() => {
    setDraft(toInputDate(value));
    if (value) {
      const d = new Date(`${value}T12:00:00`);
      setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }, [value]);

  function commit(nextDraft = draft) {
    const iso = parseInputDate(nextDraft);
    if (iso) onChange(iso);
  }

  function pick(day) {
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(iso);
    setOpen(false);
  }

  const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const start = (new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay() + 6) % 7;
  const cells = Array.from({ length: start + days }, (_, i) => i < start ? null : i - start + 1);
  const selectedDay = value && value.startsWith(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-`)
    ? Number(value.slice(8, 10))
    : null;

  const inputStyle = {
    width: '100%',
    background: C.isLight ? DS.colors.surface : C.card,
    border: `1.5px solid ${open ? DS.colors.primary : C.border}`,
    borderRadius: DS.radius.md,
    padding: '7px 34px 7px 10px',
    color: C.text,
    fontSize: 12,
    outline: 'none',
    fontFamily: 'inherit',
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ fontSize:9, color:P.sub, fontWeight:800, textTransform:'uppercase', marginBottom:3 }}>{label}</div>
      <input
        value={draft}
        onFocus={() => setOpen(true)}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={e => { if (e.key === 'Enter') { commit(); setOpen(false); } }}
        placeholder="JJ/MM/AAAA"
        style={inputStyle}
      />
      <button
        type="button"
        onMouseDown={e => e.preventDefault()}
        onClick={() => setOpen(v => !v)}
        style={{
          position:'absolute', right:5, bottom:5, width:24, height:24,
          border:'none', borderRadius:DS.radius.sm, cursor:'pointer',
          background:DS.colors.primaryLt, color:DS.colors.primary, fontWeight:900,
        }}>
        📅
      </button>
      {open && (
        <div style={{
          position:'absolute', top:'100%', left:0, marginTop:6, zIndex:10020,
          width:230, background:C.surface, border:`1.5px solid ${DS.colors.primary}`,
          borderRadius:DS.radius.md, boxShadow:C.shadow, padding:10, color:C.text,
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>setCursor(new Date(cursor.getFullYear(), cursor.getMonth()-1, 1))}
              style={{ border:'none', background:DS.colors.primaryLt, color:DS.colors.primary, borderRadius:DS.radius.sm, cursor:'pointer', width:28, height:26 }}>‹</button>
            <div style={{ fontSize:12, fontWeight:900, color:C.text }}>
              {cursor.toLocaleDateString('fr-DZ', { month:'long', year:'numeric' })}
            </div>
            <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>setCursor(new Date(cursor.getFullYear(), cursor.getMonth()+1, 1))}
              style={{ border:'none', background:DS.colors.primaryLt, color:DS.colors.primary, borderRadius:DS.radius.sm, cursor:'pointer', width:28, height:26 }}>›</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:3 }}>
            {['L','M','M','J','V','S','D'].map((d, i) => (
              <div key={`${d}${i}`} style={{ textAlign:'center', fontSize:10, fontWeight:900, color:C.sub }}>{d}</div>
            ))}
            {cells.map((day, i) => (
              <button key={i} type="button" disabled={!day} onMouseDown={e=>e.preventDefault()} onClick={()=>day && pick(day)}
                style={{
                  height:26, border:'none', borderRadius:DS.radius.sm,
                  background: day === selectedDay ? DS.colors.primary : day ? (C.isLight ? DS.colors.neutralLt : C.card) : 'transparent',
                  color: day === selectedDay ? '#fff' : C.text,
                  cursor: day ? 'pointer' : 'default', fontWeight:800, fontSize:11,
                }}>
                {day || ''}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
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
  const { theme: C } = useTheme();
  const [sales,      setSales]      = useState([]);
  const [products,   setProducts]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [search,      setSearch]     = useState('');
  const [filter,      setFilter]     = useState('tous');
  const [earliestDate, setEarliestDate] = useState('');
  const [dateFrom,    setDateFrom]   = useState('');
  const [dateTo,      setDateTo]     = useState(() => new Date().toISOString().slice(0, 10));
  const [clientSearch, setClientSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');

  const [prodSearch, setProdSearch] = useState('');
  const [barcode,    setBarcode]    = useState('');
  const [qty,        setQty]        = useState(1);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [selectedAddProductId, setSelectedAddProductId] = useState(null);
  const [highlightedAddProduct, setHighlightedAddProduct] = useState(0);

  const [payModal,   setPayModal]   = useState(null);
  const [confirm,    setConfirm]    = useState(null);
  const [showAIPanel, setShowAIPanel] = useState(false);

  const prodRef = useRef();
  const barcodeRef = useRef();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [v, p] = await Promise.all([
      db.sales.orderBy('createdAt').reverse().toArray(),
      db.products.toArray(),
    ]);
    const enriched = await Promise.all(v.map(async s => {
      const items = await db.saleItems.where('saleId').equals(s.id).toArray();
      return { ...s, items };
    }));
    setSales(enriched);
    setProducts(p);
    const firstChronological = enriched[enriched.length - 1];
    const firstDate = firstChronological?.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10);
    setEarliestDate(firstDate);
    setDateFrom(prev => prev || firstDate);
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
    if (clientSearch) {
      const q = clientSearch.toLowerCase();
      list = list.filter(s => s.clientName?.toLowerCase().includes(q));
    }
    if (productSearch) {
      const q = productSearch.toLowerCase();
      list = list.filter(s => (s.items || []).some(i => i.productName?.toLowerCase().includes(q) || String(i.productId || '').includes(q)));
    }
    if (dateFrom) list = list.filter(s => (s.createdAt || '') >= `${dateFrom}T00:00:00.000Z`);
    if (dateTo) list = list.filter(s => (s.createdAt || '') <= `${dateTo}T23:59:59.999Z`);
    if (filter==='jour')   list = list.filter(s => s.createdAt?.startsWith(today));
    if (filter==='payé')   list = list.filter(s => s.status==='payé');
    if (filter==='crédit') list = list.filter(s => s.status==='crédit');
    return list;
  }, [sales, search, clientSearch, productSearch, dateFrom, dateTo, filter]);

  useEffect(() => {
    if (filtered.length && !filtered.some(s => s.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  useEffect(() => {
    setSelectedItemId(null);
  }, [selectedId]);

  const selected     = sales.find(s => s.id === selectedId);
  const selItems     = selected?.items || [];
  const selectedItem  = selItems.find(i => i.id === selectedItemId) || null;

  const normalize = value => String(value || '').trim().toLowerCase();

  const productUsage = useMemo(() => {
    const usage = new Map();
    sales.forEach(sale => {
      (sale.items || []).forEach(item => {
        const key = item.productId || item.productName;
        if (!key) return;
        const row = usage.get(key) || { qty: 0, count: 0, lastAt: '' };
        row.qty += Math.abs(Number(item.qty || 0));
        row.count += 1;
        if ((sale.createdAt || '') > row.lastAt) row.lastAt = sale.createdAt || '';
        usage.set(key, row);
      });
    });
    return usage;
  }, [sales]);

  const addProductSuggestions = useMemo(() => {
    const qName = normalize(prodSearch);
    const qCode = normalize(barcode);
    const hasQuery = !!qName || !!qCode;
    return products
      .map(product => {
        const usage = productUsage.get(product.id) || productUsage.get(product.name) || { qty: 0, count: 0, lastAt: '' };
        const name = normalize(product.name);
        const ref = normalize(product.ref);
        const codes = [product.barcode, ...(product.barcodes || [])].map(normalize).filter(Boolean);
        const nameMatch = qName && (name.includes(qName) || ref.includes(qName));
        const codeMatch = qCode && (codes.some(code => code.includes(qCode)) || ref.includes(qCode));
        const exactBoost =
          (qName && name.startsWith(qName) ? 500 : 0) +
          (qCode && (codes.some(code => code.startsWith(qCode)) || ref.startsWith(qCode)) ? 700 : 0);
        return { product, usage, match: !hasQuery || nameMatch || codeMatch, score: exactBoost + usage.qty * 6 + usage.count * 3 };
      })
      .filter(row => row.match)
      .sort((a, b) => b.score - a.score || (b.usage.lastAt || '').localeCompare(a.usage.lastAt || '') || (a.product.name || '').localeCompare(b.product.name || ''))
      .slice(0, 8);
  }, [products, productUsage, prodSearch, barcode]);

  const foundProd = useMemo(() => {
    if (selectedAddProductId) return products.find(p => p.id === selectedAddProductId) || null;
    return addProductSuggestions[0]?.product || null;
  }, [selectedAddProductId, products, addProductSuggestions]);

  useEffect(() => {
    setHighlightedAddProduct(0);
  }, [prodSearch, barcode, addProductSuggestions.length]);

  function chooseAddProduct(product) {
    setSelectedAddProductId(product.id);
    setProdSearch(product.name || '');
    setBarcode(product.barcode || product.barcodes?.[0] || '');
    setProductPickerOpen(false);
  }

  function handleAddProductKeyDown(e) {
    if (!productPickerOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) setProductPickerOpen(true);
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedAddProduct(i => Math.min(i + 1, addProductSuggestions.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlightedAddProduct(i => Math.max(i - 1, 0)); }
    if (e.key === 'Escape')    { setProductPickerOpen(false); }
    if (e.key === 'Enter') {
      e.preventDefault();
      const row = addProductSuggestions[highlightedAddProduct] || addProductSuggestions[0];
      if (row) chooseAddProduct(row.product);
    }
  }

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
    await db.transaction('rw', db.sales, db.saleItems, db.products, async () => {
      const items = await db.saleItems.where('saleId').equals(selected.id).toArray();
      for (const item of items) {
        if (!item.productId) continue;
        const product = await db.products.get(item.productId);
        if (product) {
          await db.products.update(item.productId, {
            stock: Number(product.stock || 0) + Number(item.qty || 0),
            updatedAt: nowISO(),
          });
        }
      }
      await db.saleItems.where('saleId').equals(selected.id).delete();
      await db.sales.delete(selected.id);
    });
    setSelectedId(null); setConfirm(null); await load();
  }

  async function recalcSale(saleId) {
    const sale = await db.sales.get(saleId);
    if (!sale) return;
    const items = await db.saleItems.where('saleId').equals(saleId).toArray();
    const subtotal = items.reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.qty || 0), 0);
    const cost = items.reduce((sum, item) => sum + Number(item.buyPrice || 0) * Number(item.qty || 0), 0);
    const discount = Math.min(Number(sale.discount || 0), Math.max(0, subtotal));
    const total = Math.max(0, subtotal - discount + Number(sale.tva || 0));
    const paid = Math.min(Number(sale.paid || 0), total);
    await db.sales.update(saleId, {
      subtotal,
      total,
      paid,
      discount,
      margin: total - cost,
      status: paid >= total && total > 0 ? 'payé' : 'crédit',
      updatedAt: nowISO(),
    });
  }

  async function deleteLastItem() {
    const item = selectedItem || selItems[selItems.length-1];
    if (!selected || !item) return;
    await db.transaction('rw', db.sales, db.saleItems, db.products, async () => {
      await db.saleItems.delete(item.id);
      if (item.productId) {
        const product = await db.products.get(item.productId);
        if (product) await db.products.update(item.productId, { stock: Number(product.stock || 0) + Number(item.qty || 0), updatedAt: nowISO() });
      }
      await recalcSale(selected.id);
    });
    setSelectedItemId(null);
    setConfirm(null); await load();
  }

  async function addProductToSale() {
    if (!selected || !foundProd || !qty) return;
    const addQty = Math.max(1, Number(qty) || 1);
    if (Number(foundProd.stock || 0) < addQty) alert(`Stock insuffisant (${foundProd.stock || 0}). Ajout accepte avec stock negatif.`);
    await db.transaction('rw', db.sales, db.saleItems, db.products, async () => {
      await db.saleItems.add({
        saleId: selected.id,
        productId: foundProd.id,
        productName: foundProd.name,
        qty: addQty,
        buyPrice: Number(foundProd.buyPrice || 0),
        unitPrice: Number(foundProd.sellPrice || 0),
        margin: (Number(foundProd.sellPrice || 0) - Number(foundProd.buyPrice || 0)) * addQty,
        createdAt: nowISO(),
      });
      const before = Number(foundProd.stock || 0);
      const after = before - addQty;
      await db.products.update(foundProd.id, {
        stock: after,
        updatedAt: nowISO(),
        stockHistory: [...(foundProd.stockHistory || []), {
          at: nowISO(),
          before,
          after,
          delta: -addQty,
          source: 'liste_ventes',
          saleId: selected.id,
          note: after < 0 ? 'Ajout vente avec stock negatif' : 'Ajout produit dans vente existante',
        }],
      });
      await recalcSale(selected.id);
    });
    setProdSearch('');
    setBarcode('');
    setSelectedAddProductId(null);
    setProductPickerOpen(false);
    setQty(1);
    await load();
  }

  async function setPaymentStatus(status) {
    if (!selected) return;
    const total = Number(selected.total || 0);
    await db.sales.update(selected.id, {
      status,
      paid: status === 'payé' ? total : Math.min(Number(selected.paid || 0), Math.max(0, total - 1)),
      updatedAt: nowISO(),
    });
    await load();
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
  const TD = (alt=false, extra={}, selected=false) => ({
    padding:'4px 9px', fontSize:12, color:selected && C.isLight ? DS.colors.neutralDk : P.txt,
    background: selected ? (C.isLight ? DS.colors.primaryLt : `${DS.colors.primary}30`) : alt ? '#111827' : 'transparent',
    borderBottom:`1px solid ${selected ? DS.colors.primary : P.bdrLt}`,
    borderRight:`1px solid ${selected ? DS.colors.primaryBd : P.bdrLt}`,
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
      <div style={{ display:'none', background:P.hdr, borderBottom:`2px solid ${P.blueDk}`,
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
                <input ref={prodRef} value={prodSearch} onFocus={()=>setProductPickerOpen(true)} onKeyDown={handleAddProductKeyDown} onChange={e=>{ setProdSearch(e.target.value); setSelectedAddProductId(null); setProductPickerOpen(true); }}
                  placeholder="Rechercher..."
                  style={{ ...inpStyle, flex:1 }}/>
              </div>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <span style={{ fontSize:9, color:P.sub, fontWeight:700, width:90, flexShrink:0 }}>CODE [F2] :</span>
                <input ref={barcodeRef} value={barcode} onFocus={()=>setProductPickerOpen(true)} onKeyDown={handleAddProductKeyDown} onChange={e=>{ setBarcode(e.target.value); setSelectedAddProductId(null); setProductPickerOpen(true); }}
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
              {productPickerOpen && addProductSuggestions.length > 0 && (
                <div style={{ background:P.surface, border:`1px solid ${P.blue}45`, borderRadius:6, overflow:'hidden', maxHeight:190, overflowY:'auto' }}>
                  <div style={{ padding:'4px 8px', fontSize:9, color:P.sub, borderBottom:`1px solid ${P.border}`, fontWeight:800, textTransform:'uppercase' }}>
                    {prodSearch || barcode ? 'Suggestions trouvees' : 'Produits les plus utilises'}
                  </div>
                  {addProductSuggestions.map((row, i) => (
                    <button key={row.product.id} type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>chooseAddProduct(row.product)}
                      style={{ width:'100%', display:'grid', gridTemplateColumns:'1fr auto', gap:8, alignItems:'center', border:'none', borderBottom:`1px solid ${P.border}`, background:i===highlightedAddProduct?P.sel:P.surface, color:P.txt, padding:'6px 8px', cursor:'pointer', textAlign:'left' }}>
                      <span style={{ minWidth:0 }}>
                        <span style={{ display:'block', fontSize:11, fontWeight:900, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.product.name}</span>
                        <span style={{ display:'block', fontSize:9, color:P.sub }}>Stock {row.product.stock || 0} · Utilise {row.usage.qty || 0} fois</span>
                      </span>
                      <span style={{ fontSize:11, color:P.green, fontWeight:900 }}>{fmt(row.product.sellPrice)}</span>
                    </button>
                  ))}
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

        <Btn icon="IA" label={"Agent\nIA"}  color={P.txt} bg={P.cyan+'22'}
          disabled={!selected}
          onClick={()=>setShowAIPanel(true)}/>
        <Btn icon="💳" label={"Versement\nclient"}    color={P.txt} bg={P.cyan+'22'}
          disabled={!selected||selected.status==='payé'}
          onClick={()=>setPayModal(selected)}/>

        <Btn icon="✓" label={"Marquer\npayé"} color={P.green} bg="#14532D"
          disabled={!selected||selected.status==='payé'} onClick={()=>setPaymentStatus('payé')}/>
        <Btn icon="!" label={"Mettre\ncrédit"} color={P.amber} bg="#78350F"
          disabled={!selected||selected.status==='crédit'} onClick={()=>setPaymentStatus('crédit')}/>

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

      <div style={{ background:P.surface, borderBottom:`1px solid ${P.border}`, padding:'8px 12px', display:'grid', gridTemplateColumns:'repeat(5, minmax(120px, 1fr)) auto', gap:8, alignItems:'end', flexShrink:0 }}>
        <HybridDatePicker label="Du" value={dateFrom} C={C} onChange={v=>{ setDateFrom(v); setFilter('tous'); }} />
        <HybridDatePicker label="Au" value={dateTo} C={C} onChange={v=>{ setDateTo(v); setFilter('tous'); }} />
        <div>
          <div style={{ fontSize:9, color:P.sub, fontWeight:800, textTransform:'uppercase', marginBottom:3 }}>Client</div>
          <input value={clientSearch} onChange={e=>setClientSearch(e.target.value)} placeholder="Nom client..." style={{ ...inpStyle, width:'100%' }}/>
        </div>
        <div>
          <div style={{ fontSize:9, color:P.sub, fontWeight:800, textTransform:'uppercase', marginBottom:3 }}>Produit</div>
          <input value={productSearch} onChange={e=>setProductSearch(e.target.value)} placeholder="Nom produit..." style={{ ...inpStyle, width:'100%' }}/>
        </div>
        <div>
          <div style={{ fontSize:9, color:P.sub, fontWeight:800, textTransform:'uppercase', marginBottom:3 }}>Ticket</div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Numero ou client..." style={{ ...inpStyle, width:'100%' }}/>
        </div>
        <button onClick={()=>{ setSearch(''); setClientSearch(''); setProductSearch(''); setDateFrom(earliestDate); setDateTo(new Date().toISOString().slice(0, 10)); setFilter('tous'); }} style={{ background:P.redDk, border:'none', borderRadius:5, color:'#fff', padding:'7px 12px', fontSize:11, fontWeight:800, cursor:'pointer' }}>Reset</button>
      </div>

      {/* MASTER — Tableau ventes */}
      <div style={{ background:'#0B1628', borderBottom:`1px solid ${P.border}`, padding:'7px 12px', display:'grid', gridTemplateColumns:'1.4fr 1fr 72px 1.2fr auto', gap:8, alignItems:'center', flexShrink:0 }}>
        <div style={{ position:'relative' }}>
        <input ref={prodRef} value={prodSearch} onFocus={()=>setProductPickerOpen(true)} onKeyDown={handleAddProductKeyDown} onChange={e=>{ setProdSearch(e.target.value); setSelectedAddProductId(null); setProductPickerOpen(true); }}
          placeholder="Ajouter produit par nom..."
          style={{ ...inpStyle, width:'100%', padding:'7px 10px' }}/>
        {productPickerOpen && addProductSuggestions.length > 0 && (
          <div style={{ position:'absolute', left:0, right:-360, top:'calc(100% + 4px)', zIndex:10030, background:P.surface, border:`1px solid ${P.blue}`, borderRadius:7, boxShadow:'0 18px 50px rgba(0,0,0,.45)', overflow:'hidden', maxHeight:260, overflowY:'auto' }}>
            <div style={{ padding:'6px 10px', background:P.blueHd, color:P.txt, fontSize:10, fontWeight:900, display:'flex', justifyContent:'space-between' }}>
              <span>{prodSearch || barcode ? 'Suggestions produit' : 'Les plus utilises'}</span>
              <span style={{ color:P.sub }}>Entree pour choisir</span>
            </div>
            {addProductSuggestions.map((row, i) => (
              <button key={row.product.id} type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>chooseAddProduct(row.product)}
                style={{ width:'100%', border:'none', borderBottom:`1px solid ${P.border}`, background:i===highlightedAddProduct?P.sel:P.surface, color:P.txt, display:'grid', gridTemplateColumns:'1fr 100px 90px', gap:10, alignItems:'center', padding:'8px 10px', textAlign:'left', cursor:'pointer' }}>
                <span style={{ minWidth:0 }}>
                  <span style={{ display:'block', fontWeight:900, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.product.name}</span>
                  <span style={{ display:'block', color:P.sub, fontSize:10 }}>{row.product.ref || row.product.barcode || 'Sans reference'}</span>
                </span>
                <span style={{ color:Number(row.product.stock || 0) <= 0 ? P.red : P.green, fontSize:11, fontWeight:900 }}>Stock {row.product.stock || 0}</span>
                <span style={{ color:P.blue, fontSize:11, fontWeight:900, textAlign:'right' }}>{fmt(row.product.sellPrice)}</span>
              </button>
            ))}
          </div>
        )}
        </div>
        <input ref={barcodeRef} value={barcode} onFocus={()=>setProductPickerOpen(true)} onKeyDown={handleAddProductKeyDown} onChange={e=>{ setBarcode(e.target.value); setSelectedAddProductId(null); setProductPickerOpen(true); }}
          placeholder="Code-barres / ref..."
          style={{ ...inpStyle, width:'100%', padding:'7px 10px' }}/>
        <input type="number" value={qty} min={1} onChange={e=>setQty(Number(e.target.value)||1)}
          style={{ ...inpStyle, width:'100%', padding:'7px 8px', textAlign:'center', color:P.yellow, fontWeight:900 }}/>
        <div style={{ fontSize:11, fontWeight:800, color:foundProd ? (Number(foundProd.stock||0) <= 0 ? P.red : P.green) : P.sub, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {foundProd ? `${foundProd.name} · Stock ${foundProd.stock || 0} · ${fmt(foundProd.sellPrice)}` : selected ? 'Selectionnez un produit a ajouter a cette vente' : 'Selectionnez une vente'}
        </div>
        <button onClick={addProductToSale} disabled={!selected || !foundProd}
          style={{ background:(!selected||!foundProd)?P.card:P.green, border:`1px solid ${(!selected||!foundProd)?P.border:P.green}`, borderRadius:6, color:'#fff', padding:'8px 13px', fontSize:11, fontWeight:900, cursor:(!selected||!foundProd)?'not-allowed':'pointer', opacity:(!selected||!foundProd)?.45:1 }}>
          + Ajouter
        </button>
      </div>

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
                      background: isSel ? (C.isLight ? DS.colors.primaryLt : `${DS.colors.primary}22`) : i%2===0 ? 'transparent' : P.surface,
                      boxShadow: isSel ? `inset 4px 0 0 ${DS.colors.primary}` : 'none',
                    }}>
                    <td style={TD(i%2!==0,{color:isSel?DS.colors.primary:P.cyan,fontFamily:'monospace',fontWeight:900}, isSel)}>{String(s.id).padStart(4,'0')}</td>
                    <td style={TD(i%2!==0,{fontWeight:800}, isSel)}>{s.clientName||'Passage'}</td>
                    <td style={TD(i%2!==0,{}, isSel)}>{fD(s.createdAt)}</td>
                    <td style={TD(i%2!==0,{}, isSel)}>{fT(s.createdAt)}</td>
                    <td style={TD(i%2!==0,{}, isSel)}>{s.payMode}</td>
                    <td style={TD(i%2!==0,{fontWeight:900,color:isSel?DS.colors.primary:P.blue}, isSel)}>{fmt(s.total)}</td>
                    <td style={TD(i%2!==0,{color:P.green}, isSel)}>{fmt(s.paid)}</td>
                    <td style={TD(i%2!==0,{}, isSel)}>
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
              {selItems.map((item, i) => {
                const isItemSel = item.id === selectedItemId;
                return (
                  <tr key={item.id || i} onClick={()=>setSelectedItemId(item.id)}
                    style={{ cursor:'pointer', background: isItemSel ? (C.isLight ? DS.colors.primaryLt : `${DS.colors.primary}30`) : i % 2 === 0 ? 'transparent' : P.surface }}>
                    <td style={TD(i % 2 !== 0, { fontWeight: isItemSel ? 900 : 600 }, isItemSel)}>{item.productName}</td>
                    <td style={TD(i % 2 !== 0, {}, isItemSel)}>{fmt(item.unitPrice)}</td>
                    <td style={TD(i % 2 !== 0, { color:isItemSel?DS.colors.primary:P.yellow, fontWeight:900 }, isItemSel)}>{item.qty}</td>
                    <td style={TD(i % 2 !== 0, { textAlign: 'right', fontWeight: 900 }, isItemSel)}>{fmt(item.unitPrice * item.qty)}</td>
                  </tr>
                );
              })}
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
      {showAIPanel && (
        <AIAgentPanel
          onClose={()=>setShowAIPanel(false)}
          liveData={{ products, sales, sale:selected, saleItems:selItems }}
          userRole="admin"
          defaultAgentId="sales"
        />
      )}
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
