import { db, nowISO, fmt } from '../db';

const toNumber = value => Number(value) || 0;
const daysBetween = date => date ? Math.floor((Date.now() - new Date(date).getTime()) / 86400000) : null;

export class ClientAgent {
  id = 'clients';
  name = 'Agent Clients';
  color = '#3B82F6';

  async enrichClient(client) {
    const sales = await db.sales.where('clientId').equals(client.id).toArray();
    const total = sales.reduce((s, sale) => s + toNumber(sale.total), 0);
    const paid = sales.reduce((s, sale) => s + toNumber(sale.paid), 0);
    const totalDue = Math.max(0, total - paid);
    const sorted = [...sales].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const lastSale = sorted[0]?.createdAt || null;
    const debtLimit = toNumber(client.debtLimit || client.creditLimit || 0);
    const inactiveDays = daysBetween(lastSale);

    return {
      ...client,
      sales,
      total,
      paid,
      totalDue,
      salesCount: sales.length,
      lastSale,
      inactiveDays,
      debtLimit,
      segment: total >= 50000 ? 'VIP' : sales.length >= 5 ? 'Regulier' : sales.length ? 'Occasionnel' : 'Nouveau',
      risk: totalDue > 0 && debtLimit && totalDue > debtLimit ? 'critique' : totalDue > 10000 || (inactiveDays || 0) > 45 ? 'attention' : 'ok',
    };
  }

  async analyzeClients() {
    const clients = await db.clients.toArray();
    const enriched = await Promise.all(clients.map(c => this.enrichClient(c)));
    const debtors = enriched.filter(c => c.totalDue > 0).sort((a, b) => b.totalDue - a.totalDue);
    const inactive = enriched.filter(c => c.salesCount > 0 && (c.inactiveDays || 0) >= 45).sort((a, b) => b.inactiveDays - a.inactiveDays);
    const vip = enriched.filter(c => c.segment === 'VIP').sort((a, b) => b.total - a.total);

    return {
      clients: enriched,
      debtors,
      inactive,
      vip,
      totalDue: debtors.reduce((s, c) => s + c.totalDue, 0),
    };
  }

  async getEmbeddedSuggestions(limit = 5) {
    const analysis = await this.analyzeClients();
    return [
      ...analysis.debtors.map(client => ({
        id: `debt-${client.id}`,
        priority: client.risk === 'critique' ? 'danger' : 'warning',
        title: `Relancer ${client.name}`,
        message: `Reste a payer ${fmt(client.totalDue)}${client.debtLimit ? ` / plafond ${fmt(client.debtLimit)}` : ''}.`,
        actionLabel: 'Ouvrir fiche',
        client,
      })),
      ...analysis.inactive.map(client => ({
        id: `inactive-${client.id}`,
        priority: 'info',
        title: `${client.name} est inactif`,
        message: `Dernier achat il y a ${client.inactiveDays} jours. Relance commerciale conseillee.`,
        actionLabel: 'Ouvrir fiche',
        client,
      })),
    ].slice(0, limit);
  }

  async recordPayment(clientId, amount, note = 'Versement Agent Clients') {
    const creditSales = await db.sales.where('clientId').equals(clientId).toArray();
    const openSales = creditSales
      .filter(s => s.status === 'credit' || s.status === 'crédit' || s.status === 'crÃ©dit')
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

    let remaining = toNumber(amount);
    for (const sale of openSales) {
      if (remaining <= 0) break;
      const due = Math.max(0, toNumber(sale.total) - toNumber(sale.paid));
      const paying = Math.min(due, remaining);
      const newPaid = toNumber(sale.paid) + paying;
      await db.sales.update(sale.id, {
        paid: newPaid,
        status: newPaid >= toNumber(sale.total) ? 'payé' : sale.status,
      });
      remaining -= paying;
    }

    await db.payments.add({
      clientId,
      amount: toNumber(amount),
      note,
      createdAt: nowISO(),
      createdByAgent: this.id,
    });
  }

  async getTextReport() {
    const analysis = await this.analyzeClients();
    return [
      '## Agent Clients',
      `Clients: ${analysis.clients.length}`,
      `Debiteurs: ${analysis.debtors.length} | Creances: ${fmt(analysis.totalDue)}`,
      ...analysis.debtors.slice(0, 8).map(c => `- ${c.name}: ${fmt(c.totalDue)}`),
    ].join('\n');
  }
}

export default new ClientAgent();
