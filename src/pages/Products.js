import { useState, useEffect, useMemo, useRef } from 'react';
import { useTheme } from '../ThemeContext';
import { db, fmt, today, nowISO } from '../db';
import CameraAI from '../components/CameraAI';

// ─── Tokens locaux dérivés du thème dynamique ─────────────────────────────────
// NE PAS éditer ces valeurs directement — elles proviennent de useTheme()
function useDesignTokens() {
  const { theme: C } = useTheme();
  return {
    // Surfaces
    bg:     C.bg,
    white:  C.isLight ? 'rgba(255,255,255,0.88)' : C.card,
    border: C.isLight ? 'rgba(255,255,255,0.95)' : C.border,
    // Ombres
    shadow:   C.shadowSm,
    shadowLg: C.shadow,
    // Rayons
    R: 16, Rs: 10,
    // Bleu / Indigo / Violet (accent + secondaire)
    blue:     C.blue,
    blueLt:   C.blueLo,
    blueBd:   C.blue + '50',
    indigo:   C.violet,
    indigoLt: C.isLight ? '#EEF2FF' : C.violetLo,
    indigoBd: C.isLight ? '#C7D2FE' : C.violet + '40',
    violet:   C.purple,
    violetLt: C.purpleLo,
    violetBd: C.purple + '40',
    // Sémantiques
    green:   C.green,   greenLt:  C.greenLo,  greenBd:  C.green  + '50',
    amber:   C.amber,   amberLt:  C.amberLo,  amberBd:  C.amber  + '50',
    red:     C.red,     redLt:    C.redLo,    redBd:    C.red    + '50',
    cyan:    C.accent,  cyanLt:   C.accentLo, cyanBd:   C.accent + '50',
    pink:    C.purple,  pinkLt:   C.purpleLo, pinkBd:   C.purple + '50',
    // Texte
    txt:   C.text,
    sub:   C.sub,
    muted: C.muted,
    // Référence thème complète
    C,
  };
}

const CATS  = ['Lubrifiants','Filtres','Électrique','Liquides','Distribution','Freinage','Carrosserie','Pneumatiques','Alimentaire','Vêtements','Électronique','Plomberie','Outillage','Divers'];
const UNITS = ['pce','L','kg','m','boîte','carton','sachet','rouleau','paire'];

// ─── Composants utilitaires ─────────────────────────────────────────────────
function G({ children, style, ac, D }) {
  return (
    <div style={{
      background:        D.white,
      backdropFilter:    'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border:            `1.5px solid ${ac ? ac + '40' : D.border}`,
      borderRadius:      D.R,
      boxShadow:         D.shadow,
      ...style,
    }}>{children}</div>
  );
}

function Inp({ label, value, onChange, type = 'text', placeholder, style, color, D }) {
  return (
    <div style={style}>
      {label && (
        <div style={{ fontSize: 10, fontWeight: 700, color: color || D.sub, marginBottom: 4, textTransform: 'uppercase', letterSpacing: .6 }}>
          {label}
        </div>
      )}
      <input value={value || ''} onChange={onChange} type={type} placeholder={placeholder}
        style={{
          width: '100%',
          background: D.C.isLight ? (color ? color + '10' : '#F8FAFF') : D.C.bg,
          border: `1.5px solid ${color ? color + '40' : D.indigoBd}`,
          borderRadius: D.Rs, padding: '8px 12px',
          color: D.txt, fontSize: 13, outline: 'none',
          boxSizing: 'border-box', transition: 'border .15s', fontFamily: 'inherit',
        }}
        onFocus={e  => { e.target.style.borderColor = color || D.blue; }}
        onBlur={e   => { e.target.style.borderColor = color ? color + '40' : D.indigoBd; }}
      />
    </div>
  );
}

function Sel({ label, value, onChange, children, color, D }) {
  return (
    <div>
      {label && (
        <div style={{ fontSize: 10, fontWeight: 700, color: color || D.sub, marginBottom: 4, textTransform: 'uppercase', letterSpacing: .6 }}>
          {label}
        </div>
      )}
      <select value={value || ''} onChange={onChange}
        style={{
          width: '100%',
          background: D.C.isLight ? '#F8FAFF' : D.C.bg,
          border: `1.5px solid ${color ? color + '40' : D.indigoBd}`,
          borderRadius: D.Rs, padding: '8px 12px',
          color: D.txt, fontSize: 13, outline: 'none',
          boxSizing: 'border-box', fontFamily: 'inherit',
        }}>
        {children}
      </select>
    </div>
  );
}

function Pill({ label, active, onClick, color, D }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 14px',
      border:      `1.5px solid ${active ? color || D.blue : D.indigoBd}`,
      borderRadius: 20, cursor: 'pointer', fontSize: 12,
      fontWeight:  active ? 700 : 500,
      background:  active ? (color || D.blue) : D.indigoLt,
      color:       active ? '#fff' : D.sub,
      transition:  'all .15s', whiteSpace: 'nowrap',
    }}>{label}</button>
  );
}

