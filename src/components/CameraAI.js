import { useState, useRef } from 'react';
import { useTheme } from '../ThemeContext'; // ← FIX: remplace 'import C from ../theme'
import { db, nowISO } from '../db';

const GROQ_KEY = () => localStorage.getItem('groq_key') || '';

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

async function analyzeImage(base64, mimeType, systemPrompt, userPrompt) {
  const key = GROQ_KEY();
  if (!key) throw new Error('Clé API Groq manquante. Configurez-la dans les Agents IA.');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 2000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          { type: 'text', text: userPrompt }
        ]}
      ]
    })
  });
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error?.message || `Erreur ${res.status}`); }
  const d = await res.json();
  return d.choices?.[0]?.message?.content || '';
}

// ══════════════════════════════════════════════════════════════════════════════
// MODE 1 — Reconnaissance de produit
// ══════════════════════════════════════════════════════════════════════════════
function ProductRecognition({ onClose, onFound, existingProducts }) {
  const { theme: C } = useTheme(); // ← FIX: dynamique
  const [step, setStep]         = useState('capture');
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile]       = useState(null);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState('');
  const fileRef = useRef();

  function handleFile(file) {
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setStep('preview');
  }

  async function analyze() {
    if (!imageFile) return;
    setStep('analyzing');
    setError('');
    try {
      const base64 = await fileToBase64(imageFile);
      const mime   = imageFile.type || 'image/jpeg';
      const stockList = existingProducts.map(p =>
        `- ${p.name} (catégorie: ${p.category||'Divers'}, stock: ${p.stock} ${p.unit||'pce'})`
      ).join('\n');
      const system = `Tu es un expert en identification de produits commerciaux et industriels.
Tu dois analyser une photo et identifier le produit, puis chercher des correspondances dans un stock existant.
Réponds UNIQUEMENT en JSON valide, sans texte avant ou après.`;
      const user = `Analyse cette photo et identifie le produit.\n\nStock existant:\n${stockList || 'Aucun produit en stock.'}\n\nRéponds en JSON avec cette structure exacte:\n{\n  "identified": "nom du produit identifié",\n  "category": "catégorie probable",\n  "description": "description courte",\n  "confidence": "élevée/moyenne/faible",\n  "similarInStock": [{"name": "...", "reason": "..."}],\n  "suggestedUnit": "pce/L/kg/m/boîte",\n  "suggestedRef": "référence courte"\n}`;
      const raw = await analyzeImage(base64, mime, system, user);
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed  = JSON.parse(cleaned);
      setResult(parsed);
      setStep('result');
    } catch(e) {
      setError(e.message.includes('JSON') ? 'Erreur de lecture. Réessayez avec une photo plus nette.' : e.message);
      setStep('preview');
    }
  }

  function useResult() {
    if (!result) return;
    onFound({ name: result.identified || '', category: result.category || 'Divers', unit: result.suggestedUnit || 'pce', ref: result.suggestedRef || '', buyPrice: '', sellPrice: '', stock: '', minStock: 5, expiry: '', favorite: false, barcode: '' });
    onClose();
  }

  return (
    <div>
      <div style={{ fontWeight:800, fontSize:16, color:C.accent, marginBottom:4 }}>🔍 Reconnaissance de produit</div>
      <div style={{ color:C.sub, fontSize:13, marginBottom:20 }}>Photographiez un produit — l'IA l'identifie et cherche des similaires dans votre stock.</div>

      {(step === 'capture' || step === 'preview') && (
        <div>
          {!imagePreview ? (
            <div onClick={() => fileRef.current.click()}
              style={{ border:`2px dashed ${C.accent}50`, borderRadius:16, padding:48, textAlign:'center', cursor:'pointer', background:C.accentLo, transition:'all .2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor=C.accent}
              onMouseLeave={e => e.currentTarget.style.borderColor=C.accent+'50'}>
              <div style={{ fontSize:48, marginBottom:12 }}>📸</div>
              <div style={{ color:C.accent, fontWeight:700, fontSize:15 }}>Cliquez pour prendre une photo</div>
              <div style={{ color:C.sub, fontSize:12, marginTop:6 }}>ou glissez une image ici</div>
            </div>
          ) : (
            <div>
              <img src={imagePreview} alt="preview" style={{ width:'100%', maxHeight:280, objectFit:'contain', borderRadius:12, border:`1px solid ${C.border}`, marginBottom:14 }} />
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => { setImagePreview(null); setImageFile(null); setStep('capture'); }}
                  style={{ flex:1, background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px', color:C.sub, cursor:'pointer', fontSize:13 }}>
                  🔄 Changer
                </button>
                <button onClick={analyze}
                  style={{ flex:2, background:C.accentGrad||C.accent, border:'none', borderRadius:10, padding:'10px', color:'#000', fontWeight:800, cursor:'pointer', fontSize:14 }}>
                  🔍 Analyser avec l'IA
                </button>
              </div>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={e => handleFile(e.target.files[0])} style={{ display:'none' }} />
          {error && <div style={{ marginTop:12, background:C.redLo, border:`1px solid ${C.red}30`, borderRadius:10, padding:'10px 14px', color:C.red, fontSize:13 }}>⚠ {error}</div>}
        </div>
      )}

      {step === 'analyzing' && (
        <div style={{ textAlign:'center', padding:48 }}>
          <div style={{ fontSize:48, marginBottom:16 }}>🤖</div>
          <div style={{ color:C.accent, fontWeight:700, fontSize:16, marginBottom:8 }}>Analyse en cours...</div>
          <div style={{ color:C.sub, fontSize:13 }}>L'IA identifie votre produit</div>
        </div>
      )}

      {step === 'result' && result && (
        <div>
          <div style={{ background:C.greenLo, border:`1px solid ${C.green}30`, borderRadius:12, padding:16, marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ color:C.green, fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:.8, marginBottom:4 }}>Produit identifié</div>
                <div style={{ fontWeight:900, fontSize:18, color:C.text }}>{result.identified}</div>
                <div style={{ color:C.sub, fontSize:13, marginTop:4 }}>{result.description}</div>
              </div>
              <span style={{ background:result.confidence==='élevée'?C.greenLo:C.amberLo, color:result.confidence==='élevée'?C.green:C.amber, border:`1px solid ${result.confidence==='élevée'?C.green:C.amber}30`, borderRadius:20, padding:'3px 10px', fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>
                {result.confidence === 'élevée' ? '✓ Confiance élevée' : result.confidence === 'moyenne' ? '~ Confiance moyenne' : '? Faible confiance'}
              </span>
            </div>
            <div style={{ marginTop:10, display:'flex', gap:8 }}>
              <span style={{ background:C.blueLo, color:C.blue, border:`1px solid ${C.blue}30`, borderRadius:20, padding:'2px 10px', fontSize:11, fontWeight:700 }}>{result.category}</span>
              <span style={{ background:C.card, color:C.sub, borderRadius:20, padding:'2px 10px', fontSize:11 }}>Unité: {result.suggestedUnit}</span>
            </div>
          </div>

          {result.similarInStock?.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontWeight:700, fontSize:13, marginBottom:10, color:C.amber }}>🔗 Produits similaires dans votre stock :</div>
              {result.similarInStock.map((s, i) => (
                <div key={i} style={{ background:C.amberLo, border:`1px solid ${C.amber}25`, borderRadius:10, padding:'10px 14px', marginBottom:6 }}>
                  <div style={{ fontWeight:700, color:C.amber, fontSize:13 }}>{s.name}</div>
                  <div style={{ color:C.sub, fontSize:12, marginTop:2 }}>{s.reason}</div>
                </div>
              ))}
            </div>
          )}

          {result.similarInStock?.length === 0 && (
            <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'12px 14px', marginBottom:16, color:C.sub, fontSize:13 }}>
              ℹ️ Aucun produit similaire trouvé dans votre stock actuel.
            </div>
          )}

          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => { setStep('capture'); setImagePreview(null); setImageFile(null); setResult(null); }}
              style={{ flex:1, background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px', color:C.sub, cursor:'pointer', fontSize:13 }}>
              🔄 Nouvelle photo
            </button>
            <button onClick={useResult}
              style={{ flex:2, background:C.accent, border:'none', borderRadius:10, padding:'10px', color:'#000', fontWeight:800, cursor:'pointer', fontSize:13 }}>
              + Ajouter comme nouveau produit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODE 2 — Scan bon d'achat
// ══════════════════════════════════════════════════════════════════════════════
function InvoiceScan({ onClose, onProductsImported }) {
  const { theme: C } = useTheme(); // ← FIX: dynamique
  const [step, setStep]           = useState('capture');
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile]       = useState(null);
  const [products, setProducts]   = useState([]);
  const [error, setError]         = useState('');
  const [saving, setSaving]       = useState(false);
  const fileRef = useRef();

  function handleFile(file) {
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setStep('preview');
  }

  async function analyze() {
    if (!imageFile) return;
    setStep('analyzing');
    setError('');
    try {
      const base64 = await fileToBase64(imageFile);
      const mime   = imageFile.type || 'image/jpeg';
      const system = `Tu es un expert en lecture de bons de livraison et factures commerciales algériennes.\nTu dois extraire tous les produits avec leurs informations depuis une photo de bon d'achat.\nRéponds UNIQUEMENT en JSON valide, sans texte avant ou après.`;
      const user = `Lis ce bon d'achat/livraison et extrait tous les produits.\n\nRéponds en JSON avec cette structure exacte:\n{\n  "supplier": "nom du fournisseur si visible, sinon null",\n  "invoiceDate": "date si visible au format YYYY-MM-DD, sinon null",\n  "invoiceNumber": "numéro du bon si visible, sinon null",\n  "products": [{"name": "...", "ref": "...", "quantity": 1, "unit": "pce/L/kg/m/boîte", "buyPrice": 0, "category": "..."}]\n}\nImportant: buyPrice = prix unitaire d'achat. Si pas visible, mets 0.`;
      const raw    = await analyzeImage(base64, mime, system, user);
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed  = JSON.parse(cleaned);
      const prods = (parsed.products || []).map((p, i) => ({
        _id: i, name: p.name || '', ref: p.ref || '', category: p.category || 'Divers',
        unit: p.unit || 'pce', buyPrice: p.buyPrice || 0, sellPrice: '',
        stock: p.quantity || 1, minStock: 5, expiry: '', favorite: false, barcode: '',
        _supplier: parsed.supplier, _invoiceDate: parsed.invoiceDate,
      }));
      setProducts(prods);
      setStep('review');
    } catch(e) {
      setError(e.message.includes('JSON') ? 'Impossible de lire le bon. Essayez avec une photo plus nette et bien éclairée.' : e.message);
      setStep('preview');
    }
  }

  async function saveAll() {
    const invalid = products.filter(p => !p.name.trim());
    if (invalid.length > 0) return alert('Certains produits n\'ont pas de nom.');
    setSaving(true);
    try {
      for (const p of products) {
        const { _id, _supplier, _invoiceDate, ...payload } = p;
        await db.products.add({ ...payload, sellPrice: Number(p.sellPrice) || 0, buyPrice: Number(p.buyPrice) || 0, stock: Number(p.stock) || 0, createdAt: nowISO(), updatedAt: nowISO() });
      }
      onProductsImported(products.length);
      onClose();
    } catch(e) { alert('Erreur lors de la sauvegarde : ' + e.message); }
    setSaving(false);
  }

  function updateProduct(id, field, value) { setProducts(ps => ps.map(p => p._id === id ? { ...p, [field]: value } : p)); }
  function removeProduct(id) { setProducts(ps => ps.filter(p => p._id !== id)); }

  return (
    <div>
      <div style={{ fontWeight:800, fontSize:16, color:C.purple, marginBottom:4 }}>📄 Scanner un bon d'achat</div>
      <div style={{ color:C.sub, fontSize:13, marginBottom:20 }}>Photographiez votre bon de livraison — l'IA ajoute automatiquement les produits avec les prix d'achat.</div>

      {(step === 'capture' || step === 'preview') && (
        <div>
          {!imagePreview ? (
            <div onClick={() => fileRef.current.click()}
              style={{ border:`2px dashed ${C.purple}50`, borderRadius:16, padding:48, textAlign:'center', cursor:'pointer', background:C.purpleLo, transition:'all .2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor=C.purple}
              onMouseLeave={e => e.currentTarget.style.borderColor=C.purple+'50'}>
              <div style={{ fontSize:48, marginBottom:12 }}>📄</div>
              <div style={{ color:C.purple, fontWeight:700, fontSize:15 }}>Photographiez votre bon d'achat</div>
              <div style={{ color:C.sub, fontSize:12, marginTop:6 }}>Bon de livraison · Facture · Liste de prix</div>
            </div>
          ) : (
            <div>
              <img src={imagePreview} alt="bon" style={{ width:'100%', maxHeight:300, objectFit:'contain', borderRadius:12, border:`1px solid ${C.border}`, marginBottom:14 }} />
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => { setImagePreview(null); setImageFile(null); setStep('capture'); }}
                  style={{ flex:1, background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px', color:C.sub, cursor:'pointer', fontSize:13 }}>🔄 Changer</button>
                <button onClick={analyze}
                  style={{ flex:2, background:`linear-gradient(135deg,${C.purple},${C.violet})`, border:'none', borderRadius:10, padding:'10px', color:'#fff', fontWeight:800, cursor:'pointer', fontSize:14 }}>📖 Lire le bon avec l'IA</button>
              </div>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={e => handleFile(e.target.files[0])} style={{ display:'none' }} />
          {error && <div style={{ marginTop:12, background:C.redLo, border:`1px solid ${C.red}30`, borderRadius:10, padding:'10px 14px', color:C.red, fontSize:13 }}>⚠ {error}</div>}
        </div>
      )}

      {step === 'analyzing' && (
        <div style={{ textAlign:'center', padding:48 }}>
          <div style={{ fontSize:48, marginBottom:16 }}>📖</div>
          <div style={{ color:C.purple, fontWeight:700, fontSize:16, marginBottom:8 }}>Lecture en cours...</div>
          <div style={{ color:C.sub, fontSize:13 }}>L'IA lit votre bon et extrait les produits</div>
        </div>
      )}

      {step === 'review' && (
        <div>
          <div style={{ background:C.greenLo, border:`1px solid ${C.green}30`, borderRadius:10, padding:'10px 14px', marginBottom:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ color:C.green, fontWeight:700, fontSize:13 }}>✓ {products.length} produit(s) détecté(s)</span>
            {products[0]?._supplier && <span style={{ color:C.sub, fontSize:12 }}>Fournisseur: {products[0]._supplier}</span>}
          </div>
          <div style={{ background:C.amberLo, border:`1px solid ${C.amber}30`, borderRadius:10, padding:'10px 14px', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:18 }}>✏️</span>
            <span style={{ color:C.amber, fontSize:12, fontWeight:600 }}>Remplissez les <strong>prix de vente</strong> avant d'enregistrer.</span>
          </div>
          <div style={{ maxHeight:360, overflowY:'auto', display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
            {products.map((p) => (
              <div key={p._id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <input value={p.name} onChange={e => updateProduct(p._id, 'name', e.target.value)}
                    style={{ flex:1, background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'7px 10px', color:C.text, fontSize:14, fontWeight:700, outline:'none' }} />
                  <button onClick={() => removeProduct(p._id)} style={{ marginLeft:8, background:C.redLo, border:'none', borderRadius:8, padding:'6px 10px', color:C.red, cursor:'pointer', fontSize:13 }}>✕</button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8 }}>
                  <div>
                    <div style={{ color:C.muted, fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:.6, marginBottom:4 }}>Prix achat</div>
                    <input type="number" value={p.buyPrice} onChange={e => updateProduct(p._id, 'buyPrice', e.target.value)}
                      style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'7px 8px', color:C.sub, fontSize:13, outline:'none' }} />
                  </div>
                  <div>
                    <div style={{ color:C.amber, fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:.6, marginBottom:4 }}>Prix vente ✏️</div>
                    <input type="number" value={p.sellPrice} placeholder="À définir" onChange={e => updateProduct(p._id, 'sellPrice', e.target.value)}
                      style={{ width:'100%', background:C.bg, border:`2px solid ${p.sellPrice ? C.green+'60' : C.amber+'60'}`, borderRadius:8, padding:'7px 8px', color:C.text, fontSize:13, outline:'none', fontWeight:700 }}
                      onFocus={e => e.target.style.borderColor=C.amber}
                      onBlur={e => e.target.style.borderColor=p.sellPrice?C.green+'60':C.amber+'60'} />
                  </div>
                  <div>
                    <div style={{ color:C.muted, fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:.6, marginBottom:4 }}>Stock</div>
                    <input type="number" value={p.stock} onChange={e => updateProduct(p._id, 'stock', e.target.value)}
                      style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'7px 8px', color:C.sub, fontSize:13, outline:'none' }} />
                  </div>
                  <div>
                    <div style={{ color:C.muted, fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:.6, marginBottom:4 }}>Catégorie</div>
                    <select value={p.category} onChange={e => updateProduct(p._id, 'category', e.target.value)}
                      style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, padding:'7px 6px', color:C.sub, fontSize:12, outline:'none' }}>
                      {['Lubrifiants','Filtres','Électrique','Liquides','Distribution','Freinage','Carrosserie','Pneumatiques','Divers'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => { setStep('capture'); setImagePreview(null); setProducts([]); }}
              style={{ flex:1, background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'11px', color:C.sub, cursor:'pointer', fontSize:13 }}>🔄 Rescanner</button>
            <button onClick={saveAll} disabled={saving || products.length === 0}
              style={{ flex:2, background:`linear-gradient(135deg,${C.green},${C.accent})`, border:'none', borderRadius:10, padding:'11px', color:'#000', fontWeight:900, cursor:saving?'not-allowed':'pointer', fontSize:14, opacity: saving ? .6 : 1 }}>
              {saving ? '⏳ Enregistrement...' : `✓ Ajouter ${products.length} produit(s) au stock`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL — Modal CameraAI
// ══════════════════════════════════════════════════════════════════════════════
export default function CameraAI({ onClose, onProductFound, onProductsImported, existingProducts = [] }) {
  const { theme: C } = useTheme(); // ← FIX: dynamique
  const [mode, setMode] = useState(null);

  return (
    <div style={{ position:'fixed', inset:0, background:'#000000aa', zIndex:250, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>

      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:24, width:600, maxWidth:'95vw', maxHeight:'90vh', overflow:'auto', boxShadow:'0 40px 100px #000d' }}>
        <div style={{ padding:'20px 24px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontWeight:900, fontSize:17, fontFamily:C.fontDisplay, color:C.text }}>📸 IA Caméra</div>
            <div style={{ color:C.sub, fontSize:12, marginTop:2 }}>Reconnaissance produit · Scan bon d'achat</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:C.sub, fontSize:24, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>

        <div style={{ padding:24 }}>
          {!mode && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <button onClick={() => setMode('recognize')}
                style={{ background:C.accentLo, border:`2px solid ${C.accent}40`, borderRadius:16, padding:28, cursor:'pointer', textAlign:'center', transition:'all .2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor=C.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor=C.accent+'40'; }}>
                <div style={{ fontSize:44, marginBottom:12 }}>🔍</div>
                <div style={{ fontWeight:800, fontSize:15, color:C.accent, marginBottom:6 }}>Reconnaître un produit</div>
                <div style={{ color:C.sub, fontSize:12, lineHeight:1.5 }}>Photographiez un article et l'IA l'identifie automatiquement</div>
              </button>
              <button onClick={() => setMode('invoice')}
                style={{ background:C.purpleLo, border:`2px solid ${C.purple}40`, borderRadius:16, padding:28, cursor:'pointer', textAlign:'center', transition:'all .2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor=C.purple; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor=C.purple+'40'; }}>
                <div style={{ fontSize:44, marginBottom:12 }}>📄</div>
                <div style={{ fontWeight:800, fontSize:15, color:C.purple, marginBottom:6 }}>Scanner un bon d'achat</div>
                <div style={{ color:C.sub, fontSize:12, lineHeight:1.5 }}>Photographiez un bon de livraison — l'IA extrait les produits automatiquement</div>
              </button>
            </div>
          )}

          {mode === 'recognize' && (
            <div>
              <button onClick={() => setMode(null)} style={{ background:'none', border:'none', color:C.sub, cursor:'pointer', fontSize:13, marginBottom:16, display:'flex', alignItems:'center', gap:6 }}>← Retour</button>
              <ProductRecognition onClose={onClose} onFound={onProductFound} existingProducts={existingProducts} />
            </div>
          )}

          {mode === 'invoice' && (
            <div>
              <button onClick={() => setMode(null)} style={{ background:'none', border:'none', color:C.sub, cursor:'pointer', fontSize:13, marginBottom:16, display:'flex', alignItems:'center', gap:6 }}>← Retour</button>
              <InvoiceScan onClose={onClose} onProductsImported={onProductsImported} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}