import { useTheme } from '../ThemeContext';
import { useState, useRef, useEffect } from 'react';
import { db, fmt, nowISO } from '../db';
import stockAgent from './StockAgent';
import financeAgent from './FinanceAgent';
import clientAgent from './ClientAgent';
import { buildShoppingCandidates, createShoppingList } from '../businessFeatures';

// ════════════════════════════════════════════════════════════════════════════
// AGENTS V2 — Prompts enrichis, suggestions contextuelles
// ════════════════════════════════════════════════════════════════════════════

const AGENTS_ADMIN = [
  {
    id: 'stock', icon: '📦', name: 'Agent Stock', color: '#F59E0B',
    tagline: 'Ruptures · Prédictions · Commandes',
    prompt: `Tu es l'Agent Stock expert de VenteX AI, spécialisé en gestion de stock pour commerces algériens.

RÈGLES DE FORMATAGE STRICTES:
- Utilise ## pour les titres de section (ex: ## Ruptures Critiques)
- Utilise **texte** pour mettre en évidence les chiffres et noms importants
- Utilise des listes avec • pour les items
- Toujours afficher les montants avec le format: **X XXX DA**
- Maximum 3 niveaux de hiérarchie
- Sois concis, précis, orienté action

EXPERTISE COMPLÈTE:
• Identifier ruptures et stocks critiques (≤ minStock)
• Calculer vélocité de vente et prédire les ruptures
• Recommander les quantités à commander (couverture 30 jours)
• Analyser rotation et stocks dormants (jamais vendus depuis 60j)
• Calculer valeur du stock immobilisé (prix achat × quantité)
• Identifier produits à promouvoir pour écouler le stock

Réponds toujours en français professionnel adapté au contexte algérien.`,
    suggestions: [
      'Que commander cette semaine ?',
      'Produits a faible marge',
      'Ruptures stock',
      'Aide commandes stock',
      'Valeur totale du stock',
    ],
  },
  {
    id: 'sales', icon: '🧾', name: 'Agent Ventes', color: '#10B981',
    tagline: 'CA · Tendances · Conseils commerciaux',
    prompt: `Tu es l'Agent Ventes expert de VenteX AI, conseiller commercial pour le marché algérien.

FORMATAGE:
- ## pour sections, **gras** pour chiffres clés
- Listes • pour les recommandations
- Toujours inclure les montants en DA
- Format date: JJ/MM/AAAA

EXPERTISE COMPLÈTE:
• Calculer et analyser le CA par heure, jour, semaine, mois
• Identifier tendances, saisonnalité, produits stars
• Clients VIP (fort CA) et clients à risque (absents > 30 jours)
• Heures et jours de forte activité
• Taux de transformation et panier moyen
• Conseils concrets pour augmenter le CA de 20-30%
• Analyse crédits en cours et risques d'impayés

Sois commercial, dynamique, orienté résultats.`,
    suggestions: [
      'Details derniere vente',
      'Top produits du mois',
      'Ventes par vendeur',
      'Impayes clients',
      'Aide commandes vente',
    ],
  },
  {
    id: 'clients', icon: '👥', name: 'Agent Clients', color: '#3B82F6',
    tagline: 'Crédits · Fidélité · Recouvrement',
    prompt: `Tu es l'Agent Clients expert de VenteX AI, spécialiste en gestion clientèle et recouvrement pour le marché algérien.

FORMATAGE:
- Tableaux texte avec | pour les listes de débiteurs
- **Montants** toujours en gras
- Plans d'action numérotés (1., 2., 3.)
- Urgence: 🔴 critique, 🟡 attention, 🟢 OK

EXPERTISE COMPLÈTE:
• Identifier et classer les débiteurs par montant et ancienneté
• Calculer créances totales et risque de non-recouvrement
• Stratégies de relance adaptées au contexte algérien
• Segmentation: VIP (>50K DA), Régulier, Occasionnel, Inactif
• Fidélité: fréquence d'achat, dernière visite, historique complet
• Score de risque client basé sur comportement de paiement

Sois proactif, bienveillant mais ferme sur le recouvrement.`,
    suggestions: [
      'Liste des debiteurs',
      'Clients VIP',
      'Fiche client Rachid',
      'Aide commandes clients',
      'Plan de relance cette semaine',
    ],
  },
  {
    id: 'finance', icon: '💰', name: 'Agent Finance', color: '#A855F7',
    tagline: 'Trésorerie · Marges · Zakat · Bilan',
    prompt: `Tu es l'Agent Finance expert de VenteX AI, comptable pour commerces algériens.

FORMATAGE:
- ## pour chaque section du bilan
- **Montants** toujours en DA
- Tableaux texte avec | pour les chiffres comparatifs
- Pourcentages avec %, signaux: 🟢 bon, 🟡 acceptable, 🔴 mauvais

EXPERTISE COMPLÈTE:
• Bilan financier complet mensuel et annuel
• Analyse marges brutes et nettes par produit et catégorie
• Ratios de rentabilité (marge/CA, retour sur stock)
• CALCUL ZAKAT ISLAMIQUE: base = valeur stock + créances - dettes × 2.5%
  → Nisab 2024 en Algérie ≈ 250 000 DA (vérifier avec un imam)
• Seuil de rentabilité et point mort
• Analyse des dépenses par catégorie
• Projections à 3 et 12 mois basées sur la tendance actuelle

Sois rigoureux, transparent, respectueux des valeurs islamiques.`,
    suggestions: [
      'Bilan du mois',
      'Calculer la Zakat',
      'Depenses par categorie',
      'Marge et benefice',
      'Aide commandes finance',
    ],
  },
  {
    id: 'hr', icon: '👨‍💼', name: 'Agent RH', color: '#6366F1',
    tagline: 'Performance · Salaires · Équipe',
    prompt: `Tu es l'Agent RH expert de VenteX AI, responsable RH pour commerce algérien.

FORMATAGE:
- Classements numérotés avec émojis de médaille 🥇🥈🥉
- **Métriques clés** en gras
- Tableaux comparatifs avec |

EXPERTISE COMPLÈTE:
• Classement vendeurs par CA généré avec évolution
• Calcul ROI: CA généré / salaire mensuel (ratio idéal > 10x)
• Performance individuelle par période
• Masse salariale totale et % du CA (idéal < 15%)
• Analyse productivité: ventes par heure travaillée
• Recommandations de motivation, formation, sanction

Sois objectif, bienveillant, constructif, confidentiel.`,
    suggestions: [
      '🏆 Classement des vendeurs',
      '💼 Masse salariale et ratio CA',
      '📊 Performance par employé',
      '💡 Recommandations équipe',
      '📈 Évolution des performances',
    ],
  },
  {
    id: 'assistant', icon: '✨', name: 'Assistant IA', color: '#06B6D4',
    tagline: 'Aide · Stratégie · Résumé journalier',
    prompt: `Tu es l'Assistant général de VenteX AI, conseiller stratégique personnel pour commerçants algériens.

FORMATAGE:
- Réponses structurées mais conversationnelles
- ## pour les plans d'action
- Listes • pour les conseils
- Toujours ancré dans le contexte algérien (DA, Ramadan, habitudes locales)

EXPERTISE COMPLÈTE:
• Résumé intelligent de la journée avec points clés et alertes
• Conseils stratégiques adaptés à la taille et au secteur
• Guide d'utilisation de VenteX AI (fonctionnalités, raccourcis)
• Bonnes pratiques commerciales pour l'Algérie (saisonnalité, culture)
• Réponses à toutes les questions sur la gestion commerciale
• Aide à la prise de décision basée sur les données

Sois chaleureux, encourageant et toujours utile.`,
    suggestions: [
      '📋 Résumé complet de la journée',
      '💡 3 conseils pour aujourd\'hui',
      '🎯 Plan d\'action cette semaine',
      '❓ Comment utiliser VenteX AI ?',
      '🌟 Bonnes pratiques commerce',
    ],
  },
];

const AGENTS_EMPLOYEE = [
  {
    id: 'stock', icon: '📦', name: 'Stock', color: '#F59E0B',
    tagline: 'Consulter disponibilités',
    prompt: `Tu es un assistant stock pour employés. Accès limité: stock actuel et prix de vente uniquement. Sois utile et précis.`,
    suggestions: ['Stock disponible ?', 'Prix de vente ?', 'Produit en rupture ?'],
  },
  {
    id: 'assistant', icon: '✨', name: 'Assistant', color: '#06B6D4',
    tagline: 'Aide quotidienne',
    prompt: `Tu es un assistant bienveillant pour vendeurs en commerce algérien. Aide pratique, encouragements, infos produits.`,
    suggestions: ['Comment faire une vente ?', 'Infos sur ce produit ?', 'Aide rapide'],
  },
];

