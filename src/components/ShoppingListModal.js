import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../ThemeContext';
import { db, fmt, nowISO } from '../db';
import { buildShoppingCandidates, createShoppingList, getLatestShoppingList } from '../businessFeatures';

export default function ShoppingListModal({ onClose }) {
  const { theme: C } = useTheme();
  const [mode, setMode] = useState('alerts');
  const [prompt, setPrompt] = useState('');
  const [manual, setManual] = useState({ name: '', qty: 1 });
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [lastList, setLastList] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    db.products.toArray().then(setProducts);
    getLatestShoppingList().then(setLastList).catch(() => {});
    generate('alerts');
  }, []);

  const total = useMemo(() => items.reduce((s, i) => s + Number(i.estimatedTotal || 0), 0), [items]);

  async function generate(nextMode = mode) {
    const rows = await buildShoppingCandidates({ mode: nextMode, prompt });
    setItems(rows);
    setMode(nextMode);
  }

  function addManual() {
    const q = manual.name.trim().toLowerCase();
    const product = products.find(p => p.name?.toLowerCase().includes(q) || p.ref?.toLowerCase().includes(q) || p.barcode?.includes(q));
    if (!product) return alert('Produit introuvable');
    const qty = Math.max(1, Number(manual.qty) || 1);
    setItems(current => [
      ...current,
      {
        product,
        productId: product.id,
        productName: product.name,
        ref: product.ref || '',
        quantity: qty,
        unit: product.unit || 'pce',
        buyPrice: Number(product.buyPrice || 0),
        estimatedTotal: qty * Number(product.buyPrice || 0),
        reason: 'Ajout manuel',
      },
    ]);
    setManual({ name: '', qty: 1 });
  }

  async function saveList() {
    setSaving(true);
    const id = await createShoppingList({
      title: `Liste courses ${new Date().toLocaleDateString('fr-DZ')}`,
      source: mode,
      items,
    });
    await db.shoppingLists.update(id, { estimatedTotal: total, updatedAt: nowISO() });
    setLastList(await getLatestShoppingList());
    setSaving(false);
  }

  const btn = active => ({
    background: active ? C.accent : C.card,
    color: active ? '#fff' : C.sub,
    border: `1px solid ${active ? C.accent : C.border}`,
    borderRadius: 9,
    padding: '7px 10px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 800,
  });

  return (
    <div style={{ position:'fixed', inset:0, zIndex:12000, background:'rgba(0,0,0,.68)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ width:860, maxWidth:'96vw', maxHeight:'92vh', overflow:'hidden', background:C.surface, color:C.text, border:`1.5px solid ${C.accent}50`, borderRadius:16, boxShadow:C.shadow, display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontWeight:900, fontSize:16 }}>Liste de courses IA</div>
            <div style={{ color:C.sub, fontSize:12 }}>Alertes stock, ruptures, prompt IA ou saisie manuelle.</div>
          </div>
          <button onClick={onClose} style={{ border:'none', background:C.redLo, color:C.red, borderRadius:8, width:30, height:30, cursor:'pointer', fontWeight:900 }}>x</button>
        </div>

        <div style={{ padding:16, borderBottom:`1px solid ${C.border}`, display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          <div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
              <button onClick={()=>generate('alerts')} style={btn(mode==='alerts')}>Alertes min</button>
              <button onClick={()=>generate('zero')} style={btn(mode==='zero')}>Stock = 0</button>
              <button onClick={()=>generate('prompt')} style={btn(mode==='prompt')}>Prompt stock</button>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <input value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="ex: filtre, huile, frein..." style={{ flex:1, background:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:'8px 10px', color:C.text }} />
              <button onClick={()=>generate('prompt')} style={btn(true)}>Generer</button>
            </div>
          </div>
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 80px auto', gap:8 }}>
              <input value={manual.name} onChange={e=>setManual(m=>({...m,name:e.target.value}))} placeholder="Nom produit manuel" style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:'8px 10px', color:C.text }} />
              <input type="number" min={1} value={manual.qty} onChange={e=>setManual(m=>({...m,qty:e.target.value}))} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:'8px 10px', color:C.text }} />
              <button onClick={addManual} style={btn(true)}>Ajouter</button>
            </div>
            {lastList && <div style={{ marginTop:8, color:C.sub, fontSize:11 }}>Derniere liste: {lastList.items?.length || 0} article(s) - {fmt(lastList.estimatedTotal || 0)}</div>}
          </div>
        </div>

        <div style={{ flex:1, overflow:'auto', padding:16 }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>{['Produit','Raison','Qté','Prix achat','Total',''].map(h=><th key={h} style={{ textAlign:'left', fontSize:10, color:C.sub, padding:'8px', borderBottom:`1px solid ${C.border}`, textTransform:'uppercase' }}>{h}</th>)}</tr></thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={`${item.productId}-${i}`}>
                  <td style={{ padding:8, fontWeight:800 }}>{item.productName}</td>
                  <td style={{ padding:8, color:C.sub, fontSize:12 }}>{item.reason}</td>
                  <td style={{ padding:8 }}><input type="number" min={1} value={item.quantity} onChange={e=>setItems(rows=>rows.map((r, idx)=>idx===i?{...r, quantity:Number(e.target.value)||1, estimatedTotal:(Number(e.target.value)||1)*Number(r.buyPrice||0)}:r))} style={{ width:70, background:C.bg, border:`1px solid ${C.border}`, borderRadius:7, color:C.text, padding:5 }} /></td>
                  <td style={{ padding:8, color:C.sub }}>{fmt(item.buyPrice)}</td>
                  <td style={{ padding:8, color:C.green, fontWeight:900 }}>{fmt(item.estimatedTotal)}</td>
                  <td style={{ padding:8 }}><button onClick={()=>setItems(rows=>rows.filter((_, idx)=>idx!==i))} style={{ border:'none', background:C.redLo, color:C.red, borderRadius:7, padding:'5px 8px', cursor:'pointer' }}>Supprimer</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && <div style={{ textAlign:'center', color:C.sub, padding:30 }}>Aucun article dans la liste.</div>}
        </div>

        <div style={{ padding:14, borderTop:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontWeight:900, color:C.accent }}>Total estime: {fmt(total)}</div>
          <button onClick={saveList} disabled={!items.length || saving} style={{ border:'none', background:items.length?C.green:C.card, color:'#fff', borderRadius:10, padding:'10px 18px', fontWeight:900, cursor:items.length?'pointer':'not-allowed' }}>{saving?'Enregistrement...':'Enregistrer la liste'}</button>
        </div>
      </div>
    </div>
  );
}
