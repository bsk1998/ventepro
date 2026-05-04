import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../ThemeContext';
import { db, nowISO, fmt, invalidateCache } from '../db';
import { printTicket, printInvoice, printDelivery } from '../components/Ticket';
import DetailedSalesList from './DetailedSalesList';
import salesAgent from '../components/SalesAgent';
import { useToast, useSaleSuccess } from '../components/Feedback';
import { DS } from '../designSystem'; //

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
      <div style={{ ...DS.typography.label, color: DS.colors.neutral }}>{date}</div>
      <div style={{ ...DS.typography.monoLg, color: DS.colors.primary }}>{time}</div>
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
  const [suggestions,  setSuggestions]  = useState([]);
  const [qty,          setQty]          = useState(1);
  const [selectedTva,  setSelectedTva]  = useState('0%');
  const [selectedPay,  setSelectedPay]  = useState(0);

  const toastMsg = useToast();
  const { triggerSaleSuccess, SaleSuccessOverlay } = useSaleSuccess();
  const barcodeRef = useRef();

  const total    = items.reduce((sum, i) => sum + (i.sellPrice * i.qty), 0);
  const totalTTC = total - discount;

  useEffect(() => {
    loadData();
    const handleKeys = (e) => {
      if (e.key === 'F1') { e.preventDefault(); barcodeRef.current?.focus(); return; }
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); finishSale(); return; }
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        setItems([]); setDiscount(0); setPaid('');
        setClient({ name: 'Passage', id: null });
        toastMsg.info('Nouveau ticket ouvert');
        return;
      }
      if (e.ctrlKey && e.key === 'h') { e.preventDefault(); setShowHistory(true); return; }
      if (e.ctrlKey && e.key === 'r') { e.preventDefault(); setShowAI(true); return; }
      if (e.key === 'Escape') {
        setShowHistory(false); setShowUnpaid(false); setShowAI(false);
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [items, totalTTC, paid, discount, client]);

  useEffect(() => {
    if (items.length === 0) { setSuggestions([]); return; }
    salesAgent.suggestUpsell(items, client.id).then(setSuggestions).catch(() => {});
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

  const addItem = (p) => {
    const addQty = qty || 1;
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
    try {
      const saleId = await db.sales.add({
        clientName: client.name, clientId: client.id,
        total: totalTTC, paid: Number(paid) || 0,
        discount: Number(discount) || 0, payMode,
        status: (Number(paid) || 0) >= totalTTC ? 'payé' : 'crédit',
        createdAt: nowISO(),
      });
      for (const item of items) {
        await db.saleItems.add({
          saleId, productId: item.id, productName: item.name,
          qty: item.qty, buyPrice: item.buyPrice, unitPrice: item.sellPrice,
        });
        await db.products.update(item.id, { stock: item.stock - item.qty });
      }
      invalidateCache();
      triggerSaleSuccess(totalTTC);
      toastMsg.success('Vente enregistrée avec succès !');
      setItems([]); setPaid(''); setDiscount(0);
      setClient({ name: 'Passage', id: null });
      loadData();
    } catch (err) {
      toastMsg.error('Erreur : ' + err.message);
    }
  }

  const foundProd = search.length > 0 ? products.find(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode === search
  ) : null;

  const ACTION_BTNS = [
    { icon: '📊', label: 'Liste\nVentes', color: DS.colors.success, action: () => setShowHistory(true) },
    { icon: '💳', label: 'Versement', color: DS.colors.danger, action: () => setShowUnpaid(true) },
    { icon: '✅', label: '[CTRL+ENT] Valider', color: DS.colors.success, action: finishSale, isValidate: true },
    { icon: '➕', label: 'Nouveau', color: DS.colors.primary, action: () => setItems([]), isNew: true },
  ];

  return (
    <div style={{
      width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column',
      background: DS.colors.bg, fontFamily: DS.typography.body.fontFamily, color: DS.colors.neutralDk,
    }}>

      {/* HEADER LLIÉ AU DS */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', background: DS.colors.surface,
        borderBottom: `2px solid ${DS.colors.neutralBd}`, padding: `0 ${DS.spacing.xxxl}px`, height: '88px', gap: DS.spacing.lg,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: DS.spacing.md }}>
          <div style={{ ...DS.typography.h3, color: DS.colors.neutral }}>👤 {client.name}</div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: 'right' }}>
          <div style={DS.typography.label}>TOTAL TTC</div>
          <div style={{ ...DS.typography.monoLg, color: DS.colors.neutralDk }}>
            {fmt(totalTTC)}
          </div>
        </div>
        <LiveClock />
      </div>

      {/* RECHERCHE */}
      <div style={{ padding: `${DS.spacing.md}px ${DS.spacing.xxxl}px`, background: DS.colors.surface, borderBottom: `2px solid ${DS.colors.neutralBd}` }}>
        <input
          ref={barcodeRef}
          type="text"
          placeholder="Rechercher (F1)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%', padding: DS.spacing.md, borderRadius: DS.radius.md,
            border: `2px solid ${DS.colors.successBd}`, background: DS.colors.successLt,
            ...DS.typography.h3, outline: 'none',
          }}
        />
      </div>

      {/* PANIER */}
      <div style={{ flex: 1, overflowY: 'auto', background: DS.colors.surface, margin: DS.spacing.lg, borderRadius: DS.radius.lg, boxShadow: DS.shadows.sm }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: DS.colors.neutralLt, position: 'sticky', top: 0 }}>
            <tr>
              <th style={{ padding: DS.spacing.lg, textAlign: 'left', ...DS.typography.label }}>Produit</th>
              <th style={{ padding: DS.spacing.lg, textAlign: 'center', ...DS.typography.label }}>Qté</th>
              <th style={{ padding: DS.spacing.lg, textAlign: 'right', ...DS.typography.label }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} style={{ borderBottom: `1px solid ${DS.colors.neutralBd}` }}>
                <td style={{ padding: DS.spacing.lg, ...DS.typography.h3 }}>{item.name}</td>
                <td style={{ padding: DS.spacing.lg, textAlign: 'center' }}>{item.qty}</td>
                <td style={{ padding: DS.spacing.lg, textAlign: 'right', color: DS.colors.successDk, fontWeight: 800 }}>{fmt(item.sellPrice * item.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FOOTER ACTIONS */}
      <div style={{
        height: 100, background: DS.colors.secondary, display: 'flex', alignItems: 'center',
        padding: `0 ${DS.spacing.xxxl}px`, gap: DS.spacing.lg,
      }}>
         {ACTION_BTNS.map((btn, i) => (
          <button key={i} onClick={btn.action} style={{
            padding: `${DS.spacing.sm}px ${DS.spacing.lg}px`, borderRadius: DS.radius.md,
            background: DS.colors.surface, border: 'none', cursor: 'pointer',
            ...DS.typography.label, color: btn.color, boxShadow: DS.shadows.md,
          }}>
            {btn.icon} {btn.label}
          </button>
        ))}
      </div>

      {SaleSuccessOverlay}
    </div>
  );
}