import Dexie from 'dexie';

export const db = new Dexie('VentePro');

db.version(1).stores({
  products:   '++id, name, ref, category, stock, favorite, expiry',
  clients:    '++id, name, phone',
  suppliers:  '++id, name, city',
  employees:  '++id, name, role, active',
  sales:      '++id, clientId, employeeId, status, createdAt',
  saleItems:  '++id, saleId, productId',
  payments:   '++id, clientId, saleId, createdAt',
  expenses:   '++id, category, createdAt',
  purchases:  '++id, supplierId, status, createdAt',
  purchaseItems: '++id, purchaseId, productId',
  quotes:      '++id, clientId, status, createdAt',
  quoteItems: '++id, quoteId, productId',
  settings:   'key',
});

export async function seedIfEmpty() {
  const count = await db.products.count();
  if (count > 0) return;

  await db.products.bulkAdd([
    { name:'Huile Moteur 5W30', ref:'HM-001', category:'Lubrifiants',   buyPrice:1200, sellPrice:1850, stock:42, minStock:10, unit:'L',   expiry:'2027-06-01', favorite:true,  barcode:'' },
    { name:'Filtre à Air',      ref:'FA-002', category:'Filtres',        buyPrice:380,  sellPrice:650,  stock:7,  minStock:15, unit:'pce', expiry:'2028-01-01', favorite:false, barcode:'' },
    { name:'Bougie NGK',        ref:'BG-003', category:'Électrique',     buyPrice:220,  sellPrice:420,  stock:88, minStock:20, unit:'pce', expiry:null,          favorite:true,  barcode:'' },
    { name:'Liquide Frein DOT4',ref:'LF-004', category:'Liquides',        buyPrice:500,  sellPrice:980,  stock:3,  minStock:8,  unit:'L',   expiry:'2026-05-01', favorite:false, barcode:'' },
    { name:'Courroie Distrib.', ref:'CD-005', category:'Distribution',   buyPrice:1400, sellPrice:2400, stock:15, minStock:5,  unit:'pce', expiry:null,          favorite:false, barcode:'' },
    { name:'Plaquettes Frein',  ref:'PF-006', category:'Freinage',        buyPrice:700,  sellPrice:1200, stock:0,  minStock:10, unit:'jeu', expiry:null,          favorite:true,  barcode:'' },
  ]);

  await db.clients.bulkAdd([
    { name:'Rachid Benmoussa', phone:'0661 23 45 67', address:'Alger Centre', notes:'Client fidèle',           createdAt: new Date().toISOString() },
    { name:'Karim Hadj',       phone:'0770 98 76 54', address:'Bab Ezzouar',  notes:'',                         createdAt: new Date().toISOString() },
    { name:'Farid Slimani',    phone:'0555 11 22 33', address:'Hussein Dey',  notes:'Appeler avant livraison', createdAt: new Date().toISOString() },
    { name:'Ahmed Benali',     phone:'0662 44 55 66', address:'Kouba',         notes:'',                         createdAt: new Date().toISOString() },
  ]);

  await db.suppliers.bulkAdd([
    { name:'Alpha Distribution', contact:'Mourad', phone:'0550 10 20 30', city:'Alger', notes:'' },
    { name:'Meca Import',        contact:'Salim',  phone:'0661 55 66 77', city:'Oran',  notes:'' },
    { name:'TechAuto SARL',      contact:'Khaled', phone:'0770 33 44 55', city:'Blida', notes:'' },
  ]);

  await db.employees.bulkAdd([
    { name:'Propriétaire', role:'gérant',    phone:'',             pin:'0000', salary:0,     active:true },
    { name:'Amar Djelloul', role:'vendeur',  phone:'0661 11 22 33', pin:'1234', salary:45000, active:true },
    { name:'Sara Hadj',     role:'caissière',phone:'0770 44 55 66', pin:'5678', salary:40000, active:true },
  ]);

  await db.settings.bulkPut([
    { key:'shop_name',  value:'VentePro' },
    { key:'currency',   value:'DA' },
    { key:'tax_rate',   value:'19' },
    { key:'theme',      value:'dark' },
    { key:'print_logo', value:'' },
  ]);
}

// ─── today() — date du jour au format YYYY-MM-DD ──────────────────
export function today() {
  return new Date().toISOString().slice(0, 10);
}

// ─── nowISO() — date+heure ISO complète ───────────────────────────
export function nowISO() {
  return new Date().toISOString();
}

