import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../ThemeContext';
import { db, fmt } from '../db';

export default function GlobalSearch({ onNavigate, onOpenAI }) {
  const { theme: C, metier } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef();

  // Raccourcis clavier globaux
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey && e.key==='k') || (e.key==='/' && !['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (e.key==='Escape') { setOpen(false); setQuery(''); return; }
      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        const MAP = {d:'dashboard',p:'products',v:'sales',c:'clients',f:'suppliers',e:'employees',t:'treasury',r:'reports',s:'settings'};
        if (MAP[e.key]) { e.preventDefault(); onNavigate(MAP[e.key]); return; }
        if (e.key==='i') { e.preventDefault(); if(onOpenAI) onOpenAI(); return; }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNavigate, onOpenAI]);

  useEffect(() => {
    const handleClick = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function search(q) {
    setQuery(q);
    if (!q.trim() || q.length < 2) { setResults([]); setOpen(false); return; }
    setOpen(true);
    const [products, clients, sales] = await Promise.all([
      db.products.toArray(),
      db.clients.toArray(),
      db.sales.orderBy('createdAt').reverse().limit(100).toArray(),
    ]);
    const S = q.toLowerCase();
    const res = [];
    products.filter(p => p.name?.toLowerCase().includes(S)||p.ref?.toLowerCase().includes(S)||p.barcode?.includes(S)).slice(0,4).forEach(p =>
      res.push({ type:'product', icon: metier.productIcon||'📦', color:C.amber, title:p.name, sub:`Stock: ${p.stock} ${p.unit} · ${fmt(p.sellPrice)}`, page:'products' })
    );
    clients.filter(c => c.name?.toLowerCase().includes(S)||c.phone?.includes(S)).slice(0,3).forEach(c =>
      res.push({ type:'client', icon: metier.navIcons?.clients||'👥', color:C.blue, title:c.name, sub:`📞 ${c.phone||'—'}`, page:'clients' })
    );
    sales.filter(s => s.clientName?.toLowerCase().includes(S)||String(s.id).includes(S)).slice(0,3).forEach(s =>
      res.push({ type:'vente', icon: metier.navIcons?.sales||'🧾', color:C.green, title:`Vente VP-${String(s.id).padStart(4,'0')}`, sub:`${s.clientName} · ${fmt(s.total)}`, page:'sales' })
    );
    setResults(res);
  }

  function handleSelect(r) { setQuery(''); setResults([]); setOpen(false); if (onNavigate) onNavigate(r.page); }

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <div style={{ position:'relative' }}>
        <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:C.muted, fontSize:13 }}>🔍</span>
        <input
          value={query} onChange={e=>search(e.target.value)}
          onFocus={()=>query.length>=2&&setOpen(true)}
          placeholder="Recherche... (Ctrl+K)"
          style={{ width:'100%', background:C.bg, border:`1px solid ${open?C.accent:C.border}`,
            borderRadius:10, padding:'8px 30px 8px 30px', color:C.text, fontSize:12,
            outline:'none', fontFamily:C.fontBody, transition:'border-color .2s', boxSizing:'border-box' }}/>
        {query && (
          <button onClick={()=>{setQuery('');setResults([]);setOpen(false);}}
            style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)',
              background:'none', border:'none', color:C.muted, cursor:'pointer', fontSize:15 }}>×</button>
        )}
      </div>

      {open && results.length>0 && (
        <div style={{ position:'absolute', top:'110%', left:0, right:0, zIndex:999,
          background:C.card, border:`1px solid ${C.border}`, borderRadius:12, boxShadow:C.shadow, overflow:'hidden' }}>
          {results.map((r,i)=>(
            <div key={i} onClick={()=>handleSelect(r)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', cursor:'pointer',
                borderBottom:i<results.length-1?`1px solid ${C.border}`:'none' }}
              onMouseEnter={e=>e.currentTarget.style.background=C.accentLo}
              onMouseLeave={e=>e.currentTarget.style.background='none'}>
              <div style={{ width:30, height:30, borderRadius:7, background:r.color+'20',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>{r.icon}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</div>
                <div style={{ fontSize:10, color:C.sub, marginTop:1 }}>{r.sub}</div>
              </div>
              <div style={{ fontSize:9, color:r.color, fontWeight:700, textTransform:'uppercase', letterSpacing:.5 }}>{r.type}</div>
            </div>
          ))}
        </div>
      )}

      {open && query.length>=2 && results.length===0 && (
        <div style={{ position:'absolute', top:'110%', left:0, right:0, zIndex:999,
          background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:'14px',
          textAlign:'center', color:C.sub, fontSize:12, boxShadow:C.shadow }}>
          Aucun résultat pour "<strong style={{color:C.text}}>{query}</strong>"
        </div>
      )}
    </div>
  );
}
