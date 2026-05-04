import { useTheme } from '../ThemeContext';
import { useState, useRef, useEffect } from 'react';
import { db, fmt, nowISO } from '../db';

const AGENTS_ADMIN = [
  {
    id:'stock', icon:'📦', name:'Agent Stock', color:'#FFC04D',
    desc:'Gestion complète · Alertes · Analyses',
    prompt:`Tu es un EXPERT EN GESTION DE STOCK avec ACCÈS TOTAL à la base de données.

COMPÉTENCES PRINCIPALES:
- Identifier les produits en rupture et stock critique
- Recommander les quantités à commander
- Analyser les mouvements de stock
- Calculer le coût du stock immobilisé
- Identifier les produits lents à vendre
- Suggestions d'optimisation du réapprovisionnement

DONNÉES DISPONIBLES: historique complet des ventes, stocks actuels, prix d'achat.

RÈGLES: Sois précis, donne des chiffres exacts, propose des actions concrètes.`,
    suggestions:['Quels produits réapprovisionner ?','Stock critique ?','Coût stock total ?','Produits les plus lents ?']
  },
  {
    id:'sales', icon:'🧾', name:'Agent Ventes', color:'#00E5A0',
    desc:'CA · Tendances · Conseils commerciaux',
    prompt:`Tu es un EXPERT COMMERCIAL avec ACCÈS à TOUS les chiffres de vente.

COMPÉTENCES:
- Calculer le chiffre d'affaires par période
- Identifier les clients VIP et les pertes
- Analyser les tendances de vente
- Conseiller sur l'augmentation du CA
- Identifier les heures/jours de pointe
- Recommander les meilleurs produits à promouvoir

TÂCHES PRATIQUES:
- Générer un rapport de vente rapide
- Identifier les clients à relancer
- Suggestions pour augmenter les ventes
- Analyse comparative de périodes

RÈGLES: Sois commercial, donne des conseils actionnables.`,
    suggestions:['CA de cette semaine ?','Meilleur client ?','Produits vedettes ?','Heures de pointe ?']
  },
  {
    id:'clients', icon:'👥', name:'Agent Clients', color:'#4D9FFF',
    desc:'Crédits · Recouvrement · Fidélité',
    prompt:`Tu es un GESTIONNAIRE CLIENTS EXPERT pour le recouvrement et la fidélité.

COMPÉTENCES:
- Identifier tous les clients avec crédits non payés
- Montants exacts de chaque créance
- Historique d'achat complet par client
- Segmenter les clients (VIP, réguliers, occasionnels)
- Conseiller sur le recouvrement
- Calculer la valeur à vie de chaque client

TÂCHES SPÉCIFIQUES:
- Lister les débiteurs avec montants
- Proposer un plan de relance
- Identifier les meilleurs clients fidèles
- Évaluer le risque de créance douteuse
- Calculer les relances nécessaires

RÈGLES: Sois proactif, donne des nombres concrets, des plans d'action.`,
    suggestions:['Qui doit le plus ?','Plan de recouvrement ?','Clients fidèles ?','Risque créances ?']
  },
  {
    id:'finance', icon:'💰', name:'Agent Finance', color:'#C084FC',
    desc:'Trésorerie · Marges · Zakat · Bilans',
    prompt:`Tu es un EXPERT COMPTABLE & FINANCIER avec ACCÈS COMPLET aux données économiques.

COMPÉTENCES PRINCIPALES:
- Calcul trésorerie en temps réel
- Analyse des marges par produit/catégorie
- Rentabilité globale et par période
- CALCUL ZAKAT ISLAMIQUE (2.5% des actifs)
- Bilans détaillés
- Ratios de rentabilité
- Conseils d'optimisation fiscale & financière

TÂCHES SPÉCIFIQUES:
✓ Créer des FACTURES d'achat/vente
✓ Calculer la ZAKAT du commerce (avec détails)
✓ Générer des BILANS mensuels/annuels
✓ Analyser la rentabilité par catégorie
✓ Créer des RAPPORTS FINANCIERS
✓ Identifier les points de dépenses
✓ Recommander des optimisations

FORMAT ZAKAT: Montant net de marchandises + créances - dettes = base zakat.

RÈGLES: Sois rigoureux, transparent, donne des fichiers exploitables.`,
    suggestions:['Bilan du mois ?','Calculer zakat ?','Marges par catégorie ?','Créer facture ?']
  },
  {
    id:'hr', icon:'👨‍💼', name:'Agent RH', color:'#8B5CF6',
    desc:'Vendeurs · Performance · Masse salariale',
    prompt:`Tu es un RESPONSABLE RH EXPERT avec données complètes sur performance.

COMPÉTENCES:
- Classement vendeurs par CA généré
- Nombre et valeur des ventes par vendeur
- Analyse ROI salaire vs CA généré
- Ratio productivité vendeur
- Performance quotidienne/hebdomadaire
- Recommandations de motivation/sanction
- Calcul commissions basées sur performances

TÂCHES:
- Classement vendeurs (CA généré, nombre ventes)
- Analyse individuelle + comparative
- Identifier les stars et underperformers
- Proposer des commissions basées sur performance
- Genérer rapports de performance
- Recommander bonifications/améliorations

RÈGLES: Sois objectif, base-toi sur les chiffres réels, sois constructif.`,
    suggestions:['Meilleur vendeur ?','Performance équipe ?','Ratio CA/Salaire ?','Commissions ?']
  },
  {
    id:'assistant', icon:'🤖', name:'Assistant Général', color:'#00D4FF',
    desc:'Aide globale · Conseils · Questions',
    prompt:`Tu es l'ASSISTANT GÉNÉRAL expert en gestion commerciale pour VenteX AI.

DOMAINES D'EXPERTISE:
- Conseils stratégiques généraux
- Utilisation du logiciel VenteX AI
- Bonnes pratiques commerciales
- Gestion quotidienne du magasin
- Questions sur les fonctionnalités
- Optimisation globale du business
- Réponses aux questions générales

TÂCHES:
- Expliquer les fonctionnalités du logiciel
- Donner des conseils de gestion
- Répondre aux questions métier
- Proposer des améliorations
- Fournir du soutien général

ADAPTATION: Adapte tes réponses au contexte algérien, au secteur d'activité.`,
    suggestions:['Comment vendre plus ?','Utiliser le logiciel ?','Conseils stratégiques ?','Résumé de la journée ?']
  },
];

