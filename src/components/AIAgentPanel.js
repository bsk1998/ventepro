import { useTheme } from '../ThemeContext';
import { useState, useRef, useEffect } from 'react';

import { db, fmt } from '../db';

const AGENTS_ADMIN = [
  {
    id:'stock', icon:'📦', name:'Agent Stock', color:'#FFC04D',
    desc:'Historique complet · Mouvements · Analyses',
    prompt:`Tu es un expert en gestion de stock avec accès COMPLET à toutes les données.
Tu peux répondre à des questions comme:
- Quand tel produit a été vendu et à qui
- Quand il a été acheté et à quel prix
- Combien de fois il a été vendu ce mois/cette année
- Quels produits se vendent le mieux/moins bien
- Prévisions de réapprovisionnement
- Historique complet des mouvements de stock
Sois précis, utilise les vraies données, donne des conseils proactifs.`,
    suggestions:['Quand ai-je vendu de l\'huile moteur ?','Produit le plus vendu ?','Que commander cette semaine ?','Analyse mon stock complet']
  },
  {
    id:'sales', icon:'🧾', name:'Agent Ventes', color:'#00E5A0',
    desc:'Analyse · Tendances · Performance',
    prompt:`Tu es un analyste commercial expert avec accès à TOUTES les ventes.
Tu peux répondre:
- Chiffre d'affaires par jour/semaine/mois/année
- Ventes par client, par produit, par vendeur
- Heures de pointe, jours les plus actifs
- Comparaisons de périodes
- Prévisions et tendances
- Clients qui n'ont pas acheté depuis longtemps
Analyse en profondeur et donne des conseils stratégiques.`,
    suggestions:['CA de cette semaine ?','Meilleur client ce mois ?','Comparer avec le mois dernier','Heures de pointe ?']
  },
  {
    id:'clients', icon:'👥', name:'Agent Clients', color:'#4D9FFF',
    desc:'Crédits · Fidélité · Recouvrement',
    prompt:`Tu es un expert relation client avec accès à TOUS les dossiers clients.
Tu peux:
- Identifier les clients avec impayés et les montants exacts
- Voir l'historique complet d'un client
- Suggérer qui relancer et comment
- Analyser la fidélité des clients
- Identifier les meilleurs clients
- Alerter sur les risques de créances douteuses
Sois proactif et donne des recommandations concrètes.`,
    suggestions:['Qui me doit de l\'argent ?','Historique de Rachid ?','Clients à relancer ?','Meilleurs clients fidèles ?']
  },
  {
    id:'finance', icon:'💰', name:'Agent Finance', color:'#C084FC',
    desc:'Trésorerie · Marges · Zakat · Bilan',
    prompt:`Tu es un comptable et conseiller financier expert.
Tu analyses:
- Trésorerie en temps réel
- Marges par produit et par catégorie
- Rentabilité globale et par période
- Calcul précis de la Zakat
- Dépenses vs recettes
- Conseils pour optimiser les profits
Donne des analyses financières professionnelles et des conseils pratiques.`,
    suggestions:['Bilan du mois ?','Ma marge nette ?','Calculer la zakat ?','Où je perds de l\'argent ?']
  },
  {
    id:'hr', icon:'👨‍💼', name:'Agent RH', color:'#8B5CF6',
    desc:'Employés · Performance · Salaires',
    prompt:`Tu es un DRH expert avec accès aux données RH complètes.
Tu analyses:
- Performance de chaque vendeur (CA généré, nombre de ventes)
- Comparaison entre employés
- Charges salariales vs CA généré
- Suggestions pour motiver l'équipe
- Alertes sur les performances faibles
Donne des analyses RH objectives et des recommandations.`,
    suggestions:['Meilleur vendeur ?','Performance de l\'équipe ?','Ratio salaires/CA ?','Qui vend le plus ?']
  },
  {
    id:'assistant', icon:'🤖', name:'Assistant Général', color:'#00D4FF',
    desc:'Aide · Conseils · Questions générales',
    prompt:`Tu es l'assistant général de VenteX AI, un logiciel de gestion commerciale.
Tu aides avec:
- Toute question sur le logiciel
- Conseils de gestion commerciale
- Stratégies pour améliorer les ventes
- Gestion quotidienne du magasin
- Réponses aux questions générales
Sois utile, pratique et adapté au contexte algérien.`,
    suggestions:['Comment améliorer mes ventes ?','Conseils pour ce mois ?','Comment utiliser le logiciel ?','Résumé de la journée ?']
  },
];

