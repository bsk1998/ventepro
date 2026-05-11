import { db, nowISO, fmt, invalidateCache } from '../db';

const toNumber = value => Number(value) || 0;

export class FinanceAgent {
  id = 'finance';
  name = 'Agent Finance';
  color = '#A855F7';

  async generateMonthlyReport(forceRefresh = false) {
    const now = new Date();
    const monthKey = now.toISOString().slice(0, 7);

    if (!forceRefresh) {
      const existing = await db.settings.get(`report_${monthKey}`).catch(() => null);
      if (existing?.value) return JSON.parse(existing.value);
    }

    const [allSales, allExpenses, allProducts, allSaleItems] = await Promise.all([
      db.sales.toArray(),
      db.expenses.toArray(),
      db.products.toArray(),
      db.saleItems.toArray(),
    ]);

    const monthSales = allSales.filter(s => s.createdAt?.startsWith(monthKey));
    const monthExpenses = allExpenses.filter(e => e.createdAt?.startsWith(monthKey));
    const revenue = monthSales.reduce((s, v) => s + toNumber(v.total), 0);
    const totalPaid = monthSales.reduce((s, v) => s + toNumber(v.paid), 0);
    const totalCredit = Math.max(0, revenue - totalPaid);
    const expensesTotal = monthExpenses.reduce((s, e) => s + toNumber(e.amount), 0);
    const costOfGoods = allSaleItems
      .filter(i => monthSales.some(s => s.id === i.saleId))
      .reduce((s, i) => s + toNumber(i.buyPrice) * toNumber(i.qty), 0);
    const grossProfit = revenue - costOfGoods;
    const netProfit = grossProfit - expensesTotal;
    const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    const stockValue = allProducts.reduce((s, p) => s + toNumber(p.stock) * toNumber(p.buyPrice), 0);
    const zakatBase = Math.max(0, stockValue + totalCredit);
    const zakatAmount = zakatBase * 0.025;

    const productRevenue = new Map();
    const productQty = new Map();
    const monthSaleIds = new Set(monthSales.map(s => s.id));
    for (const item of allSaleItems.filter(i => monthSaleIds.has(i.saleId))) {
      const revenueLine = toNumber(item.unitPrice) * toNumber(item.qty);
      productRevenue.set(item.productName, (productRevenue.get(item.productName) || 0) + revenueLine);
      productQty.set(item.productName, (productQty.get(item.productName) || 0) + toNumber(item.qty));
    }

    const topProducts = [...productRevenue.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, ca]) => ({ name, ca, qty: productQty.get(name) || 0 }));

    const expByCategory = {};
    monthExpenses.forEach(e => {
      expByCategory[e.category || 'Divers'] = (expByCategory[e.category || 'Divers'] || 0) + toNumber(e.amount);
    });

    const recommendations = this.buildRecommendations({
      revenue,
      totalCredit,
      expensesTotal,
      profitMargin,
      stockValue,
      salesCount: monthSales.length,
    });

    const report = {
      period: monthKey,
      generatedAt: nowISO(),
      revenue,
      totalPaid,
      totalCredit,
      expensesTotal,
      costOfGoods,
      grossProfit,
      profit: netProfit,
      profitMargin: Number(profitMargin.toFixed(2)),
      salesCount: monthSales.length,
      stockValue,
      zakatBase,
      zakatAmount,
      topProducts,
      expByCategory,
      recommendations,
    };

    await db.settings.put({ key: `report_${monthKey}`, value: JSON.stringify(report) }).catch(() => {});
    return report;
  }

  buildRecommendations({ revenue, totalCredit, expensesTotal, profitMargin, stockValue, salesCount }) {
    const recommendations = [];
    if (profitMargin < 10) {
      recommendations.push({ type: 'danger', msg: `Marge nette ${profitMargin.toFixed(1)}%. Revoir prix, remises et charges.` });
    } else if (profitMargin < 20) {
      recommendations.push({ type: 'warning', msg: `Marge nette ${profitMargin.toFixed(1)}%. Potentiel d'amelioration.` });
    } else {
      recommendations.push({ type: 'success', msg: `Marge nette ${profitMargin.toFixed(1)}%. Rentabilite saine.` });
    }
    if (revenue > 0 && totalCredit > revenue * 0.3) {
      recommendations.push({ type: 'danger', msg: `${fmt(totalCredit)} de credits ouverts. Priorite au recouvrement.` });
    }
    if (revenue > 0 && expensesTotal > revenue * 0.4) {
      recommendations.push({ type: 'warning', msg: `Charges elevees: ${fmt(expensesTotal)} (${((expensesTotal / revenue) * 100).toFixed(0)}% du CA).` });
    }
    if (stockValue > revenue * 2 && revenue > 0) {
      recommendations.push({ type: 'warning', msg: `Stock immobilise important: ${fmt(stockValue)}.` });
    }
    if (!salesCount) {
      recommendations.push({ type: 'info', msg: 'Aucune vente ce mois. Verifier la saisie ou lancer une action commerciale.' });
    }
    return recommendations;
  }

  async analyzeTreasury() {
    const report = await this.generateMonthlyReport(true);
    return {
      report,
      alerts: report.recommendations.map((rec, index) => ({
        id: `finance-${index}`,
        priority: rec.type === 'danger' ? 'danger' : rec.type === 'warning' ? 'warning' : 'info',
        title: rec.type === 'success' ? 'Finance stable' : 'Point finance',
        message: rec.msg,
      })),
    };
  }

  async addExpense({ label, amount, category = 'Divers' }) {
    const id = await db.expenses.add({
      label,
      amount: toNumber(amount),
      category,
      createdAt: nowISO(),
      createdByAgent: this.id,
    });
    invalidateCache();
    return id;
  }

  async getTextReport(forceRefresh = false) {
    const report = await this.generateMonthlyReport(forceRefresh);
    return [
      `## Agent Finance - ${report.period}`,
      `Chiffre d'affaires: ${fmt(report.revenue)}`,
      `Encaisses: ${fmt(report.totalPaid)}`,
      `Credits ouverts: ${fmt(report.totalCredit)}`,
      `Depenses: ${fmt(report.expensesTotal)}`,
      `Benefice net: ${fmt(report.profit)} (${report.profitMargin}%)`,
      `Zakat estimee: ${fmt(report.zakatAmount)}`,
      ...report.recommendations.map(r => `- ${r.msg}`),
    ].join('\n');
  }
}

export default new FinanceAgent();
