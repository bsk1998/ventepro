import { db, nowISO, fmt } from '../db';

// ════════════════════════════════════════════════════════════════════════════
// STOCK AGENT — Prédictions ruptures + suggestions commandes
// ════════════════════════════════════════════════════════════════════════════

export class StockAgent {

  // ── Récupère les ventes des N derniers jours ──────────────────────────────
  async getRecentSales(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceISO = since.toISOString();
    return db.sales.where('createdAt').aboveOrEqual(sinceISO).toArray();
  }

  // ── Calcule la vélocité de vente par produit ──────────────────────────────
  // Retourne un Map : productId → quantité totale vendue sur la période
  async calcVelocity(days = 30) {
    const recentSales  = await this.getRecentSales(days);
    const saleIds      = new Set(recentSales.map(s => s.id));
    const allSaleItems = await db.saleItems.toArray();

    const velocity = new Map();
    for (const item of allSaleItems) {
      if (saleIds.has(item.saleId)) {
        velocity.set(item.productId, (velocity.get(item.productId) || 0) + item.qty);
      }
    }
    return velocity;
  }

  // ── Prédit les ruptures de stock ──────────────────────────────────────────
  // Retourne la liste des produits risquant la rupture dans les 30 prochains jours
  async predictStockouts(days = 30) {
    const products  = await db.products.toArray();
    const velocity  = await this.calcVelocity(days);

    const predictions = [];

    for (const p of products) {
      const totalSold      = velocity.get(p.id) || 0;
      const dailyVelocity  = totalSold / days;

      // Produit jamais vendu → ignorer pour les prédictions
      if (dailyVelocity === 0) continue;

      const daysUntilStockout  = dailyVelocity > 0 ? p.stock / dailyVelocity : Infinity;
      const recommendedOrder   = Math.ceil(dailyVelocity * 30); // stock pour 30 jours

      predictions.push({
        productId:          p.id,
        name:               p.name,
        ref:                p.ref || '',
        category:           p.category || 'Divers',
        currentStock:       p.stock,
        unit:               p.unit || 'pce',
        dailyVelocity:      parseFloat(dailyVelocity.toFixed(2)),
        daysUntilStockout:  parseFloat(daysUntilStockout.toFixed(1)),
        recommendedOrder,
        sellPrice:          p.sellPrice,
        buyPrice:           p.buyPrice,
        priority:           daysUntilStockout <= 3
                              ? 'CRITIQUE'
                              : daysUntilStockout <= 7
                              ? 'URGENT'
                              : daysUntilStockout <= 14
                              ? 'ATTENTION'
                              : 'NORMAL',
      });
    }

    // Trier par urgence croissante
    return predictions
      .filter(p => p.daysUntilStockout < 30)
      .sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);
  }

  // ── Génère un résumé texte pour le panel IA ───────────────────────────────
  async getSummary() {
    const predictions = await this.predictStockouts();
    const critiques   = predictions.filter(p => p.priority === 'CRITIQUE');
    const urgents     = predictions.filter(p => p.priority === 'URGENT');
    const attention   = predictions.filter(p => p.priority === 'ATTENTION');

    return {
      predictions,
      counts: {
        critique:  critiques.length,
        urgent:    urgents.length,
        attention: attention.length,
        total:     predictions.length,
      },
      critiques,
      urgents,
    };
  }

  // ── Formate le résumé en texte lisible pour l'Agent IA chat ──────────────
  async getTextReport() {
    const { counts, critiques, urgents, predictions } = await this.getSummary();

    if (predictions.length === 0) {
      return '✅ Aucune rupture prévue dans les 30 prochains jours. Stock en bonne santé !';
    }

    let report = `📦 RAPPORT PRÉDICTION STOCK\n\n`;
    report += `🔴 CRITIQUE (< 3j) : ${counts.critique}\n`;
    report += `🟠 URGENT (< 7j)   : ${counts.urgent}\n`;
    report += `🟡 ATTENTION (< 14j): ${counts.attention}\n\n`;

    if (critiques.length > 0) {
      report += `🚨 ACTIONS IMMÉDIATES :\n`;
      critiques.forEach(p => {
        report += `• ${p.name} → ${p.daysUntilStockout}j restants · Commander ${p.recommendedOrder} ${p.unit}\n`;
      });
      report += '\n';
    }

    if (urgents.length > 0) {
      report += `⚠️ À COMMANDER CETTE SEMAINE :\n`;
      urgents.forEach(p => {
        report += `• ${p.name} → ${p.daysUntilStockout}j restants · Commander ${p.recommendedOrder} ${p.unit}\n`;
      });
    }

    return report;
  }
}

export default new StockAgent();