const AGENTS_EMPLOYEE = [
  {
    id:'stock', icon:'📦', name:'Agent Stock', color:'#FFC04D',
    desc:'Vérifier le stock disponible',
    prompt:`Tu es un assistant stock pour employé. Tu peux donner:
- Le stock actuel des produits
- Les produits en rupture
- Les prix de vente
Pas d'accès aux prix d'achat ni aux données financières.`,
    suggestions:['Stock disponible ?','Produits en rupture ?','Prix de ce produit ?']
  },
  {
    id:'assistant', icon:'🤖', name:'Assistant', color:'#00D4FF',
    desc:'Aide générale pour les employés',
    prompt:`Tu es un assistant pour employé de magasin. Tu aides avec les tâches quotidiennes de vente. Tu n'as PAS accès aux données financières, salaires, ou informations confidentielles.`,
    suggestions:['Comment faire une vente ?','Comment ajouter un client ?','Aide rapide ?']
  },
];

async function getAllData() {
  const [products, clients, suppliers, employees, sales, saleItems, payments, expenses] = await Promise.all([
    db.products.toArray(),
    db.clients.toArray(),
    db.suppliers.toArray(),
    db.employees.toArray(),
    db.sales.orderBy('createdAt').reverse().limit(200).toArray(),
    db.saleItems.toArray(),
    db.payments.toArray(),
    db.expenses.toArray(),
  ]);

  const enrichedClients = clients.map(c => {
    const clientSales = sales.filter(s => s.clientId === c.id);
    return {
      ...c,
      totalAchete: clientSales.reduce((s,v) => s+Number(v.total||0), 0),
      totalPaye: clientSales.reduce((s,v) => s+Number(v.paid||0), 0),
      nombreAchats: clientSales.length,
      derniereVisite: clientSales[0]?.createdAt || null,
    };
  });

  const enrichedProducts = products.map(p => {
    const prodItems = saleItems.filter(i => i.productId === p.id);
    const totalVendu = prodItems.reduce((s,i) => s+i.qty, 0);
    const caGenere = prodItems.reduce((s,i) => s+i.unitPrice*i.qty, 0);
    return { ...p, totalVendu, caGenere };
  });

  return { products: enrichedProducts, clients: enrichedClients, suppliers, employees, sales, saleItems, payments, expenses };
}

