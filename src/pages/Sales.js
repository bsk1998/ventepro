import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../ThemeContext';
import { db, nowISO, fmt, invalidateCache } from '../db';
import { printTicket, printInvoice, printDelivery } from '../components/Ticket';
import DetailedSalesList from './DetailedSalesList';
import salesAgent from '../components/SalesAgent';
import { useToast, useSaleSuccess } from '../components/Feedback';
import { DS } from '../designSystem';

const CATS  = ['Lubrifiants','Filtres','Électrique','Liquides','Distribution','Freinage','Carrosserie','Pneumatiques','Alimentaire','Vêtements','Électronique','Plomberie','Outillage','Divers'];
const UNITS = ['pce','L','kg','m','boîte','carton','sachet','rouleau','paire'];

// ─── Horloge ─────────────────────────────────────────────────────────────────
function LiveClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id); }, []);
  return (
    <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
      <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>
        {t.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color: '#00C9FF', fontFamily: 'monospace', letterSpacing: 1 }}>
        {t.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
    </div>
  );
}

// ─── Item dropdown enrichi ────────────────────────────────────────────────────
function SearchDropdownItem({ product: p, isHighlighted, index, onSelect, onHover, C }) {
  const stockOut  = p.stock === 0;
  const stockLow  = p.stock > 0 && p.stock <= (p.minStock || 5);
  const stockColor = stockOut ? C.red : stockLow ? C.amber : C.green;
  const margin     = p.buyPrice > 0 ? Math.round(((p.sellPrice - p.buyPrice) / p.buyPrice) * 100) : null;

  return (
    <div id={`search-item-${index}`}
      onMouseEnter={() => onHover(index)} onMouseLeave={() => onHover(-1)}
      onClick={() => !stockOut && onSelect(p)}
      style={{
        padding: '10px 14px', cursor: stockOut ? 'not-allowed' : 'pointer',
        background: isHighlighted ? C.accentLo : 'transparent',
        borderBottom: `1px solid ${C.border}`,
        opacity: stockOut ? 0.5 : 1, transition: DS.transitions.fast,
      }}>

      {/* Ligne 1 : nom + ref + statut stock */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: stockColor + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
            {stockOut ? '📭' : stockLow ? '⚠️' : '📦'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: isHighlighted ? C.accent : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
              {p.name}
            </div>
            {p.ref && <div style={{ fontSize: 10, color: C.muted }}>Réf : {p.ref}</div>}
          </div>
        </div>
        {/* Badge stock */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ background: stockColor + '18', border: `1.5px solid ${stockColor}40`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 800, color: stockColor, whiteSpace: 'nowrap' }}>
            {stockOut ? 'Rupture' : `${p.stock} ${p.unit || 'pce'}`}
          </div>
          {margin !== null && (
            <div style={{ background: margin > 0 ? C.greenLo : C.redLo, border: `1px solid ${margin > 0 ? C.green : C.red}30`, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700, color: margin > 0 ? C.green : C.red }}>
              {margin > 0 ? '+' : ''}{margin}%
            </div>
          )}
        </div>
      </div>

      {/* Ligne 2 : grille de prix */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {/* Prix achat */}
        <div style={{ background: C.isLight ? '#FEF2F2' : C.redLo, border: `1px solid ${C.red}25`, borderRadius: 7, padding: '5px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.red, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }}>Achat</div>
          <div style={{ fontSize: 12, fontWeight: 900, color: C.red, fontFamily: 'monospace' }}>
            {p.buyPrice > 0 ? fmt(p.buyPrice) : <span style={{ color: C.muted }}>—</span>}
          </div>
        </div>

        {/* Prix vente détail */}
        <div style={{ background: C.isLight ? '#EFF6FF' : C.blueLo, border: `1px solid ${C.blue}25`, borderRadius: 7, padding: '5px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }}>Vente</div>
          <div style={{ fontSize: 12, fontWeight: 900, color: C.blue, fontFamily: 'monospace' }}>{fmt(p.sellPrice)}</div>
        </div>

        {/* Prix semi-gros */}
        <div style={{ background: C.isLight ? '#F5F3FF' : C.purpleLo || '#1a0a40', border: `1px solid ${C.purple || C.violet}25`, borderRadius: 7, padding: '5px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.purple || C.violet, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }}>S.Gros</div>
          <div style={{ fontSize: 12, fontWeight: 900, color: p.sellPriceSemiGros > 0 ? (C.purple || C.violet) : C.muted, fontFamily: 'monospace' }}>
            {p.sellPriceSemiGros > 0 ? fmt(p.sellPriceSemiGros) : '—'}
          </div>
        </div>

        {/* Prix gros */}
        <div style={{ background: C.isLight ? '#ECFDF5' : C.greenLo, border: `1px solid ${C.green}25`, borderRadius: 7, padding: '5px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }}>Gros</div>
          <div style={{ fontSize: 12, fontWeight: 900, color: p.sellPriceGros > 0 ? C.green : C.muted, fontFamily: 'monospace' }}>
            {p.sellPriceGros > 0 ? fmt(p.sellPriceGros) : '—'}
          </div>
        </div>
      </div>

      {/* Indicateur clavier */}
      {isHighlighted && (
        <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ background: C.accent + '20', border: `1px solid ${C.accent}40`, borderRadius: 5, padding: '1px 8px', fontSize: 9, fontWeight: 700, color: C.accent }}>↵ Sélectionner</span>
        </div>
      )}
    </div>
  );
}

// ─── Modal Nouveau Produit ────────────────────────────────────────────────────
const PROD_EMPTY = { name: '', ref: '', category: 'Divers', unit: 'pce', buyPrice: '', sellPrice: '', sellPriceSemiGros: '', sellPriceGros: '', stock: '', minStock: '5', expiry: '', favorite: false };

function NewProductModal({ onClose, onSaved, C }) {
  const [form,   setForm]   = useState(PROD_EMPTY);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const margin = form.buyPrice && form.sellPrice && Number(form.buyPrice) > 0
    ? Math.round(((Number(form.sellPrice) - Number(form.buyPrice)) / Number(form.buyPrice)) * 100) : null;

  async function save() {
    if (!form.name.trim())  { setError('Le nom du produit est requis.'); return; }
    if (!form.sellPrice)    { setError('Le prix de vente est requis.'); return; }
    setSaving(true); setError('');
    try {
      const id = await db.products.add({
        name:              form.name.trim(),
        ref:               form.ref.trim(),
        category:          form.category,
        unit:              form.unit,
        buyPrice:          Number(form.buyPrice)          || 0,
        sellPrice:         Number(form.sellPrice)         || 0,
        sellPriceSemiGros: Number(form.sellPriceSemiGros) || 0,
        sellPriceGros:     Number(form.sellPriceGros)     || 0,
        stock:             Number(form.stock)             || 0,
        minStock:          Number(form.minStock)          || 5,
        expiry:            form.expiry || null,
        favorite:          !!form.favorite,
        barcode: '', barcodes: [],
        createdAt: nowISO(), updatedAt: nowISO(),
      });
      onSaved(id, form.name.trim());
    } catch (e) { setError('Erreur : ' + e.message); }
    setSaving(false);
  }

  const headerBd = C.isLight ? '#E2E8F0' : C.border;
  const inputBg  = C.isLight ? '#F8FAFC' : C.bg;
  const inpStyle = {
    width: '100%', padding: '8px 11px', fontSize: 13, fontWeight: 600,
    background: inputBg, border: `1.5px solid ${headerBd}`, borderRadius: 9,
    color: C.text, outline: 'none', boxSizing: 'border-box',
    transition: 'border-color .15s', fontFamily: 'inherit',
  };
  const lbl = (txt, color) => (
    <div style={{ fontSize: 9, fontWeight: 800, color: color || C.sub, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 4 }}>{txt}</div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: DS.zIndex.modal + 20, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.isLight ? '#fff' : C.surface, border: `2px solid ${C.accent}40`, borderRadius: 20, width: 660, maxWidth: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,.6)', animation: 'npUp .22s cubic-bezier(.34,1.56,.64,1)' }}>
        <style>{`@keyframes npUp{from{opacity:0;transform:translateY(20px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>

        {/* Header */}
        <div style={{ background: `linear-gradient(135deg,${C.blue},${C.violet || '#6366F1'})`, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>📦</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15, color: '#fff' }}>Créer un nouveau produit</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>Sera immédiatement ajouté au stock</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 8, width: 28, height: 28, color: '#fff', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Corps scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Nom + Ref + Catégorie */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
            <div>
              {lbl('Nom du produit *', C.blue)}
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Huile Moteur 5W30"
                style={{ ...inpStyle, border: `1.5px solid ${C.blue}40` }}
                onFocus={e => { e.target.style.borderColor = C.blue; }}
                onBlur={e => { e.target.style.borderColor = C.blue + '40'; }} />
            </div>
            <div>
              {lbl('Référence')}
              <input value={form.ref} onChange={e => set('ref', e.target.value)} placeholder="HM-001"
                style={inpStyle}
                onFocus={e => { e.target.style.borderColor = C.accent; }}
                onBlur={e => { e.target.style.borderColor = headerBd; }} />
            </div>
            <div>
              {lbl('Unité')}
              <select value={form.unit} onChange={e => set('unit', e.target.value)} style={inpStyle}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div>
            {lbl('Catégorie')}
            <select value={form.category} onChange={e => set('category', e.target.value)} style={inpStyle}>
              {CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Grille de prix */}
          <div style={{ background: C.isLight ? '#F8FAFC' : C.card, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.sub, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 12 }}>💰 Grille de prix</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>

              {/* Prix achat */}
              <div style={{ background: C.isLight ? '#FEF2F2' : C.redLo, border: `1.5px solid ${C.red}30`, borderRadius: 10, padding: '10px 12px' }}>
                {lbl('Prix achat (DA)', C.red)}
                <input type="number" value={form.buyPrice} onChange={e => set('buyPrice', e.target.value)} placeholder="0"
                  style={{ ...inpStyle, background: 'transparent', border: 'none', fontSize: 16, fontWeight: 900, color: C.red, padding: '4px 0' }}
                  onFocus={e => { e.target.style.outline = 'none'; }} />
              </div>

              {/* Prix vente */}
              <div style={{ background: C.isLight ? '#EFF6FF' : C.blueLo, border: `1.5px solid ${C.blue}30`, borderRadius: 10, padding: '10px 12px' }}>
                {lbl('Prix vente * (DA)', C.blue)}
                <input type="number" value={form.sellPrice} onChange={e => set('sellPrice', e.target.value)} placeholder="0"
                  style={{ ...inpStyle, background: 'transparent', border: 'none', fontSize: 16, fontWeight: 900, color: C.blue, padding: '4px 0' }}
                  onFocus={e => { e.target.style.outline = 'none'; }} />
                {margin !== null && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: margin > 0 ? C.green : C.red, marginTop: 3 }}>
                    Marge : {margin > 0 ? '+' : ''}{margin}%
                  </div>
                )}
              </div>

              {/* Prix semi-gros */}
              <div style={{ background: C.isLight ? '#F5F3FF' : (C.purpleLo || '#1a0a40'), border: `1.5px solid ${(C.purple || C.violet)}30`, borderRadius: 10, padding: '10px 12px' }}>
                {lbl('Semi-gros (DA)', C.purple || C.violet)}
                <input type="number" value={form.sellPriceSemiGros} onChange={e => set('sellPriceSemiGros', e.target.value)} placeholder="0"
                  style={{ ...inpStyle, background: 'transparent', border: 'none', fontSize: 16, fontWeight: 900, color: C.purple || C.violet, padding: '4px 0' }}
                  onFocus={e => { e.target.style.outline = 'none'; }} />
              </div>

              {/* Prix gros */}
              <div style={{ background: C.isLight ? '#ECFDF5' : C.greenLo, border: `1.5px solid ${C.green}30`, borderRadius: 10, padding: '10px 12px' }}>
                {lbl('Gros (DA)', C.green)}
                <input type="number" value={form.sellPriceGros} onChange={e => set('sellPriceGros', e.target.value)} placeholder="0"
                  style={{ ...inpStyle, background: 'transparent', border: 'none', fontSize: 16, fontWeight: 900, color: C.green, padding: '4px 0' }}
                  onFocus={e => { e.target.style.outline = 'none'; }} />
              </div>
            </div>
          </div>

          {/* Stock */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div style={{ background: C.isLight ? '#ECFDF5' : C.greenLo, border: `1.5px solid ${C.green}30`, borderRadius: 10, padding: '10px 12px' }}>
              {lbl('Stock initial', C.green)}
              <input type="number" value={form.stock} onChange={e => set('stock', e.target.value)} placeholder="0"
                style={{ ...inpStyle, background: 'transparent', border: 'none', fontSize: 18, fontWeight: 900, color: C.green, padding: '4px 0' }}
                onFocus={e => { e.target.style.outline = 'none'; }} />
            </div>
            <div style={{ background: C.isLight ? '#FFFBEB' : C.amberLo, border: `1.5px solid ${C.amber}30`, borderRadius: 10, padding: '10px 12px' }}>
              {lbl('Stock minimum', C.amber)}
              <input type="number" value={form.minStock} onChange={e => set('minStock', e.target.value)} placeholder="5"
                style={{ ...inpStyle, background: 'transparent', border: 'none', fontSize: 18, fontWeight: 900, color: C.amber, padding: '4px 0' }}
                onFocus={e => { e.target.style.outline = 'none'; }} />
            </div>
            <div>
              {lbl('Date de péremption')}
              <input type="date" value={form.expiry} onChange={e => set('expiry', e.target.value)}
                style={inpStyle}
                onFocus={e => { e.target.style.borderColor = C.accent; }}
                onBlur={e => { e.target.style.borderColor = headerBd; }} />
            </div>
          </div>

          {/* Favori */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!form.favorite} onChange={e => set('favorite', e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: C.accent }} />
            <span style={{ color: C.sub, fontSize: 13 }}>⭐ Marquer comme produit favori</span>
          </label>

          {error && (
            <div style={{ background: C.redLo, border: `1.5px solid ${C.red}40`, borderRadius: 9, padding: '9px 14px', color: C.red, fontSize: 13, fontWeight: 600 }}>⚠ {error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, padding: '12px 20px', borderTop: `1.5px solid ${C.border}`, display: 'flex', gap: 10, background: C.isLight ? '#fff' : C.surface }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '11px', background: inputBg, border: `2px solid ${headerBd}`, borderRadius: 11, fontSize: 13, fontWeight: 700, color: C.sub, cursor: 'pointer' }}>
            Annuler
          </button>
          <button onClick={save} disabled={saving}
            style={{ flex: 2, padding: '11px', background: saving ? C.muted : `linear-gradient(135deg,${C.blue},${C.violet || '#6366F1'})`, border: 'none', borderRadius: 11, fontSize: 14, fontWeight: 900, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: saving ? 'none' : `0 5px 18px ${C.blue}40`, transition: 'all .15s' }}
            onMouseEnter={e => { if (!saving) e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
            {saving ? '⏳ Enregistrement...' : '✅ Créer et ajouter au stock'}
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
  const [paidAmount,  setPaidAmount]  = useState('');
  const [userEdited,  setUserEdited]  = useState(false);
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
    <div style={{ position: 'fixed', inset: 0, zIndex: DS.zIndex.modal + 10, background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={{ background: C.isLight ? '#fff' : C.surface, border: `2px solid ${C.green}40`, borderRadius: 20, width: 500, maxWidth: '96vw', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,.5)', animation: 'smUp .22s cubic-bezier(.34,1.56,.64,1)' }}>
        <style>{`@keyframes smUp{from{opacity:0;transform:translateY(24px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
        <div style={{ background: `linear-gradient(135deg,${C.green},#059669)`, padding: '13px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 20 }}>🧾</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: 14, color: '#fff' }}>Valider la vente</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.75)' }}>Confirmer le paiement</div>
            </div>
          </div>
          <button onClick={onCancel} style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 8, width: 28, height: 28, color: '#fff', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 13 }}>
          <div style={{ background: C.isLight ? '#F0FDF4' : C.greenLo, border: `1.5px solid ${C.green}40`, borderRadius: 11, padding: '11px 14px' }}>
            {(discount > 0 || tvaRate > 0) && (
              <div style={{ marginBottom: 7, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.sub }}><span>Sous-total</span><span style={{ fontFamily: 'monospace' }}>{fmt(totalHT)}</span></div>}
                {discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.amber }}><span>Remise</span><span style={{ fontFamily: 'monospace' }}>− {fmt(discount)}</span></div>}
                {tvaRate > 0  && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.sub }}><span>TVA {selectedTva}</span><span style={{ fontFamily: 'monospace' }}>+ {fmt(tvaAmount)}</span></div>}
                <div style={{ borderTop: `1px solid ${C.green}30`, marginTop: 3 }} />
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 900, fontSize: 12, color: C.green, textTransform: 'uppercase', letterSpacing: .6 }}>TOTAL TTC</span>
              <span style={{ fontSize: 30, fontWeight: 900, color: C.green, fontFamily: 'monospace' }}>{fmt(grandTotal).replace(' DA', '')} <span style={{ fontSize: 13, color: C.sub }}>DA</span></span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: C.sub, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>TVA</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {TVA_RATES.map(t => (
                <button key={t} onClick={() => { setSelectedTva(t); setUserEdited(false); }}
                  style={{ flex: 1, padding: '7px', borderRadius: 9, border: selectedTva === t ? 'none' : `2px solid ${bdColor}`, background: selectedTva === t ? (C.violet || '#6D28D9') : inputBg, color: selectedTva === t ? '#fff' : C.sub, fontSize: 13, fontWeight: 800, cursor: 'pointer', transition: DS.transitions.fast }}>{t}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: C.sub, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>MODE DE PAIEMENT</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
              {PAY_MODES.map((mode, i) => (
                <button key={i} onClick={() => setSelectedPay(i)}
                  style={{ padding: '7px 3px', borderRadius: 9, border: selectedPay === i ? 'none' : `2px solid ${bdColor}`, background: selectedPay === i ? C.blue : inputBg, color: selectedPay === i ? '#fff' : C.sub, fontSize: 9, fontWeight: 800, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, transition: DS.transitions.fast }}>
                  <span style={{ fontSize: 17 }}>{PAY_ICONS[i]}</span>{mode}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: C.sub, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>MONTANT VERSÉ (DA)</div>
            <input ref={paidRef} type="number" value={paidAmount}
              onChange={e => { setPaidAmount(e.target.value); setUserEdited(true); }}
              onFocus={e => e.target.select()}
              style={{ width: '100%', padding: '11px 13px', fontSize: 24, fontWeight: 900, fontFamily: 'monospace', textAlign: 'center', background: isCredit ? (C.isLight ? '#FFF7ED' : C.amberLo) : isOver ? (C.isLight ? '#ECFDF5' : C.greenLo) : inputBg, border: `2.5px solid ${isCredit ? C.amber : isOver ? C.green : C.blue}`, borderRadius: 11, color: isCredit ? C.amber : isOver ? C.green : C.blue, outline: 'none', boxSizing: 'border-box' }} />
            {paidAmount !== '' && (
              <div style={{ marginTop: 5, display: 'flex', justifyContent: 'center' }}>
                {isCredit && <div style={{ background: C.amberLo, border: `1px solid ${C.amber}40`, borderRadius: 7, padding: '3px 11px', fontSize: 11, fontWeight: 700, color: C.amber }}>⏳ Crédit — Reste : {fmt(grandTotal - paid)}</div>}
                {isOver   && <div style={{ background: C.greenLo, border: `1px solid ${C.green}40`, borderRadius: 7, padding: '3px 11px', fontSize: 11, fontWeight: 700, color: C.green }}>💵 Rendu : {fmt(paid - grandTotal)}</div>}
                {!isCredit && !isOver && paid > 0 && <div style={{ background: C.greenLo, border: `1px solid ${C.green}40`, borderRadius: 7, padding: '3px 11px', fontSize: 11, fontWeight: 700, color: C.green }}>✅ Paiement exact</div>}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onCancel} style={{ flex: 1, padding: '11px', background: inputBg, border: `2px solid ${bdColor}`, borderRadius: 11, fontSize: 13, fontWeight: 700, color: C.sub, cursor: 'pointer' }}>Annuler</button>
            <button onClick={() => onConfirm({ tvaRate, tvaAmount, grandTotal, paid, payMode: PAY_MODES[selectedPay], status: isCredit ? 'crédit' : 'payé' })}
              style={{ flex: 2, padding: '11px', background: `linear-gradient(135deg,${C.green},#059669)`, border: 'none', borderRadius: 11, fontSize: 13, fontWeight: 900, color: '#fff', cursor: 'pointer', boxShadow: `0 5px 16px ${C.green}40` }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
              ✅ {isCredit ? 'Enregistrer en crédit' : 'Confirmer la vente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PAGE VENTES
// ════════════════════════════════════════════════════════════════════════════
export default function Sales() {
  const { theme: C } = useTheme();

  const [items,           setItems]           = useState([]);
  const [client,          setClient]          = useState({ name: 'Passage', id: null });
  const [discount,        setDiscount]        = useState(0);
  const [products,        setProducts]        = useState([]);
  const [clients,         setClients]         = useState([]);
  const [unpaidSales,     setUnpaidSales]     = useState([]);
  const [suggestions,     setSuggestions]     = useState([]);
  const [showUnpaid,      setShowUnpaid]      = useState(false);
  const [showHistory,     setShowHistory]     = useState(false);
  const [showValidModal,  setShowValidModal]  = useState(false);
  const [showNewProduct,  setShowNewProduct]  = useState(false);

  const [search,           setSearch]           = useState('');
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

  useEffect(() => {
    const h = e => { if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) { setShowDropdown(false); setHighlightedIndex(-1); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (highlightedIndex >= 0) document.getElementById(`search-item-${highlightedIndex}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlightedIndex]);

  useEffect(() => {
    if (!hasItems) { setSuggestions([]); return; }
    salesAgent.suggestUpsell(items, client.id).then(setSuggestions).catch(() => {});
  }, [items, client.id]);

  useEffect(() => {
    const handler = e => {
      if (showValidModal || showNewProduct) return;
      if (e.key === 'F1') { e.preventDefault(); searchRef.current?.focus(); return; }
      if ((e.ctrlKey && e.key === 'Enter') || e.key === 'F8') { e.preventDefault(); if (hasItems) setShowValidModal(true); return; }
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); resetTicket(); toastMsg.info('Nouveau ticket'); return; }
      if (e.ctrlKey && e.key === 'h') { e.preventDefault(); setShowHistory(true); return; }
      if (e.key === 'Escape') { setShowHistory(false); setShowUnpaid(false); setShowDropdown(false); setHighlightedIndex(-1); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasItems, showValidModal, showNewProduct]); // eslint-disable-line

  async function loadData() {
    const [p, c, u] = await Promise.all([db.products.toArray(), db.clients.toArray(), db.sales.where('status').equals('crédit').toArray()]);
    setProducts(p); setClients(c); setUnpaidSales(u);
  }
  useEffect(() => { loadData(); }, []);

  function resetTicket() {
    setItems([]); setDiscount(0); setClient({ name: 'Passage', id: null });
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
    if (q > 0 && p.stock < q) { toastMsg.warning(`Stock insuffisant : ${p.stock} ${p.unit || 'pce'}`); return; }
    const existing = items.find(x => x.id === p.id);
    if (existing) setItems(items.map(x => x.id === p.id ? { ...x, qty: x.qty + q } : x));
    else setItems([...items, { ...p, qty: q }]);
    setSelectedProduct(null); setSearch(''); setQty(1);
    searchRef.current?.focus();
  }

  // Callback après création produit
  async function handleProductSaved(newId, newName) {
    await loadData();
    const newProd = await db.products.get(newId);
    if (newProd) {
      selectProduct(newProd);
      toastMsg.success(`"${newName}" créé et sélectionné !`);
    }
    setShowNewProduct(false);
  }

  async function finishSale({ tvaRate, tvaAmount, grandTotal, paid, payMode, status }) {
    if (!hasItems) return;
    try {
      const saleId = await db.sales.add({ clientName: client.name, clientId: client.id, total: grandTotal, subtotal: totalTTC, tva: tvaAmount, tvaRate, paid, discount: Number(discount) || 0, payMode, status, createdAt: nowISO() });
      for (const item of items) {
        await db.saleItems.add({ saleId, productId: item.id, productName: item.name, qty: item.qty, buyPrice: item.buyPrice, unitPrice: item.sellPrice });
        await db.products.update(item.id, { stock: item.stock - item.qty });
      }
      invalidateCache();
      setShowValidModal(false);
      triggerSaleSuccess(grandTotal);
      toastMsg.success(status === 'crédit' ? 'Vente en crédit enregistrée !' : 'Vente enregistrée !');
      resetTicket(); loadData();
    } catch (err) { toastMsg.error('Erreur : ' + err.message); }
  }

  const filteredProds = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode || '').includes(search) ||
    (p.ref || '').toLowerCase().includes(search.toLowerCase())
  ).slice(0, 8);

  function handleSearchKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(i => Math.min(i + 1, filteredProds.length - 1)); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlightedIndex(i => Math.max(i - 1, 0)); return; }
    if (e.key === 'Escape')    { setShowDropdown(false); setHighlightedIndex(-1); return; }
    if (e.key === 'Enter')     { e.preventDefault(); const t = highlightedIndex >= 0 ? filteredProds[highlightedIndex] : filteredProds[0]; if (t) selectProduct(t); }
  }

  const totalAchats = items.reduce((s, i) => s + (i.buyPrice || 0) * i.qty, 0);
  const benefice    = totalTTC - totalAchats;
  const isRetour    = qty < 0;
  const canAdd      = !!selectedProduct;

  const headerBg = C.isLight ? '#FFFFFF' : C.surface;
  const headerBd = C.isLight ? '#E2E8F0' : C.border;
  const rowAlt   = C.isLight ? '#FAFAFA' : '#ffffff05';
  const btnBase  = C.isLight ? '#F8FAFC' : C.card;
  const btnBorder= C.isLight ? '#E2E8F0' : C.border;

  const ACTION_BTNS = [
    { icon: '🗑️', label: 'Supprimer\nVente',    color: '#EF4444', action: () => setItems([]),                                                disabled: !hasItems },
    { icon: '🧾', label: 'Ticket\ncaisse',       color: C.blue,   action: async () => { if (!hasItems) return; await printTicket({ id: Date.now(), clientName: client.name, total: totalTTC, paid: totalTTC, discount, status: 'payé', createdAt: new Date().toISOString() }, items.map(i => ({ productName: i.name, qty: i.qty, unitPrice: i.sellPrice }))); },                   disabled: !hasItems },
    { icon: '📋', label: 'B.Livraison\nA4',      color: C.blue,   action: async () => { if (!hasItems) return; const cl = client.id ? await db.clients.get(client.id).catch(() => null) : null; await printDelivery({ id: Date.now(), clientName: client.name, total: totalTTC, paid: totalTTC, discount, status: 'payé', createdAt: new Date().toISOString() }, items.map(i => ({ productName: i.name, qty: i.qty, unitPrice: i.sellPrice })), cl); }, disabled: !hasItems },
    { icon: '📋', label: 'B.Livraison\nA5',      color: C.blue,   action: async () => { if (!hasItems) return; const cl = client.id ? await db.clients.get(client.id).catch(() => null) : null; await printDelivery({ id: Date.now(), clientName: client.name, total: totalTTC, paid: totalTTC, discount, status: 'payé', createdAt: new Date().toISOString(), formatA5: true }, items.map(i => ({ productName: i.name, qty: i.qty, unitPrice: i.sellPrice })), cl); }, disabled: !hasItems },
    { icon: '📄', label: 'Facture\nA4',          color: C.violet, action: async () => { if (!hasItems) return; const cl = client.id ? await db.clients.get(client.id).catch(() => null) : null; await printInvoice({ id: Date.now(), clientName: client.name, total: totalTTC, paid: totalTTC, discount, status: 'payé', createdAt: new Date().toISOString() }, items.map(i => ({ productName: i.name, qty: i.qty, unitPrice: i.sellPrice })), cl); }, disabled: !hasItems },
    { icon: '📄', label: 'Facture\nProforma',    color: C.violet, action: async () => { if (!hasItems) return; const cl = client.id ? await db.clients.get(client.id).catch(() => null) : null; await printInvoice({ id: Date.now(), clientName: client.name, total: totalTTC, paid: totalTTC, discount, status: 'payé', proforma: true, createdAt: new Date().toISOString() }, items.map(i => ({ productName: i.name, qty: i.qty, unitPrice: i.sellPrice })), cl); }, disabled: !hasItems },
    { icon: '📊', label: 'Liste\nVentes',        color: C.green,  action: () => setShowHistory(true),          disabled: false },
    { icon: '📈', label: 'Analyse\nGlobale',     color: C.amber,  action: null,                                disabled: false },
    { icon: '⏸️', label: 'Mettre\nen attente',   color: C.sub,    action: null,                                disabled: !hasItems },
    { icon: '📁', label: 'Attente\n(0)',         color: C.sub,    action: null,                                disabled: false },
    { icon: '💳', label: 'Versement\nclient',    color: C.red,    action: () => setShowUnpaid(true),           disabled: false, highlight: true },
    { icon: '✅', label: '[F8] Valider',         color: C.green,  action: () => hasItems && setShowValidModal(true), disabled: !hasItems, isValidate: true },
    { icon: '➕', label: 'Nouvelle\nvente',      color: C.blue,   action: resetTicket,                         disabled: false, isNew: true },
  ];

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: C.isLight ? '#F1F5F9' : C.bg, fontFamily: "'Segoe UI', system-ui, sans-serif", color: C.text }}>

      {/* ══ HEADER ══ */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', background: headerBg, borderBottom: `2px solid ${headerBd}`, padding: '0 20px', height: '88px', gap: '10px', boxSizing: 'border-box' }}>

        {/* CLIENT */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 9, background: C.violet || '#6D28D9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, color: '#fff' }}>👤</div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: C.sub, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>CLIENT</div>
            <select value={client.id || 'passage'}
              onChange={e => { if (e.target.value === 'passage') setClient({ name: 'Passage', id: null }); else { const s = clients.find(c => c.id === parseInt(e.target.value)); if (s) setClient({ name: s.name, id: s.id }); } }}
              style={{ fontSize: 12, border: `2px solid ${headerBd}`, borderRadius: 8, padding: '5px 9px', background: C.isLight ? '#F8FAFC' : C.bg, color: C.text, outline: 'none', minWidth: 140, fontWeight: 700, cursor: 'pointer' }}>
              <option value="passage">COMPTOIR</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ width: 1, height: 42, background: headerBd, flexShrink: 0 }} />

        {/* RECHERCHE + BOUTON NOUVEAU PRODUIT */}
        <div ref={searchContainerRef} style={{ flex: '1 1 auto', maxWidth: 460, position: 'relative' }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: C.green, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>PRODUIT [F1] · Nom · Code-barre · Réf</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input ref={searchRef} type="text" placeholder="Rechercher un produit..."
              value={search}
              onChange={e => { setSearch(e.target.value); setSelectedProduct(null); setHighlightedIndex(-1); setShowDropdown(e.target.value.trim().length > 0); }}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => { if (search.trim().length > 0 && !selectedProduct) setShowDropdown(true); }}
              style={{ flex: 1, padding: '8px 12px', fontSize: 13, fontWeight: selectedProduct ? 800 : 500, border: `2px solid ${selectedProduct ? C.green : showDropdown && filteredProds.length > 0 ? C.accent : headerBd}`, borderRadius: showDropdown && filteredProds.length > 0 && !selectedProduct ? '9px 9px 0 0' : 9, outline: 'none', background: selectedProduct ? (C.isLight ? '#ECFDF5' : C.greenLo) : (C.isLight ? '#F8FAFC' : C.bg), color: selectedProduct ? C.green : C.text, boxSizing: 'border-box', transition: 'all .15s' }} />
            {/* Bouton créer nouveau produit */}
            <button onClick={() => setShowNewProduct(true)} title="Créer un nouveau produit"
              style={{ flexShrink: 0, padding: '0 12px', background: `linear-gradient(135deg,${C.blue},${C.violet || '#6366F1'})`, border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, boxShadow: `0 3px 10px ${C.blue}35`, whiteSpace: 'nowrap', transition: 'all .15s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
              <span style={{ fontSize: 15 }}>📦</span>
              <span>+ Nouveau</span>
            </button>
          </div>

          {/* Badge produit sélectionné */}
          {selectedProduct && (
            <div style={{ position: 'absolute', left: 8, top: '55%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 5, pointerEvents: 'none' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.green }}>{fmt(selectedProduct.sellPrice)}</span>
            </div>
          )}
          {selectedProduct && (
            <button onClick={() => { setSelectedProduct(null); setSearch(''); searchRef.current?.focus(); }}
              style={{ position: 'absolute', right: 82, top: '56%', transform: 'translateY(-50%)', background: C.redLo, border: 'none', borderRadius: 5, width: 16, height: 16, cursor: 'pointer', color: C.red, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>×</button>
          )}

          {/* Dropdown enrichi */}
          {showDropdown && !selectedProduct && search.trim().length > 0 && filteredProds.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: DS.colors.surface, border: `2px solid ${C.accent}`, borderTop: 'none', borderRadius: '0 0 12px 12px', boxShadow: DS.shadows.md, zIndex: DS.zIndex.top, maxHeight: 440, overflowY: 'auto' }}>
              <div style={{ padding: '5px 14px', background: C.accent + '12', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.accent }}>{filteredProds.length} résultat(s) · Cliquer pour sélectionner</span>
                <span style={{ fontSize: 9, color: C.muted }}>↑↓ naviguer · ↵ sélectionner</span>
              </div>
              {filteredProds.map((p, i) => (
                <SearchDropdownItem key={p.id} product={p} isHighlighted={i === highlightedIndex} index={i} onSelect={selectProduct} onHover={setHighlightedIndex} C={C} />
              ))}
              {/* Option créer au bas du dropdown */}
              <div onClick={() => { setShowDropdown(false); setShowNewProduct(true); }}
                style={{ padding: '10px 14px', cursor: 'pointer', background: C.isLight ? '#F5F3FF' : C.purpleLo || '#1a0a40', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}
                onMouseEnter={e => { e.currentTarget.style.background = C.accent + '15'; }}
                onMouseLeave={e => { e.currentTarget.style.background = C.isLight ? '#F5F3FF' : (C.purpleLo || '#1a0a40'); }}>
                <span style={{ fontSize: 16 }}>📦</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.accent }}>Créer «{search}» comme nouveau produit</div>
                  <div style={{ fontSize: 10, color: C.sub }}>Ajouter au stock et sélectionner immédiatement</div>
                </div>
              </div>
            </div>
          )}
          {showDropdown && !selectedProduct && search.trim().length > 0 && filteredProds.length === 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: DS.colors.surface, border: `2px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 10px 10px', boxShadow: DS.shadows.md, zIndex: DS.zIndex.top, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', textAlign: 'center', color: C.muted, fontSize: 12 }}>Aucun produit pour «{search}»</div>
              <div onClick={() => { setShowDropdown(false); setShowNewProduct(true); }}
                style={{ padding: '10px 14px', cursor: 'pointer', background: C.isLight ? '#EFF6FF' : C.blueLo, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}
                onMouseEnter={e => { e.currentTarget.style.background = C.accent + '20'; }}
                onMouseLeave={e => { e.currentTarget.style.background = C.isLight ? '#EFF6FF' : C.blueLo; }}>
                <span style={{ fontSize: 16 }}>➕</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.blue }}>Créer «{search}» comme nouveau produit</div>
                  <div style={{ fontSize: 10, color: C.sub }}>Ajouter au stock maintenant</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* QTITÉ */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: isRetour ? C.amber : C.violet, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>{isRetour ? '↩ RETOUR' : 'QTITÉ'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: isRetour ? (C.isLight ? '#FFF7ED' : C.amberLo) : (C.isLight ? '#F5F3FF' : C.purpleLo || '#2A1060'), border: `2px solid ${isRetour ? C.amber + '60' : C.isLight ? '#DDD6FE' : C.violet + '40'}`, borderRadius: 9, padding: '4px 7px', transition: 'all .15s' }}>
            <button onClick={() => setQty(q => q - 1)} style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${isRetour ? C.amber + '50' : C.violet + '40'}`, background: 'transparent', cursor: 'pointer', color: isRetour ? C.amber : C.violet, fontSize: 15, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
            <input ref={qtyRef} type="number" value={qty}
              onChange={e => setQty(Number(e.target.value) || 0)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addToCart(); } }}
              onFocus={e => e.target.select()}
              style={{ width: 44, background: 'transparent', border: 'none', outline: 'none', fontSize: 19, fontWeight: 900, color: isRetour ? C.amber : C.violet, textAlign: 'center', padding: 0 }} />
            <button onClick={() => setQty(q => q + 1)} style={{ width: 22, height: 22, borderRadius: 5, border: `1px solid ${isRetour ? C.amber + '50' : C.violet + '40'}`, background: 'transparent', cursor: 'pointer', color: isRetour ? C.amber : C.violet, fontSize: 15, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
          </div>
        </div>

        {/* BOUTON AJOUTER */}
        <button onClick={addToCart} disabled={!canAdd}
          style={{ padding: '9px 14px', flexShrink: 0, background: !canAdd ? (C.isLight ? '#F1F5F9' : C.card) : isRetour ? `linear-gradient(135deg,${C.amber},#D97706)` : C.green, color: !canAdd ? C.muted : '#fff', border: !canAdd ? `2px solid ${headerBd}` : 'none', borderRadius: 10, fontSize: 13, fontWeight: 900, cursor: canAdd ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap', transition: 'all .15s', boxShadow: canAdd ? `0 4px 12px ${isRetour ? C.amber : C.green}40` : 'none', alignSelf: 'flex-end', marginBottom: 2 }}>
          {isRetour ? '↩ Retour' : '+ Ajouter'}
        </button>

        <div style={{ width: 1, height: 42, background: headerBd, flexShrink: 0 }} />

        {/* REMISE */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: C.amber, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>REMISE (DA)</div>
          <input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value) || 0)}
            style={{ width: 68, background: C.isLight ? '#FFFBEB' : C.amberLo, border: `2px solid ${C.amber}40`, borderRadius: 9, outline: 'none', fontSize: 17, fontWeight: 900, color: C.amber, textAlign: 'center', padding: '6px 3px' }} />
        </div>

        <div style={{ flex: 1 }} />

        {/* AGENT IA */}
        <button style={{ background: `linear-gradient(135deg,${C.blue},${C.violet || '#6366F1'})`, border: 'none', borderRadius: 9, padding: '8px 13px', color: '#fff', fontWeight: 900, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: `0 4px 12px ${C.blue}40`, flexShrink: 0 }}>🤖 Agent IA</button>

        <div style={{ width: 2, height: 42, background: headerBd, flexShrink: 0 }} />

        {/* TOTAL TTC */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: 1 }}>TOTAL TTC</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: C.text, fontFamily: 'monospace', lineHeight: 1 }}>
            {fmt(totalTTC).replace(' DA', '')}<span style={{ fontSize: 13, color: C.sub, marginLeft: 3 }}>DA</span>
          </div>
        </div>

        <div style={{ width: 2, height: 42, background: headerBd, flexShrink: 0 }} />
        <LiveClock />
      </div>

      {/* ══ UPSELL ══ */}
      {suggestions.length > 0 && (
        <div style={{ flexShrink: 0, background: C.isLight ? '#FFFBEB' : C.amberLo, borderBottom: `2px solid ${C.amber}40`, padding: '5px 20px', display: 'flex', gap: 7, alignItems: 'center', overflowX: 'auto' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: C.amber, flexShrink: 0 }}>💡 Souvent achetés ensemble :</span>
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => selectProduct(s.product)}
              style={{ background: headerBg, border: `2px solid ${C.amber}40`, borderRadius: 7, padding: '4px 10px', cursor: 'pointer', flexShrink: 0, transition: 'border-color .12s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.amber; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.amber + '40'; }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: C.text }}>+ {s.product.name}</span>
              <span style={{ fontSize: 10, color: C.amber, marginLeft: 5 }}>{s.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ══ BOUTONS D'ACTION ══ */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, background: headerBg, borderBottom: `2px solid ${headerBd}`, padding: '7px 20px', overflowX: 'auto', minHeight: 84 }}>
        {ACTION_BTNS.map((btn, i) => (
          <button key={i}
            onClick={btn.disabled ? undefined : (btn.action || (() => {}))}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '6px 9px', flexShrink: 0, background: btn.isValidate ? C.greenLo : btn.isNew ? C.blueLo : btn.highlight ? C.redLo : btnBase, border: `2px solid ${btn.isValidate ? C.green + '40' : btn.isNew ? C.blue + '40' : btn.highlight ? C.red + '40' : btnBorder}`, borderRadius: 9, cursor: btn.disabled ? 'not-allowed' : 'pointer', minWidth: 66, minHeight: 62, opacity: btn.disabled ? 0.3 : 1, filter: btn.disabled ? 'grayscale(40%)' : 'none', transition: 'all .15s', position: 'relative' }}
            onMouseEnter={e => { if (!btn.disabled) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = DS.shadows.sm; } }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
            {btn.isNew && <div style={{ position: 'absolute', top: -6, right: -3, background: C.blue, color: '#fff', fontSize: 7, fontWeight: 900, borderRadius: 4, padding: '1px 4px' }}>NEW</div>}
            <div style={{ fontSize: 19 }}>{btn.icon}</div>
            <div style={{ fontSize: 9, fontWeight: 800, color: btn.disabled ? C.muted : btn.color, whiteSpace: 'pre', textAlign: 'center', lineHeight: 1.3 }}>{btn.label}</div>
          </button>
        ))}
      </div>

      {/* ══ PANIER ══ */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: headerBg, overflow: 'hidden' }}>
        {!hasItems ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div style={{ fontSize: 60, opacity: 0.08 }}>🛒</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.muted }}>Panier vide</div>
            <div style={{ fontSize: 12, color: C.muted }}>Recherchez et sélectionnez un produit en haut</div>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {items.some(i => i.qty < 0) && (
              <div style={{ background: C.amberLo, borderBottom: `1px solid ${C.amber}30`, padding: '5px 20px', fontSize: 11, fontWeight: 700, color: C.amber }}>
                ↩ Ce ticket contient des retours — le total sera déduit
              </div>
            )}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: C.isLight ? '#F8FAFC' : C.surface, zIndex: 1 }}>
                <tr style={{ borderBottom: `2px solid ${headerBd}` }}>
                  {['Produit', 'Prix U.', 'Qté', 'Total TTC', ''].map((h, idx) => (
                    <th key={idx} style={{ padding: '9px 20px', fontSize: 10, fontWeight: 900, color: C.sub, textTransform: 'uppercase', textAlign: idx >= 3 ? 'right' : idx === 2 ? 'center' : 'left', letterSpacing: .5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const isRet = item.qty < 0;
                  return (
                    <tr key={item.id} style={{ borderBottom: `1px solid ${headerBd}`, background: isRet ? (C.isLight ? '#FFF7ED' : C.amberLo + '80') : i % 2 === 0 ? headerBg : rowAlt }}>
                      <td style={{ padding: '10px 20px', fontSize: 13, fontWeight: 700, color: C.text }}>
                        {item.name}
                        {isRet && <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 800, color: C.amber, background: C.amberLo, border: `1px solid ${C.amber}40`, borderRadius: 5, padding: '1px 6px' }}>↩ Retour</span>}
                      </td>
                      <td style={{ padding: '10px 20px', fontSize: 12, color: C.sub, fontWeight: 600 }}>{fmt(item.sellPrice)}</td>
                      <td style={{ padding: '10px 20px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                          <button onClick={() => setItems(items.map(x => x.id === item.id ? { ...x, qty: x.qty - 1 } : x).filter(x => x.qty !== 0))}
                            style={{ width: 25, height: 25, borderRadius: 5, border: `1.5px solid ${headerBd}`, background: headerBg, cursor: 'pointer', fontWeight: 900, color: C.sub, fontSize: 13 }}>−</button>
                          <input type="number" value={item.qty}
                            onChange={e => { const v = Number(e.target.value); if (v === 0) setItems(items.filter(x => x.id !== item.id)); else setItems(items.map(x => x.id === item.id ? { ...x, qty: v } : x)); }}
                            style={{ width: 42, background: 'transparent', border: `1.5px solid ${isRet ? C.amber + '60' : headerBd}`, borderRadius: 5, outline: 'none', fontSize: 13, fontWeight: 900, color: isRet ? C.amber : C.text, textAlign: 'center', padding: '2px' }} />
                          <button onClick={() => setItems(items.map(x => x.id === item.id ? { ...x, qty: x.qty + 1 } : x))}
                            style={{ width: 25, height: 25, borderRadius: 5, border: `1.5px solid ${C.green}40`, background: C.greenLo, cursor: 'pointer', fontWeight: 900, color: C.green, fontSize: 13 }}>+</button>
                        </div>
                      </td>
                      <td style={{ padding: '10px 20px', fontSize: 13, fontWeight: 800, color: isRet ? C.amber : C.green, textAlign: 'right' }}>{fmt(item.sellPrice * item.qty)}</td>
                      <td style={{ padding: '10px 20px', textAlign: 'right' }}>
                        <button onClick={() => setItems(items.filter(x => x.id !== item.id))}
                          style={{ width: 25, height: 25, borderRadius: 5, background: C.redLo, border: `1.5px solid ${C.red}40`, color: C.red, cursor: 'pointer', fontWeight: 900, fontSize: 11 }}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ FOOTER ══ */}
      <div style={{ flexShrink: 0, background: C.isLight ? `linear-gradient(135deg,${C.violet || '#6D28D9'},${C.purple || '#7C3AED'})` : `linear-gradient(135deg,${C.violet || '#3D1A6E'},${C.purple || '#4A2080'})`, padding: '0 20px', height: 70, display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {[{ label: 'TOTAL ACHATS', value: fmt(totalAchats) }, { label: 'TOTAL VENTES', value: fmt(total) }, { label: 'REMISE', value: fmt(discount) }, { label: 'TOTAL TTC', value: fmt(totalTTC), big: true, color: '#FCD34D' }, { label: 'BÉNÉFICE', value: fmt(benefice), big: true, color: '#4ADE80' }].map(({ label, value, big, color }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 8, fontWeight: 900, opacity: .7, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: big ? 20 : 13, fontWeight: 900, fontFamily: 'monospace', color: color || '#fff', lineHeight: 1 }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)', textAlign: 'right' }}>
          {items.length} article(s) · Impayés :&nbsp;
          <span style={{ color: '#FCA5A5', fontWeight: 800 }}>{fmt(unpaidSales.reduce((s, v) => s + Math.max(0, Number(v.total || 0) - Number(v.paid || 0)), 0))}</span>
        </div>
      </div>

      {/* ══ BOUTON FLOTTANT ══ */}
      <button onClick={() => { if (hasItems) setShowValidModal(true); }} disabled={!hasItems}
        style={{ position: 'fixed', bottom: 22, right: 26, zIndex: DS.zIndex.float, padding: '14px 28px', background: hasItems ? C.green : C.muted, color: '#fff', border: 'none', borderRadius: 999, fontSize: 15, fontWeight: 900, cursor: hasItems ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 8, boxShadow: hasItems ? `0 10px 34px ${C.green}60` : 'none', transition: DS.transitions.normal }}
        onMouseEnter={e => { if (hasItems) e.currentTarget.style.transform = 'translateY(-3px)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
        🧾 Valider la vente
      </button>

      {/* ══ MODALES ══ */}
      {showNewProduct  && <NewProductModal onClose={() => setShowNewProduct(false)} onSaved={handleProductSaved} C={C} />}
      {showValidModal  && <ValidationModal totalHT={total} discount={discount} onConfirm={finishSale} onCancel={() => setShowValidModal(false)} C={C} />}

      {showUnpaid && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: DS.zIndex.modal }}>
          <div style={{ background: headerBg, borderRadius: 15, width: 460, maxHeight: '80vh', overflow: 'auto', boxShadow: DS.shadows.lg, border: `1px solid ${headerBd}` }}>
            <div style={{ padding: '15px 19px', borderBottom: `1.5px solid ${C.red}30`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.redLo }}>
              <h3 style={{ margin: 0, color: C.red, fontWeight: 900, fontSize: 15 }}>🔴 Ventes à crédit ({unpaidSales.length})</h3>
              <button onClick={() => setShowUnpaid(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.red }}>✕</button>
            </div>
            <div style={{ padding: 13 }}>
              {unpaidSales.length === 0 ? <div style={{ textAlign: 'center', padding: 22, color: C.green, fontWeight: 800 }}>✅ Aucun impayé !</div>
                : unpaidSales.map(s => (
                  <div key={s.id} style={{ padding: '9px 12px', marginBottom: 6, borderRadius: 8, border: `1.5px solid ${C.red}30`, background: C.redLo }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: C.text }}>{s.clientName || 'Passage'}</div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 3, fontSize: 11 }}>
                      <span style={{ color: C.sub }}>Total : {fmt(s.total)}</span>
                      <span style={{ color: C.green, fontWeight: 700 }}>Payé : {fmt(s.paid)}</span>
                      <span style={{ color: C.red, fontWeight: 800 }}>Reste : {fmt(Number(s.total) - Number(s.paid))}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {showHistory && <DetailedSalesList onClose={() => setShowHistory(false)} currentClient={client} currentTotal={totalTTC} />}
      {SaleSuccessOverlay}
    </div>
  );
}