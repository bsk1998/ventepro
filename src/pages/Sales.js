import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../ThemeContext';
import { db, nowISO, fmt, invalidateCache } from '../db';
import { printTicket, printInvoice, printDelivery } from '../components/Ticket';
import DetailedSalesList from './DetailedSalesList';
import salesAgent from '../components/SalesAgent';

function LiveClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const date = t.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const time = t.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return (
    <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
      <div style={{ fontSize: 14, color: '#64748B', fontWeight: 600 }}>{date}</div>
      <div style={{ fontSize: 32, fontWeight: 900, color: '#00C9FF', fontFamily: 'monospace', letterSpacing: 1 }}>{time}</div>
    </div>
  );
}

export default function Sales() {
  const [items,        setItems]        = useState([]);
  const [client,       setClient]       = useState({ name: 'Passage', id: null });
  const [payMode,      setPayMode]      = useState('Espèces');
  const [discount,     setDiscount]     = useState(0);
  const [paid,         setPaid]         = useState('');
  const [products,     setProducts]     = useState([]);
  const [clients,      setClients]      = useState([]);
  const [search,       setSearch]       = useState('');
  const [showUnpaid,   setShowUnpaid]   = useState(false);
  const [unpaidSales,  setUnpaidSales]  = useState([]);
  const [showHistory,  setShowHistory]  = useState(false);
  const [filterStock,  setFilterStock]  = useState('tous');
  const [showAI,       setShowAI]       = useState(false);
  const [suggestions,  setSuggestions]  = useState([]); // State upsell[cite: 3]
  const [qty,          setQty]          = useState(1);
  const [selectedTva,  setSelectedTva]  = useState('0%');
  const [selectedPay,  setSelectedPay]  = useState(0);

  const barcodeRef = useRef();

  // Focus & Chargement initial
  useEffect(() => {
    loadData();
    const handleF1 = (e) => { if (e.key === 'F1') { e.preventDefault(); barcodeRef.current?.focus(); } };
    window.addEventListener('keydown', handleF1);
    return () => window.removeEventListener('keydown', handleF1);
  }, []);

  // Suggestions upsell à chaque changement de panier[cite: 3]
  useEffect(() => {
    if (items.length === 0) { 
      setSuggestions([]); 
      return; 
    }
    salesAgent.suggestUpsell(items, client.id)
      .then(setSuggestions)
      .catch(() => {});
  }, [items, client.id]);

  async function loadData() {
    const [p, c, u] = await Promise.all([
      db.products.toArray(),
      db.clients.toArray(),
      db.sales.where('status').equals('crédit').toArray(),
    ]);
    setProducts(p);
    setClients(c);
    setUnpaidSales(u);
  }

  const total    = items.reduce((sum, i) => sum + (i.sellPrice * i.qty), 0);
  const totalTTC = total - discount;

  const addItem = (p) => {
    const addQty   = qty || 1;
    const existing = items.find(x => x.id === p.id);
    if (existing) {
      setItems(items.map(x => x.id === p.id ? { ...x, qty: x.qty + addQty } : x));
    } else {
      setItems([...items, { ...p, qty: addQty }]);
    }
    setSearch('');
    setQty(1);
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
      createdAt:  nowISO(),
    });

    for (const item of items) {
      await db.saleItems.add({
        saleId,
        productId:   item.id,
        productName: item.name,
        qty:         item.qty,
        buyPrice:    item.buyPrice,
        unitPrice:   item.sellPrice,
      });
      await db.products.update(item.id, { stock: item.stock - item.qty });
    }

    invalidateCache();

    setItems([]);
    setPaid('');
    setDiscount(0);
    setClient({ name: 'Passage', id: null });
    loadData();
    alert('Vente enregistrée !');
  }

  const filteredProds = products.filter(p => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode  || '').includes(search) ||
      (p.ref      || '').toLowerCase().includes(search.toLowerCase());
    if (filterStock === 'dispo')   return matchSearch && p.stock > 0;
    if (filterStock === 'rupture') return matchSearch && p.stock === 0;
    return matchSearch;
  });

  const foundProd   = search.length > 0 ? filteredProds[0] || null : null;
  const totalAchats = items.reduce((s, i) => s + (i.buyPrice || 0) * i.qty, 0);
  const benefice    = totalTTC - totalAchats;

  const PAY_ICONS = ['💵', '🏦', '💳', '⏳'];

  const ACTION_BTNS = [
    { icon: '🗑️', label: 'Supprimer\nProduit',  color: '#94A3B8', action: null,                         disabled: items.length === 0 },
    { icon: '🗑️', label: 'Supprimer\nVente',     color: '#94A3B8', action: null,                         disabled: items.length === 0 },
    { icon: '🧾', label: 'Ticket\ncaisse',        color: '#3B82F6', action: null,                         disabled: items.length === 0 },
    { icon: '📋', label: 'B.Livraison\nA4',       color: '#3B82F6', action: null,                         disabled: items.length === 0 },
    { icon: '📋', label: 'B.Livraison\nA5',       color: '#3B82F6', action: null,                         disabled: items.length === 0 },
    { icon: '📄', label: 'Facture\nA4',           color: '#6366F1', action: null,                         disabled: items.length === 0 },
    { icon: '📄', label: 'Facture\nProforma',     color: '#6366F1', action: null,                         disabled: items.length === 0 },
    { icon: '📊', label: 'Liste\nVentes',         color: '#10B981', action: () => setShowHistory(true),   disabled: false },
    { icon: '📈', label: 'Analyse\nGlobale',      color: '#F59E0B', action: null,                         disabled: false },
    { icon: '⏸️', label: 'Mettre\nen attente',    color: '#94A3B8', action: null,                         disabled: true },
    { icon: '📁', label: 'Attente\n(0)',          color: '#94A3B8', action: null,                         disabled: true },
    { icon: '💳', label: 'Versement\nclient',     color: '#EF4444', action: () => setShowUnpaid(true),    disabled: false, highlight: true },
    { icon: '✅', label: '[F8] Valider',          color: '#10B981', action: finishSale,                  disabled: items.length === 0, isValidate: true },
    { icon: '➕', label: 'Nouvelle\nvente',       color: '#3B82F6', action: () => { setItems([]); setDiscount(0); setPaid(''); setClient({ name: 'Passage', id: null }); }, disabled: false, isNew: true },
  ];

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', background: '#F1F5F9',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      color: '#1F2937', margin: 0, padding: 0, boxSizing: 'border-box',
    }}>

      {/* ══ 1. HEADER ══ */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center',
        background: '#FFFFFF', borderBottom: '2px solid #E2E8F0',
        padding: '0 40px', height: '88px', gap: '16px', boxSizing: 'border-box',
      }}>
        {/* Client sélecteur */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, background: '#6D28D9',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, color: '#fff',
          }}>👤</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 }}>CLIENT</div>
            <select
              value={client.id || 'passage'}
              onChange={(e) => {
                if (e.target.value === 'passage') {
                  setClient({ name: 'Passage', id: null });
                } else {
                  const sel = clients.find(c => c.id === parseInt(e.target.value));
                  if (sel) setClient({ name: sel.name, id: sel.id });
                }
              }}
              style={{
                fontSize: 14, border: '2px solid #E2E8F0', borderRadius: 8,
                padding: '7px 12px', background: '#F8FAFC', color: '#1E293B',
                outline: 'none', minWidth: 180, fontWeight: 700, cursor: 'pointer',
              }}>
              <option value="passage">COMPTOIR</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ width: 1, height: 48, background: '#E2E8F0', flexShrink: 0 }} />

        {/* TVA */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>TVA</div>
          <div style={{ display: 'flex', gap: 5 }}>
            {['0%', '9%', '19%'].map(t => (
              <button key={t} onClick={() => setSelectedTva(t)} style={{
                padding: '7px 15px', borderRadius: 24,
                border: selectedTva === t ? 'none' : '2px solid #E2E8F0',
                background: selectedTva === t ? '#6D28D9' : '#F8FAFC',
                color: selectedTva === t ? '#fff' : '#64748B',
                fontSize: 14, fontWeight: 800, cursor: 'pointer', transition: 'all .15s',
              }}>{t}</button>
            ))}
          </div>
        </div>

        <div style={{ width: 1, height: 48, background: '#E2E8F0', flexShrink: 0 }} />

        {/* Paiement */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>PAIEMENT</div>
          <div style={{ display: 'flex', gap: 5 }}>
            {PAY_ICONS.map((icon, i) => (
              <button key={i} onClick={() => setSelectedPay(i)} style={{
                width: 42, height: 42, borderRadius: 8, fontSize: 22, cursor: 'pointer',
                border: selectedPay === i ? 'none' : '2px solid #E2E8F0',
                background: selectedPay === i ? '#10B981' : '#F8FAFC',
                transition: 'all .15s',
              }}>{icon}</button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Bouton IA */}
        <button
          onClick={() => setShowAI(true)}
          style={{
            background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
            border: 'none', borderRadius: 10, padding: '10px 18px',
            color: '#fff', fontWeight: 900, fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
            transition: 'all .2s', flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
          🤖 Agent IA
        </button>

        {/* TOTAL TTC + Heure */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 }}>TOTAL TTC</div>
            <div style={{ fontSize: 42, fontWeight: 900, color: '#1E293B', fontFamily: 'monospace', lineHeight: 1 }}>
              {fmt(totalTTC).replace(' DA', '')}
              <span style={{ fontSize: 18, color: '#64748B', marginLeft: 5 }}>DA</span>
            </div>
          </div>
          <div style={{ width: 2, height: 48, background: '#E2E8F0' }} />
          <LiveClock />
        </div>
      </div>

      {/* ══ 2. BARRE RECHERCHE ══ */}
      <div style={{
        flexShrink: 0, background: '#FFFFFF',
        borderBottom: '2px solid #E2E8F0', padding: '10px 40px', boxSizing: 'border-box',
      }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: '#10B981', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>
          NOM PRODUIT [F1] - CODE BARRE [F2] - RÉFÉRENCE [F3]
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
          <input
            ref={barcodeRef}
            type="text"
            placeholder="Rechercher par nom, référence, code-barres..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && foundProd) addItem(foundProd); }}
            style={{
              flex: 1, padding: '14px 20px', fontSize: 16,
              border: '2.5px solid #A7F3D0', borderRadius: 12, outline: 'none',
              background: '#F0FDF4', color: '#1F2937', fontWeight: 700, boxSizing: 'border-box',
            }}
          />
          {/* QTITÉ */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F5F3FF', border: '2px solid #DDD6FE', borderRadius: 11, padding: '6px 16px', flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: 1.2 }}>QTITÉ</div>
            <input
              type="number" min={1} value={qty}
              onChange={e => setQty(Math.max(1, Number(e.target.value) || 1))}
              style={{ width: 60, background: 'transparent', border: 'none', outline: 'none', fontSize: 24, fontWeight: 900, color: '#6D28D9', textAlign: 'center', padding: 0 }}
            />
          </div>
          {/* STOCK DISPO */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#ECFDF5', border: '2px solid #A7F3D0', borderRadius: 11, padding: '6px 16px', flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: '#10B981', textTransform: 'uppercase', letterSpacing: 1.2 }}>STOCK DISPO</div>
            <div style={{ fontSize: 19, fontWeight: 900, color: foundProd ? (foundProd.stock > 0 ? '#10B981' : '#EF4444') : '#94A3B8', marginTop: 3 }}>
              {foundProd ? `${foundProd.stock} ${foundProd.unit || ''}` : '—'}
            </div>
          </div>
          {/* PRIX DE VENTE */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#EFF6FF', border: '2px solid #BFDBFE', borderRadius: 11, padding: '6px 16px', flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: '#2563EB', textTransform: 'uppercase', letterSpacing: 1.2 }}>PRIX DE VENTE</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: foundProd ? '#2563EB' : '#94A3B8', marginTop: 3 }}>
              {foundProd ? fmt(foundProd.sellPrice) : '—'}
            </div>
          </div>
          {/* REMISE */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#FFFBEB', border: '2px solid #FDE68A', borderRadius: 11, padding: '6px 16px', flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: 1.2 }}>REMISE (DA)</div>
            <input
              type="number" value={discount}
              onChange={e => setDiscount(Number(e.target.value) || 0)}
              style={{ width: 80, background: 'transparent', border: 'none', outline: 'none', fontSize: 20, fontWeight: 900, color: '#D97706', textAlign: 'center', padding: 0, marginTop: 3 }}
            />
          </div>
          <button
            onClick={() => { if (foundProd) addItem(foundProd); }}
            disabled={!foundProd}
            style={{
              padding: '0 28px', background: foundProd ? '#059669' : '#D1FAE5',
              color: foundProd ? '#FFFFFF' : '#A7F3D0', border: 'none', borderRadius: 12,
              fontSize: 16, fontWeight: 900, cursor: foundProd ? 'pointer' : 'default',
              whiteSpace: 'nowrap', transition: 'all .15s',
              boxShadow: foundProd ? '0 4px 14px rgba(5,150,105,0.3)' : 'none',
            }}>
            + Ajouter
          </button>
        </div>
        {foundProd && search.length > 0 && (
          <div style={{ marginTop: 8, background: '#F0FDF4', border: '1.5px solid #A7F3D0', borderRadius: 8, padding: '6px 14px', fontSize: 13, color: '#065F46', fontWeight: 700 }}>
            ✓ {foundProd.name} — {fmt(foundProd.sellPrice)} — Stock : {foundProd.stock} {foundProd.unit}
          </div>
        )}
      </div>

      {/* ══ SUGGESTIONS UPSELL ══[cite: 3] */}
      {suggestions.length > 0 && (
        <div style={{
          flexShrink: 0, background: '#FFFBEB',
          borderBottom: '2px solid #FDE68A',
          padding: '8px 40px', display: 'flex', gap: 10, alignItems: 'center',
          overflowX: 'auto', boxSizing: 'border-box',
        }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#92400E', flexShrink: 0 }}>
            💡 Souvent achetés ensemble :
          </span>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => addItem(s.product)}
              style={{
                background: '#fff', border: '2px solid #FDE68A', borderRadius: 10,
                padding: '6px 14px', cursor: 'pointer', flexShrink: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#F59E0B'; e.currentTarget.style.background = '#FFFBEB'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#FDE68A'; e.currentTarget.style.background = '#fff'; }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#1E293B' }}>
                + {s.product.name}
              </span>
              <span style={{ fontSize: 11, color: '#92400E' }}>
                {s.label} · {s.reason}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ══ 3. BARRE D'ACTIONS ══ */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
        background: '#FFFFFF', borderBottom: '2px solid #E2E8F0',
        padding: '8px 40px', overflowX: 'auto', boxSizing: 'border-box', minHeight: 90,
      }}>
        {ACTION_BTNS.map((btn, i) => (
          <button
            key={i}
            onClick={btn.action || (() => {})}
            disabled={btn.disabled}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 4, padding: '8px 11px', flexShrink: 0,
              background: btn.isValidate ? '#ECFDF5' : btn.isNew ? '#EFF6FF' : btn.highlight ? '#FEF2F2' : '#F8FAFC',
              border: `2px solid ${btn.isValidate ? '#A7F3D0' : btn.isNew ? '#BFDBFE' : btn.highlight ? '#FECACA' : '#E2E8F0'}`,
              borderRadius: 11, cursor: btn.disabled ? 'not-allowed' : 'pointer',
              minWidth: 72, minHeight: 68,
              opacity: btn.disabled ? 0.38 : 1, transition: 'all .12s', position: 'relative',
            }}
            onMouseEnter={e => { if (!btn.disabled) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,.1)'; } }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            {btn.isNew && (
              <div style={{ position: 'absolute', top: -8, right: -4, background: '#3B82F6', color: '#fff', fontSize: 8, fontWeight: 900, borderRadius: 5, padding: '2px 5px', letterSpacing: 0.5 }}>NEW</div>
            )}
            <div style={{ fontSize: 22 }}>{btn.icon}</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: btn.color, whiteSpace: 'pre', textAlign: 'center', lineHeight: 1.3 }}>{btn.label}</div>
          </button>
        ))}
      </div>

      {/* ══ 4. PANIER ══ */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#FFFFFF', overflow: 'hidden' }}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 40px', borderBottom: '1.5px solid #F1F5F9' }}>
          <div style={{ fontSize: 28, opacity: 0.5 }}>🛒</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#1E293B' }}>Panier en cours</div>
            <div style={{ fontSize: 13, color: '#94A3B8' }}>
              {items.length} produit(s) · {items.reduce((s, i) => s + i.qty, 0)} article(s)
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {items.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <div style={{ fontSize: 80, opacity: 0.12 }}>🛒</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#94A3B8' }}>Panier vide</div>
              <div style={{ fontSize: 15, color: '#CBD5E1' }}>Recherchez un produit ci-dessus pour commencer</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#F8FAFC', zIndex: 1 }}>
                <tr style={{ borderBottom: '2.5px solid #E2E8F0' }}>
                  {['Produit', 'Prix U.', 'Qté', 'Total TTC', ''].map((h, idx) => (
                    <th key={idx} style={{ padding: '12px 40px', fontSize: 12, fontWeight: 900, color: '#64748B', textTransform: 'uppercase', textAlign: idx >= 3 ? 'right' : idx === 2 ? 'center' : 'left', letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                    <td style={{ padding: '13px 40px', fontSize: 15, fontWeight: 700, color: '#1E293B' }}>{item.name}</td>
                    <td style={{ padding: '13px 40px', fontSize: 14, color: '#64748B', fontWeight: 600 }}>{fmt(item.sellPrice)}</td>
                    <td style={{ padding: '13px 40px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <button onClick={() => setItems(items.map(x => x.id === item.id ? { ...x, qty: Math.max(1, x.qty - 1) } : x))}
                          style={{ width: 30, height: 30, borderRadius: 6, border: '1.5px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontWeight: 800, color: '#64748B', fontSize: 16 }}>−</button>
                        <span style={{ fontWeight: 900, minWidth: 32, textAlign: 'center', fontSize: 15 }}>{item.qty}</span>
                        <button onClick={() => addItem(item)}
                          style={{ width: 30, height: 30, borderRadius: 6, border: '1.5px solid #A7F3D0', background: '#ECFDF5', cursor: 'pointer', fontWeight: 800, color: '#10B981', fontSize: 16 }}>+</button>
                      </div>
                    </td>
                    <td style={{ padding: '13px 40px', fontSize: 15, fontWeight: 800, color: '#10B981', textAlign: 'right' }}>{fmt(item.sellPrice * item.qty)}</td>
                    <td style={{ padding: '13px 40px', textAlign: 'right' }}>
                      <button onClick={() => setItems(items.filter(x => x.id !== item.id))}
                        style={{ width: 30, height: 30, borderRadius: 6, background: '#FEF2F2', border: '1.5px solid #FECACA', color: '#EF4444', cursor: 'pointer', fontWeight: 800, fontSize: 14 }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ══ 5. FOOTER ══ */}
      <div style={{
        flexShrink: 0, background: 'linear-gradient(135deg, #6D28D9 0%, #7C3AED 100%)',
        padding: '0 40px', height: 82, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', color: '#fff', boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {[
            { label: 'TOTAL ACHATS', value: fmt(totalAchats) },
            { label: 'TOTAL VENTES', value: fmt(total) },
            { label: 'REMISE',       value: fmt(discount) },
            { label: 'TVA',          value: '0 DA' },
            { label: 'TOTAL TTC',    value: fmt(totalTTC),  big: true, color: '#FCD34D' },
            { label: 'BÉNÉFICE',     value: fmt(benefice),  big: true, color: '#4ADE80' },
          ].map(({ label, value, big, color }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 900, opacity: 0.75, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: big ? 24 : 17, fontWeight: 900, fontFamily: 'monospace', color: color || '#fff', lineHeight: 1 }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'right' }}>
          {items.length} article(s) · {fmt(totalTTC)} · Impayés :&nbsp;
          <span style={{ color: '#FCA5A5', fontWeight: 800 }}>
            {fmt(unpaidSales.reduce((s, v) => s + Math.max(0, Number(v.total || 0) - Number(v.paid || 0)), 0))}
          </span>
        </div>
      </div>

      {/* ══ 6. BOUTON FLOTTANT ══ */}
      <button
        onClick={finishSale}
        disabled={items.length === 0}
        style={{
          position: 'fixed', bottom: 25, right: 35, zIndex: 999,
          padding: '18px 36px',
          background: items.length > 0 ? '#10B981' : '#94A3B8',
          color: '#fff', border: 'none', borderRadius: 999,
          fontSize: 18, fontWeight: 900, cursor: items.length > 0 ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: items.length > 0 ? '0 12px 40px rgba(16,185,129,0.6)' : '0 8px 24px rgba(0,0,0,0.15)',
          transition: 'all .25s', letterSpacing: 0.5,
        }}
        onMouseEnter={e => { if (items.length > 0) e.currentTarget.style.transform = 'translateY(-3px)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>
        🧾 Valider la vente
      </button>

      {/* ══ MODAL IMPAYÉS ══ */}
      {showUnpaid && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }}>
          <div style={{ background: '#fff', borderRadius: 18, width: 520, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 25px 70px rgba(0,0,0,.3)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1.5px solid #FEE2E2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FEF2F2' }}>
              <h3 style={{ margin: 0, color: '#EF4444', fontWeight: 900, fontSize: 18 }}>🔴 Ventes à crédit ({unpaidSales.length})</h3>
              <button onClick={() => setShowUnpaid(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#EF4444' }}>✕</button>
            </div>
            <div style={{ padding: 18 }}>
              {unpaidSales.length === 0
                ? <div style={{ textAlign: 'center', padding: 32, color: '#10B981', fontWeight: 800, fontSize: 15 }}>✅ Aucun impayé !</div>
                : unpaidSales.map(s => (
                  <div key={s.id} style={{ padding: '12px 15px', marginBottom: 8, borderRadius: 9, border: '1.5px solid #FECACA', background: '#FEF2F2' }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{s.clientName || 'Passage'}</div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 5, fontSize: 13 }}>
                      <span style={{ color: '#64748B' }}>Total: {fmt(s.total)}</span>
                      <span style={{ color: '#10B981', fontWeight: 700 }}>Payé: {fmt(s.paid)}</span>
                      <span style={{ color: '#EF4444', fontWeight: 800 }}>Reste: {fmt(Number(s.total) - Number(s.paid))}</span>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* ══ LISTE DES VENTES ══ */}
      {showHistory && (
        <DetailedSalesList
          onClose={() => setShowHistory(false)}
          currentClient={client}
          currentTotal={totalTTC}
        />
      )}
    </div>
  );
}