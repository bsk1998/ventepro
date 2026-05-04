import { db, fmt } from '../db';

// ════════════════════════════════════════════════════════════════════════════
// SALES AGENT — Upsell temps réel + analyse bundles + fidélité clients
// ════════════════════════════════════════════════════════════════════════════

export class SalesAgent {

  // ── Analyse les paires de produits vendus ensemble ────────────────────────
  // Retourne les associations fréquentes (vendues 3+ fois ensemble)
  async analyzeBundles(minFrequency = 3) {
    const saleItems = await db.saleItems.toArray();

    // Grouper les items par vente
    const saleMap = new Map();
    for (const item of saleItems) {
      if (!saleMap.has(item.saleId)) saleMap.set(item.saleId, []);
      saleMap.get(item.saleId).push(item.productId);
    }

    // Compter les paires de produits
    const pairCount  = new Map();
    const pairNames  = new Map();

    for (const [, productIds] of saleMap) {
      const unique = [...new Set(productIds)];
      if (unique.length < 2) continue;

      for (let i = 0; i < unique.length; i++) {
        for (let j = i + 1; j < unique.length; j++) {
          const key = [unique[i], unique[j]].sort((a, b) => a - b).join('-');
          pairCount.set(key, (pairCount.get(key) || 0) + 1);
        }
      }
    }

    // Filtrer par fréquence minimum et enrichir avec noms produits
    const products = await db.products.toArray();
    const prodMap  = new Map(products.map(p => [p.id, p]));

    const bundles = [];
    for (const [key, freq] of pairCount) {
      if (freq < minFrequency) continue;
      const [idA, idB] = key.split('-').map(Number);
      const prodA      = prodMap.get(idA);
      const prodB      = prodMap.get(idB);
      if (!prodA || !prodB) continue;

      bundles.push({
        productIds: [idA, idB],
        products:   [prodA, prodB],
        frequency:  freq,
        reason:     `${prodA.name} + ${prodB.name}`,
      });
    }

    return bundles.sort((a, b) => b.frequency - a.frequency);
  }

  // ── Suggestions d'upsell pour le panier en cours ─────────────────────────
  // Retourne des produits complémentaires à ajouter
  async suggestUpsell(cartItems, clientId = null) {
    if (!cartItems || cartItems.length === 0) return [];

    const cartProductIds = new Set(cartItems.map(i => i.id));
    const bundles        = await this.analyzeBundles(2); // seuil abaissé à 2 pour plus de suggestions
    const products       = await db.products.toArray();
    const prodMap        = new Map(products.map(p => [p.id, p]));

    const suggestions = [];
    const alreadySuggested = new Set();

    for (const bundle of bundles) {
      const [idA, idB] = bundle.productIds;
      const inCart     = cartProductIds.has(idA) || cartProductIds.has(idB);
      const missing    = cartProductIds.has(idA) ? idB : idA;

      if (!inCart) continue;
      if (cartProductIds.has(missing)) continue;
      if (alreadySuggested.has(missing)) continue;

      const missingProd = prodMap.get(missing);
      if (!missingProd || missingProd.stock === 0) continue;

      alreadySuggested.add(missing);
      const profit = (missingProd.sellPrice || 0) - (missingProd.buyPrice || 0);

      suggestions.push({
        product:        missingProd,
        reason:         `Souvent acheté avec : ${bundle.reason}`,
        frequency:      bundle.frequency,
        potentialProfit: profit,
        label:          `+${fmt(missingProd.sellPrice)}`,
      });
    }

    // Trier par profit potentiel décroissant
    return suggestions
      .sort((a, b) => b.potentialProfit - a.potentialProfit)
      .slice(0, 3); // Maximum 3 suggestions
  }

  // ── Analyse la fidélité clients ───────────────────────────────────────────
  async getClientInsights(clientId) {
    if (!clientId) return null;

    const client       = await db.clients.get(clientId).catch(() => null);
    if (!client) return null;

    const clientSales  = await db.sales.where('clientId').equals(clientId).toArray();
    const saleIds      = clientSales.map(s => s.id);
    const allItems     = await db.saleItems.toArray();
    const clientItems  = allItems.filter(i => saleIds.includes(i.saleId));

    const totalSpent   = clientSales.reduce((s, v) => s + Number(v.total  || 0), 0);
    const totalPaid    = clientSales.reduce((s, v) => s + Number(v.paid   || 0), 0);
    const totalDue     = totalSpent - totalPaid;

    // Produits favoris du client
    const prodCount = new Map();
    for (const item of clientItems) {
      prodCount.set(item.productName, (prodCount.get(item.productName) || 0) + item.qty);
    }
    const topProducts = [...prodCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, qty]) => ({ name, qty }));

    // Fréquence d'achat
    const firstSale    = clientSales.reduce((min, s) => s.createdAt < min ? s.createdAt : min, clientSales[0]?.createdAt || '');
    const daysSinceFirst = firstSale
      ? Math.floor((Date.now() - new Date(firstSale).getTime()) / 86400000)
      : 0;
    const avgFreqDays  = clientSales.length > 1 ? Math.floor(daysSinceFirst / clientSales.length) : null;

    return {
      client,
      totalSpent,
      totalPaid,
      totalDue,
      salesCount:  clientSales.length,
      topProducts,
      avgFreqDays,
      isVIP:       totalSpent > 50000,
      hasDebt:     totalDue > 0,
    };
  }

  // ── Rapport texte pour l'agent IA chat ───────────────────────────────────
  async getTextReport(cartItems = [], clientId = null) {
    const suggestions = await this.suggestUpsell(cartItems, clientId);
    const insights    = clientId ? await this.getClientInsights(clientId) : null;

    let report = '';

    if (insights) {
      report += `👤 CLIENT : ${insights.client.name}\n`;
      report += `💰 Total acheté : ${fmt(insights.totalSpent)} · Achats : ${insights.salesCount}\n`;
      if (insights.totalDue > 0) report += `🔴 Dette : ${fmt(insights.totalDue)}\n`;
      if (insights.isVIP)         report += `⭐ Client VIP\n`;
      if (insights.avgFreqDays)   report += `📅 Fréquence moyenne : tous les ${insights.avgFreqDays} jours\n`;
      if (insights.topProducts.length > 0) {
        report += `🏆 Favoris : ${insights.topProducts.map(p => p.name).join(', ')}\n`;
      }
      report += '\n';
    }

    if (suggestions.length > 0) {
      report += `💡 SUGGESTIONS UPSELL :\n`;
      suggestions.forEach(s => {
        report += `• ${s.product.name} (${s.label}) — ${s.reason} · vendu ${s.frequency}x ensemble\n`;
      });
    } else if (cartItems.length > 0) {
      report += `ℹ️ Pas de suggestions pour ce panier (données insuffisantes).`;
    }

    return report || 'ℹ️ Panier vide — ajoutez des produits pour obtenir des suggestions.';
  }
}

export default new SalesAgent();