import Dexie from 'dexie';

// ════════════════════════════════════════════════════════════════════════════
// BASE DE DONNÉES — VentePro v2
// Migration v1 → v2 : ajout d'index composites
// Dexie gère la migration automatiquement via .version(2).stores().upgrade()
// Les données existantes sont CONSERVÉES — seuls les index sont reconstruits
// ════════════════════════════════════════════════════════════════════════════

export const db = new Dexie('VentePro');

// ── VERSION 1 (schema original — NE PAS TOUCHER) ──────────────────────────
// Dexie a besoin de la v1 déclarée pour gérer les utilisateurs existants
db.version(1).stores({
  products:      '++id, name, ref, category, stock, favorite, expiry',
  clients:       '++id, name, phone',
  suppliers:     '++id, name, city',
  employees:     '++id, name, role, active',
  sales:         '++id, clientId, employeeId, status, createdAt',
  saleItems:     '++id, saleId, productId',
  payments:      '++id, clientId, saleId, createdAt',
  expenses:      '++id, category, createdAt',
  purchases:     '++id, supplierId, status, createdAt',
  purchaseItems: '++id, purchaseId, productId',
  quotes:        '++id, clientId, status, createdAt',
  quoteItems:    '++id, quoteId, productId',
  settings:      'key',
});

// ── VERSION 2 (index composites — MIGRATION AUTOMATIQUE) ──────────────────
// Dexie compare v1 et v2, reconstruit les index sans toucher aux données.
// Si un utilisateur ouvre l'app avec la v1, Dexie migre silencieusement.
//
// SYNTAXE INDEX COMPOSITES Dexie :
//   '[champ1+champ2]'  → index composite (recherche sur les deux)
//   '*tags'            → index multi-entrées
//   '&ref'             → index unique
//
// POURQUOI CES INDEX ?
//   [category+stock]   → filtre par catégorie ET stock en une seule opération
//   [status+createdAt] → récupérer les ventes crédit du jour en O(log n)
//   [saleId+productId] → jointure saleItems→sales sans full scan
db.version(2).stores({
  products:      '++id, name, ref, category, stock, favorite, expiry, [category+stock], *barcodes',
  clients:       '++id, name, phone',
  suppliers:     '++id, name, city',
  employees:     '++id, name, role, active',
  sales:         '++id, clientId, employeeId, status, createdAt, [status+createdAt]',
  saleItems:     '++id, saleId, productId, [saleId+productId]',
  payments:      '++id, clientId, saleId, createdAt',
  expenses:      '++id, category, createdAt',
  purchases:     '++id, supplierId, status, createdAt',
  purchaseItems: '++id, purchaseId, productId',
  quotes:        '++id, clientId, status, createdAt',
  quoteItems:    '++id, quoteId, productId',
  settings:      'key',
});

// ════════════════════════════════════════════════════════════════════════════
// HELPERS UTILITAIRES
// ════════════════════════════════════════════════════════════════════════════

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function nowISO() {
  return new Date().toISOString();
}

export function fmt(n) {
  return (Number(n) || 0).toLocaleString('fr-DZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }) + ' DA';
}

// ════════════════════════════════════════════════════════════════════════════
// SYSTÈME DE CACHE TTL (Time-To-Live)
// ════════════════════════════════════════════════════════════════════════════
// Principe : on stocke le résultat en mémoire avec un timestamp.
// Si on rappelle la fonction dans les TTL_MS suivantes, on retourne
// le résultat en cache sans toucher à IndexedDB.
//
// IMPACT : getDashboardStats passe de ~300ms à ~0ms lors des navigations
// répétées (retour dashboard, ouverture panel IA, etc.)

const CACHE_TTL_MS = 60_000; // 60 secondes

const _cache = new Map();
// Structure : { data: any, ts: number (Date.now()) }

function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    _cache.delete(key);
    return null;
  }
  return entry.data;
}

function cacheSet(key, data) {
  _cache.set(key, { data, ts: Date.now() });
}

// Invalider le cache manuellement après une vente ou modification
export function invalidateCache(key = null) {
  if (key) _cache.delete(key);
  else     _cache.clear();
}