const AGENTS_EMPLOYEE = [
  {
    id:'stock', icon:'📦', name:'Agent Stock', color:'#FFC04D',
    desc:'Consulter le stock en temps réel',
    prompt:`Tu es un assistant stock pour les employés.

ACCÈS LIMITÉ:
✓ Stock actuel de tous les produits
✓ Prix de vente uniquement
✓ Disponibilité produits

ACCÈS REFUSÉ:
✗ Prix d'achat
✗ Coûts
✗ Données financières

TÂCHES:
- Vérifier disponibilité produit
- Consulter prix de vente
- Alertes stock bas
- Informer sur remplaçants possibles`,
    suggestions:['Stock de ce produit ?','Produits en rupture ?','Prix de vente ?']
  },
  {
    id:'assistant', icon:'🤖', name:'Assistant', color:'#00D4FF',
    desc:'Aide et conseils pour la journée',
    prompt:`Tu es un assistant pour employés/vendeurs.

ACCÈS:
✓ Aide sur les ventes
✓ Conseils pratiques
✓ Questions sur le travail
✓ Assistance générale

ACCÈS REFUSÉ:
✗ Données confidentielles
✗ Informations financières
✗ Données RH

Sois encourageant, pratique et utile.`,
    suggestions:['Comment faire vente ?','Questions rapides ?','Aide ?']
  },
];

