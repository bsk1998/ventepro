import Dexie from 'dexie';

export const db = new Dexie('VentePro');

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

// ── VERSION 3 : ajout salary_payments pour suivi des salaires ─────────────
db.version(3).stores({
  products:        '++id, name, ref, category, stock, favorite, expiry, [category+stock], *barcodes',
  clients:         '++id, name, phone',
  suppliers:       '++id, name, city',
  employees:       '++id, name, role, active',
  sales:           '++id, clientId, employeeId, status, createdAt, [status+createdAt]',
  saleItems:       '++id, saleId, productId, [saleId+productId]',
  payments:        '++id, clientId, saleId, createdAt',
  expenses:        '++id, category, createdAt',
  purchases:       '++id, supplierId, status, createdAt',
  purchaseItems:   '++id, purchaseId, productId',
  quotes:          '++id, clientId, status, createdAt',
  quoteItems:      '++id, quoteId, productId',
  settings:        'key',
  salaryPayments:  '++id, employeeId, createdAt',
});

db.version(4).stores({
  products:        '++id, name, ref, category, stock, favorite, expiry, [category+stock], *barcodes',
  clients:         '++id, name, phone, creditDueDate, creditPolicy, loyaltyEnabled',
  suppliers:       '++id, name, city',
  employees:       '++id, name, role, active',
  sales:           '++id, clientId, employeeId, status, createdAt, [status+createdAt]',
  saleItems:       '++id, saleId, productId, [saleId+productId]',
  payments:        '++id, clientId, saleId, createdAt',
  expenses:        '++id, category, createdAt',
  purchases:       '++id, supplierId, status, createdAt, dueDate',
  purchaseItems:   '++id, purchaseId, productId',
  quotes:          '++id, clientId, status, createdAt',
  quoteItems:      '++id, quoteId, productId',
  settings:        'key',
  salaryPayments:  '++id, employeeId, createdAt',
  shoppingLists:   '++id, status, source, createdAt',
  shoppingListItems:'++id, listId, productId',
  saleTemplates:   '++id, name, createdAt',
  saleTemplateItems:'++id, templateId, productId',
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
// CACHE TTL
// ════════════════════════════════════════════════════════════════════════════

const CACHE_TTL_MS = 10_000;
const _cache = new Map();

function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { _cache.delete(key); return null; }
  return entry.data;
}

function cacheSet(key, data) {
  _cache.set(key, { data, ts: Date.now() });
}

export function invalidateCache(key = null) {
  if (key) _cache.delete(key);
  else     _cache.clear();
}

export async function buildBackupData() {
  return {
    version:    6,
    exportedAt: nowISO(),
    products:   await db.products.toArray(),
    clients:    await db.clients.toArray(),
    suppliers:  await db.suppliers.toArray(),
    employees:  await db.employees.toArray(),
    sales:      await db.sales.toArray(),
    saleItems:  await db.saleItems.toArray(),
    payments:   await db.payments.toArray(),
    expenses:   await db.expenses.toArray(),
    purchases:  await db.purchases.toArray().catch(() => []),
    purchaseItems: await db.purchaseItems.toArray().catch(() => []),
    quotes:     await db.quotes.toArray().catch(() => []),
    quoteItems: await db.quoteItems.toArray().catch(() => []),
    salaryPayments: await db.salaryPayments.toArray().catch(() => []),
    shoppingLists: await db.shoppingLists.toArray().catch(() => []),
    shoppingListItems: await db.shoppingListItems.toArray().catch(() => []),
    saleTemplates: await db.saleTemplates.toArray().catch(() => []),
    saleTemplateItems: await db.saleTemplateItems.toArray().catch(() => []),
    settings:   await db.settings.toArray().catch(() => []),
  };
}

export async function saveAutoBackupSnapshot(force = false) {
  const enabled = localStorage.getItem('vp_auto_backup_enabled') !== 'false';
  if (!enabled) return null;
  const last = Number(localStorage.getItem('vp_auto_backup_at') || 0);
  if (!force && Date.now() - last < 24 * 60 * 60 * 1000) return null;
  const data = await buildBackupData();
  localStorage.setItem('vp_auto_backup_snapshot', JSON.stringify(data));
  localStorage.setItem('vp_auto_backup_at', String(Date.now()));
  return data;
}

// ════════════════════════════════════════════════════════════════════════════
// getDashboardStats
// ════════════════════════════════════════════════════════════════════════════

export async function getDashboardStats() {
  const CACHE_KEY = 'dashboard_stats';
  const cached = cacheGet(CACHE_KEY);
  if (cached) return cached;

  try {
    const todayStr  = today();
    const monthStr  = todayStr.slice(0, 7);

    const [products, allSales, allSaleItems, expenses] = await Promise.all([
      db.products.toArray(),
      db.sales.orderBy('createdAt').toArray(),
      db.saleItems.toArray(),
      db.expenses.toArray().catch(() => []),
    ]);

    const salesMap    = new Map(allSales.map(s => [s.id, s]));
    const todaySales  = allSales.filter(s => s.createdAt?.startsWith(todayStr));
    const monthSales  = allSales.filter(s => s.createdAt?.startsWith(monthStr));

    // CA mois précédent pour comparaison N-1
    const prevDate = new Date();
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevMonthStr = prevDate.toISOString().slice(0, 7);
    const prevMonthSales = allSales.filter(s => s.createdAt?.startsWith(prevMonthStr));
    const prevMonthTotal = prevMonthSales.reduce((s, v) => s + Number(v.total || 0), 0);

    const todayTotal  = todaySales.reduce((s, v) => s + Number(v.total  || 0), 0);
    const todayCash   = todaySales.filter(s => s.status === 'payé').reduce((s, v) => s + Number(v.total || 0), 0);
    const todayCredit = todaySales.filter(s => s.status === 'crédit').reduce((s, v) => s + Number(v.total || 0), 0);
    const monthTotal  = monthSales.reduce((s, v) => s + Number(v.total  || 0), 0);
    const monthCredit = allSales.filter(s => s.status === 'crédit').reduce((s, v) => s + Math.max(0, Number(v.total || 0) - Number(v.paid || 0)), 0);

    const stockAlert = products.filter(p => p.stock <= (p.minStock || 5)).length;
    const stockValue = products.reduce((s, p) => s + (p.stock || 0) * (p.sellPrice || 0), 0);

    // Produits expirant dans les 30 prochains jours
    const cutoff30 = new Date();
    cutoff30.setDate(cutoff30.getDate() + 30);
    const cutoffStr = cutoff30.toISOString().slice(0, 10);
    const expiryAlert = products.filter(p => p.expiry && p.expiry >= todayStr && p.expiry <= cutoffStr).length;

    const expTotal = expenses.filter(e => e.createdAt?.startsWith(monthStr)).reduce((s, e) => s + Number(e.amount || 0), 0);

    const monthItemsCount = {};
    for (const item of allSaleItems) {
      const parentSale = salesMap.get(item.saleId);
      if (parentSale?.createdAt?.startsWith(monthStr)) {
        monthItemsCount[item.productName] = (monthItemsCount[item.productName] || 0) + item.qty;
      }
    }
    const topProduct = Object.entries(monthItemsCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    const evolution = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key   = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString('fr-DZ', { month: 'short' });
      const total = allSales.filter(s => s.createdAt?.startsWith(key)).reduce((s, v) => s + Number(v.total || 0), 0);
      evolution.push({ label, total, key });
    }

    const lastSales = [...allSales].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 5);

    const result = {
      todayTotal, todayCash, todayCredit,
      monthTotal, monthCredit, prevMonthTotal,
      monthEvolution: prevMonthTotal > 0 ? Math.round(((monthTotal - prevMonthTotal) / prevMonthTotal) * 100) : null,
      stockAlert, stockValue, expTotal, expiryAlert,
      topProduct, evolution, lastSales,
      productsCount: products.length,
      salesCount: allSales.length,
      chart: evolution,
    };

    cacheSet(CACHE_KEY, result);
    return result;

  } catch (e) {
    console.error('getDashboardStats error:', e);
    return {
      todayTotal: 0, todayCash: 0, todayCredit: 0,
      monthTotal: 0, monthCredit: 0, prevMonthTotal: 0, monthEvolution: null,
      stockAlert: 0, stockValue: 0, expTotal: 0, expiryAlert: 0,
      topProduct: '—', evolution: [], lastSales: [], chart: [],
      productsCount: 0, salesCount: 0,
    };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// PAGINATION
// ════════════════════════════════════════════════════════════════════════════

export async function fetchProductsPage(page = 0, pageSize = 50, options = {}) {
  const { search = '', category = '', sortBy = 'name', sortDir = 'asc', filterStock = 'tous' } = options;
  const todayStr = today();

  try {
    let collection;
    if (category) collection = db.products.where('category').equals(category);
    else if (sortBy === 'name')   collection = db.products.orderBy('name');
    else if (sortBy === 'stock')  collection = db.products.orderBy('stock');
    else if (sortBy === 'expiry') collection = db.products.orderBy('expiry');
    else                          collection = db.products.toCollection();

    collection = collection.filter(p => {
      if (search) {
        const s = search.toLowerCase();
        if (!p.name?.toLowerCase().includes(s) && !p.ref?.toLowerCase().includes(s) &&
            !p.barcode?.includes(s) && !(p.barcodes || []).some(b => b.includes(s)) &&
            !p.category?.toLowerCase().includes(s)) return false;
      }
      if (filterStock === 'favoris')   return p.favorite;
      if (filterStock === 'stock bas') return p.stock > 0 && p.stock <= (p.minStock || 5);
      if (filterStock === 'rupture')   return p.stock === 0;
      if (filterStock === 'périmés')   return p.expiry && p.expiry < todayStr;
      return true;
    });

    const totalCount = await collection.count();
    let items = await collection.offset(page * pageSize).limit(pageSize).toArray();

    if (sortBy === 'sellPrice') items.sort((a, b) => sortDir === 'asc' ? a.sellPrice - b.sellPrice : b.sellPrice - a.sellPrice);
    else if (sortBy === 'buyPrice') items.sort((a, b) => sortDir === 'asc' ? a.buyPrice - b.buyPrice : b.buyPrice - a.buyPrice);
    else if (sortBy === 'margin') {
      const margin = p => p.buyPrice > 0 ? ((p.sellPrice - p.buyPrice) / p.buyPrice) * 100 : 0;
      items.sort((a, b) => sortDir === 'asc' ? margin(a) - margin(b) : margin(b) - margin(a));
    } else if (sortDir === 'desc') items.reverse();

    return { items, total: totalCount, page, pageSize, hasMore: (page + 1) * pageSize < totalCount, pages: Math.ceil(totalCount / pageSize) };
  } catch (e) {
    console.error('fetchProductsPage error:', e);
    return { items: [], total: 0, page: 0, pageSize, hasMore: false, pages: 0 };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// REQUÊTES OPTIMISÉES
// ════════════════════════════════════════════════════════════════════════════

export async function getCreditSales() {
  const sales = await db.sales.where('status').equals('crédit').toArray();
  return sales.map(s => ({ ...s, remaining: Math.max(0, Number(s.total || 0) - Number(s.paid || 0)) }));
}

export async function getSalesByDate(dateStr) {
  const start = dateStr + 'T00:00:00.000Z';
  const end   = dateStr + 'T23:59:59.999Z';
  return db.sales.where('createdAt').between(start, end, true, true).toArray();
}

export async function getLowStockProducts() {
  const candidates = await db.products.where('stock').belowOrEqual(20).toArray();
  return candidates.filter(p => p.stock <= (p.minStock || 5));
}

export async function getSaleItems(saleId) {
  return db.saleItems.where('saleId').equals(saleId).toArray();
}

// ── Produits expirant bientôt ─────────────────────────────────────────────
export async function getExpiringProducts(days = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const todayStr  = today();
  const products  = await db.products.where('expiry').belowOrEqual(cutoffStr).toArray();
  return products.filter(p => p.expiry && p.expiry >= todayStr);
}

// ════════════════════════════════════════════════════════════════════════════
// SEED INITIAL
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
// BACKUP / RESTORE — BUG CORRIGÉ : data.expenses (était data.saleItems)
// ════════════════════════════════════════════════════════════════════════════

export async function exportBackup() {
  const data = await buildBackupData();
  let blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  let extension = 'json';
  if ('CompressionStream' in window) {
    const stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
    blob = await new Response(stream).blob();
    extension = 'json.gz';
  }
  const a = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `ventepro-backup-${today()}.${extension}`;
  a.click();
}

export async function importBackup(file) {
  let text;
  if (file.name?.endsWith('.gz') && 'DecompressionStream' in window) {
    const stream = file.stream().pipeThrough(new DecompressionStream('gzip'));
    text = await new Response(stream).text();
  } else {
    text = await file.text();
  }
  const data = JSON.parse(text);
  if (!data.version) throw new Error('Fichier invalide');
  await db.transaction('rw',
    db.products, db.clients, db.suppliers, db.employees,
    db.sales, db.saleItems, db.payments, db.expenses,
    db.purchases, db.purchaseItems, db.quotes, db.quoteItems,
    db.salaryPayments, db.shoppingLists, db.shoppingListItems,
    db.saleTemplates, db.saleTemplateItems, db.settings,
    async () => {
      await db.products.clear();      await db.products.bulkAdd(data.products      || []);
      await db.clients.clear();       await db.clients.bulkAdd(data.clients        || []);
      await db.suppliers.clear();     await db.suppliers.bulkAdd(data.suppliers    || []);
      await db.employees.clear();     await db.employees.bulkAdd(data.employees    || []);
      await db.sales.clear();         await db.sales.bulkAdd(data.sales            || []);
      await db.saleItems.clear();     await db.saleItems.bulkAdd(data.saleItems    || []);
      await db.payments.clear();      await db.payments.bulkAdd(data.payments      || []);
      // ✅ CORRIGÉ : data.expenses (était data.saleItems — bug critique)
      await db.expenses.clear();      await db.expenses.bulkAdd(data.expenses      || []);
      await db.purchases.clear();     await db.purchases.bulkAdd(data.purchases    || []);
      await db.purchaseItems.clear(); await db.purchaseItems.bulkAdd(data.purchaseItems || []);
      await db.quotes.clear();        await db.quotes.bulkAdd(data.quotes          || []);
      await db.quoteItems.clear();    await db.quoteItems.bulkAdd(data.quoteItems  || []);
      await db.salaryPayments.clear(); await db.salaryPayments.bulkAdd(data.salaryPayments || []);
      await db.shoppingLists.clear(); await db.shoppingLists.bulkAdd(data.shoppingLists || []);
      await db.shoppingListItems.clear(); await db.shoppingListItems.bulkAdd(data.shoppingListItems || []);
      await db.saleTemplates.clear(); await db.saleTemplates.bulkAdd(data.saleTemplates || []);
      await db.saleTemplateItems.clear(); await db.saleTemplateItems.bulkAdd(data.saleTemplateItems || []);
      await db.settings.clear();      await db.settings.bulkPut(data.settings      || []);
    }
  );
  invalidateCache();
}