// ─── fmt() — formatage monétaire algérien ─────────────────────────
export function fmt(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('fr-DZ', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' DA';
}

// ─── getDashboardStats() — stats temps réel pour le Dashboard ─────
export async function getDashboardStats() {
  try {
    const todayStr = today();
    const monthStr = todayStr.slice(0, 7); // YYYY-MM

    const [products, sales, expenses] = await Promise.all([
      db.products.toArray(),
      db.sales.toArray(),
      db.expenses?.toArray().catch(() => []) || Promise.resolve([]),
    ]);

    // Ventes aujourd'hui
    const todaySales  = sales.filter(s => s.createdAt?.startsWith(todayStr));
    const todayTotal  = todaySales.reduce((s, v) => s + Number(v.total || 0), 0);
    const todayCash   = todaySales.filter(s => s.status === 'payé').reduce((s, v) => s + Number(v.total || 0), 0);
    const todayCredit = todaySales.filter(s => s.status === 'crédit').reduce((s, v) => s + Number(v.total || 0), 0);

    // Ventes du mois
    const monthSales  = sales.filter(s => s.createdAt?.startsWith(monthStr));
    const monthTotal  = monthSales.reduce((s, v) => s + Number(v.total || 0), 0);
    const monthCredit = sales.filter(s => s.status === 'crédit')
      .reduce((s, v) => s + Math.max(0, Number(v.total || 0) - Number(v.paid || 0)), 0);

    // Stock
    const stockAlert  = products.filter(p => p.stock <= (p.minStock || 5)).length;
    const stockValue  = products.reduce((s, p) => s + (p.stock || 0) * (p.sellPrice || 0), 0);

    // Dépenses du mois
    const expTotal = expenses.filter(e => e.createdAt?.startsWith(monthStr))
      .reduce((s, e) => s + Number(e.amount || 0), 0);

    // Top produit du mois
    const saleItems = await db.saleItems.toArray().catch(() => []);
    const monthItems = saleItems.filter(i => {
      const sale = sales.find(s => s.id === i.saleId);
      return sale?.createdAt?.startsWith(monthStr);
    });
    const prodCount = {};
    monthItems.forEach(i => { prodCount[i.productName] = (prodCount[i.productName] || 0) + i.qty; });
    const topProduct = Object.entries(prodCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    // Évolution 7 derniers mois
    const evolution = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString('fr-DZ', { month: 'short' });
      const total = sales.filter(s => s.createdAt?.startsWith(key))
        .reduce((s, v) => s + Number(v.total || 0), 0);
      evolution.push({ label, total, key });
    }

    // Dernières ventes (5)
    const lastSales = [...sales].sort((a, b) => b.createdAt?.localeCompare(a.createdAt))
      .slice(0, 5);

    return {
      todayTotal, todayCash, todayCredit,
      monthTotal, monthCredit,
      stockAlert, stockValue, expTotal,
      topProduct, evolution, lastSales,
      productsCount: products.length,
      salesCount: sales.length,
    };
  } catch (e) {
    console.error('getDashboardStats error:', e);
    return {
      todayTotal: 0, todayCash: 0, todayCredit: 0,
      monthTotal: 0, monthCredit: 0,
      stockAlert: 0, stockValue: 0, expTotal: 0,
      topProduct: '—', evolution: [], lastSales: [],
      productsCount: 0, salesCount: 0,
    };
  }
}

export async function exportBackup() {
  const data = {
    version: 3,
    exportedAt: nowISO(),
    products:  await db.products.toArray(),
    clients:   await db.clients.toArray(),
    suppliers: await db.suppliers.toArray(),
    employees: await db.employees.toArray(),
    sales:     await db.sales.toArray(),
    saleItems: await db.saleItems.toArray(),
    payments:  await db.payments.toArray(),
    expenses:  await db.expenses.toArray(),
  };
  const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ventepro-backup-${today()}.json`;
  a.click();
}

export async function importBackup(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!data.version) throw new Error('Fichier invalide');
  await db.transaction('rw', db.products, db.clients, db.suppliers, db.employees, db.sales, db.saleItems, db.payments, db.expenses, async () => {
    await db.products.clear();  await db.products.bulkAdd(data.products||[]);
    await db.clients.clear();   await db.clients.bulkAdd(data.clients||[]);
    await db.suppliers.clear(); await db.suppliers.bulkAdd(data.suppliers||[]);
    await db.employees.clear(); await db.employees.bulkAdd(data.employees||[]);
    await db.sales.clear();     await db.sales.bulkAdd(data.sales||[]);
    await db.saleItems.clear(); await db.saleItems.bulkAdd(data.saleItems||[]);
    await db.payments.clear();  await db.payments.bulkAdd(data.payments||[]);
    await db.expenses.clear();  await db.expenses.bulkAdd(data.expenses||[]);
  });
}