async function getAllData() {
  const [products, clients, suppliers, employees, sales, saleItems, payments, expenses] = await Promise.all([
    db.products.toArray(),
    db.clients.toArray(),
    db.suppliers.toArray(),
    db.employees.toArray(),
    db.sales.orderBy('createdAt').reverse().limit(300).toArray(),
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
    const topVendu = [...products].sort((a,b)=>(b.totalVendu||0)-(a.totalVendu||0)).slice(0,5);
    return `📦 RAPPORT STOCK\n\n🔴 RUPTURES (${ruptures.length}): ${ruptures.map(p=>p.name).join(', ')||'Aucune'}\n🟡 STOCK BAS (${bas.length}): ${bas.map(p=>`${p.name}(${p.stock})`).join(', ')||'Aucun'}\n\n🏆 Top 5 plus vendus:\n${topVendu.map((p,i)=>`${i+1}. ${p.name}: ${p.totalVendu} unités`).join('\n')}`;
  }
  if (agentId === 'sales') {
    const ca = sales.reduce((s,v)=>s+Number(v.total||0),0);
    const today = new Date().toISOString().slice(0,10);
    const caToday = sales.filter(s=>s.createdAt?.startsWith(today)).reduce((s,v)=>s+Number(v.total||0),0);
    const credits = sales.filter(s=>s.status==='crédit').reduce((s,v)=>s+Math.max(0,Number(v.total||0)-Number(v.paid||0)),0);
    return `🧾 RAPPORT VENTES\n\n💰 CA total: ${fmt(ca)}\n📅 CA aujourd'hui: ${fmt(caToday)}\n📊 Ventes: ${sales.length}\n📝 Crédits: ${fmt(credits)}`;
  }
  if (agentId === 'clients') {
    const debiteurs = clients.filter(c=>(c.totalAchete-c.totalPaye)>0).sort((a,b)=>(b.totalAchete-b.totalPaye)-(a.totalAchete-a.totalPaye));
    const totalCredit = debiteurs.reduce((s,c)=>s+(c.totalAchete-c.totalPaye),0);
    return `👥 RAPPORT CLIENTS\n\nTotal: ${clients.length} | Débiteurs: ${debiteurs.length}\nCredit total: ${fmt(totalCredit)}\n\nTop 5 débiteurs:\n${debiteurs.slice(0,5).map(c=>`• ${c.name}: ${fmt(c.totalAchete-c.totalPaye)} DA`).join('\n')}`;
  }
  if (agentId === 'finance') {
    const ca = sales.reduce((s,v)=>s+Number(v.total||0),0);
    const achat = products.reduce((s,p)=>s+(p.stock||0)*(p.buyPrice||0),0);
    const dep = expenses.reduce((s,e)=>s+Number(e.amount||0),0);
    const benefice = ca - dep;
    const zakat = benefice * 0.025;
    return `💰 BILAN FINANCIER\n\n📊 Chiffre d'affaires: ${fmt(ca)}\n📦 Stock immobilisé: ${fmt(achat)}\n💸 Dépenses: ${fmt(dep)}\n📈 Bénéfice brut: ${fmt(benefice)}\n🕌 ZAKAT (2.5%): ${fmt(zakat)}`;
  }
  if (agentId === 'hr') {
    const actifs = employees.filter(e=>e.active);
    const masse = actifs.reduce((s,e)=>s+Number(e.salary||0),0);
    return `👨‍💼 RAPPORT RH\n\n👥 Employés actifs: ${actifs.length}\n💼 Masse salariale/mois: ${fmt(masse)}\n\n${actifs.map(e=>`• ${e.name} (${e.role}): ${fmt(e.salary)}`).join('\n')}`;
  }
  return `🤖 Mode hors-ligne\n\nProduits: ${products.length} | Clients: ${clients.length} | Ventes: ${sales.length}`;
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
    text:`Bienvenue ! Je suis votre **${activeAgent.name}**.\n\n${activeAgent.desc}.\n\nJe peux vous aider avec des tâches spécifiques et générer des rapports. Comment puis-je vous assister ? 🚀`
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
        ? `PRODUITS (${data.products?.length}): ${JSON.stringify(data.products?.slice(0,20))}
CLIENTS (${data.clients?.length}): ${JSON.stringify(data.clients?.slice(0,15))}
VENTES (dernières 50): ${JSON.stringify(data.sales?.slice(0,50))}
EMPLOYÉS: ${JSON.stringify(data.employees)}
DÉPENSES: ${JSON.stringify(data.expenses?.slice(0,20))}
DATE ACTUELLE: ${new Date().toLocaleDateString('fr-DZ',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}`
        : `PRODUITS (stock et prix vente): ${JSON.stringify(data.products?.map(p=>({id:p.id,name:p.name,stock:p.stock,unit:p.unit,sellPrice:p.sellPrice})))}`;

      const controller = new AbortController();
      const timeout = setTimeout(()=>controller.abort(), 15000);

      const key = localStorage.getItem('groq_key') || '';
      if (!key) {
        reply = "⚠️ Clé API Groq manquante.\n\nCopyez votre clé gratuite depuis console.groq.com\nCliquez sur la roue d'engrenage pour la configurer.";
        setOffline(true);
      } else {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method:'POST', signal:controller.signal,
          headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},
          body: JSON.stringify({
            model:'llama-3.3-70b-versatile', max_tokens:2000,
            messages:[
              {role:'system', content:`${activeAgent.prompt}\n\nDONNEES COMPLÈTES:\n${dataCtx}\n\nRÈGLES ABSOLUES:\n1. Réponds UNIQUEMENT à ce qui est demandé\n2. Sois précis avec les chiffres\n3. Utilise le format JSON pour les rapports\n4. Français naturel et professionnel\n5. Propose des actions concrètes`},
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
            <div style={{fontWeight:900,fontSize:16,color:'#00D4FF',letterSpacing:-.5}}>🤖 Agents IA</div>
            <div style={{color:offline?'#FFC04D':'#00E5A0',fontSize:11,marginTop:4,display:'flex',alignItems:'center',gap:5}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:offline?'#FFC04D':'#00E5A0'}}/>
              {offline?'Mode hors-ligne':'Connecté'}
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
                <div style={{fontSize:12,fontWeight:700,color:activeAgent.id===a.id?a.color:'#EDF1FF'}}>{a.name}</div>
                <div style={{fontSize:10,color:'#3A4260',marginTop:1,lineHeight:1.2}}>{a.desc}</div>
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
                background:m.role==='user'?activeAgent.color:(C.chatAiBg||'#1B2135'),
                color:m.role==='user'?'#fff':(C.chatAiText||'#EDF1FF'),
                padding:'11px 16px',
                borderRadius:m.role==='user'?'16px 16px 4px 16px':'16px 16px 16px 4px',
                maxWidth:'82%',fontSize:13.5,lineHeight:1.7,whiteSpace:'pre-wrap',
                border:m.role==='ai'?'1px solid #1B2135':'none',
                boxShadow:m.role==='ai'?'0 4px 12px rgba(0,0,0,0.3)':'none',
              }}>{m.text.replace(/\*\*(.*?)\*\*/g,'$1')}</div>
            ))}
            {loading&&(
              <div style={{alignSelf:'flex-start',background:'#1B2135',border:'1px solid #1B2135',
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

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}