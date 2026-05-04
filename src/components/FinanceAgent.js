import { db, nowISO, fmt } from '../db';

// ════════════════════════════════════════════════════════════════════════════
// FINANCE AGENT — Rapports mensuels automatiques + Zakat + recommandations
// ════════════════════════════════════════════════════════════════════════════

export class FinanceAgent {

  // ── Récupère ou génère le rapport du mois courant ─────────────────────────
  async generateMonthlyReport(forceRefresh = false) {
    const now        = new Date();
    const monthKey   = now.toISOString().slice(0, 7); // YYYY-MM
    const monthStart = `${monthKey}-01`;

    // Vérifier si un rapport du mois existe déjà en base
    if (!forceRefresh) {
      try {
        const existing = await db.settings.get(`report_${monthKey}`);
        if (existing?.value) return JSON.parse(existing.value);
      } catch (_) {}
    }

    // ── Chargement des données ──────────────────────────────────────────────
    const [allSales, allExpenses, allProducts, allSaleItems] = await Promise.all([
      db.sales.toArray(),
      db.expenses.toArray(),
      db.products.toArray(),
      db.saleItems.toArray(),
    ]);

    const monthSales    = allSales.filter(s => s.createdAt?.startsWith(monthKey));
    const monthExpenses = allExpenses.filter(e => e.createdAt?.startsWith(monthKey));

    // ── Calculs financiers ──────────────────────────────────────────────────
    const revenue         = monthSales.reduce((s, v) => s + Number(v.total   || 0), 0);
    const totalPaid       = monthSales.reduce((s, v) => s + Number(v.paid    || 0), 0);
    const totalCredit     = revenue - totalPaid;
    const expensesTotal   = monthExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const profit          = revenue - expensesTotal;
    const profitMargin    = revenue > 0 ? (profit / revenue) * 100 : 0;

    // ── Zakat (calcul islamique) ────────────────────────────────────────────
    // Base : stock immobilisé + créances + trésorerie - dettes
    const stockValue      = allProducts.reduce((s, p) => s + (p.stock || 0) * (p.buyPrice || 0), 0);
    const zakatBase       = Math.max(0, stockValue + totalCredit);
    const zakatAmount     = zakatBase * 0.025;

    // ── Top produits du mois ────────────────────────────────────────────────
    const monthSaleIds    = new Set(monthSales.map(s => s.id));
    const monthItems      = allSaleItems.filter(i => monthSaleIds.has(i.saleId));

    const prodRevenue     = new Map();
    const prodQty         = new Map();
    for (const item of monthItems) {
      const rev = (item.unitPrice || 0) * (item.qty || 0);
      prodRevenue.set(item.productName, (prodRevenue.get(item.productName) || 0) + rev);
      prodQty.set(item.productName,     (prodQty.get(item.productName)     || 0) + item.qty);
    }

    const topProducts = [...prodRevenue.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, ca]) => ({ name, ca, qty: prodQty.get(name) || 0 }));

    // ── Dépenses par catégorie ──────────────────────────────────────────────
    const expByCategory = {};
    monthExpenses.forEach(e => {
      expByCategory[e.category] = (expByCategory[e.category] || 0) + Number(e.amount || 0);
    });

    // ── Évolution CA sur 6 mois ────────────────────────────────────────────
    const evolution = [];
    for (let i = 5; i >= 0; i--) {
      const d   = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      const ca  = allSales
        .filter(s => s.createdAt?.startsWith(key))
        .reduce((s, v) => s + Number(v.total || 0), 0);
      evolution.push({ month: key, ca });
    }

    // ── Recommandations intelligentes ──────────────────────────────────────
    const recommendations = [];

    if (profitMargin < 10) {
      recommendations.push({ type: 'danger', msg: `Marge nette ${profitMargin.toFixed(1)}% — trop faible. Revoir les prix de vente ou réduire les achats.` });
    } else if (profitMargin < 20) {
      recommendations.push({ type: 'warning', msg: `Marge nette ${profitMargin.toFixed(1)}% — acceptable mais peut être améliorée.` });
    } else {
      recommendations.push({ type: 'success', msg: `Marge nette ${profitMargin.toFixed(1)}% — bonne santé financière.` });
    }

    if (totalCredit > revenue * 0.3) {
      recommendations.push({ type: 'danger', msg: `${fmt(totalCredit)} de crédits non encaissés (${((totalCredit / revenue) * 100).toFixed(0)}% du CA) — relancer les clients débiteurs.` });
    }

    if (expensesTotal > revenue * 0.4) {
      recommendations.push({ type: 'warning', msg: `Charges élevées : ${fmt(expensesTotal)} soit ${((expensesTotal / revenue) * 100).toFixed(0)}% du CA.` });
    }

    const lowStockCount = allProducts.filter(p => p.stock <= (p.minStock || 5)).length;
    if (lowStockCount > 0) {
      recommendations.push({ type: 'warning', msg: `${lowStockCount} produit(s) en alerte stock — risque de manque à gagner.` });
    }

    if (monthSales.length === 0) {
      recommendations.push({ type: 'info', msg: 'Aucune vente enregistrée ce mois — vérifier la saisie des données.' });
    }

    // ── Assemblage rapport final ────────────────────────────────────────────
    const report = {
      period:           monthKey,
      generatedAt:      nowISO(),
      revenue,
      totalPaid,
      totalCredit,
      expensesTotal,
      profit,
      profitMargin:     parseFloat(profitMargin.toFixed(2)),
      salesCount:       monthSales.length,
      stockValue,
      zakatBase,
      zakatAmount,
      topProducts,
      expByCategory,
      evolution,
      recommendations,
    };

    // Mettre en cache dans settings (expire au prochain mois)
    try {
      await db.settings.put({ key: `report_${monthKey}`, value: JSON.stringify(report) });
    } catch (_) {}

    return report;
  }

  // ── Rapport texte formaté pour l'agent IA chat ───────────────────────────
  async getTextReport(forceRefresh = false) {
    const report = await this.generateMonthlyReport(forceRefresh);

    let text = `💰 RAPPORT FINANCIER — ${report.period}\n`;
    text += `Généré le ${new Date(report.generatedAt).toLocaleDateString('fr-DZ')}\n\n`;

    text += `📊 RÉSULTATS DU MOIS\n`;
    text += `• Chiffre d'affaires : ${fmt(report.revenue)}\n`;
    text += `• Encaissé           : ${fmt(report.totalPaid)}\n`;
    text += `• Crédit restant     : ${fmt(report.totalCredit)}\n`;
    text += `• Dépenses           : ${fmt(report.expensesTotal)}\n`;
    text += `• Bénéfice net       : ${fmt(report.profit)}\n`;
    text += `• Marge nette        : ${report.profitMargin}%\n\n`;

    text += `🕌 ZAKAT\n`;
    text += `• Base de calcul     : ${fmt(report.zakatBase)}\n`;
    text += `• Zakat à verser     : ${fmt(report.zakatAmount)}\n\n`;

    if (report.topProducts.length > 0) {
      text += `🏆 TOP PRODUITS\n`;
      report.topProducts.forEach((p, i) => {
        text += `${i + 1}. ${p.name} — ${fmt(p.ca)} (${p.qty} vendus)\n`;
      });
      text += '\n';
    }

    if (report.recommendations.length > 0) {
      text += `💡 RECOMMANDATIONS\n`;
      report.recommendations.forEach(r => {
        const icon = r.type === 'danger' ? '🔴' : r.type === 'warning' ? '🟡' : r.type === 'success' ? '🟢' : 'ℹ️';
        text += `${icon} ${r.msg}\n`;
      });
    }

    return text;
  }
}

export default new FinanceAgent();