function localFallback(agentId, question, data) {
  const { products=[], clients=[], sales=[], employees=[], expenses=[] } = data;
  const q = question.toLowerCase();

  if (agentId === 'stock') {
    const ruptures = products.filter(p=>p.stock===0);
    const bas = products.filter(p=>p.stock>0&&p.stock<=p.minStock);
    const topVendu = [...products].sort((a,b)=>(b.totalVendu||0)-(a.totalVendu||0)).slice(0,3);
    return `📦 Analyse Stock (mode hors-ligne)\n\n🔴 Ruptures: ${ruptures.map(p=>p.name).join(', ')||'Aucune'}\n🟡 Stock bas: ${bas.map(p=>`${p.name}(${p.stock})`).join(', ')||'Aucun'}\n\n🏆 Top vendus:\n${topVendu.map(p=>`• ${p.name}: ${p.totalVendu||0} unités`).join('\n')}`;
  }
  if (agentId === 'sales') {
    const ca = sales.reduce((s,v)=>s+Number(v.total||0),0);
    const today = new Date().toISOString().slice(0,10);
    const caToday = sales.filter(s=>s.createdAt?.startsWith(today)).reduce((s,v)=>s+Number(v.total||0),0);
    return `📊 Analyse Ventes\n\nCA total: ${fmt(ca)}\nCA aujourd'hui: ${fmt(caToday)}\nNombre ventes: ${sales.length}\nDont crédit: ${sales.filter(s=>s.status==='crédit').length}`;
  }
  if (agentId === 'clients') {
    const debiteurs = clients.filter(c=>(c.totalAchete-c.totalPaye)>0).sort((a,b)=>(b.totalAchete-b.totalPaye)-(a.totalAchete-a.totalPaye));
    return `👥 Analyse Clients\n\nTotal clients: ${clients.length}\nAvec crédit: ${debiteurs.length}\n\nTop débiteurs:\n${debiteurs.slice(0,5).map(c=>`• ${c.name}: ${fmt(c.totalAchete-c.totalPaye)}`).join('\n')||'Aucun impayé ✅'}`;
  }
  if (agentId === 'finance') {
    const ca = sales.reduce((s,v)=>s+Number(v.total||0),0);
    const dep = expenses.reduce((s,e)=>s+Number(e.amount||0),0);
    return `💰 Bilan Financier\n\nCA total: ${fmt(ca)}\nDépenses: ${fmt(dep)}\nBénéfice: ${fmt(ca-dep)}\nZakat (2.5%/an): ${fmt((ca-dep)*0.025)}`;
  }
  if (agentId === 'hr') {
    const actifs = employees.filter(e=>e.active);
    const masse = actifs.reduce((s,e)=>s+Number(e.salary||0),0);
    return `👨‍💼 Rapport RH\n\nEmployés actifs: ${actifs.length}\nMasse salariale: ${fmt(masse)}/mois\n${actifs.map(e=>`• ${e.name}(${e.role}): ${fmt(e.salary)}/mois`).join('\n')}`;
  }
  return `🤖 Assistant hors-ligne\n\nProduits: ${products.length} | Stock critique: ${products.filter(p=>p.stock<=p.minStock).length}\nClients: ${clients.length} | Ventes: ${sales.length}`;
}

