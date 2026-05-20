import { db, nowISO, fmt, saveAutoBackupSnapshot } from './db';

const toNumber = value => Number(value) || 0;
const norm = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function estimateSuggestedOrder(product, soldQty = 0, days = 30) {
  const stock = toNumber(product.stock);
  const minStock = toNumber(product.minStock || 5);
  const daily = Math.max(0, soldQty) / Math.max(1, days);
  const cover = stock <= 0 ? 45 : stock <= minStock ? 30 : 15;
  return Math.max(1, Math.ceil(daily * cover + minStock - stock));
}

export async function buildShoppingCandidates({ mode = 'alerts', prompt = '', days = 30 } = {}) {
  const [products, sales, saleItems] = await Promise.all([
    db.products.toArray(),
    db.sales.toArray(),
    db.saleItems.toArray(),
  ]);
  const since = new Date();
  since.setDate(since.getDate() - days);
  const recentIds = new Set(sales.filter(s => !s.createdAt || new Date(s.createdAt) >= since).map(s => s.id));
  const sold = new Map();
  saleItems.forEach(item => {
    if (recentIds.has(item.saleId)) sold.set(item.productId, (sold.get(item.productId) || 0) + Math.max(0, toNumber(item.qty)));
  });

  const q = norm(prompt);
  return products
    .filter(product => {
      const stock = toNumber(product.stock);
      if (mode === 'zero') return stock <= 0;
      if (mode === 'prompt') return q && [product.name, product.ref, product.category, product.barcode].some(v => norm(v).includes(q));
      return stock <= toNumber(product.minStock || 5);
    })
    .map(product => {
      const soldQty = sold.get(product.id) || 0;
      const quantity = estimateSuggestedOrder(product, soldQty, days);
      return {
        product,
        productId: product.id,
        productName: product.name,
        ref: product.ref || '',
        quantity,
        unit: product.unit || 'pce',
        buyPrice: toNumber(product.buyPrice),
        estimatedTotal: quantity * toNumber(product.buyPrice),
        reason: toNumber(product.stock) <= 0 ? 'Rupture' : toNumber(product.stock) <= toNumber(product.minStock || 5) ? 'Alerte stock' : 'Recherche IA',
      };
    })
    .sort((a, b) => a.product.stock - b.product.stock || b.estimatedTotal - a.estimatedTotal);
}

export async function createShoppingList({ title = 'Liste de courses IA', source = 'manual', items = [] }) {
  const clean = items.filter(i => i.productId && toNumber(i.quantity) > 0);
  const listId = await db.shoppingLists.add({
    title,
    source,
    status: 'ouverte',
    estimatedTotal: clean.reduce((sum, item) => sum + toNumber(item.estimatedTotal), 0),
    createdAt: nowISO(),
    updatedAt: nowISO(),
  });
  if (clean.length) {
    await db.shoppingListItems.bulkAdd(clean.map(item => ({
      listId,
      productId: item.productId,
      productName: item.productName,
      ref: item.ref || '',
      quantity: toNumber(item.quantity),
      unit: item.unit || 'pce',
      buyPrice: toNumber(item.buyPrice),
      estimatedTotal: toNumber(item.estimatedTotal) || toNumber(item.quantity) * toNumber(item.buyPrice),
      reason: item.reason || '',
      createdAt: nowISO(),
    })));
  }
  return listId;
}

export async function getLatestShoppingList() {
  const list = await db.shoppingLists.orderBy('createdAt').reverse().first().catch(() => null);
  if (!list) return null;
  const items = await db.shoppingListItems.where('listId').equals(list.id).toArray().catch(() => []);
  return { ...list, items };
}

export async function getProactiveInsights() {
  const [products, clients, sales, expenses] = await Promise.all([
    db.products.toArray(),
    db.clients.toArray(),
    db.sales.toArray(),
    db.expenses.toArray().catch(() => []),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const todaySales = sales.filter(s => s.createdAt?.startsWith(today));
  const monthSales = sales.filter(s => s.createdAt?.startsWith(month));
  const creditSales = sales.filter(s => s.status === 'crédit');
  const totalDue = creditSales.reduce((sum, s) => sum + Math.max(0, toNumber(s.total) - toNumber(s.paid)), 0);
  const overdueClients = [];
  for (const client of clients) {
    if (!client.creditDueDate || client.creditDueDate > today) continue;
    const due = sales.filter(s => s.clientId === client.id).reduce((sum, s) => sum + Math.max(0, toNumber(s.total) - toNumber(s.paid)), 0);
    if (due > 0) overdueClients.push({ client, due });
  }
  const lowStock = products.filter(p => toNumber(p.stock) > 0 && toNumber(p.stock) <= toNumber(p.minStock || 5));
  const zeroStock = products.filter(p => toNumber(p.stock) <= 0);
  const lowMargin = products
    .filter(p => toNumber(p.buyPrice) > 0)
    .map(p => ({ product: p, margin: ((toNumber(p.sellPrice) - toNumber(p.buyPrice)) / toNumber(p.buyPrice)) * 100 }))
    .filter(x => x.margin < 15)
    .sort((a, b) => a.margin - b.margin);
  const monthExpenses = expenses.filter(e => e.createdAt?.startsWith(month)).reduce((s, e) => s + toNumber(e.amount), 0);
  const caMonth = monthSales.reduce((s, v) => s + toNumber(v.total), 0);

  return [
    ...zeroStock.slice(0, 3).map(({ name }) => ({ priority: 'danger', title: `${name} en rupture`, message: 'Ajouter a la liste de courses ou commander fournisseur.' })),
    ...lowStock.slice(0, 3).map(({ name, stock, minStock }) => ({ priority: 'warning', title: `${name} presque fini`, message: `Stock ${stock}, minimum ${minStock || 5}.` })),
    ...overdueClients.slice(0, 3).map(({ client, due }) => ({ priority: client.creditPolicy === 'block' ? 'danger' : 'warning', title: `Credit en retard: ${client.name}`, message: `${fmt(due)} a regler depuis le ${client.creditDueDate}.` })),
    ...lowMargin.slice(0, 3).map(({ product, margin }) => ({ priority: 'info', title: `Marge faible: ${product.name}`, message: `Marge ${margin.toFixed(1)}%. Revoir prix de vente.` })),
    totalDue > 0 ? { priority: 'warning', title: 'Credits ouverts', message: `Reste a encaisser: ${fmt(totalDue)}.` } : null,
    monthExpenses > caMonth * 0.35 && caMonth > 0 ? { priority: 'warning', title: 'Charges elevees', message: `Depenses du mois: ${fmt(monthExpenses)}.` } : null,
    todaySales.length === 0 ? { priority: 'info', title: 'Aucune vente aujourd hui', message: 'Verifier la saisie ou lancer une action commerciale.' } : null,
  ].filter(Boolean).slice(0, 10);
}

export async function runAutoBackup() {
  return saveAutoBackupSnapshot(false);
}