const AGENT_ACTIONS = {
  stock: [
    { id: 'stock-order', label: 'Plan commande', desc: 'Ruptures, stock bas et quantites conseillees.', command: 'Que commander cette semaine ?' },
    { id: 'stock-margin', label: 'Prix a corriger', desc: 'Articles a faible marge avec prix conseille.', command: 'Produits a faible marge' },
    { id: 'stock-value', label: 'Valeur stock', desc: 'Stock immobilise et priorites de rotation.', command: 'Valeur totale du stock' },
  ],
  sales: [
    { id: 'sales-last', label: 'Derniere vente', desc: 'Client, vendeur, versement et articles.', command: 'Details derniere vente' },
    { id: 'sales-top', label: 'Top produits', desc: 'Produits qui tirent le chiffre d affaires.', command: 'Top produits du mois' },
    { id: 'sales-debt', label: 'Credits ouverts', desc: 'Impayes clients a traiter.', command: 'Impayes clients' },
    { id: 'sales-validate', label: 'Valider panier', desc: 'Ouvre la validation dans le module Vente.', command: 'Valide la vente', requiresModule: true },
  ],
  clients: [
    { id: 'client-debt', label: 'Relances', desc: 'Debiteurs classes par montant restant.', command: 'Liste des debiteurs' },
    { id: 'client-vip', label: 'Clients VIP', desc: 'Meilleurs clients et potentiel commercial.', command: 'Clients VIP' },
    { id: 'client-plan', label: 'Plan recouvrement', desc: 'Priorites de relance cette semaine.', command: 'Plan de relance cette semaine' },
  ],
  finance: [
    { id: 'finance-month', label: 'Bilan du mois', desc: 'CA, encaissements, credits, benefice.', command: 'Bilan du mois' },
    { id: 'finance-zakat', label: 'Zakat', desc: 'Estimation locale basee sur stock et credits.', command: 'Calculer la Zakat' },
    { id: 'finance-exp', label: 'Charges', desc: 'Depenses par categorie.', command: 'Depenses par categorie' },
  ],
  hr: [
    { id: 'hr-sellers', label: 'Vendeurs', desc: 'Classement CA par vendeur.', command: 'Ventes par vendeur' },
    { id: 'hr-team', label: 'Equipe', desc: 'Masse salariale et performance.', command: 'Performance par employe' },
  ],
  assistant: [
    { id: 'assistant-day', label: 'Diagnostic complet', desc: 'Stock, ventes, clients et finance en une vue.', command: 'Diagnostic complet' },
    { id: 'assistant-plan', label: 'Plan action', desc: 'Actions concretes a faire maintenant.', command: 'Plan d action cette semaine' },
    { id: 'assistant-help', label: 'Commandes', desc: 'Ce que l IA peut executer.', command: 'Aide commandes' },
  ],
};

// ════════════════════════════════════════════════════════════════════════════
// CHARGEMENT DONNÉES ENRICHI
// ════════════════════════════════════════════════════════════════════════════