export default function AIAgentPanel({ onClose, userRole='admin' }) {
  const { theme: C, applyFromAgent } = useTheme();
  const AGENTS = userRole === 'admin' ? AGENTS_ADMIN : AGENTS_EMPLOYEE;
  const [activeAgent, setActiveAgent] = useState(AGENTS[0]);
  const [msgs, setMsgs] = useState({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [allData, setAllData] = useState(null);
  const endRef = useRef();

  useEffect(() => {
    getAllData().then(setAllData);
  }, []);

  const agentMsgs = msgs[activeAgent.id] || [{
    role:'ai',
    text:`Bonjour ! Je suis votre **${activeAgent.name}**.\n${activeAgent.desc}.\n\n${userRole==='admin'?'✅ Accès complet aux données activé.':'⚡ Mode employé.'}\n\nComment puis-je vous aider ?`,
  }];

  async function send(q) {
    const question = q||input;
    if (!question.trim()||loading) return;
    setInput('');
    const newMsgs = [...agentMsgs, {role:'user', text:question}];
    setMsgs(m=>({...m,[activeAgent.id]:newMsgs}));
    setLoading(true);

    const data = allData || await getAllData();
    let reply = '';

    try {
      const dataCtx = userRole === 'admin'
        ? `PRODUITS (avec historique ventes): ${JSON.stringify(data.products?.slice(0,30))}
CLIENTS (avec historique): ${JSON.stringify(data.clients?.slice(0,20))}
FOURNISSEURS: ${JSON.stringify(data.suppliers)}
EMPLOYES: ${JSON.stringify(data.employees)}
VENTES RECENTES (200): ${JSON.stringify(data.sales?.slice(0,50))}
LIGNES VENTES: ${JSON.stringify(data.saleItems?.slice(0,100))}
DEPENSES: ${JSON.stringify(data.expenses?.slice(0,30))}
DATE: ${new Date().toLocaleDateString('fr-DZ',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}`
        : `PRODUITS (stock et prix vente seulement): ${JSON.stringify(data.products?.map(p=>({id:p.id,name:p.name,stock:p.stock,unit:p.unit,sellPrice:p.sellPrice})))}`;

      const controller = new AbortController();
      const timeout = setTimeout(()=>controller.abort(), 10000);

      const key = localStorage.getItem('groq_key') || '';
      if (!key) {
        reply = "⚠️ Clé API Groq manquante. Cliquez sur '🔑 Clé API' pour la configurer.\n\nObtenez-la gratuitement sur console.groq.com";
        setOffline(true);
      } else {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method:'POST', signal:controller.signal,
          headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},
          body: JSON.stringify({
            model:'llama-3.3-70b-versatile', max_tokens:1500,
            messages:[
              {role:'system', content:`${activeAgent.prompt}\n\nDONNEES:\n${dataCtx}\n\nRÈGLES: réponds uniquement à ce qui est demandé. Bonjour = réponse courte. Français naturel.`},
              ...newMsgs.filter((_,i)=>i>0).map(m=>({role:m.role==='ai'?'assistant':'user',content:m.text}))
            ]
          })
        });
        clearTimeout(timeout);
        const d = await res.json();
        reply = d.choices?.[0]?.message?.content || 'Erreur de réponse.';
        setOffline(false);
      }
    } catch {
      setOffline(true);
      reply = localFallback(activeAgent.id, question, data) + '\n\n_💡 Mode hors-ligne — analyse locale._';
    }

    // Agent Design: apply theme change
    if (activeAgent.id === 'design' && typeof applyFromAgent === 'function') {
      applyFromAgent(reply);
    }
    setMsgs(m=>({...m,[activeAgent.id]:[...newMsgs,{role:'ai',text:reply}]}));
    setLoading(false);
    setTimeout(()=>endRef.current?.scrollIntoView({behavior:'smooth'}),100);
  }

  return (
    <div style={{position:'fixed',inset:0,background:'#00000099',zIndex:200,
      display:'flex',alignItems:'center',justifyContent:'center',
      backdropFilter:'blur(4px)'}}>
      <div style={{background:'#0E1220',border:'1px solid #1B2135',borderRadius:24,
        width:960,maxWidth:'97vw',height:'90vh',display:'flex',overflow:'hidden',
        boxShadow:'0 40px 120px #000e, 0 0 80px rgba(0,212,255,0.06)'}}>

        {/* Sidebar */}
        <div style={{width:250,background:'#0A0D18',borderRight:'1px solid #1B2135',
          display:'flex',flexDirection:'column',padding:'20px 12px'}}>
          <div style={{padding:'0 8px 20px'}}>
            <div style={{fontWeight:900,fontSize:16,color:'#00D4FF',letterSpacing:-.5}}>🤖 VenteX IA</div>
            <div style={{color:offline?'#FFC04D':'#00E5A0',fontSize:11,marginTop:4,display:'flex',alignItems:'center',gap:5}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:offline?'#FFC04D':'#00E5A0'}}/>
              {offline?'Mode hors-ligne':'Connecté · Données live'}
            </div>
            <div style={{color:'#3A4260',fontSize:10,marginTop:4}}>
              {userRole==='admin'?'👑 Mode Administrateur':'👨‍💼 Mode Employé'}
            </div>
          </div>

          {AGENTS.map(a=>(
            <button key={a.id} onClick={()=>setActiveAgent(a)} style={{
              display:'flex',alignItems:'center',gap:10,padding:'11px 12px',
              borderRadius:12,border:'none',cursor:'pointer',textAlign:'left',marginBottom:5,
              background:activeAgent.id===a.id?a.color+'18':'none',
              borderLeft:`3px solid ${activeAgent.id===a.id?a.color:'transparent'}`,
              transition:'all .15s',
            }}>
              <span style={{fontSize:20}}>{a.icon}</span>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:activeAgent.id===a.id?a.color:C.text}}>{a.name}</div>
                <div style={{fontSize:10,color:'#3A4260',marginTop:1,lineHeight:1.3}}>{a.desc}</div>
              </div>
            </button>
          ))}

          <div style={{flex:1}}/>
          <button onClick={onClose} style={{background:'#FF4D6A10',border:'1px solid #FF4D6A25',
            borderRadius:10,padding:'9px',color:'#FF4D6A',fontWeight:700,cursor:'pointer',fontSize:12,width:'100%'}}>
            ✕ Fermer
          </button>
        </div>

        {/* Chat */}
        <div style={{flex:1,display:'flex',flexDirection:'column'}}>
          <div style={{padding:'18px 22px',borderBottom:'1px solid #1B2135',
            background:activeAgent.color+'08',display:'flex',alignItems:'center',gap:14}}>
            <span style={{fontSize:30}}>{activeAgent.icon}</span>
            <div>
              <div style={{fontWeight:800,fontSize:16,color:activeAgent.color}}>{activeAgent.name}</div>
              <div style={{color:'#7A85AA',fontSize:12,marginTop:2}}>{activeAgent.desc}</div>
            </div>
            {loading&&<div style={{marginLeft:'auto',color:'#7A85AA',fontSize:12}}>⏳ Analyse...</div>}
          </div>

          <div style={{flex:1,overflowY:'auto',padding:'16px 20px',display:'flex',flexDirection:'column',gap:10}}>
            {agentMsgs.map((m,i)=>(
              <div key={i} style={{
                alignSelf:m.role==='user'?'flex-end':'flex-start',
                background:m.role==='user'?activeAgent.color:(C.chatAiBg||C.card),
                color:m.role==='user'?'#fff':(C.chatAiText||C.text),
                padding:'11px 16px',
                borderRadius:m.role==='user'?'16px 16px 4px 16px':'16px 16px 16px 4px',
                maxWidth:'82%',fontSize:13.5,lineHeight:1.7,whiteSpace:'pre-wrap',
                border:m.role==='ai'?'1px solid #1B2135':'none',
                boxShadow:m.role==='ai'?'0 4px 12px rgba(0,0,0,0.3)':'none',
              }}>{m.text.replace(/\*\*(.*?)\*\*/g,'$1')}</div>
            ))}
            {loading&&(
              <div style={{alignSelf:'flex-start',background:C.chatAiBg||C.card,border:`1px solid ${C.chatBorder||C.border}`,
                padding:'11px 16px',borderRadius:'16px 16px 16px 4px',
                display:'flex',gap:6,alignItems:'center'}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:activeAgent.color,animation:'pulse 1s infinite'}}/>
                <div style={{width:8,height:8,borderRadius:'50%',background:activeAgent.color,animation:'pulse 1s infinite .2s',opacity:.7}}/>
                <div style={{width:8,height:8,borderRadius:'50%',background:activeAgent.color,animation:'pulse 1s infinite .4s',opacity:.4}}/>
              </div>
            )}
            <div ref={endRef}/>
          </div>

          <div style={{padding:'8px 18px',display:'flex',gap:6,flexWrap:'wrap',borderTop:'1px solid #1B2135'}}>
            {activeAgent.suggestions.map(s=>(
              <button key={s} onClick={()=>send(s)} style={{
                background:activeAgent.color+'12',border:`1px solid ${activeAgent.color}28`,
                borderRadius:20,padding:'5px 14px',color:activeAgent.color,
                fontSize:11,cursor:'pointer',fontWeight:600,transition:'all .15s'}}
                onMouseEnter={e=>e.currentTarget.style.background=activeAgent.color+'25'}
                onMouseLeave={e=>e.currentTarget.style.background=activeAgent.color+'12'}>
                {s}
              </button>
            ))}
          </div>

          <div style={{padding:'14px 18px',display:'flex',gap:10,borderTop:'1px solid #1B2135'}}>
            <input value={input} onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&send()}
              placeholder={`Demander à ${activeAgent.name}...`}
              style={{flex:1,background:'#07090F',border:'1px solid #1B2135',borderRadius:12,
                padding:'12px 16px',color:'#EDF1FF',fontSize:14,outline:'none',
                transition:'border-color .2s'}}
              onFocus={e=>e.target.style.borderColor=activeAgent.color}
              onBlur={e=>e.target.style.borderColor='#1B2135'}/>
            <button onClick={()=>send()} disabled={loading} style={{
              background:loading?'#1B2135':`linear-gradient(135deg,${activeAgent.color},${activeAgent.color}90)`,
              border:'none',borderRadius:12,padding:'12px 22px',
              color:activeAgent.color==='#00D4FF'?'#000':'#fff',
              fontWeight:900,cursor:loading?'not-allowed':'pointer',fontSize:16,
              transition:'all .2s'}}>→</button>
          </div>
        </div>
      </div>
    </div>
  );
}