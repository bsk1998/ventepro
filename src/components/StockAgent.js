import { db, nowISO, fmt } from '../db';

const toNumber = value => Number(value) || 0;

export class StockAgent {
  id = 'stock';
  name = 'Agent Stock';
  color = '#F59E0B';

  async getRecentSales(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return db.sales.where('createdAt').aboveOrEqual(since.toISOString()).toArray();
  }

  async calcVelocity(days = 30) {
    const recentSales = await this.getRecentSales(days);
    const saleIds = new Set(recentSales.map(s => s.id));
    const allSaleItems = await db.saleItems.toArray();
    const velocity = new Map();

    for (const item of allSaleItems) {
      if (saleIds.has(item.saleId)) {
        velocity.set(item.productId, (velocity.get(item.productId) || 0) + toNumber(item.qty));
      }
    }
    return velocity;
  }

  async predictStockouts(days = 30) {
    const [products, velocity] = await Promise.all([
      db.products.toArray(),
      this.calcVelocity(days),
    ]);

    return products
      .map(product => {
        const totalSold = Math.max(0, velocity.get(product.id) || 0);
        const dailyVelocity = totalSold / days;
        const stock = toNumber(product.stock);
        const minStock = toNumber(product.minStock || 5);
        const daysUntilStockout = dailyVelocity > 0 ? stock / dailyVelocity : Infinity;
        const targetCoverDays = daysUntilStockout <= 7 ? 45 : 30;
        const recommendedOrder = Math.max(0, Math.ceil((dailyVelocity * targetCoverDays) + minStock - stock));

        return {
          productId: product.id,
          product,
          name: product.name,
          ref: product.ref || '',
          category: product.category || 'Divers',
          currentStock: stock,
          minStock,
          unit: product.unit || 'pce',
          dailyVelocity: Number(dailyVelocity.toFixed(2)),
          daysUntilStockout: Number.isFinite(daysUntilStockout) ? Number(daysUntilStockout.toFixed(1)) : null,
          recommendedOrder,
          sellPrice: toNumber(product.sellPrice),
          buyPrice: toNumber(product.buyPrice),
          supplier: product.supplier || '',
          priority: stock === 0
            ? 'CRITIQUE'
            : stock <= minStock || daysUntilStockout <= 7
            ? 'URGENT'
            : daysUntilStockout <= 14
            ? 'ATTENTION'
            : 'NORMAL',
        };
      })
      .filter(p => p.priority !== 'NORMAL' || p.recommendedOrder > 0)
      .sort((a, b) => {
        const ar = a.daysUntilStockout ?? 9999;
        const br = b.daysUntilStockout ?? 9999;
        return ar - br || b.recommendedOrder - a.recommendedOrder;
      });
  }

  async analyzeInventory() {
    const [products, predictions] = await Promise.all([
      db.products.toArray(),
      this.predictStockouts(),
    ]);

    const lowMargin = products
      .map(p => ({
        product: p,
        marginRate: toNumber(p.buyPrice) > 0 ? ((toNumber(p.sellPrice) - toNumber(p.buyPrice)) / toNumber(p.buyPrice)) * 100 : null,
      }))
      .filter(x => x.marginRate !== null && x.marginRate < 12)
      .sort((a, b) => a.marginRate - b.marginRate)
      .slice(0, 5);

    const dormant = products
      .filter(p => toNumber(p.stock) > 0)
      .sort((a, b) => (b.stock || 0) * (b.buyPrice || 0) - (a.stock || 0) * (a.buyPrice || 0))
      .slice(0, 5);

    return {
      predictions,
      critical: predictions.filter(p => p.priority === 'CRITIQUE'),
      urgent: predictions.filter(p => p.priority === 'URGENT'),
      attention: predictions.filter(p => p.priority === 'ATTENTION'),
      lowMargin,
      dormant,
      stockValue: products.reduce((sum, p) => sum + toNumber(p.stock) * toNumber(p.buyPrice), 0),
    };
  }

  async getEmbeddedSuggestions(limit = 5) {
    const analysis = await this.analyzeInventory();
    const alerts = [
      ...analysis.critical.map(p => ({
        id: `stock-critical-${p.productId}`,
        priority: 'danger',
        title: `${p.name} en rupture critique`,
        message: `Commander ${p.recommendedOrder || p.minStock} ${p.unit}. Stock actuel: ${p.currentStock}.`,
        actionLabel: 'Filtrer rupture',
        filter: 'rupture',
        product: p.product,
      })),
      ...analysis.urgent.map(p => ({
        id: `stock-urgent-${p.productId}`,
        priority: 'warning',
        title: `${p.name} a reapprovisionner`,
        message: `${p.daysUntilStockout ?? 'Peu'} jours de couverture. Commande conseillee: ${p.recommendedOrder} ${p.unit}.`,
        actionLabel: 'Voir stock bas',
        filter: 'stock bas',
        product: p.product,
      })),
      ...analysis.lowMargin.map(({ product, marginRate }) => ({
        id: `price-${product.id}`,
        priority: 'info',
        title: `Marge faible: ${product.name}`,
        message: `Marge ${marginRate.toFixed(1)}%. Prix conseille: ${fmt(this.suggestRetailPrice(product))}.`,
        actionLabel: 'Appliquer prix IA',
        product,
        nextPrice: this.suggestRetailPrice(product),
      })),
    ];
    return alerts.slice(0, limit);
  }

  suggestRetailPrice(product, targetMarginRate = 30) {
    const buyPrice = toNumber(product.buyPrice);
    if (!buyPrice) return toNumber(product.sellPrice);
    return Math.ceil((buyPrice * (1 + targetMarginRate / 100)) / 10) * 10;
  }

  async updateProductPrice(productId, sellPrice) {
    await db.products.update(productId, {
      sellPrice: toNumber(sellPrice),
      updatedAt: nowISO(),
      updatedByAgent: this.id,
    });
  }

  async getTextReport() {
    const analysis = await this.analyzeInventory();
    if (!analysis.predictions.length) return '## Agent Stock\nAucune rupture prevue. Stock stable.';
    return [
      '## Agent Stock',
      `Valeur stock achat: ${fmt(analysis.stockValue)}`,
      `Critiques: ${analysis.critical.length} | Urgents: ${analysis.urgent.length}`,
      ...analysis.predictions.slice(0, 8).map(p => `- ${p.name}: commander ${p.recommendedOrder} ${p.unit}`),
    ].join('\n');
  }
}

export default new StockAgent();