async function loadAllData() {
  const [products, clients, suppliers, employees, sales, saleItems, payments, expenses] = await Promise.all([
    db.products.toArray(),
    db.clients.toArray(),
    db.suppliers.toArray().catch(() => []),
    db.employees.toArray().catch(() => []),
    db.sales.orderBy('createdAt').reverse().limit(300).toArray(),
    db.saleItems.toArray(),
    db.payments.toArray().catch(() => []),
    db.expenses.toArray().catch(() => []),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const month = new Date().toISOString().slice(0, 7);

  const todaySales = sales.filter(s => s.createdAt?.startsWith(today));
  const monthSales = sales.filter(s => s.createdAt?.startsWith(month));

  const enrichedClients = clients.map(c => {
    const cs = sales.filter(s => s.clientId === c.id);
    const totalAchete = cs.reduce((s, v) => s + Number(v.total || 0), 0);
    const totalPaye   = cs.reduce((s, v) => s + Number(v.paid  || 0), 0);
    return { ...c, totalAchete, totalPaye, dette: totalAchete - totalPaye, nombreAchats: cs.length, derniereVisite: cs[0]?.createdAt || null };
  });

  const enrichedProducts = products.map(p => {
    const items = saleItems.filter(i => i.productId === p.id);
    return { ...p, totalVendu: items.reduce((s, i) => s + i.qty, 0), caGenere: items.reduce((s, i) => s + i.unitPrice * i.qty, 0) };
  });

  const caToday    = todaySales.reduce((s, v) => s + Number(v.total || 0), 0);
  const caMonth    = monthSales.reduce((s, v) => s + Number(v.total || 0), 0);
  const stockAlerts = products.filter(p => p.stock <= (p.minStock || 5)).length;
  const totalCredits = sales.filter(s => s.status === 'crédit').reduce((s, v) => s + Math.max(0, Number(v.total || 0) - Number(v.paid || 0)), 0);
  const clientsDebiteurs = enrichedClients.filter(c => c.dette > 0).length;

  return {
    products: enrichedProducts, clients: enrichedClients, suppliers,
    employees, sales, saleItems, payments, expenses,
    todaySales, monthSales,
    stats: { caToday, caMonth, stockAlerts, totalCredits, clientsDebiteurs },
  };
}

function buildContext(agentId, data, role) {
  if (role === 'employee') {
    return `PRODUITS: ${JSON.stringify(data.products?.slice(0, 30).map(p => ({ n: p.name, s: p.stock, prix: p.sellPrice, unit: p.unit })))}`;
  }
  const resume = `=== RÉSUMÉ ===\nCA aujourd'hui: ${fmt(data.stats?.caToday)} | CA mois: ${fmt(data.stats?.caMonth)} | Alertes stock: ${data.stats?.stockAlerts} | Crédits impayés: ${fmt(data.stats?.totalCredits)} | Clients débiteurs: ${data.stats?.clientsDebiteurs}`;

  if (agentId === 'stock') {
    return `${resume}\n\nPRODUITS (${data.products?.length}): ${JSON.stringify(data.products?.slice(0, 50).map(p => ({ id: p.id, n: p.name, cat: p.category, stock: p.stock, min: p.minStock || 5, buy: p.buyPrice, sell: p.sellPrice, vendu: p.totalVendu, ca: p.caGenere, expiry: p.expiry })))}`;
  }
  if (agentId === 'sales') {
    return `${resume}\n\nVENTES (${data.sales?.length}): ${JSON.stringify(data.sales?.slice(0, 100).map(s => ({ id: s.id, client: s.clientName, total: s.total, paid: s.paid, status: s.status, mode: s.payMode, date: s.createdAt?.slice(0, 10) })))}\n\nTOP PRODUITS: ${JSON.stringify(data.products?.sort((a, b) => (b.totalVendu || 0) - (a.totalVendu || 0)).slice(0, 15).map(p => ({ n: p.name, vendu: p.totalVendu, ca: p.caGenere })))}`;
  }
  if (agentId === 'clients') {
    return `${resume}\n\nCLIENTS (${data.clients?.length}): ${JSON.stringify(data.clients?.slice(0, 40).map(c => ({ id: c.id, n: c.name, tel: c.phone, achete: c.totalAchete, paye: c.totalPaye, dette: c.dette, achats: c.nombreAchats, derniere: c.derniereVisite?.slice(0, 10) })))}`;
  }
  if (agentId === 'finance') {
    const stockVal = data.products?.reduce((s, p) => s + (p.stock || 0) * (p.buyPrice || 0), 0) || 0;
    const depTotal = data.expenses?.reduce((s, e) => s + Number(e.amount || 0), 0) || 0;
    return `${resume}\n\nVALEUR STOCK: ${stockVal}\nDÉPENSES TOTAL: ${depTotal}\nDÉPENSES: ${JSON.stringify(data.expenses?.slice(0, 30))}\nVENTES MOIS: ${JSON.stringify(data.monthSales?.slice(0, 80).map(s => ({ t: s.total, p: s.paid, st: s.status, d: s.createdAt?.slice(0, 10) })))}`;
  }
  if (agentId === 'hr') {
    const byVendeur = data.sales?.reduce((acc, s) => { if (s.employeeName) { acc[s.employeeName] = (acc[s.employeeName] || 0) + Number(s.total || 0); } return acc; }, {});
    return `${resume}\n\nEMPLOYÉS: ${JSON.stringify(data.employees)}\nCA PAR VENDEUR: ${JSON.stringify(byVendeur)}`;
  }
  return `${resume}\n\nPRODUITS: ${data.products?.length} | CLIENTS: ${data.clients?.length} | VENTES: ${data.sales?.length}`;
}

function localFallback(agentId, data) {
  const { products = [], clients = [], sales = [], employees = [], expenses = [] } = data;
  const now = new Date();

  if (agentId === 'stock') {
    const rupt = products.filter(p => p.stock === 0);
    const bas  = products.filter(p => p.stock > 0 && p.stock <= (p.minStock || 5));
    const top  = [...products].sort((a, b) => (b.totalVendu || 0) - (a.totalVendu || 0)).slice(0, 5);
    const val  = products.reduce((s, p) => s + (p.stock || 0) * (p.buyPrice || 0), 0);
    return `## Rapport Stock (mode local)\n\n**🔴 Ruptures (${rupt.length}):**\n${rupt.slice(0, 8).map(p => `• **${p.name}**`).join('\n') || '• Aucune rupture'}\n\n**🟡 Stock bas (${bas.length}):**\n${bas.slice(0, 8).map(p => `• **${p.name}** — ${p.stock} ${p.unit || 'pce'}`).join('\n') || '• Aucun'}\n\n## Top 5 Produits Vendus\n\n${top.map((p, i) => `${i + 1}. **${p.name}** — ${p.totalVendu || 0} vendus`).join('\n')}\n\n## Valeur Stock\n\n**Valeur totale:** ${fmt(val)} (prix achat)`;
  }
  if (agentId === 'sales') {
    const today = now.toISOString().slice(0, 10);
    const caT = sales.filter(s => s.createdAt?.startsWith(today)).reduce((s, v) => s + Number(v.total || 0), 0);
    const caM = sales.reduce((s, v) => s + Number(v.total || 0), 0);
    const credits = sales.filter(s => s.status === 'crédit').reduce((s, v) => s + Math.max(0, Number(v.total || 0) - Number(v.paid || 0)), 0);
    const panier = sales.length > 0 ? caM / sales.length : 0;
    return `## Rapport Ventes (mode local)\n\n**CA aujourd'hui:** ${fmt(caT)}\n**CA total enregistré:** ${fmt(caM)}\n**Nombre de ventes:** ${sales.length}\n**Panier moyen:** ${fmt(panier)}\n**Crédits impayés:** ${fmt(credits)}\n\n## Statut\n\n🟢 Données disponibles en lecture locale.`;
  }
  if (agentId === 'clients') {
    const debiteurs = clients.filter(c => (c.totalAchete - c.totalPaye) > 0).sort((a, b) => (b.totalAchete - b.totalPaye) - (a.totalAchete - a.totalPaye));
    const totalDette = debiteurs.reduce((s, c) => s + (c.totalAchete - c.totalPaye), 0);
    return `## Rapport Clients (mode local)\n\n**Total clients:** ${clients.length}\n**Débiteurs:** ${debiteurs.length}\n**Créances totales:** ${fmt(totalDette)}\n\n## Top Débiteurs\n\n${debiteurs.slice(0, 6).map((c, i) => `${i + 1}. **${c.name}** — ${fmt(c.totalAchete - c.totalPaye)}`).join('\n') || '• Aucun crédit en cours ✅'}`;
  }
  if (agentId === 'finance') {
    const ca  = sales.reduce((s, v) => s + Number(v.total || 0), 0);
    const stk = products.reduce((s, p) => s + (p.stock || 0) * (p.buyPrice || 0), 0);
    const dep = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const ben = ca - dep;
    const zakat = Math.max(0, ben * 0.025);
    return `## Bilan Financier (mode local)\n\n**Chiffre d'affaires:** ${fmt(ca)}\n**Stock immobilisé:** ${fmt(stk)}\n**Dépenses totales:** ${fmt(dep)}\n**Bénéfice brut:** ${fmt(ben)}\n\n## Zakat\n\n**Base de calcul:** ${fmt(ben)}\n**Zakat à verser (2.5%):** **${fmt(zakat)}**`;
  }
  if (agentId === 'hr') {
    const actifs = employees.filter(e => e.active);
    const masse = actifs.reduce((s, e) => s + Number(e.salary || 0), 0);
    const byV = sales.reduce((acc, s) => { if (s.employeeName) acc[s.employeeName] = (acc[s.employeeName] || 0) + Number(s.total || 0); return acc; }, {});
    return `## Rapport RH (mode local)\n\n**Employés actifs:** ${actifs.length}\n**Masse salariale:** ${fmt(masse)}/mois\n\n## Performance Vendeurs\n\n${Object.entries(byV).sort((a, b) => b[1] - a[1]).map(([n, ca], i) => `${i + 1}. **${n}** — ${fmt(ca)} CA`).join('\n') || '• Aucune vente associée à un vendeur'}`;
  }
  return `## Données disponibles (mode local)\n\n**Produits:** ${products.length}\n**Clients:** ${clients.length}\n**Ventes:** ${sales.length}\n**Employés actifs:** ${employees.filter(e => e.active).length}`;
}

// ════════════════════════════════════════════════════════════════════════════
// MARKDOWN RENDERER
// ════════════════════════════════════════════════════════════════════════════

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractAmount(text) {
  const matches = [...normalizeText(text).matchAll(/(\d+(?:[ .]\d{3})*(?:[,.]\d+)?)/g)];
  const match = matches[matches.length - 1];
  return match ? Number(match[1].replace(/\s|\./g, '').replace(',', '.')) || 0 : 0;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }
  return prev[b.length];
}

function extractPhone(text) {
  return String(text || '').match(/(?:\+?213|0)(?:[\s.-]?\d){8,9}/)?.[0]?.trim() || '';
}

function extractNameAfter(text, keywords) {
  const raw = String(text || '').trim();
  const normalized = normalizeText(raw);
  for (const key of keywords) {
    const idx = normalized.indexOf(key);
    if (idx >= 0) {
      const originalTail = raw.slice(Math.min(raw.length, idx + key.length)).replace(/(?:tel|telephone|phone|montant|prix|a|de)\s+.*$/i, '').trim();
      if (originalTail) return originalTail;
    }
  }
  return '';
}

function extractQty(text) {
  const normalized = normalizeText(text);
  const match = normalized.match(/(?:ajoute|vends|vend|mets|retire|enleve)\s+(\d+(?:[,.]\d+)?)(?:\s|x|fois|unites?|pieces?|pce|l|kg)/);
  return match ? Number(match[1].replace(',', '.')) || 1 : 1;
}

function findByName(list, text, fields = ['name']) {
  const q = normalizeText(text);
  return [...(list || [])]
    .map(item => {
      const haystack = fields.map(f => normalizeText(item[f])).join(' ');
      const name = normalizeText(item.name || item.clientName || item.label);
      const haystackTokens = haystack.split(' ').filter(Boolean);
      const queryTokens = q.split(' ').filter(Boolean);
      const tokenHits = name.split(' ').filter(w => w.length > 2 && queryTokens.includes(w)).length;
      const bestDistance = haystackTokens.reduce((best, token) => {
        if (token.length < 2) return best;
        const localBest = queryTokens.reduce((min, qToken) => Math.min(min, levenshtein(token, qToken)), Infinity);
        return Math.min(best, localBest);
      }, Infinity);
      const normalizedDistance = Number.isFinite(bestDistance) ? bestDistance / Math.max(name.length, 1) : 1;
      const exactScore = haystack && q.includes(haystack) ? 1000 + haystack.length : 0;
      const fuzzyScore = normalizedDistance <= 0.35 ? Math.max(0, 20 - normalizedDistance * 100) : 0;
      const score = exactScore || (tokenHits ? tokenHits * 25 : 0) + fuzzyScore;
      return { item, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.item || null;
}

function productHistoryReport(product) {
  const stockRows = (product.stockHistory || []).slice().reverse().slice(0, 8);
  const editRows = (product.modificationHistory || []).slice().reverse().slice(0, 6);
  const lines = [
    `## Produit: ${product.name}`,
    `Stock actuel: **${product.stock || 0} ${product.unit || 'pce'}**`,
    `Prix vente: **${fmt(product.sellPrice || 0)}**`,
    `Code-barres: **${product.barcode || 'non renseigne'}**`,
    `Cree le: **${product.createdAt ? new Date(product.createdAt).toLocaleString('fr-DZ') : 'inconnu'}**`,
    `Modifie le: **${product.updatedAt ? new Date(product.updatedAt).toLocaleString('fr-DZ') : 'jamais'}**`,
    '',
    '## Changements de stock',
    ...(stockRows.length ? stockRows.map(h => `- ${h.at ? new Date(h.at).toLocaleString('fr-DZ') : ''}: ${h.before} -> ${h.after} (${Number(h.delta || 0) > 0 ? '+' : ''}${h.delta}) ${h.note || ''}`) : ['- Aucun changement enregistre.']),
    '',
    '## Modifications produit',
    ...(editRows.length ? editRows.map(h => `- ${h.at ? new Date(h.at).toLocaleString('fr-DZ') : ''}: ${h.source || 'modification'}`) : ['- Aucune modification enregistree.']),
  ];
  return lines.join('\n');
}

function agentHelp(agentId, hasModuleActions) {
  const common = [
    '## Commandes gratuites disponibles',
    'Je fonctionne en local avec vos donnees Dexie. Pas besoin de payer une API pour ces actions.',
  ];
  if (agentId === 'sales') {
    return [...common,
      '- `ajoute 2 huile 5w30`',
      '- `retourne 2 huile 5w30`',
      '- `applique une remise de 500`',
      hasModuleActions ? '- `valide la vente`' : '- Ouvrez-moi depuis le module Vente pour modifier le panier actif',
      '- `details vente VP-12`',
      '- `qui a fait la derniere vente ?`',
      '- `top produits du mois`',
      '- `impayes clients`',
    ].join('\n');
  }
  if (agentId === 'stock') {
    return [...common,
      '- `ruptures stock`',
      '- `que commander cette semaine ?`',
      '- `mets le prix de huile 5w30 a 1900`',
      '- `mets le stock de bougie a 40`',
      '- `augmente stock filtre a air de 10`',
      '- `produits a faible marge`',
    ].join('\n');
  }
  if (agentId === 'clients') {
    return [...common,
      '- `liste des debiteurs`',
      '- `fiche client Rachid`',
      '- `enregistre versement 5000 pour Rachid`',
      '- `cree client Mohamed tel 0555123456`',
      '- `clients VIP`',
    ].join('\n');
  }
  if (agentId === 'finance') {
    return [...common,
      '- `bilan du mois`',
      '- `zakat`',
      '- `ajoute depense loyer 25000`',
      '- `depenses par categorie`',
      '- `marge et benefice`',
    ].join('\n');
  }
  return [...common, '- `resume aujourd hui`', '- `alertes importantes`'].join('\n');
}

function topProductsReport(data, period = 'month') {
  const sales = data.sales || [];
  const saleItems = data.saleItems || [];
  const now = new Date();
  const key = period === 'today' ? now.toISOString().slice(0, 10) : now.toISOString().slice(0, 7);
  const saleIds = new Set(sales.filter(s => s.createdAt?.startsWith(key)).map(s => s.id));
  const rows = new Map();
  for (const item of saleItems) {
    if (!saleIds.has(item.saleId)) continue;
    const current = rows.get(item.productName) || { qty: 0, ca: 0 };
    current.qty += Number(item.qty || 0);
    current.ca += Number(item.qty || 0) * Number(item.unitPrice || 0);
    rows.set(item.productName, current);
  }
  const top = [...rows.entries()].sort((a, b) => b[1].ca - a[1].ca).slice(0, 10);
  if (!top.length) return `## Top produits\nAucune vente sur la periode ${period === 'today' ? "d'aujourd'hui" : 'du mois'}.`;
  return ['## Top produits', ...top.map(([name, row], index) => `${index + 1}. **${name}** - ${row.qty} vendu(s), ${fmt(row.ca)}`)].join('\n');
}

function salesBySellerReport(data) {
  const rows = new Map();
  for (const sale of data.sales || []) {
    const name = sale.employeeName || 'Non renseigne';
    const current = rows.get(name) || { count: 0, total: 0, paid: 0 };
    current.count += 1;
    current.total += Number(sale.total || 0);
    current.paid += Number(sale.paid || 0);
    rows.set(name, current);
  }
  const sorted = [...rows.entries()].sort((a, b) => b[1].total - a[1].total);
  if (!sorted.length) return '## Ventes par vendeur\nAucune vente enregistree.';
  return ['## Ventes par vendeur', ...sorted.map(([name, row], index) => `${index + 1}. **${name}** - ${row.count} vente(s), CA ${fmt(row.total)}, verse ${fmt(row.paid)}`)].join('\n');
}

function debtorsReport(data) {
  const clients = data.clients || [];
  const debtors = clients
    .filter(c => Number(c.dette || c.totalDue || 0) > 0)
    .sort((a, b) => Number(b.dette || b.totalDue || 0) - Number(a.dette || a.totalDue || 0))
    .slice(0, 12);
  if (!debtors.length) return '## Credits clients\nAucun debiteur.';
  const total = debtors.reduce((sum, c) => sum + Number(c.dette || c.totalDue || 0), 0);
  return ['## Debiteurs prioritaires', `Total affiche: **${fmt(total)}**`, ...debtors.map((c, i) => `${i + 1}. **${c.name}** - ${fmt(c.dette || c.totalDue)} ${c.phone ? `(${c.phone})` : ''}`)].join('\n');
}

function businessPilotReport(data) {
  const products = data.products || [];
  const sales = data.sales || [];
  const clients = data.clients || [];
  const expenses = data.expenses || [];
  const today = new Date().toISOString().slice(0, 10);
  const todaySales = sales.filter(s => s.createdAt?.startsWith(today));
  const caToday = todaySales.reduce((sum, s) => sum + Number(s.total || 0), 0);
  const credits = clients
    .filter(c => Number(c.dette || c.totalDue || 0) > 0)
    .sort((a, b) => Number(b.dette || b.totalDue || 0) - Number(a.dette || a.totalDue || 0));
  const stockCritical = products.filter(p => Number(p.stock || 0) <= 0);
  const stockLow = products.filter(p => Number(p.stock || 0) > 0 && Number(p.stock || 0) <= Number(p.minStock || 5));
  const lowMargin = products
    .map(p => ({ p, margin: Number(p.buyPrice || 0) > 0 ? ((Number(p.sellPrice || 0) - Number(p.buyPrice || 0)) / Number(p.buyPrice || 0)) * 100 : null }))
    .filter(row => row.margin !== null && row.margin < 15)
    .sort((a, b) => a.margin - b.margin);
  const monthExpenses = expenses
    .filter(e => e.createdAt?.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const actions = [];
  if (stockCritical.length) actions.push(`Commander en urgence: **${stockCritical.slice(0, 3).map(p => p.name).join(', ')}**.`);
  if (stockLow.length) actions.push(`Verifier stock bas: **${stockLow.slice(0, 3).map(p => p.name).join(', ')}**.`);
  if (credits.length) actions.push(`Relancer d'abord **${credits[0].name}** pour **${fmt(credits[0].dette || credits[0].totalDue)}**.`);
  if (lowMargin.length) actions.push(`Corriger les prix faibles: **${lowMargin.slice(0, 3).map(row => row.p.name).join(', ')}**.`);
  if (!todaySales.length) actions.push('Aucune vente aujourd hui: verifier caisse, ouvrir une action commerciale ou saisir les tickets manquants.');

  return [
    '## Diagnostic IA executif',
    `CA aujourd hui: **${fmt(caToday)}**`,
    `Ventes aujourd hui: **${todaySales.length}**`,
    `Ruptures: **${stockCritical.length}** | Stock bas: **${stockLow.length}**`,
    `Clients a relancer: **${credits.length}**`,
    `Depenses du mois: **${fmt(monthExpenses)}**`,
    '',
    '## Actions recommandees',
    ...(actions.length ? actions.map((a, i) => `${i + 1}. ${a}`) : ['1. Situation stable. Continuer le suivi ventes, stock et credits.']),
  ].join('\n');
}

function clientDetailsReport(client, data) {
  if (!client) return 'Client introuvable.';
  const sales = (data.sales || []).filter(s => s.clientId === client.id);
  const total = sales.reduce((sum, s) => sum + Number(s.total || 0), 0);
  const paid = sales.reduce((sum, s) => sum + Number(s.paid || 0), 0);
  const last = [...sales].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
  return [
    `## Fiche client - ${client.name}`,
    `Telephone: **${client.phone || 'Non renseigne'}**`,
    `Achats: **${sales.length}**`,
    `Total achete: **${fmt(total)}**`,
    `Verse: **${fmt(paid)}**`,
    `Reste: **${fmt(total - paid)}**`,
    `Derniere visite: **${last?.createdAt ? new Date(last.createdAt).toLocaleDateString('fr-DZ') : 'Aucune'}**`,
  ].join('\n');
}

function formatSaleDetails(sale, items = [], payments = []) {
  if (!sale) return 'Aucune vente trouvee.';
  const total = Number(sale.total || 0);
  const paid = Number(sale.paid || 0);
  const due = Math.max(0, total - paid);
  const date = sale.createdAt ? new Date(sale.createdAt).toLocaleString('fr-DZ') : 'Date inconnue';
  const lines = [
    `## Vente VP-${String(sale.id).padStart(4, '0')}`,
    `Date: **${date}**`,
    `Client: **${sale.clientName || 'Passage'}**`,
    `Vendeur: **${sale.employeeName || 'Non renseigne'}**`,
    `Total: **${fmt(total)}**`,
    `Verse: **${fmt(paid)}**`,
    `Reste: **${fmt(due)}**`,
    `Mode: **${sale.payMode || 'Non renseigne'}** | Statut: **${sale.status || 'Non renseigne'}**`,
  ];
  if (items.length) {
    lines.push('\n## Articles');
    items.forEach(item => lines.push(`- ${item.productName}: ${item.qty} x ${fmt(item.unitPrice)}`));
  }
  if (payments.length) {
    lines.push('\n## Versements');
    payments.forEach(payment => lines.push(`- ${fmt(payment.amount)} le ${new Date(payment.createdAt).toLocaleDateString('fr-DZ')}`));
  }
  return lines.join('\n');
}

async function answerSaleQuestion(question, data) {
  const q = normalizeText(question);
  const sales = data.sales || [];
  let sale = null;
  const idMatch = q.match(/(?:vp[-\s]*)?(\d{1,6})/);

  if (idMatch && /(vente|ticket|facture|vp)/.test(q)) {
    sale = await db.sales.get(Number(idMatch[1])).catch(() => null);
  }
  if (!sale && /(derniere|recente|dernier|last)/.test(q)) {
    sale = sales[0] || await db.sales.orderBy('createdAt').reverse().first();
  }
  if (!sale) {
    const client = findByName(data.clients, q, ['name', 'phone']);
    if (client) {
      const rows = await db.sales.where('clientId').equals(client.id).toArray().catch(() => []);
      sale = rows.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0] || null;
    }
  }

  if (sale) {
    const [items, payments] = await Promise.all([
      db.saleItems.where('saleId').equals(sale.id).toArray(),
      db.payments.where('saleId').equals(sale.id).toArray().catch(() => []),
    ]);
    return formatSaleDetails(sale, items, payments);
  }

  if (/(aujourd|today)/.test(q)) {
    const today = new Date().toISOString().slice(0, 10);
    const todaySales = sales.filter(s => s.createdAt?.startsWith(today));
    const total = todaySales.reduce((sum, s) => sum + Number(s.total || 0), 0);
    const paid = todaySales.reduce((sum, s) => sum + Number(s.paid || 0), 0);
    return `## Ventes du jour\n${todaySales.length} vente(s)\nCA: **${fmt(total)}**\nVerse: **${fmt(paid)}**\nCredit restant: **${fmt(total - paid)}**`;
  }

  return null;
}

async function executeLocalAgentCommand({ agentId, question, data, userRole, moduleActions }) {
  const q = normalizeText(question);
  const canWrite = userRole === 'admin' || agentId === 'sales';

  if (/^(aide|help|commandes|que peux tu faire|quoi faire)/.test(q)) {
    return { handled: true, reply: agentHelp(agentId, !!moduleActions) };
  }

  if (/(diagnostic|resume complet|pilotage|plan d action|actions? a faire|revolutionnaire|priorite)/.test(q)) {
    return { handled: true, reply: businessPilotReport(data) };
  }

  if (agentId === 'sales') {
    if (/(top|meilleur|classement).*(produit|article)|produit.*(vendu|top|meilleur)/.test(q)) {
      return { handled: true, reply: topProductsReport(data, /(aujourd|jour)/.test(q) ? 'today' : 'month') };
    }
    if (/(vendeur|employe|ca par|qui vend|performance)/.test(q)) {
      return { handled: true, reply: salesBySellerReport(data) };
    }
    if (/(impaye|credit|debiteur|reste a payer)/.test(q)) {
      return { handled: true, reply: debtorsReport(data) };
    }
    if (/(retour|retourne|reprend|rends)/.test(q)) {
      const product = findByName(data.products, q, ['name', 'ref', 'barcode', 'category']);
      if (!product) return { handled: true, reply: "## Agent Ventes\nJe n'ai pas trouve le produit a retourner. Donnez le nom ou la reference." };
      const qty = -Math.abs(extractQty(question));
      if (moduleActions?.addProductToCart) {
        await moduleActions.addProductToCart(product, qty);
        return { handled: true, reply: `## Retour ajoute\nJ'ai ajoute **${qty} x ${product.name}** au panier.` };
      }
      return { handled: true, reply: "## Action impossible ici\nOuvrez l'agent depuis le module Vente pour modifier le panier actif." };
    }
    if (/(ajoute|mets|vend|vends)/.test(q)) {
      const product = findByName(data.products, q, ['name', 'ref', 'barcode', 'category']);
      if (!product) return { handled: true, reply: "## Agent Ventes\nJe n'ai pas trouve le produit dans le stock. Donnez le nom ou la reference." };
      const qty = extractQty(question);
      if (moduleActions?.addProductToCart) {
        await moduleActions.addProductToCart(product, qty);
        return { handled: true, reply: `## Action executee\nJ'ai ajoute **${qty} x ${product.name}** au panier.\nStock disponible: **${product.stock} ${product.unit || 'pce'}**.` };
      }
      return { handled: true, reply: "## Action impossible ici\nOuvrez l'agent depuis le module Vente pour modifier le panier actif." };
    }
    if (/(remise|reduction|rabais)/.test(q)) {
      const amount = extractAmount(question);
      if (!amount) return { handled: true, reply: '## Agent Ventes\nIndiquez le montant de remise a appliquer, par exemple: `applique une remise de 500`.' };
      if (moduleActions?.applyDiscount) {
        await moduleActions.applyDiscount(amount);
        return { handled: true, reply: `## Action executee\nRemise appliquee: **${fmt(amount)}**.` };
      }
      return { handled: true, reply: "## Action impossible ici\nLa remise se modifie depuis le module Vente ouvert." };
    }
    if (/(valide|encaisse|finalise|termine)/.test(q)) {
      if (moduleActions?.openValidation) {
        await moduleActions.openValidation();
        return { handled: true, reply: "## Action executee\nJ'ai ouvert la validation de vente. Verifiez le paiement avant de confirmer." };
      }
      return { handled: true, reply: "## Action impossible ici\nJe peux ouvrir la validation seulement depuis le module Vente." };
    }
    const saleAnswer = await answerSaleQuestion(question, data);
    if (saleAnswer) return { handled: true, reply: saleAnswer };
  }

  if (agentId === 'stock') {
    if (/(historique|info|information|fiche|date|creation|modification|changement).*(produit|stock)|produit.*(historique|info|date|modification|changement)/.test(q)) {
      const product = findByName(data.products, q, ['name', 'ref', 'barcode', 'category']);
      if (!product) return { handled: true, reply: "## Agent Stock\nProduit introuvable. Donnez le nom, la reference ou le code-barres." };
      return { handled: true, reply: productHistoryReport(product) };
    }
    if (/(liste.*course|courses|commande ia|liste achat|panier achat)/.test(q)) {
      if (!canWrite) return { handled: true, reply: "## Acces limite\nSeul un administrateur peut creer une liste de courses." };
      const mode = /(zero|rupture|epuise)/.test(q) ? 'zero' : /(alerte|minimum|stock bas|reappro)/.test(q) ? 'alerts' : 'prompt';
      const items = await buildShoppingCandidates({ mode, prompt: question });
      if (!items.length) return { handled: true, reply: "## Liste de courses IA\nAucun produit pertinent trouve pour cette demande." };
      const listId = await createShoppingList({ title: 'Liste IA - ' + new Date().toLocaleDateString('fr-DZ'), source: 'chat-stock', items });
      const total = items.reduce((s, i) => s + Number(i.estimatedTotal || 0), 0);
      return { handled: true, reply: [`## Liste de courses IA creee`, `ID: **${listId}**`, `Total estime: **${fmt(total)}**`, ...items.slice(0, 8).map(i => `- **${i.productName}**: ${i.qty} x ${fmt(i.buyPrice)} (${i.reason})`)].join('\n') };
    }
    if (/(stock).*(met|change|modifier|fixe|ajuste)|(?:met|change|modifier|fixe|ajuste).*(stock)/.test(q)) {
      if (!canWrite) return { handled: true, reply: "## Acces limite\nSeul un administrateur peut modifier le stock." };
      const product = findByName(data.products, q, ['name', 'ref', 'barcode', 'category']);
      const amount = extractAmount(question);
      if (!product && !amount) return { handled: true, reply: '## Agent Stock\nPrecisez le produit et la quantite. Exemple: `mets le stock de Bougie NGK a 40`.' };
      if (!product) return { handled: true, reply: "## Agent Stock\nProduit introuvable. Donnez le nom ou la reference." };
      await db.products.update(product.id, {
        stock: amount,
        updatedAt: nowISO(),
        updatedByAgent: 'stock',
        stockHistory: [...(product.stockHistory || []), { at: nowISO(), before: Number(product.stock || 0), after: amount, delta: amount - Number(product.stock || 0), source: 'agent_stock', note: 'Stock fixe par IA' }],
      });
      return { handled: true, reply: `## Action executee\nStock de **${product.name}** mis a **${amount} ${product.unit || 'pce'}**.` };
    }
    if (/(augmente|ajoute|recois|reception).*(stock)|stock.*(augmente|ajoute|recois|reception)/.test(q)) {
      if (!canWrite) return { handled: true, reply: "## Acces limite\nSeul un administrateur peut modifier le stock." };
      const product = findByName(data.products, q, ['name', 'ref', 'barcode', 'category']);
      const amount = extractAmount(question);
      if (!product || !amount) return { handled: true, reply: '## Agent Stock\nExemple: `augmente stock Filtre a Air de 10`.' };
      const next = Number(product.stock || 0) + amount;
      await db.products.update(product.id, {
        stock: next,
        updatedAt: nowISO(),
        updatedByAgent: 'stock',
        stockHistory: [...(product.stockHistory || []), { at: nowISO(), before: Number(product.stock || 0), after: next, delta: amount, source: 'agent_stock', note: 'Stock augmente par IA' }],
      });
      return { handled: true, reply: `## Action executee\nStock de **${product.name}** augmente de **${amount}**. Nouveau stock: **${next} ${product.unit || 'pce'}**.` };
    }
    if (/(prix|tarif).*(met|change|modifier|fixe|applique)|(?:met|change|modifier|fixe).*(prix|tarif)/.test(q)) {
      if (!canWrite) return { handled: true, reply: "## Acces limite\nSeul un administrateur peut modifier les prix." };
      const product = findByName(data.products, q, ['name', 'ref', 'barcode', 'category']);
      const amount = extractAmount(question);
      if (!product || !amount) return { handled: true, reply: '## Agent Stock\nPrecisez le produit et le nouveau prix. Exemple: `mets le prix de Huile 5W30 a 1900`.' };
      await stockAgent.updateProductPrice(product.id, amount);
      return { handled: true, reply: `## Action executee\nPrix de **${product.name}** mis a jour: **${fmt(amount)}**.` };
    }
    if (/(rupture|stock bas|commander|commande|reappro)/.test(q)) {
      return { handled: true, reply: await stockAgent.getTextReport() };
    }
    if (/(faible marge|marge faible|prix faible)/.test(q)) {
      const rows = (data.products || [])
        .map(p => ({ p, margin: Number(p.buyPrice || 0) > 0 ? ((Number(p.sellPrice || 0) - Number(p.buyPrice || 0)) / Number(p.buyPrice || 0)) * 100 : null }))
        .filter(x => x.margin !== null)
        .sort((a, b) => a.margin - b.margin)
        .slice(0, 10);
      return { handled: true, reply: ['## Produits a faible marge', ...rows.map(({ p, margin }) => `- **${p.name}** - ${margin.toFixed(1)}% (${fmt(p.buyPrice)} -> ${fmt(p.sellPrice)})`)].join('\n') };
    }
  }

  if (agentId === 'clients') {
    if (/(cree|ajoute|nouveau).*(client)|client.*(cree|ajoute|nouveau)/.test(q)) {
      if (!canWrite) return { handled: true, reply: "## Acces limite\nSeul un administrateur peut creer un client." };
      const phone = extractPhone(question);
      const name = extractNameAfter(question, ['client', 'nouveau client', 'ajoute client', 'cree client']).replace(phone, '').trim();
      if (!name) return { handled: true, reply: '## Agent Clients\nDonnez le nom du client. Exemple: `cree client Mohamed tel 0555123456`.' };
      const id = await db.clients.add({ name, phone, address: '', notes: 'Cree par Agent Clients', createdAt: nowISO() });
      return { handled: true, reply: `## Action executee\nClient **${name}** cree${phone ? ` avec telephone **${phone}**` : ''}. ID: ${id}.` };
    }
    if (/(versement|paiement|paye|regle|rembourse)/.test(q)) {
      if (!canWrite) return { handled: true, reply: "## Acces limite\nSeul un administrateur peut enregistrer un versement client." };
      const client = findByName(data.clients, q, ['name', 'phone']);
      const amount = extractAmount(question);
      if (!client || !amount) return { handled: true, reply: '## Agent Clients\nPrecisez le client et le montant. Exemple: `enregistre versement 5000 pour Rachid`.' };
      await clientAgent.recordPayment(client.id, amount);
      return { handled: true, reply: `## Action executee\nVersement de **${fmt(amount)}** enregistre pour **${client.name}**.` };
    }
    if (/(debiteur|dette|credit|relance|client)/.test(q)) {
      const client = findByName(data.clients, q, ['name', 'phone']);
      if (client && !/(debiteur|liste|tous)/.test(q)) return { handled: true, reply: clientDetailsReport(client, data) };
      return { handled: true, reply: await clientAgent.getTextReport() };
    }
    if (/(vip|meilleur client|top client)/.test(q)) {
      const rows = [...(data.clients || [])].sort((a, b) => Number(b.totalAchete || 0) - Number(a.totalAchete || 0)).slice(0, 10);
      return { handled: true, reply: ['## Meilleurs clients', ...rows.map((c, i) => `${i + 1}. **${c.name}** - ${fmt(c.totalAchete || 0)} (${c.nombreAchats || 0} achats)`)].join('\n') };
    }
  }

  if (agentId === 'finance') {
    if (/(ajoute|enregistre|cree).*(depense|charge)|(?:depense|charge).*(ajoute|enregistre|cree)/.test(q)) {
      if (!canWrite) return { handled: true, reply: "## Acces limite\nSeul un administrateur peut ajouter une depense." };
      const amount = extractAmount(question);
      const label = question.replace(/ajoute|enregistre|cree|une|un|depense|charge|de|da|\d+/gi, ' ').replace(/\s+/g, ' ').trim() || 'Depense saisie par IA';
      if (!amount) return { handled: true, reply: '## Agent Finance\nIndiquez le montant. Exemple: `ajoute depense loyer 25000`.' };
      await financeAgent.addExpense({ label, amount, category: 'Divers' });
      return { handled: true, reply: `## Action executee\nDepense **${label}** ajoutee pour **${fmt(amount)}**.` };
    }
    if (/(bilan|zakat|tresorerie|marge|benefice|depense)/.test(q)) {
      if (/(categorie|par categorie)/.test(q)) {
        const report = await financeAgent.generateMonthlyReport(true);
        const rows = Object.entries(report.expByCategory || {}).sort((a, b) => b[1] - a[1]);
        return { handled: true, reply: ['## Depenses par categorie', ...rows.map(([cat, total]) => `- **${cat}**: ${fmt(total)}`)].join('\n') || 'Aucune depense.' };
      }
      return { handled: true, reply: await financeAgent.getTextReport(true) };
    }
  }

  return { handled: false };
}

function parseInline(text) {
  if (!text) return null;
  const bold = text.split(/(\*\*[^*]+\*\*)/g);
  return bold.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 800 }}>{part.slice(2, -2)}</strong>;
    }
    const code = part.split(/(`[^`]+`)/g);
    if (code.length > 1) {
      return code.map((cp, j) =>
        cp.startsWith('`') && cp.endsWith('`')
          ? <code key={j} style={{ background: 'rgba(255,255,255,0.12)', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: 12 }}>{cp.slice(1, -1)}</code>
          : <span key={j}>{cp}</span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function MarkdownRenderer({ text, accent }) {
  if (!text) return null;
  const lines = text.split('\n');
  const els = [];
  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) { els.push(<div key={i} style={{ height: 5 }} />); return; }
    if (t.startsWith('## '))  { els.push(<div key={i} style={{ fontWeight: 900, fontSize: 12.5, color: accent, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 14, marginBottom: 5, paddingBottom: 4, borderBottom: `1px solid ${accent}25` }}>{parseInline(t.slice(3))}</div>); return; }
    if (t.startsWith('### ')) { els.push(<div key={i} style={{ fontWeight: 800, fontSize: 12.5, color: accent, marginTop: 9, marginBottom: 3 }}>{parseInline(t.slice(4))}</div>); return; }
    if (t === '---')          { els.push(<hr key={i} style={{ border: 'none', borderTop: `1px solid ${accent}20`, margin: '8px 0' }} />); return; }

    const numMatch = t.match(/^(\d+)[.)]\s+(.+)/);
    if (numMatch) {
      els.push(<div key={i} style={{ display: 'flex', gap: 8, marginBottom: 2, paddingLeft: 2 }}><span style={{ color: accent, fontWeight: 800, fontSize: 11, minWidth: 20, flexShrink: 0 }}>{numMatch[1]}.</span><span style={{ lineHeight: 1.65 }}>{parseInline(numMatch[2])}</span></div>);
      return;
    }
    if (t.startsWith('• ') || t.startsWith('- ') || t.startsWith('* ')) {
      els.push(<div key={i} style={{ display: 'flex', gap: 8, marginBottom: 3, paddingLeft: 2 }}><span style={{ color: accent, flexShrink: 0, marginTop: 4, fontSize: 8 }}>◆</span><span style={{ lineHeight: 1.65 }}>{parseInline(t.slice(2))}</span></div>);
      return;
    }
    els.push(<div key={i} style={{ lineHeight: 1.7, marginBottom: 1 }}>{parseInline(t)}</div>);
  });
  return <div style={{ fontSize: 13 }}>{els}</div>;
}

// ════════════════════════════════════════════════════════════════════════════
// MESSAGE BUBBLE
// ════════════════════════════════════════════════════════════════════════════

function Bubble({ msg, color, icon, isLight, streaming }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === 'user';

  function copy() {
    navigator.clipboard.writeText(msg.text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14, animation: 'msgIn .2s ease' }}>
        <div style={{
          maxWidth: '76%',
          background: `linear-gradient(135deg, ${color}, ${color}CC)`,
          borderRadius: '16px 16px 4px 16px',
          padding: '10px 15px', fontSize: 13.5, lineHeight: 1.6,
          color: '#000', boxShadow: `0 4px 14px ${color}35`,
        }}>
          <div style={{ fontWeight: 600 }}>{msg.text}</div>
          <div style={{ fontSize: 9, opacity: 0.55, marginTop: 4, textAlign: 'right' }}>{msg.time}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'flex-start', animation: 'msgIn .2s ease' }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        background: color + '18', border: `1.5px solid ${color}35`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
        boxShadow: `0 2px 8px ${color}20`,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          background: isLight ? 'rgba(255,255,255,0.95)' : '#111827',
          border: `1px solid ${isLight ? '#E2E8F0' : color + '20'}`,
          borderRadius: '4px 16px 16px 16px',
          padding: '13px 15px',
          boxShadow: isLight ? '0 2px 10px rgba(0,0,0,0.07)' : '0 4px 18px rgba(0,0,0,0.35)',
          color: isLight ? '#1E293B' : '#EDF1FF',
        }}>
          <MarkdownRenderer text={msg.text} accent={color} />
          {streaming && (
            <span style={{ display: 'inline-block', width: 6, height: 14, background: color, borderRadius: 2, marginLeft: 3, verticalAlign: 'middle', animation: 'blink .7s infinite' }} />
          )}
          {!streaming && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 7, borderTop: `1px solid ${color}12` }}>
              <span style={{ fontSize: 9, color: isLight ? '#CBD5E1' : '#2D3748' }}>{msg.time}</span>
              <button onClick={copy} style={{
                background: copied ? color + '20' : 'transparent',
                border: `1px solid ${copied ? color + '40' : 'transparent'}`,
                borderRadius: 6, padding: '2px 9px',
                color: copied ? color : (isLight ? '#CBD5E1' : '#2D3748'),
                cursor: 'pointer', fontSize: 10, fontWeight: 600, transition: 'all 0.15s',
              }}>{copied ? '✓ Copié !' : '📋 Copier'}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingDots({ color, icon }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'flex-start' }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: color + '18', border: `1.5px solid ${color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>{icon}</div>
      <div style={{ background: '#111827', border: `1px solid ${color}20`, borderRadius: '4px 16px 16px 16px', padding: '14px 18px', display: 'flex', gap: 5, alignItems: 'center' }}>
        {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: color, animation: `typeDot 1.2s infinite ${i * 0.2}s` }} />)}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════

export default function AIAgentPanel({ onClose, userRole = 'admin', defaultAgentId = null, moduleActions = null }) {
  const { theme: C } = useTheme();
  const isLight = C.isLight;
  const agents = userRole === 'admin' ? AGENTS_ADMIN : AGENTS_EMPLOYEE;
  const defaultAgent = defaultAgentId ? (agents.find(a => a.id === defaultAgentId) || agents[0]) : agents[0];

  const [activeAgent, setActiveAgent] = useState(defaultAgent);
  const [msgs,        setMsgs]        = useState({});
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [streaming,   setStreaming]   = useState(false);
  const [offline,     setOffline]     = useState(false);
  const [allData,     setAllData]     = useState(null);
  const [badges,      setBadges]      = useState({});

  const endRef   = useRef();
  const inputRef = useRef();

  const getTime = () => new Date().toLocaleTimeString('fr-DZ', { hour: '2-digit', minute: '2-digit' });

  useEffect(() => {
    loadAllData().then(data => {
      setAllData(data);
      setBadges({
        stock:     data.stats.stockAlerts,
        sales:     data.todaySales?.length || 0,
        clients:   data.stats.clientsDebiteurs,
        finance:   0,
        hr:        data.employees?.filter(e => e.active).length || 0,
        assistant: 0,
      });
    });
  }, []);

  useEffect(() => {
    if (defaultAgentId) { const a = agents.find(x => x.id === defaultAgentId); if (a) setActiveAgent(a); }
  }, [defaultAgentId]); // eslint-disable-line

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, [activeAgent]);

  const agentMsgs = msgs[activeAgent.id] || [{
    role: 'ai',
    text: `## Bonjour ! Je suis votre ${activeAgent.name}\n\n${activeAgent.tagline}\n\nJe suis connecté à vos données en temps réel. Que puis-je analyser pour vous ?`,
    time: getTime(),
  }];
  const activeActions = AGENT_ACTIONS[activeAgent.id] || [];

  async function simulateStream(fullText, agentId, baseHistory) {
    const words = fullText.split(' ');
    let built = '';
    for (let i = 0; i < words.length; i++) {
      built += (i === 0 ? '' : ' ') + words[i];
      setMsgs(m => ({ ...m, [agentId]: [...baseHistory, { role: 'ai', text: built, time: getTime(), _streaming: true }] }));
      const delay = fullText.length > 800 ? (i % 8 === 0 ? 12 : 0) : 18;
      if (delay) await new Promise(r => setTimeout(r, delay));
    }
    return built;
  }

  async function send(question) {
    const q = (question || input).trim();
    if (!q || loading) return;
    setInput('');

    const time = getTime();
    const userMsg = { role: 'user', text: q, time };
    const history = [...agentMsgs, userMsg];
    setMsgs(m => ({ ...m, [activeAgent.id]: history }));
    setLoading(true);

    const data = allData || await loadAllData();
    let reply = '';

    try {
      const localAction = await executeLocalAgentCommand({
        agentId: activeAgent.id,
        question: q,
        data,
        userRole,
        moduleActions,
      });

      if (localAction.handled) {
        reply = localAction.reply;
        const refreshed = await loadAllData();
        setAllData(refreshed);
        setOffline(false);
      } else {
      const key = localStorage.getItem('groq_key') || '';
      if (!key) {
        reply = `## IA locale gratuite\n\nJe n'utilise aucune API payante pour cette reponse. Les commandes d'action et les analyses metier fonctionnent directement sur vos donnees locales.\n\n${localFallback(activeAgent.id, data)}\n\n---\nTapez **aide** pour voir les commandes que je peux executer dans ce module.`;
        setOffline(false);
      } else {
        const ctx = buildContext(activeAgent.id, data, userRole);
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 25000);
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST', signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile', max_tokens: 2500, temperature: 0.65,
            messages: [
              { role: 'system', content: `${activeAgent.prompt}\n\n════ DONNÉES EN TEMPS RÉEL ════\n${ctx}\n\nDATE ET HEURE: ${new Date().toLocaleString('fr-DZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` },
              ...history.filter((_, i) => i > 0).map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text })),
            ],
          }),
        });
        clearTimeout(timer);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error?.message || `Erreur ${res.status}`);
        reply = d.choices?.[0]?.message?.content || 'Aucune réponse.';
        setOffline(false);
      }
      }
    } catch (err) {
      setOffline(true);
      reply = err.name === 'AbortError'
        ? `## Délai dépassé\n\nLa requête a pris trop de temps. Vérifiez votre connexion internet.\n\n---\n\n${localFallback(activeAgent.id, data)}`
        : `## Erreur de connexion\n\n**${err.message}**\n\n---\n\n${localFallback(activeAgent.id, data)}`;
    }

    setLoading(false);
    setStreaming(true);

    // Streaming simulé
    const placeholder = [...history, { role: 'ai', text: '', time: getTime(), _streaming: true }];
    setMsgs(m => ({ ...m, [activeAgent.id]: placeholder }));
    await simulateStream(reply, activeAgent.id, history);

    // Finaliser message (sans flag _streaming)
    setMsgs(m => ({ ...m, [activeAgent.id]: [...history, { role: 'ai', text: reply, time: getTime() }] }));
    setStreaming(false);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
  }

  // Couleurs UI
  const bg    = isLight ? '#F1F5F9' : '#08090F';
  const sideB = isLight ? '#FFFFFF' : '#070910';
  const chatB = isLight ? '#F8FAFC' : '#0B0D16';
  const bd    = isLight ? '#E2E8F0' : '#151C2E';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: C.fontBody,
    }}>
      <style>{`
        @keyframes msgIn    { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes typeDot  { 0%,80%,100% { transform:translateY(0); } 40% { transform:translateY(-5px); } }
        @keyframes blink    { 0%,100% { opacity:1; } 50% { opacity:0; } }
        @keyframes panelIn  { from { opacity:0; transform:scale(0.96) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes pulseDot { 0%,100% { box-shadow:0 0 0 0 currentColor; } 50% { box-shadow:0 0 0 4px transparent; } }
        .ai-agent-scroll::-webkit-scrollbar { width: 4px; }
        .ai-agent-scroll::-webkit-scrollbar-thumb { background: #2D3748; border-radius: 99px; }
      `}</style>

      <div style={{
        width: 1040, maxWidth: '97vw', height: '91vh',
        background: bg, border: `1px solid ${bd}`,
        borderRadius: 22, display: 'flex', overflow: 'hidden',
        boxShadow: '0 48px 140px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04)',
        animation: 'panelIn .28s cubic-bezier(0.34,1.56,0.64,1)',
      }}>

        {/* ══════════════ SIDEBAR ══════════════ */}
        <div style={{
          width: 252, flexShrink: 0,
          background: sideB, borderRight: `1px solid ${bd}`,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Header sidebar */}
          <div style={{ padding: '17px 15px 13px', borderBottom: `1px solid ${bd}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 11,
                background: 'linear-gradient(135deg,#06B6D4,#3B82F6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, boxShadow: '0 4px 14px rgba(6,182,212,0.4)',
              }}>✨</div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 14, color: isLight ? '#0F172A' : '#EDF1FF', letterSpacing: -0.3 }}>Agents IA</div>
                <div style={{ fontSize: 10, color: isLight ? '#64748B' : '#4A5568', marginTop: 1 }}>VenteX AI · Données live</div>
              </div>
            </div>
            {/* Statut connexion */}
            <div style={{
              background: offline ? '#78350F18' : '#064E3B18',
              border: `1px solid ${offline ? '#F59E0B35' : '#10B98135'}`,
              borderRadius: 8, padding: '5px 10px',
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: offline ? '#F59E0B' : '#10B981',
                boxShadow: offline ? 'none' : '0 0 7px #10B981',
              }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: offline ? '#F59E0B' : '#10B981' }}>
                {offline ? 'Mode local' : (localStorage.getItem('groq_key') ? 'IA active · Groq' : 'IA locale gratuite')}
              </span>
              {(loading || streaming) && <div style={{ marginLeft: 'auto', width: 14, height: 14, border: `2px solid ${activeAgent.color}`, borderTop: `2px solid transparent`, borderRadius: '50%', animation: 'typeDot 0.7s linear infinite' }} />}
            </div>
          </div>

          {/* Liste agents */}
          <div className="ai-agent-scroll" style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
            {agents.map(agent => {
              const isAct = activeAgent.id === agent.id;
              const b = badges[agent.id];
              return (
                <button key={agent.id} onClick={() => !loading && !streaming && setActiveAgent(agent)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 11px', borderRadius: 12, border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer', textAlign: 'left', marginBottom: 3,
                  background: isAct ? agent.color + '18' : 'transparent',
                  outline: isAct ? `2px solid ${agent.color}30` : 'none',
                  transition: 'all 0.15s', opacity: loading && !isAct ? 0.5 : 1,
                  borderLeft: `3px solid ${isAct ? agent.color : 'transparent'}`,
                }}
                onMouseEnter={e => { if (!isAct && !loading) e.currentTarget.style.background = isLight ? '#F1F5F9' : '#0F1320'; }}
                onMouseLeave={e => { if (!isAct) e.currentTarget.style.background = isAct ? agent.color + '18' : 'transparent'; }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                    background: isAct ? agent.color + '22' : (isLight ? '#F8FAFC' : '#141B2D'),
                    border: `1.5px solid ${isAct ? agent.color + '50' : 'transparent'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                  }}>{agent.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: isAct ? agent.color : (isLight ? '#334155' : '#C4CBD8') }}>{agent.name}</div>
                    <div style={{ fontSize: 10, color: isLight ? '#94A3B8' : '#394364', marginTop: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.tagline}</div>
                  </div>
                  {b > 0 && (
                    <div style={{
                      background: agent.id === 'clients' ? '#EF4444' : agent.color,
                      color: agent.id === 'clients' ? '#fff' : '#000',
                      fontSize: 9, fontWeight: 900, borderRadius: 20, padding: '2px 7px', flexShrink: 0,
                    }}>{b}</div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Stats live */}
          {allData && (
            <div style={{ padding: '11px 13px', borderTop: `1px solid ${bd}`, background: isLight ? '#F8FAFC' : '#06080E' }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: isLight ? '#CBD5E1' : '#2D3748', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                Données en direct
              </div>
              {[
                { l: "CA Aujourd'hui", v: fmt(allData.stats.caToday),     c: '#10B981' },
                { l: 'Alertes stock',  v: allData.stats.stockAlerts,       c: '#EF4444' },
                { l: 'Crédits dus',    v: fmt(allData.stats.totalCredits), c: '#F59E0B' },
              ].map(({ l, v, c }) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: isLight ? '#64748B' : '#4A5568' }}>{l}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: c }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {/* Bouton fermer */}
          <button onClick={onClose} style={{
            margin: '10px 12px 13px',
            background: 'transparent', border: `1.5px solid #EF444430`,
            borderRadius: 10, padding: '9px',
            color: '#EF4444', fontWeight: 700, cursor: 'pointer', fontSize: 12,
            transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#EF444415'; e.currentTarget.style.borderColor = '#EF444460'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#EF444430'; }}>
            ✕ Fermer le panel
          </button>
        </div>

        {/* ══════════════ ZONE CHAT ══════════════ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: chatB }}>

          {/* Header agent */}
          <div style={{
            padding: '13px 20px', borderBottom: `1px solid ${bd}`,
            background: isLight ? '#FFFFFF' : '#0D1020',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 46, height: 46, borderRadius: 13, flexShrink: 0,
              background: `linear-gradient(135deg, ${activeAgent.color}30, ${activeAgent.color}15)`,
              border: `2px solid ${activeAgent.color}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
              boxShadow: `0 4px 16px ${activeAgent.color}20`,
            }}>{activeAgent.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 16, color: activeAgent.color, letterSpacing: -0.3 }}>{activeAgent.name}</div>
              <div style={{ fontSize: 12, color: isLight ? '#64748B' : '#4A5568', marginTop: 2 }}>{activeAgent.tagline}</div>
            </div>
            {/* Chips contextuels */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {allData && activeAgent.id === 'stock' && allData.stats.stockAlerts > 0 && (
                <Chip label={`🔴 ${allData.stats.stockAlerts} alertes`} color="#EF4444" />
              )}
              {allData && activeAgent.id === 'sales' && (
                <Chip label={`📈 ${fmt(allData.stats.caToday)}`} color="#10B981" />
              )}
              {allData && activeAgent.id === 'clients' && allData.stats.clientsDebiteurs > 0 && (
                <Chip label={`⚠️ ${allData.stats.clientsDebiteurs} débiteurs`} color="#F59E0B" />
              )}
              {(loading || streaming) && (
                <Chip label={streaming ? '✍️ Rédaction...' : '🔍 Analyse...'} color={activeAgent.color} pulse />
              )}
            </div>
          </div>

          {/* Centre d'actions */}
          <div style={{
            padding: '10px 16px',
            borderBottom: `1px solid ${bd}`,
            background: isLight ? '#FFFFFF' : '#090B14',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))',
            gap: 8,
          }}>
            {activeActions.map(action => {
              const disabled = loading || streaming || (action.requiresModule && !moduleActions);
              return (
                <button key={action.id} disabled={disabled} onClick={() => send(action.command)}
                  title={action.requiresModule && !moduleActions ? 'Disponible depuis le module concerne' : action.command}
                  style={{
                    textAlign: 'left',
                    border: `1.5px solid ${disabled ? bd : activeAgent.color + '35'}`,
                    background: disabled ? (isLight ? '#F8FAFC' : '#0F1320') : activeAgent.color + '10',
                    borderRadius: 12,
                    padding: '9px 10px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.55 : 1,
                    minHeight: 66,
                  }}
                  onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = activeAgent.color + '18'; }}
                  onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = activeAgent.color + '10'; }}>
                  <div style={{ fontSize: 11.5, fontWeight: 900, color: disabled ? (isLight ? '#94A3B8' : '#3A4260') : activeAgent.color, marginBottom: 4 }}>
                    {action.label}
                  </div>
                  <div style={{ fontSize: 10.5, color: isLight ? '#64748B' : '#7A849D', lineHeight: 1.35 }}>
                    {disabled && action.requiresModule ? 'Ouvrir depuis le module.' : action.desc}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Messages */}
          <div className="ai-agent-scroll" style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 8px' }}>
            {agentMsgs.map((m, i) => (
              <Bubble
                key={i} msg={m}
                color={activeAgent.color} icon={activeAgent.icon}
                isLight={isLight} streaming={!!m._streaming && i === agentMsgs.length - 1}
              />
            ))}
            {loading && !streaming && <TypingDots color={activeAgent.color} icon={activeAgent.icon} />}
            <div ref={endRef} />
          </div>

          {/* Suggestions */}
          <div style={{
            padding: '8px 16px', borderTop: `1px solid ${bd}`,
            background: isLight ? '#FFFFFF' : '#0A0C15',
            display: 'flex', gap: 6, flexWrap: 'wrap',
          }}>
            {activeAgent.suggestions.map(s => (
              <button key={s} onClick={() => send(s)} disabled={loading || streaming} style={{
                background: (loading || streaming) ? 'transparent' : activeAgent.color + '10',
                border: `1.5px solid ${(loading || streaming) ? bd : activeAgent.color + '28'}`,
                borderRadius: 20, padding: '4px 13px',
                color: (loading || streaming) ? (isLight ? '#CBD5E1' : '#2D3748') : activeAgent.color,
                fontSize: 11, cursor: (loading || streaming) ? 'not-allowed' : 'pointer',
                fontWeight: 600, transition: 'all 0.15s', opacity: (loading || streaming) ? 0.45 : 1,
              }}
              onMouseEnter={e => { if (!loading && !streaming) e.currentTarget.style.background = activeAgent.color + '22'; }}
              onMouseLeave={e => { if (!loading && !streaming) e.currentTarget.style.background = activeAgent.color + '10'; }}>
                {s}
              </button>
            ))}
          </div>

          {/* Zone saisie */}
          <div style={{
            padding: '12px 16px 10px', borderTop: `1px solid ${bd}`,
            background: isLight ? '#FFFFFF' : '#08090F',
            display: 'flex', gap: 10, alignItems: 'flex-end',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={`Posez votre question à ${activeAgent.name}… (Entrée pour envoyer)`}
              rows={1}
              style={{
                flex: 1, resize: 'none',
                background: isLight ? '#F8FAFC' : '#0F1320',
                border: `2px solid ${isLight ? '#E2E8F0' : '#1B2135'}`,
                borderRadius: 12, padding: '10px 14px',
                color: isLight ? '#1E293B' : '#EDF1FF',
                fontSize: 13.5, outline: 'none', fontFamily: 'inherit',
                lineHeight: 1.5, transition: 'border-color 0.2s', boxSizing: 'border-box',
                maxHeight: 100, overflow: 'auto',
              }}
              onFocus={e  => { e.target.style.borderColor = activeAgent.color; }}
              onBlur={e   => { e.target.style.borderColor = isLight ? '#E2E8F0' : '#1B2135'; }}
              onInput={e  => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'; }}
            />
            <button onClick={() => send()} disabled={loading || streaming || !input.trim()} style={{
              width: 46, height: 46, flexShrink: 0, borderRadius: 12, border: 'none',
              background: (loading || streaming || !input.trim())
                ? (isLight ? '#E2E8F0' : '#1B2135')
                : `linear-gradient(135deg, ${activeAgent.color}, ${activeAgent.color}AA)`,
              color: (loading || streaming || !input.trim()) ? (isLight ? '#94A3B8' : '#3A4260') : '#000',
              cursor: (loading || streaming || !input.trim()) ? 'not-allowed' : 'pointer',
              fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: (!loading && !streaming && input.trim()) ? `0 4px 14px ${activeAgent.color}40` : 'none',
              transition: 'all 0.2s',
            }}>→</button>
          </div>

          {/* Hint */}
          <div style={{ padding: '2px 16px 7px', background: isLight ? '#FFFFFF' : '#08090F' }}>
            <span style={{ fontSize: 10, color: isLight ? '#E2E8F0' : '#1B2135' }}>
              ↵ Envoyer · ⇧↵ Saut de ligne · Données actualisées en temps réel
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CHIP UTILITAIRE
// ════════════════════════════════════════════════════════════════════════════
function Chip({ label, color, pulse }) {
  return (
    <div style={{
      background: color + '18', border: `1px solid ${color}35`,
      borderRadius: 20, padding: '3px 11px', fontSize: 10, fontWeight: 700, color,
      display: 'flex', alignItems: 'center', gap: 5,
      boxShadow: pulse ? `0 0 8px ${color}30` : 'none',
    }}>
      {pulse && <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, animation: 'blink .8s infinite' }} />}
      {label}
    </div>
  );
}