function StatCard({ icon, label, value, color, sub }) {
  return (
    <div style={{ background: color + '15', border: `1.5px solid ${color}30`, borderRadius: 16, padding: '14px 16px', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: .7 }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 900, color, fontFamily: 'monospace' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ─── Aperçu étiquette ────────────────────────────────────────────────────────
function LabelPreview({ product, copies, onPrint, D }) {
  return (
    <div style={{ background: D.indigoLt, border: `1.5px solid ${D.indigoBd}`, borderRadius: D.R, padding: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: D.indigo, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 10 }}>
        🏷️ Aperçu étiquette
      </div>
      <div style={{ background: D.C.surface, border: `1px solid ${D.C.border}`, borderRadius: 8, padding: '10px 14px', marginBottom: 12, textAlign: 'center', boxShadow: D.shadow }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: D.txt, marginBottom: 4 }}>{product?.name || 'Nom du produit'}</div>
        {product?.ref && <div style={{ fontSize: 10, color: D.sub, marginBottom: 4 }}>Réf: {product.ref}</div>}
        <svg width="120" height="36" style={{ margin: '4px auto', display: 'block' }}>
          {Array.from({ length: 40 }).map((_, i) => (
            <rect key={i} x={i * 3} y={0} width={Math.random() > 0.5 ? 2 : 1} height={36}
              fill={D.C.isLight ? '#1E293B' : '#EDF1FF'} opacity={Math.random() > .3 ? 1 : 0} />
          ))}
        </svg>
        <div style={{ fontSize: 10, fontFamily: 'monospace', color: D.txt, marginTop: 2 }}>
          {product?.barcode || '0000000000'}
        </div>
        <div style={{ fontSize: 16, fontWeight: 900, color: D.blue, marginTop: 6 }}>
          {fmt(product?.sellPrice || 0)} DA
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Inp label="Copies" value={copies} onChange={e => onPrint('copies', e.target.value)}
          type="number" style={{ flex: 1 }} color={D.indigo} D={D} />
        <button onClick={() => onPrint('print')} style={{
          background: `linear-gradient(135deg,${D.indigo},${D.violet})`,
          border: 'none', borderRadius: D.Rs, padding: '8px 14px', color: '#fff',
          fontWeight: 800, cursor: 'pointer', fontSize: 12, marginTop: 20,
          boxShadow: `0 4px 12px ${D.indigo}40`,
        }}>🖨️ Imprimer</button>
      </div>
    </div>
  );
}

// ─── Modal Produit ────────────────────────────────────────────────────────────
const EMPTY = {
  name: '', ref: '', category: '', barcode: '', barcodes: [],
  buyPrice: '', sellPrice: '', sellPriceGros: '', sellPriceSemiGros: '',
  stock: '', minStock: 5, unit: 'pce', expiry: '', favorite: false,
  description: '', supplier: '',
};

function ProductModal({ product, onClose, onSave, initialData }) {
  const D     = useDesignTokens();
  const [form, setForm]   = useState(product ? { ...product, barcodes: product.barcodes || [] } : initialData || EMPTY);
  const [saving, setSaving] = useState(false);
  const [tab,    setTab]    = useState('general');
  const [labelCopies, setLabelCopies] = useState(1);
  const [newBarcode,  setNewBarcode]  = useState('');

  const isNew  = !product?.id;
  const margin = form.buyPrice && form.sellPrice && Number(form.buyPrice) > 0
    ? Math.round(((Number(form.sellPrice) - Number(form.buyPrice)) / Number(form.buyPrice)) * 100) : 0;

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function addBarcode() {
    if (!newBarcode.trim()) return;
    const list = form.barcodes || [];
    if (list.length >= 8) return alert('Maximum 8 codes-barres');
    setForm(f => ({ ...f, barcodes: [...list, newBarcode.trim()] }));
    setNewBarcode('');
  }

  function removeBarcode(i) {
    setForm(f => ({ ...f, barcodes: f.barcodes.filter((_, idx) => idx !== i) }));
  }

  async function save() {
    if (!form.name.trim())  return alert('Nom requis');
    if (!form.sellPrice)    return alert('Prix de vente requis');
    setSaving(true);
    const payload = {
      name: form.name, ref: form.ref, category: form.category,
      barcode: form.barcode, barcodes: form.barcodes || [],
      buyPrice: Number(form.buyPrice) || 0,
      sellPrice: Number(form.sellPrice) || 0,
      sellPriceGros: Number(form.sellPriceGros) || 0,
      sellPriceSemiGros: Number(form.sellPriceSemiGros) || 0,
      stock: Number(form.stock) || 0, minStock: Number(form.minStock) || 5,
      unit: form.unit || 'pce', expiry: form.expiry || null,
      favorite: !!form.favorite, description: form.description || '',
      supplier: form.supplier || '', updatedAt: nowISO(),
    };
    if (isNew) { payload.createdAt = nowISO(); await db.products.add(payload); }
    else await db.products.update(product.id, payload);
    onSave(); setSaving(false);
  }

  const TABS = [
    { id: 'general',   label: '📋 Général'    },
    { id: 'prix',      label: '💰 Prix & Tarifs' },
    { id: 'codes',     label: '📊 Codes-barres' },
    { id: 'etiquette', label: '🏷️ Étiquette'   },
  ];

  const inpStyle = {
    background: D.C.isLight ? '#F8FAFF' : D.C.bg,
    border:     `1.5px solid ${D.indigoBd}`,
    borderRadius: D.Rs, padding: '8px 12px',
    color: D.txt, fontSize: 13, outline: 'none',
    width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: D.indigo + '18', backdropFilter: 'blur(8px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <G D={D} ac={D.indigo} style={{ width: 680, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: D.shadowLg }}>

        {/* Header */}
        <div style={{ background: `linear-gradient(135deg,${D.blue},${D.indigo})`, padding: '14px 20px', borderRadius: `${D.R}px ${D.R}px 0 0`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 16, color: '#fff' }}>
            {isNew ? '➕ Nouveau produit' : `✏️ ${form.name}`}
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 8, width: 28, height: 28, color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '10px 16px 0', flexShrink: 0, borderBottom: `1px solid ${D.indigoBd}` }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: '7px 14px', border: 'none', borderRadius: `${D.Rs}px ${D.Rs}px 0 0`,
              cursor: 'pointer', fontSize: 12, fontWeight: tab === t.id ? 800 : 500,
              background: tab === t.id ? D.indigoLt : 'transparent',
              color: tab === t.id ? D.indigo : D.sub,
              borderBottom: tab === t.id ? `2px solid ${D.indigo}` : '2px solid transparent',
              transition: 'all .15s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Contenu */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>

          {/* ── Général ── */}
          {tab === 'general' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Inp label="Nom *" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nom du produit" style={{ gridColumn: '1/-1' }} color={D.blue} D={D} />
              <Inp label="Référence" value={form.ref} onChange={e => set('ref', e.target.value)} placeholder="REF-001" color={D.indigo} D={D} />
              <Sel label="Catégorie" value={form.category} onChange={e => set('category', e.target.value)} color={D.violet} D={D}>
                <option value="">Choisir...</option>
                {CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </Sel>
              <Inp label="Stock actuel"  value={form.stock}    onChange={e => set('stock',    e.target.value)} type="number" placeholder="0" color={D.green} D={D} />
              <Inp label="Stock minimum" value={form.minStock} onChange={e => set('minStock', e.target.value)} type="number" placeholder="5" color={D.amber} D={D} />
              <Sel label="Unité" value={form.unit} onChange={e => set('unit', e.target.value)} color={D.cyan} D={D}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </Sel>
              <Inp label="Date de péremption" value={form.expiry || ''} onChange={e => set('expiry', e.target.value)} type="date" color={D.red}    D={D} />
              <Inp label="Fournisseur"         value={form.supplier || ''} onChange={e => set('supplier', e.target.value)} placeholder="Nom fournisseur" color={D.indigo} D={D} />
              <div style={{ gridColumn: '1/-1' }}>
                <Inp label="Description" value={form.description || ''} onChange={e => set('description', e.target.value)} placeholder="Description optionnelle..." color={D.sub} D={D} />
              </div>
              <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="fav" checked={!!form.favorite} onChange={e => set('favorite', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <label htmlFor="fav" style={{ color: D.sub, fontSize: 13, cursor: 'pointer' }}>⭐ Produit favori (affiché en priorité)</label>
              </div>
            </div>
          )}

          {/* ── Prix & Tarifs ── */}
          {tab === 'prix' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <G D={D} ac={D.red} style={{ padding: 14, gridColumn: '1/-1' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: D.red, textTransform: 'uppercase', letterSpacing: .7, marginBottom: 10 }}>💸 Prix d'achat</div>
                <Inp label="Prix d'achat (DA)" value={form.buyPrice} onChange={e => set('buyPrice', e.target.value)} type="number" placeholder="0" color={D.red} D={D} />
              </G>
              <G D={D} ac={D.blue} style={{ padding: 14, gridColumn: '1/-1' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: D.blue, textTransform: 'uppercase', letterSpacing: .7, marginBottom: 10 }}>🏷️ Grille de vente</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <Inp label="Prix détail (DA) *" value={form.sellPrice} onChange={e => set('sellPrice', e.target.value)} type="number" placeholder="0" color={D.blue} D={D} />
                    {margin !== 0 && <div style={{ fontSize: 11, color: margin > 0 ? D.green : D.red, fontWeight: 700, marginTop: 4 }}>{margin > 0 ? '+' : ''}{margin}%</div>}
                  </div>
                  <Inp label="Prix semi-gros (DA)" value={form.sellPriceSemiGros || ''} onChange={e => set('sellPriceSemiGros', e.target.value)} type="number" placeholder="0" color={D.cyan} D={D} />
                  <Inp label="Prix gros (DA)"       value={form.sellPriceGros || ''}    onChange={e => set('sellPriceGros',      e.target.value)} type="number" placeholder="0" color={D.violet} D={D} />
                </div>
              </G>
              {form.buyPrice && form.sellPrice && Number(form.buyPrice) > 0 && (
                <G D={D} ac={D.green} style={{ padding: 14, gridColumn: '1/-1' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: D.green, textTransform: 'uppercase', letterSpacing: .7, marginBottom: 10 }}>📈 Récapitulatif marges</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                    {[
                      { label: 'Détail',     price: form.sellPrice,         color: D.blue   },
                      { label: 'Semi-gros',  price: form.sellPriceSemiGros, color: D.cyan   },
                      { label: 'Gros',       price: form.sellPriceGros,     color: D.violet },
                    ].map(({ label, price, color }) => {
                      if (!price || Number(price) === 0) return null;
                      const m = Math.round(((Number(price) - Number(form.buyPrice)) / Number(form.buyPrice)) * 100);
                      return (
                        <div key={label} style={{ background: color + '12', border: `1px solid ${color}30`, borderRadius: D.Rs, padding: '10px 12px' }}>
                          <div style={{ fontSize: 10, color, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                          <div style={{ fontSize: 15, fontWeight: 900, color }}>{fmt(Number(price))}</div>
                          <div style={{ fontSize: 11, color: m > 0 ? D.green : D.red, fontWeight: 700, marginTop: 2 }}>{m > 0 ? '+' : ''}{m}% · +{fmt(Number(price) - Number(form.buyPrice))} DA</div>
                        </div>
                      );
                    }).filter(Boolean)}
                  </div>
                </G>
              )}
            </div>
          )}

          {/* ── Codes-barres ── */}
          {tab === 'codes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <G D={D} ac={D.blue} style={{ padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: D.blue, textTransform: 'uppercase', letterSpacing: .7, marginBottom: 10 }}>📊 Code-barres principal</div>
                <Inp label="Code-barres" value={form.barcode || ''} onChange={e => set('barcode', e.target.value)} placeholder="Scannez ou saisissez..." color={D.blue} D={D} />
              </G>
              <G D={D} ac={D.indigo} style={{ padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: D.indigo, textTransform: 'uppercase', letterSpacing: .7, marginBottom: 10 }}>
                  📊 Codes supplémentaires ({(form.barcodes || []).length}/8)
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input value={newBarcode} onChange={e => setNewBarcode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addBarcode()}
                    placeholder="Nouveau code-barres..."
                    style={{ ...inpStyle, flex: 1 }} />
                  <button onClick={addBarcode} disabled={(form.barcodes || []).length >= 8}
                    style={{ background: `linear-gradient(135deg,${D.blue},${D.indigo})`, border: 'none', borderRadius: D.Rs, padding: '8px 16px', color: '#fff', fontWeight: 800, cursor: (form.barcodes || []).length >= 8 ? 'not-allowed' : 'pointer', fontSize: 12, opacity: (form.barcodes || []).length >= 8 ? .5 : 1 }}>
                    + Ajouter
                  </button>
                </div>
                {(form.barcodes || []).length === 0
                  ? <div style={{ textAlign: 'center', padding: 14, color: D.muted, fontSize: 13 }}>Aucun code supplémentaire</div>
                  : (form.barcodes || []).map((bc, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: D.indigoLt, border: `1px solid ${D.indigoBd}`, borderRadius: D.Rs, padding: '8px 14px', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 10, color: D.muted, marginBottom: 2 }}>Code #{i + 1}</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, color: D.txt, fontSize: 13 }}>{bc}</div>
                      </div>
                      <button onClick={() => removeBarcode(i)} style={{ background: D.redLt, border: `1px solid ${D.redBd}`, borderRadius: 7, padding: '4px 10px', color: D.red, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>✕</button>
                    </div>
                  ))
                }
              </G>
            </div>
          )}

          {/* ── Étiquette ── */}
          {tab === 'etiquette' && (
            <LabelPreview
              D={D}
              product={{ ...form, name: form.name || 'Produit', sellPrice: Number(form.sellPrice) || 0 }}
              copies={labelCopies}
              onPrint={(action, val) => {
                if (action === 'copies') setLabelCopies(Number(val) || 1);
                else window.print();
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 18px', borderTop: `1px solid ${D.indigoBd}`, display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0, background: D.white }}>
          <button onClick={onClose} style={{ background: D.C.isLight ? '#F1F5F9' : D.C.card, border: 'none', borderRadius: D.Rs, padding: '10px 20px', cursor: 'pointer', fontSize: 13, color: D.sub, fontWeight: 600 }}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ background: `linear-gradient(135deg,${D.blue},${D.indigo})`, border: 'none', borderRadius: D.Rs, padding: '10px 24px', color: '#fff', fontWeight: 900, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, boxShadow: `0 4px 14px ${D.blue}40` }}>
            {saving ? '⏳ Sauvegarde...' : '✓ Enregistrer'}
          </button>
        </div>
      </G>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PAGE PRODUITS PRINCIPALE
// ════════════════════════════════════════════════════════════════════════════
export default function Products() {
  const D = useDesignTokens();

  const [products,   setProducts]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [sort,       setSort]       = useState('name');
  const [filter,     setFilter]     = useState('tous');
  const [catFilter,  setCatFilter]  = useState('');
  const [modal,      setModal]      = useState(null);
  const [confirm,    setConfirm]    = useState(null);
  const [view,       setView]       = useState('liste');
  const [showCamera, setShowCamera] = useState(false);
  const [cameraInitData, setCameraInitData] = useState(null);

  const [advStock, setAdvStock] = useState('');
  const [advPrice, setAdvPrice] = useState('');
  const [showAdv,  setShowAdv]  = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setProducts(await db.products.toArray());
    setLoading(false);
  }

  async function adjustStock(id, delta) {
    const p = await db.products.get(id);
    if (p) await db.products.update(id, { stock: Math.max(0, p.stock + delta) });
    await load();
  }

  async function del(id) {
    await db.products.delete(id); await load(); setConfirm(null);
  }

  const inventory = useMemo(() => {
    const valAchat  = products.reduce((s, p) => s + (p.stock || 0) * (p.buyPrice  || 0), 0);
    const valVente  = products.reduce((s, p) => s + (p.stock || 0) * (p.sellPrice || 0), 0);
    const ruptures  = products.filter(p => p.stock === 0).length;
    const bas       = products.filter(p => p.stock > 0 && p.stock <= (p.minStock || 5)).length;
    const expires   = products.filter(p => p.expiry && p.expiry < today()).length;
    const totalQty  = products.reduce((s, p) => s + (p.stock || 0), 0);
    const byCat = {};
    products.forEach(p => {
      const c = p.category || 'Divers';
      if (!byCat[c]) byCat[c] = { count: 0, stock: 0, valAchat: 0, valVente: 0 };
      byCat[c].count++;
      byCat[c].stock    += p.stock || 0;
      byCat[c].valAchat += (p.stock || 0) * (p.buyPrice  || 0);
      byCat[c].valVente += (p.stock || 0) * (p.sellPrice || 0);
    });
    return { valAchat, valVente, marge: valVente - valAchat, ruptures, bas, expires, totalQty, byCat };
  }, [products]);

  const filtered = useMemo(() => {
    let list = [...products];
    if (search)    list = list.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()) || p.ref?.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search) || (p.barcodes || []).some(b => b.includes(search)) || p.category?.toLowerCase().includes(search.toLowerCase()));
    if (catFilter) list = list.filter(p => (p.category || 'Divers') === catFilter);
    if (filter === 'favoris')   list = list.filter(p => p.favorite);
    if (filter === 'stock bas') list = list.filter(p => p.stock > 0 && p.stock <= (p.minStock || 5));
    if (filter === 'rupture')   list = list.filter(p => p.stock === 0);
    if (filter === 'périmés')   list = list.filter(p => p.expiry && p.expiry < today());
    if (advStock) { const m = advStock.match(/^([<>=!]+)\s*(\d+)/); if (m) { const [, op, val] = m; const n = Number(val); if (op === '<') list = list.filter(p => p.stock < n); if (op === '>') list = list.filter(p => p.stock > n); if (op === '<=') list = list.filter(p => p.stock <= n); if (op === '>=') list = list.filter(p => p.stock >= n); if (op === '=' || op === '==') list = list.filter(p => p.stock === n); } }
    if (advPrice) { const m = advPrice.match(/^([<>=!]+)\s*(\d+)/); if (m) { const [, op, val] = m; const n = Number(val); if (op === '<') list = list.filter(p => p.sellPrice < n); if (op === '>') list = list.filter(p => p.sellPrice > n); if (op === '<=') list = list.filter(p => p.sellPrice <= n); if (op === '>=') list = list.filter(p => p.sellPrice >= n); if (op === '=' || op === '==') list = list.filter(p => p.sellPrice === n); } }
    list.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'stock' ? a.stock - b.stock : sort === 'price' ? b.sellPrice - a.sellPrice : sort === 'buy' ? b.buyPrice - a.buyPrice : sort === 'expiry' ? (a.expiry || '9999').localeCompare(b.expiry || '9999') : sort === 'margin' ? (b.sellPrice - b.buyPrice) - (a.sellPrice - a.buyPrice) : 0);
    return list;
  }, [products, search, catFilter, filter, advStock, advPrice, sort]);

  const cats = useMemo(() => [...new Set(products.map(p => p.category || 'Divers'))].sort(), [products]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12, background: D.bg }}>
      <div style={{ fontSize: 40 }}>⏳</div>
      <div style={{ color: D.sub, fontSize: 14 }}>Chargement des produits...</div>
    </div>
  );

  const selectStyle = {
    background: D.C.isLight ? '#F8FAFF' : D.C.bg,
    border:     `1.5px solid ${D.indigoBd}`,
    borderRadius: D.Rs, padding: '8px 12px',
    color: D.indigo, fontSize: 12, fontWeight: 600, outline: 'none',
  };

  return (
    <div style={{ height: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', background: D.bg, fontFamily: D.C.fontBody, overflow: 'hidden' }}>

      {/* ══ INVENTAIRE ══ */}
      <div style={{ padding: '10px 14px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
          <StatCard icon="💰" label="Valeur stock (achat)"  value={fmt(inventory.valAchat)} color={D.blue}   sub={`${products.length} produits · ${inventory.totalQty} unités`} />
          <StatCard icon="🏷️" label="Valeur stock (vente)"  value={fmt(inventory.valVente)} color={D.green}  sub="Potentiel de vente total" />
          <StatCard icon="📈" label="Marge potentielle"      value={fmt(inventory.marge)}    color={D.violet} sub={inventory.valAchat > 0 ? `${Math.round(inventory.marge / inventory.valAchat * 100)}%` : '-'} />
          <StatCard icon="⚠️" label="Alertes stock"          value={inventory.ruptures + inventory.bas} color={D.amber} sub={`${inventory.ruptures} ruptures · ${inventory.bas} bas`} />
          {inventory.expires > 0 && <StatCard icon="🗓️" label="Périmés" value={inventory.expires} color={D.red} sub="À retirer" />}
        </div>
      </div>

      {/* ══ BARRE CONTRÔLES ══ */}
      <G D={D} ac={D.blue} style={{ margin: '0 14px 6px', padding: '10px 14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: D.muted, fontSize: 14 }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Nom, référence, code-barres, catégorie..."
              style={{ width: '100%', background: D.blueLt, border: `1.5px solid ${D.blueBd}`, borderRadius: D.Rs, padding: '8px 12px 8px 34px', color: D.txt, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <select value={sort} onChange={e => setSort(e.target.value)} style={selectStyle}>
            {[['name', 'A→Z'], ['stock', 'Stock ↑'], ['price', 'Prix vente ↓'], ['buy', 'Prix achat ↓'], ['margin', 'Marge ↓'], ['expiry', 'Péremption']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button onClick={() => setShowAdv(!showAdv)} style={{ background: showAdv ? D.violet : D.violetLt, border: `1.5px solid ${D.violetBd}`, borderRadius: D.Rs, padding: '7px 14px', color: showAdv ? '#fff' : D.violet, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all .15s' }}>
            🔧 Filtres avancés {showAdv ? '▲' : '▼'}
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button onClick={() => setShowCamera(true)} style={{ background: `linear-gradient(135deg,${D.violet},${D.pink})`, border: 'none', borderRadius: D.Rs, padding: '8px 18px', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', boxShadow: `0 4px 12px ${D.violet}40`, display: 'flex', alignItems: 'center', gap: 6 }}>
              📸 Scanner Produit
            </button>
            <button onClick={() => setModal('new')} style={{ background: `linear-gradient(135deg,${D.blue},${D.indigo})`, border: 'none', borderRadius: D.Rs, padding: '8px 18px', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', boxShadow: `0 4px 12px ${D.blue}40` }}>
              + Ajouter produit
            </button>
            <button onClick={() => setView(v => v === 'liste' ? 'inventaire' : 'liste')} style={{ background: view === 'inventaire' ? D.amber : D.amberLt, border: `1.5px solid ${D.amberBd}`, borderRadius: D.Rs, padding: '8px 14px', color: view === 'inventaire' ? '#fff' : D.amber, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              📊 {view === 'inventaire' ? 'Vue liste' : 'Inventaire'}
            </button>
          </div>
        </div>

        {showAdv && (
          <div style={{ marginTop: 10, padding: 12, background: D.violetLt, border: `1px solid ${D.violetBd}`, borderRadius: D.Rs, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            <Inp label="Filtre stock (ex: <5)" value={advStock} onChange={e => setAdvStock(e.target.value)} placeholder="ex: <5" color={D.amber}   D={D} />
            <Inp label="Filtre prix (ex: >500)" value={advPrice} onChange={e => setAdvPrice(e.target.value)} placeholder="ex: >500" color={D.blue} D={D} />
            <Sel label="Catégorie" value={catFilter} onChange={e => setCatFilter(e.target.value)} color={D.violet} D={D}>
              <option value="">Toutes catégories</option>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </Sel>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
              <button onClick={() => { setAdvStock(''); setAdvPrice(''); setCatFilter(''); }} style={{ flex: 1, background: D.redLt, border: `1px solid ${D.redBd}`, borderRadius: D.Rs, padding: '8px', color: D.red, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✕ Réinitialiser</button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {['tous', 'favoris', 'stock bas', 'rupture', 'périmés'].map(f => (
            <Pill key={f} D={D}
              label={f === 'tous' ? `Tous (${products.length})` : f}
              active={filter === f}
              onClick={() => setFilter(f)}
              color={f === 'rupture' ? D.red : f === 'stock bas' ? D.amber : f === 'périmés' ? D.pink : D.blue} />
          ))}
          {cats.slice(0, 6).map(c => (
            <Pill key={c} D={D}
              label={`${c} (${products.filter(p => (p.category || 'Divers') === c).length})`}
              active={catFilter === c}
              onClick={() => setCatFilter(catFilter === c ? '' : c)}
              color={D.violet} />
          ))}
          <span style={{ fontSize: 12, color: D.muted, alignSelf: 'center', marginLeft: 4 }}>
            {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
          </span>
        </div>
      </G>

      {/* ══ VUE INVENTAIRE ══ */}
      {view === 'inventaire' && (
        <div style={{ flex: 1, overflow: 'auto', padding: '0 14px 14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {Object.entries(inventory.byCat).sort((a, b) => b[1].valVente - a[1].valVente).map(([cat, data]) => (
              <G key={cat} D={D} ac={D.blue} style={{ padding: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: D.txt, marginBottom: 12 }}>{cat}</div>
                {[
                  { l: 'Produits',           v: data.count,               c: D.indigo },
                  { l: 'Unités en stock',    v: data.stock,               c: D.blue   },
                  { l: 'Valeur achat',       v: fmt(data.valAchat),       c: D.amber  },
                  { l: 'Valeur vente',       v: fmt(data.valVente),       c: D.green  },
                  { l: 'Marge potentielle',  v: fmt(data.valVente - data.valAchat), c: D.violet },
                ].map(({ l, v, c }) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                    <span style={{ color: D.sub }}>{l}</span>
                    <span style={{ fontWeight: 700, color: c }}>{v}</span>
                  </div>
                ))}
                <div style={{ marginTop: 8, background: D.indigoLt, borderRadius: 6, height: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: `linear-gradient(90deg,${D.blue},${D.indigo})`, borderRadius: 6, width: `${inventory.valVente > 0 ? Math.min(100, (data.valVente / inventory.valVente) * 100) : 0}%`, transition: 'width .5s' }} />
                </div>
                <div style={{ fontSize: 10, color: D.muted, marginTop: 3, textAlign: 'right' }}>
                  {inventory.valVente > 0 ? Math.round((data.valVente / inventory.valVente) * 100) : 0}% du stock total
                </div>
              </G>
            ))}
          </div>
        </div>
      )}

      {/* ══ TABLEAU PRODUITS ══ */}
      {view === 'liste' && (
        <G D={D} ac={D.blue} style={{ flex: 1, margin: '0 14px 10px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flexShrink: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: D.blue + '18' }}>
                  {['', 'Réf', 'Code-barres', 'Produit', 'Catégorie', 'Prix achat', 'Prix vente', 'Marge', 'Stock', 'Péremption', 'Statut', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', fontSize: 10, fontWeight: 800, color: D.indigo, textTransform: 'uppercase', letterSpacing: .7, textAlign: 'left', whiteSpace: 'nowrap', borderBottom: `2px solid ${D.indigoBd}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
            </table>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {filtered.map((p, i) => {
                  const low    = p.stock > 0 && p.stock <= (p.minStock || 5);
                  const out    = p.stock === 0;
                  const exp    = p.expiry && p.expiry < today();
                  const margin = p.buyPrice > 0 ? Math.round(((p.sellPrice - p.buyPrice) / p.buyPrice) * 100) : 0;
                  const rowBg  = i % 2 === 0 ? D.white : D.indigoLt + '60';
                  return (
                    <tr key={p.id}
                      onDoubleClick={() => setModal(p)}
                      style={{ borderBottom: `1px solid ${D.indigoLt}`, cursor: 'pointer', background: rowBg, transition: 'background .1s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = D.indigoLt; }}
                      onMouseLeave={e => { e.currentTarget.style.background = rowBg; }}>
                      <td style={{ padding: '9px 12px', fontSize: 14 }}>{p.favorite ? '⭐' : ''}</td>
                      <td style={{ padding: '9px 12px', color: D.muted, fontSize: 11, fontFamily: 'monospace' }}>{p.ref || '—'}</td>
                      <td style={{ padding: '9px 12px', color: D.muted, fontSize: 11, fontFamily: 'monospace', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.barcode || '—'}
                        {(p.barcodes || []).length > 0 && <span style={{ background: D.indigoLt, color: D.indigo, borderRadius: 4, fontSize: 9, padding: '1px 5px', marginLeft: 4, fontWeight: 700 }}>+{p.barcodes.length}</span>}
                      </td>
                      <td style={{ padding: '9px 12px', fontWeight: 700, color: D.txt,   fontSize: 13 }}>{p.name}</td>
                      <td style={{ padding: '9px 12px' }}>
                        {p.category && <span style={{ background: D.blueLt, color: D.blue, border: `1px solid ${D.blueBd}`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>{p.category}</span>}
                      </td>
                      <td style={{ padding: '9px 12px', color: D.sub, fontSize: 12 }}>{fmt(p.buyPrice)}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 700, color: D.blue, fontSize: 13 }}>
                        {fmt(p.sellPrice)}
                        {p.sellPriceGros > 0 && <div style={{ fontSize: 9, color: D.violet }}>Gros: {fmt(p.sellPriceGros)}</div>}
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ background: margin > 30 ? D.greenLt : margin > 10 ? D.amberLt : D.redLt, color: margin > 30 ? D.green : margin > 10 ? D.amber : D.red, borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>
                          {margin > 0 ? '+' : ''}{margin}%
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', fontWeight: 800, color: out ? D.red : low ? D.amber : D.green, fontSize: 13 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <button onClick={e => { e.stopPropagation(); adjustStock(p.id, -1); }} style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${D.redBd}`, background: D.redLt, cursor: 'pointer', color: D.red, fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                          <span>{p.stock} {p.unit}</span>
                          <button onClick={e => { e.stopPropagation(); adjustStock(p.id, +1); }} style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${D.greenBd}`, background: D.greenLt, cursor: 'pointer', color: D.green, fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        </div>
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: exp ? D.red : D.sub, fontWeight: exp ? 700 : 400 }}>{p.expiry || '—'}{exp && ' ⚠'}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ background: out ? D.redLt : low ? D.amberLt : D.greenLt, color: out ? D.red : low ? D.amber : D.green, border: `1px solid ${out ? D.redBd : low ? D.amberBd : D.greenBd}`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
                          {out ? 'Rupture' : low ? 'Bas' : 'OK'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={e => { e.stopPropagation(); setModal(p); }} style={{ background: D.indigoLt, border: `1px solid ${D.indigoBd}`, borderRadius: 7, padding: '4px 10px', color: D.indigo, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>✏️</button>
                          <button onClick={e => { e.stopPropagation(); setConfirm(p.id); }} style={{ background: D.redLt, border: `1px solid ${D.redBd}`, borderRadius: 7, padding: '4px 10px', color: D.red, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={12} style={{ padding: 40, textAlign: 'center', color: D.muted, fontSize: 14 }}>Aucun produit trouvé</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </G>
      )}

      {/* ══ MODALS ══ */}
      {modal && <ProductModal product={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSave={() => { load(); setModal(null); }} initialData={cameraInitData} />}

      {confirm && (
        <div style={{ position: 'fixed', inset: 0, background: D.red + '18', backdropFilter: 'blur(4px)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <G D={D} ac={D.red} style={{ padding: 24, width: 360, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: D.txt,  marginBottom: 6 }}>Supprimer ce produit ?</div>
            <div style={{ color: D.sub, fontSize: 13, marginBottom: 20 }}>Cette action est irréversible.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setConfirm(null)} style={{ background: D.C.isLight ? '#F1F5F9' : D.C.card, border: 'none', borderRadius: D.Rs, padding: '10px 20px', cursor: 'pointer', fontSize: 13, color: D.sub, fontWeight: 600 }}>Annuler</button>
              <button onClick={() => del(confirm)} style={{ background: `linear-gradient(135deg,${D.red},#DC2626)`, border: 'none', borderRadius: D.Rs, padding: '10px 20px', color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 13 }}>Supprimer</button>
            </div>
          </G>
        </div>
      )}

      {showCamera && (
        <CameraAI
          onClose={() => { setShowCamera(false); setCameraInitData(null); }}
          onProductFound={prod => { setCameraInitData(prod); setModal('new'); setShowCamera(false); }}
          onProductsImported={count => { alert(`✅ ${count} produit(s) importé(s) avec succès !`); load(); setShowCamera(false); }}
          existingProducts={products}
        />
      )}
    </div>
  );
}