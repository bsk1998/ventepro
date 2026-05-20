import { db, nowISO, fmt, invalidateCache } from '../db';

const toNumber = value => Number(value) || 0;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class SalesAgent {
  id = 'sales';
  name = 'Agent Ventes';
  color = '#10B981';

  async analyzeBundles(minFrequency = 3) {
    const saleItems = await db.saleItems.toArray();
    const saleMap = new Map();

    for (const item of saleItems) {
      if (!saleMap.has(item.saleId)) saleMap.set(item.saleId, []);
      saleMap.get(item.saleId).push(item.productId);
    }

    const pairCount = new Map();
    for (const productIds of saleMap.values()) {
      const unique = [...new Set(productIds)].filter(Boolean);
      for (let i = 0; i < unique.length; i++) {
        for (let j = i + 1; j < unique.length; j++) {
          const key = [unique[i], unique[j]].sort((a, b) => a - b).join('-');
          pairCount.set(key, (pairCount.get(key) || 0) + 1);
        }
      }
    }

    const products = await db.products.toArray();
    const prodMap = new Map(products.map(p => [p.id, p]));

    return [...pairCount.entries()]
      .filter(([, frequency]) => frequency >= minFrequency)
      .map(([key, frequency]) => {
        const [idA, idB] = key.split('-').map(Number);
        const prodA = prodMap.get(idA);
        const prodB = prodMap.get(idB);
        if (!prodA || !prodB) return null;
        return {
          productIds: [idA, idB],
          products: [prodA, prodB],
          frequency,
          reason: `${prodA.name} + ${prodB.name}`,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.frequency - a.frequency);
  }

  async suggestUpsell(cartItems, clientId = null) {
    if (!cartItems?.length) return [];

    const cartProductIds = new Set(cartItems.map(i => i.id));
    const [bundles, products, clientInsights] = await Promise.all([
      this.analyzeBundles(2),
      db.products.toArray(),
      clientId ? this.getClientInsights(clientId) : Promise.resolve(null),
    ]);
    const prodMap = new Map(products.map(p => [p.id, p]));
    const alreadySuggested = new Set();
    const suggestions = [];

    for (const bundle of bundles) {
      const [idA, idB] = bundle.productIds;
      const hasA = cartProductIds.has(idA);
      const hasB = cartProductIds.has(idB);
      if (hasA === hasB) continue;

      const missing = hasA ? idB : idA;
      if (alreadySuggested.has(missing)) continue;

      const product = prodMap.get(missing);
      if (!product || toNumber(product.stock) <= 0) continue;

      alreadySuggested.add(missing);
      const potentialProfit = toNumber(product.sellPrice) - toNumber(product.buyPrice);
      suggestions.push({
        id: `upsell-${missing}`,
        type: 'action',
        priority: 'info',
        title: `Ajouter ${product.name}`,
        message: `${bundle.frequency} ventes montrent que ce produit accompagne souvent le panier.`,
        actionLabel: `Ajouter - ${fmt(product.sellPrice)}`,
        product,
        reason: bundle.reason,
        frequency: bundle.frequency,
        potentialProfit,
        label: `+${fmt(product.sellPrice)}`,
      });
    }

    if (clientInsights?.topProducts?.length) {
      for (const fav of clientInsights.topProducts) {
        const product = products.find(p => p.name === fav.name);
        if (!product || cartProductIds.has(product.id) || alreadySuggested.has(product.id) || toNumber(product.stock) <= 0) continue;
        suggestions.push({
          id: `favorite-${product.id}`,
          type: 'action',
          priority: 'info',
          title: `Favori client: ${product.name}`,
          message: `Ce client l'a deja achete ${fav.qty} fois.`,
          actionLabel: `Ajouter - ${fmt(product.sellPrice)}`,
          product,
          reason: 'Historique client',
          frequency: fav.qty,
          potentialProfit: toNumber(product.sellPrice) - toNumber(product.buyPrice),
          label: `+${fmt(product.sellPrice)}`,
        });
        alreadySuggested.add(product.id);
      }
    }

    return suggestions.sort((a, b) => b.potentialProfit - a.potentialProfit).slice(0, 4);
  }

  async getClientInsights(clientId) {
    if (!clientId) return null;

    const client = await db.clients.get(clientId).catch(() => null);
    if (!client) return null;

    const clientSales = await db.sales.where('clientId').equals(clientId).toArray();
    const saleIds = new Set(clientSales.map(s => s.id));
    const allItems = await db.saleItems.toArray();
    const clientItems = allItems.filter(i => saleIds.has(i.saleId));

    const totalSpent = clientSales.reduce((s, v) => s + toNumber(v.total), 0);
    const totalPaid = clientSales.reduce((s, v) => s + toNumber(v.paid), 0);
    const totalDue = Math.max(0, totalSpent - totalPaid);

    const prodCount = new Map();
    for (const item of clientItems) {
      prodCount.set(item.productName, (prodCount.get(item.productName) || 0) + toNumber(item.qty));
    }

    const topProducts = [...prodCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, qty]) => ({ name, qty }));

    const sortedSales = [...clientSales].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    const firstSale = sortedSales[0]?.createdAt;
    const lastSale = sortedSales[sortedSales.length - 1]?.createdAt;
    const daysSinceFirst = firstSale ? Math.max(1, Math.floor((Date.now() - new Date(firstSale).getTime()) / 86400000)) : 0;

    return {
      client,
      totalSpent,
      totalPaid,
      totalDue,
      salesCount: clientSales.length,
      topProducts,
      lastSale,
      avgFreqDays: clientSales.length > 1 ? Math.max(1, Math.floor(daysSinceFirst / clientSales.length)) : null,
      isVIP: totalSpent >= 50000,
      hasDebt: totalDue > 0,
      debtLimit: toNumber(client.debtLimit || client.creditLimit || 0),
    };
  }

  async analyzeCart({ items = [], clientId = null, discount = 0, paid = null, grandTotal = null } = {}) {
    const alerts = [];
    const suggestions = await this.suggestUpsell(items, clientId);
    const clientInsights = clientId ? await this.getClientInsights(clientId) : null;
    const subtotal = items.reduce((s, item) => s + toNumber(item.sellPrice) * toNumber(item.qty), 0);
    const cost = items.reduce((s, item) => s + toNumber(item.buyPrice) * toNumber(item.qty), 0);
    const finalTotal = grandTotal ?? Math.max(0, subtotal - toNumber(discount));
    const profit = finalTotal - cost;

    for (const item of items) {
      const qty = toNumber(item.qty);
      if (qty > 0 && toNumber(item.sellPrice) < toNumber(item.buyPrice)) {
        alerts.push({
          id: `loss-${item.id}`,
          priority: 'danger',
          title: `Vente a perte: ${item.name}`,
          message: `Prix vente ${fmt(item.sellPrice)} sous le prix achat ${fmt(item.buyPrice)}.`,
        });
      }
      if (qty > 0 && toNumber(item.stock) - qty <= toNumber(item.minStock || 5)) {
        alerts.push({
          id: `stock-${item.id}`,
          priority: 'warning',
          title: `Stock sensible: ${item.name}`,
          message: `Stock apres vente: ${toNumber(item.stock) - qty} ${item.unit || 'pce'}.`,
        });
      }
    }

    if (profit < 0) {
      alerts.push({
        id: 'cart-loss',
        priority: 'danger',
        title: 'Panier vendu a perte',
        message: `Benefice estime ${fmt(profit)} apres remise.`,
      });
    }

    if (clientInsights?.hasDebt) {
      const newDue = clientInsights.totalDue + Math.max(0, finalTotal - toNumber(paid ?? finalTotal));
      const limit = clientInsights.debtLimit;
      alerts.push({
        id: 'client-debt',
        priority: limit && newDue > limit ? 'danger' : 'warning',
        title: `${clientInsights.client.name} a un credit ouvert`,
        message: `Dette actuelle ${fmt(clientInsights.totalDue)}${limit ? ` / plafond ${fmt(limit)}` : ''}.`,
      });
    }

    const discountRate = subtotal > 0 ? (toNumber(discount) / subtotal) * 100 : 0;
    if (discountRate > 15) {
      alerts.push({
        id: 'high-discount',
        priority: 'warning',
        title: 'Remise elevee',
        message: `La remise represente ${discountRate.toFixed(1)}% du panier.`,
      });
    }

    return {
      alerts,
      suggestions,
      metrics: { subtotal, cost, finalTotal, profit, discountRate },
      clientInsights,
      suggestedDiscount: this.calculateSmartDiscount({ subtotal, cost, clientInsights }),
    };
  }

  calculateSmartDiscount({ subtotal, cost, clientInsights }) {
    if (!subtotal || subtotal <= cost) return null;
    const maxDiscount = Math.max(0, subtotal - cost);
    const targetRate = clientInsights?.isVIP ? 0.05 : 0.025;
    const value = Math.round(clamp(subtotal * targetRate, 0, maxDiscount * 0.5));
    if (value <= 0) return null;
    return {
      id: 'smart-discount',
      priority: 'success',
      title: clientInsights?.isVIP ? 'Remise VIP possible' : 'Remise commerciale possible',
      message: `Remise suggeree ${fmt(value)} sans vendre a perte.`,
      value,
      actionLabel: `Appliquer ${fmt(value)}`,
    };
  }

  async executeSale({ items, client, seller, totals, payment, userName }) {
    if (!items?.length) throw new Error('Panier vide');

    return db.transaction('rw', db.sales, db.saleItems, db.products, db.payments, async () => {
      for (const item of items) {
        const product = await db.products.get(item.id);
        if (!product) throw new Error(`Produit introuvable: ${item.name}`);
      }

      const saleId = await db.sales.add({
        clientName: client?.name || 'Passage',
        clientId: client?.id || null,
        employeeId: seller?.id || null,
        employeeName: seller?.name || userName || '',
        total: toNumber(payment.grandTotal),
        subtotal: toNumber(totals.subtotal),
        tva: toNumber(payment.tvaAmount),
        tvaRate: toNumber(payment.tvaRate),
        paid: toNumber(payment.paid),
        discount: toNumber(totals.discount),
        payMode: payment.payMode,
        status: payment.status,
        margin: toNumber(payment.grandTotal) - toNumber(totals.cost),
        aiAgent: this.id,
        createdAt: nowISO(),
      });

      for (const item of items) {
        const product = await db.products.get(item.id);
        const beforeStock = toNumber(product.stock);
        const afterStock = beforeStock - toNumber(item.qty);
        const stockHistory = [...(product.stockHistory || []), {
          at: nowISO(),
          before: beforeStock,
          after: afterStock,
          delta: -toNumber(item.qty),
          source: 'vente',
          saleId,
          note: afterStock < 0 ? 'Vente acceptee avec stock negatif' : 'Vente',
        }];
        await db.saleItems.add({
          saleId,
          productId: item.id,
          productName: item.name,
          qty: toNumber(item.qty),
          buyPrice: toNumber(item.buyPrice),
          unitPrice: toNumber(item.sellPrice),
          margin: (toNumber(item.sellPrice) - toNumber(item.buyPrice)) * toNumber(item.qty),
          createdAt: nowISO(),
        });
        await db.products.update(item.id, {
          stock: afterStock,
          stockHistory,
          updatedAt: nowISO(),
        });
      }

      if (client?.id && toNumber(payment.paid) > 0) {
        await db.payments.add({
          clientId: client.id,
          saleId,
          amount: toNumber(payment.paid),
          note: payment.status === 'crédit' ? 'Acompte vente' : 'Paiement vente',
          createdAt: nowISO(),
        }).catch(() => {});
      }

      invalidateCache();
      return saleId;
    });
  }

  async getTextReport(cartItems = [], clientId = null) {
    const analysis = await this.analyzeCart({ items: cartItems, clientId });
    const lines = ['## Agent Ventes'];
    if (analysis.clientInsights) {
      lines.push(`Client: ${analysis.clientInsights.client.name}`);
      lines.push(`Achats: ${fmt(analysis.clientInsights.totalSpent)} | Dette: ${fmt(analysis.clientInsights.totalDue)}`);
    }
    lines.push(`Marge panier estimee: ${fmt(analysis.metrics.profit)}`);
    if (analysis.alerts.length) lines.push(...analysis.alerts.map(a => `- ${a.title}: ${a.message}`));
    if (analysis.suggestions.length) lines.push(...analysis.suggestions.map(s => `- Upsell: ${s.product.name} (${s.label})`));
    return lines.join('\n');
  }
}

export default new SalesAgent();