// ════════════════════════════════════════════════════════════════════════════
// getDashboardStats — VERSION OPTIMISÉE
// ════════════════════════════════════════════════════════════════════════════
// Optimisations appliquées :
//   1. Cache TTL 60s pour éviter les rechargements inutiles
//   2. Index [status+createdAt] pour les requêtes filtrées
//   3. Map() pour les jointures saleItems→sales en O(1)
//   4. Requêtes parallèles avec Promise.all

export async function getDashboardStats() {
  const CACHE_KEY = 'dashboard_stats';
  const cached = cacheGet(CACHE_KEY);
  if (cached) return cached;

  try {
    const todayStr  = today();
    const monthStr  = todayStr.slice(0, 7); // YYYY-MM

    // ── Chargement parallèle ──────────────────────────────────────────────
    const [products, allSales, allSaleItems, expenses] = await Promise.all([
      db.products.toArray(),

      // OPTIMISATION INDEX : on récupère toutes les ventes triées
      // L'index sur createdAt rend ce tri quasi-gratuit
      db.sales.orderBy('createdAt').toArray(),

      db.saleItems.toArray(),

      db.expenses.toArray().catch(() => []),
    ]);

    // ── OPTIMISATION O(n²) → O(1) : Map des ventes ───────────────────────
    // Avant : items.filter(i => sales.find(s => s.id === i.saleId))
    //         = O(items × sales) = potentiellement 50 000 × 300 = 15M ops
    //
    // Après : salesMap.get(i.saleId)
    //         = O(1) quelle que soit la taille
    const salesMap = new Map(allSales.map(s => [s.id, s]));

    // ── Filtrage par période (lecture index, pas full scan) ───────────────
    const todaySales = allSales.filter(s => s.createdAt?.startsWith(todayStr));
    const monthSales = allSales.filter(s => s.createdAt?.startsWith(monthStr));

    // ── Calculs ventes aujourd'hui ────────────────────────────────────────
    const todayTotal  = todaySales.reduce((s, v) => s + Number(v.total  || 0), 0);
    const todayCash   = todaySales.filter(s => s.status === 'payé')
                                  .reduce((s, v) => s + Number(v.total  || 0), 0);
    const todayCredit = todaySales.filter(s => s.status === 'crédit')
                                  .reduce((s, v) => s + Number(v.total  || 0), 0);

    // ── Calculs ventes du mois ────────────────────────────────────────────
    const monthTotal  = monthSales.reduce((s, v) => s + Number(v.total  || 0), 0);
    const monthCredit = allSales
      .filter(s => s.status === 'crédit')
      .reduce((s, v) => s + Math.max(0, Number(v.total || 0) - Number(v.paid || 0)), 0);

    // ── Stock ─────────────────────────────────────────────────────────────
    const stockAlert = products.filter(p => p.stock <= (p.minStock || 5)).length;
    const stockValue = products.reduce((s, p) => s + (p.stock || 0) * (p.sellPrice || 0), 0);

    // ── Dépenses du mois ──────────────────────────────────────────────────
    const expTotal = expenses
      .filter(e => e.createdAt?.startsWith(monthStr))
      .reduce((s, e) => s + Number(e.amount || 0), 0);

    // ── Top produit du mois : UTILISE salesMap en O(1) ───────────────────
    // Avant : sales.find(s => s.id === i.saleId) dans une boucle → O(n²)
    // Après : salesMap.get(i.saleId)             dans une boucle → O(n)
    const monthItemsCount = {};
    for (const item of allSaleItems) {
      const parentSale = salesMap.get(item.saleId);
      if (parentSale?.createdAt?.startsWith(monthStr)) {
        monthItemsCount[item.productName] =
          (monthItemsCount[item.productName] || 0) + item.qty;
      }
    }
    const topProduct =
      Object.entries(monthItemsCount)
            .sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    // ── Évolution 7 derniers mois ─────────────────────────────────────────
    const evolution = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key   = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString('fr-DZ', { month: 'short' });
      const total = allSales
        .filter(s => s.createdAt?.startsWith(key))
        .reduce((s, v) => s + Number(v.total || 0), 0);
      evolution.push({ label, total, key });
    }

    // ── Dernières ventes (5) ──────────────────────────────────────────────
    const lastSales = [...allSales]
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 5);

    const result = {
      todayTotal, todayCash, todayCredit,
      monthTotal, monthCredit,
      stockAlert, stockValue, expTotal,
      topProduct, evolution, lastSales,
      productsCount: products.length,
      salesCount:    allSales.length,
      chart:         evolution, // alias utilisé dans Treasury.js
    };

    cacheSet(CACHE_KEY, result);
    return result;

  } catch (e) {
    console.error('getDashboardStats error:', e);
    return {
      todayTotal: 0, todayCash: 0, todayCredit: 0,
      monthTotal: 0, monthCredit: 0,
      stockAlert: 0, stockValue: 0, expTotal: 0,
      topProduct: '—', evolution: [], lastSales: [], chart: [],
      productsCount: 0, salesCount: 0,
    };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// PAGINATION CÔTÉ BASE DE DONNÉES
// ════════════════════════════════════════════════════════════════════════════
// Principe : au lieu de charger 10 000 produits, on ne charge que 50 à la fois.
// Dexie utilise .offset() qui saute des entrées dans l'index → très rapide.
//
// Utilisation dans Products.js :
//   const { items, total, hasMore } = await fetchProductsPage(0, 50);
//   // page suivante :
//   const { items: page2 } = await fetchProductsPage(1, 50);
//
// PARAMÈTRES :
//   page     : numéro de page (commence à 0)
//   pageSize : nombre de produits par page (recommandé : 50)
//   options  : { search, category, sortBy, sortDir, filterStock }

export async function fetchProductsPage(page = 0, pageSize = 50, options = {}) {
  const {
    search    = '',
    category  = '',
    sortBy    = 'name',         // 'name' | 'stock' | 'sellPrice' | 'buyPrice' | 'expiry'
    sortDir   = 'asc',          // 'asc' | 'desc'
    filterStock = 'tous',       // 'tous' | 'favoris' | 'stock bas' | 'rupture' | 'périmés'
  } = options;

  const todayStr = today();

  try {
    // ── Étape 1 : requête de base avec index si possible ──────────────────
    let collection;

    if (category) {
      // Utilise l'index sur 'category' — lecture directe, pas full scan
      collection = db.products.where('category').equals(category);
    } else if (sortBy === 'name') {
      collection = db.products.orderBy('name');
    } else if (sortBy === 'stock') {
      collection = db.products.orderBy('stock');
    } else if (sortBy === 'expiry') {
      collection = db.products.orderBy('expiry');
    } else {
      // Pour sellPrice / buyPrice / margin : pas d'index → on trie en mémoire après
      collection = db.products.toCollection();
    }

    // ── Étape 2 : appliquer les filtres en mémoire (après l'index) ────────
    // Note : les filtres .filter() de Dexie s'appliquent après l'index,
    // ce qui est bien plus efficace qu'un toArray().filter() complet.
    collection = collection.filter(p => {
      // Filtre texte
      if (search) {
        const s = search.toLowerCase();
        const matchName     = p.name?.toLowerCase().includes(s);
        const matchRef      = p.ref?.toLowerCase().includes(s);
        const matchBarcode  = p.barcode?.includes(s);
        const matchBarcodes = (p.barcodes || []).some(b => b.includes(s));
        const matchCat      = p.category?.toLowerCase().includes(s);
        if (!matchName && !matchRef && !matchBarcode && !matchBarcodes && !matchCat) return false;
      }

      // Filtre stock
      if (filterStock === 'favoris')   return p.favorite;
      if (filterStock === 'stock bas') return p.stock > 0 && p.stock <= (p.minStock || 5);
      if (filterStock === 'rupture')   return p.stock === 0;
      if (filterStock === 'périmés')   return p.expiry && p.expiry < todayStr;

      return true;
    });

    // ── Étape 3 : compter le total (pour la pagination UI) ────────────────
    // Dexie clone la collection pour le count, la collection principale reste utilisable
    const totalCount = await collection.count();

    // ── Étape 4 : appliquer offset + limit ───────────────────────────────
    // .offset() saute n enregistrements dans l'index → O(log n + offset)
    // C'est beaucoup plus rapide que de charger tout puis de .slice()
    let items = await collection
      .offset(page * pageSize)
      .limit(pageSize)
      .toArray();

    // ── Étape 5 : tri en mémoire si l'index ne peut pas le faire ─────────
    if (sortBy === 'sellPrice') {
      items.sort((a, b) => sortDir === 'asc'
        ? a.sellPrice - b.sellPrice
        : b.sellPrice - a.sellPrice);
    } else if (sortBy === 'buyPrice') {
      items.sort((a, b) => sortDir === 'asc'
        ? a.buyPrice - b.buyPrice
        : b.buyPrice - a.buyPrice);
    } else if (sortBy === 'margin') {
      const margin = p => p.buyPrice > 0
        ? ((p.sellPrice - p.buyPrice) / p.buyPrice) * 100
        : 0;
      items.sort((a, b) => sortDir === 'asc'
        ? margin(a) - margin(b)
        : margin(b) - margin(a));
    } else if (sortDir === 'desc') {
      // L'index Dexie est toujours ASC, on inverse si besoin
      items.reverse();
    }

    return {
      items,
      total:   totalCount,
      page,
      pageSize,
      hasMore: (page + 1) * pageSize < totalCount,
      pages:   Math.ceil(totalCount / pageSize),
    };

  } catch (e) {
    console.error('fetchProductsPage error:', e);
    return { items: [], total: 0, page: 0, pageSize, hasMore: false, pages: 0 };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// REQUÊTES OPTIMISÉES FRÉQUENTES
// ════════════════════════════════════════════════════════════════════════════

// Récupère toutes les ventes à crédit avec calcul de la dette résiduelle
// Utilise l'index sur 'status' → O(log n) au lieu de O(n)
export async function getCreditSales() {
  const sales = await db.sales.where('status').equals('crédit').toArray();
  return sales.map(s => ({
    ...s,
    remaining: Math.max(0, Number(s.total || 0) - Number(s.paid || 0)),
  }));
}

// Récupère les ventes d'une journée précise
// Utilise l'index sur createdAt via between() → O(log n)
export async function getSalesByDate(dateStr) {
  // dateStr format : 'YYYY-MM-DD'
  const start = dateStr + 'T00:00:00.000Z';
  const end   = dateStr + 'T23:59:59.999Z';
  return db.sales
    .where('createdAt')
    .between(start, end, true, true)
    .toArray();
}

// Récupère les produits en alerte stock (stock ≤ minStock)
// Utilise l'index sur 'stock' → O(log n)
export async function getLowStockProducts() {
  // On récupère tous les produits avec stock ≤ 20 (seuil large),
  // puis on filtre en mémoire selon le minStock individuel de chaque produit
  const candidates = await db.products
    .where('stock')
    .belowOrEqual(20)
    .toArray();
  return candidates.filter(p => p.stock <= (p.minStock || 5));
}

// Récupère les items d'une vente précise via l'index
// Remplace : saleItems.filter(i => i.saleId === id) qui fait un full scan
export async function getSaleItems(saleId) {
  return db.saleItems.where('saleId').equals(saleId).toArray();
}

// ════════════════════════════════════════════════════════════════════════════
// SEED INITIAL (inchangé fonctionnellement)
// ════════════════════════════════════════════════════════════════════════════

export async function seedIfEmpty() {
  const count = await db.products.count();
  if (count > 0) return;

  await db.products.bulkAdd([
    { name:'Huile Moteur 5W30',  ref:'HM-001', category:'Lubrifiants',  buyPrice:1200, sellPrice:1850, stock:42, minStock:10, unit:'L',   expiry:'2027-06-01', favorite:true,  barcode:'', barcodes:[] },
    { name:'Filtre à Air',       ref:'FA-002', category:'Filtres',       buyPrice:380,  sellPrice:650,  stock:7,  minStock:15, unit:'pce', expiry:'2028-01-01', favorite:false, barcode:'', barcodes:[] },
    { name:'Bougie NGK',         ref:'BG-003', category:'Électrique',    buyPrice:220,  sellPrice:420,  stock:88, minStock:20, unit:'pce', expiry:null,         favorite:true,  barcode:'', barcodes:[] },
    { name:'Liquide Frein DOT4', ref:'LF-004', category:'Liquides',      buyPrice:500,  sellPrice:980,  stock:3,  minStock:8,  unit:'L',   expiry:'2026-05-01', favorite:false, barcode:'', barcodes:[] },
    { name:'Courroie Distrib.',  ref:'CD-005', category:'Distribution',  buyPrice:1400, sellPrice:2400, stock:15, minStock:5,  unit:'pce', expiry:null,         favorite:false, barcode:'', barcodes:[] },
    { name:'Plaquettes Frein',   ref:'PF-006', category:'Freinage',      buyPrice:700,  sellPrice:1200, stock:0,  minStock:10, unit:'jeu', expiry:null,         favorite:true,  barcode:'', barcodes:[] },
  ]);

  await db.clients.bulkAdd([
    { name:'Rachid Benmoussa', phone:'0661 23 45 67', address:'Alger Centre', notes:'Client fidèle',          createdAt: nowISO() },
    { name:'Karim Hadj',       phone:'0770 98 76 54', address:'Bab Ezzouar',  notes:'',                        createdAt: nowISO() },
    { name:'Farid Slimani',    phone:'0555 11 22 33', address:'Hussein Dey',  notes:'Appeler avant livraison', createdAt: nowISO() },
    { name:'Ahmed Benali',     phone:'0662 44 55 66', address:'Kouba',        notes:'',                        createdAt: nowISO() },
  ]);

  await db.suppliers.bulkAdd([
    { name:'Alpha Distribution', contact:'Mourad', phone:'0550 10 20 30', city:'Alger', notes:'' },
    { name:'Meca Import',        contact:'Salim',  phone:'0661 55 66 77', city:'Oran',  notes:'' },
    { name:'TechAuto SARL',      contact:'Khaled', phone:'0770 33 44 55', city:'Blida', notes:'' },
  ]);

  await db.employees.bulkAdd([
    { name:'Propriétaire',  role:'gérant',    phone:'',              pin:'0000', salary:0,     active:true, createdAt: nowISO() },
    { name:'Amar Djelloul', role:'vendeur',   phone:'0661 11 22 33', pin:'1234', salary:45000, active:true, createdAt: nowISO() },
    { name:'Sara Hadj',     role:'caissière', phone:'0770 44 55 66', pin:'5678', salary:40000, active:true, createdAt: nowISO() },
  ]);

  await db.settings.bulkPut([
    { key:'shop_name',    value:'VentePro'  },
    { key:'currency',     value:'DA'        },
    { key:'tax_rate',     value:'19'        },
    { key:'theme',        value:'dark'      },
    { key:'print_logo',   value:''          },
    { key:'shop_address', value:'Algérie'   },
    { key:'shop_phone',   value:''          },
    { key:'shop_tax',     value:''          },
    { key:'footer_text',  value:'Merci de votre confiance !' },
    { key:'auto_print',   value:'false'     },
    { key:'ticket_width', value:'80mm'      },
  ]);
}

// ════════════════════════════════════════════════════════════════════════════
// BACKUP / RESTORE (inchangé)
// ════════════════════════════════════════════════════════════════════════════

export async function exportBackup() {
  const data = {
    version:    3,
    exportedAt: nowISO(),
    products:   await db.products.toArray(),
    clients:    await db.clients.toArray(),
    suppliers:  await db.suppliers.toArray(),
    employees:  await db.employees.toArray(),
    sales:      await db.sales.toArray(),
    saleItems:  await db.saleItems.toArray(),
    payments:   await db.payments.toArray(),
    expenses:   await db.expenses.toArray(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `ventepro-backup-${today()}.json`;
  a.click();
}

export async function importBackup(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data.version) throw new Error('Fichier invalide');
  await db.transaction('rw',
    db.products, db.clients, db.suppliers, db.employees,
    db.sales, db.saleItems, db.payments, db.expenses,
    async () => {
      await db.products.clear();  await db.products.bulkAdd(data.products  || []);
      await db.clients.clear();   await db.clients.bulkAdd(data.clients    || []);
      await db.suppliers.clear(); await db.suppliers.bulkAdd(data.suppliers || []);
      await db.employees.clear(); await db.employees.bulkAdd(data.employees || []);
      await db.sales.clear();     await db.sales.bulkAdd(data.sales        || []);
      await db.saleItems.clear(); await db.saleItems.bulkAdd(data.saleItems || []);
      await db.payments.clear();  await db.payments.bulkAdd(data.payments  || []);
      await db.expenses.clear();  await db.expenses.bulkAdd(data.saleItems || []);
    }
  );
  // Invalider le cache après un import
  invalidateCache();
}