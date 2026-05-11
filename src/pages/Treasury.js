import { useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { Badge, Btn, Input, Select, Card, Modal, Loader, PageHeader, MiniChart, fmt } from '../components/ui';
import { db, nowISO, getDashboardStats, invalidateCache } from '../db';
import financeAgent from '../components/FinanceAgent';
import AgentSuggestionPanel from '../components/AgentSuggestionPanel';

const CATS = ['Loyer', 'Salaires', 'Électricité', 'Transport', 'Achats stock', 'Télécommunications', 'Divers'];

export default function Treasury() {
  const C = useTheme().theme;
  const [stats,   setStats]   = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [form,    setForm]    = useState({ label: '', amount: '', category: 'Divers' });
  const [saving,  setSaving]  = useState(false);
  const [financeSuggestions, setFinanceSuggestions] = useState([]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [s, e] = await Promise.all([
      getDashboardStats(),
      db.expenses.orderBy('createdAt').reverse().toArray(),
    ]);
    setStats(s);
    setExpenses(e);
    financeAgent.analyzeTreasury().then(result => setFinanceSuggestions(result.alerts || [])).catch(() => setFinanceSuggestions([]));
    setLoading(false);
  }

  async function saveExpense() {
    if (!form.label || !form.amount) return alert('Champs requis');
    setSaving(true);
    await db.expenses.add({
      label:    form.label,
      amount:   Number(form.amount),
      category: form.category,
      createdAt: nowISO(),
    });

    // Invalider le cache dashboard après ajout d'une dépense
    invalidateCache();

    setForm({ label: '', amount: '', category: 'Divers' });
    setModal(false);
    await load();
    setSaving(false);
  }

  if (loading) return <Loader />;

  const month         = new Date().toISOString().slice(0, 7);
  const expMonth      = expenses.filter(e => e.createdAt?.startsWith(month));
  const expMonthTotal = expMonth.reduce((s, e) => s + Number(e.amount || 0), 0);
  const benefice      = (stats?.monthTotal || 0) - expMonthTotal;
  const annualBenef   = benefice * 12;
  const zakat         = Math.max(0, annualBenef * 0.025);
  const totalAllExp   = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  const catTotals = {};
  expenses.forEach(e => {
    catTotals[e.category] = (catTotals[e.category] || 0) + Number(e.amount || 0);
  });

  return (
    <div>
      <PageHeader
        title="Trésorerie & Comptabilité"
        sub={`Bilan · ${new Date().toLocaleDateString('fr-DZ', { month: 'long', year: 'numeric' })}`}>
        <Btn onClick={() => setModal(true)}>+ Ajouter dépense</Btn>
      </PageHeader>

      {/* ── Résumé 3 colonnes ── */}
      <AgentSuggestionPanel
        title="Agent Finance integre"
        subtitle="Analyse marge, credits, charges et Zakat"
        suggestions={financeSuggestions}
        onDismiss={() => setFinanceSuggestions([])}
        style={{ marginBottom: 14 }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Recettes du mois', val: stats?.monthTotal || 0, type: '+', color: C.green },
          { label: 'Dépenses du mois', val: expMonthTotal,           type: '-', color: C.red   },
          { label: 'Bénéfice net',     val: benefice,                type: '=', color: C.accent },
        ].map(r => (
          <Card key={r.label} style={{ border: `1px solid ${r.color}25` }}>
            <div style={{ color: C.sub, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>{r.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: r.color, fontFamily: C.fontDisplay }}>
              {r.type === '+' ? '+' : r.type === '-' ? '-' : '='} {fmt(Math.abs(r.val))}
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* ── Colonne gauche ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <Card>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, fontFamily: C.fontDisplay }}>📊 Évolution mensuelle</div>
            <MiniChart data={stats?.chart || []} />
          </Card>

          <Card>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, fontFamily: C.fontDisplay }}>💸 Dépenses par catégorie</div>
            {Object.entries(catTotals).map(([cat, total]) => {
              const pct = totalAllExp > 0 ? Math.round((total / totalAllExp) * 100) : 0;
              return (
                <div key={cat} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: C.sub }}>{cat}</span>
                    <span style={{ fontWeight: 700 }}>{pct}% · {fmt(total)}</span>
                  </div>
                  <div style={{ background: C.bg, borderRadius: 4, height: 5 }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: C.accent }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(catTotals).length === 0 && (
              <div style={{ color: C.sub, fontSize: 13, textAlign: 'center', padding: 16 }}>Aucune dépense</div>
            )}
          </Card>
        </div>

        {/* ── Colonne droite ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Zakat */}
          <Card style={{ border: `1px solid ${C.accent}25`, background: C.accentLo }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, fontFamily: C.fontDisplay }}>☪️ Calcul de la Zakat</div>
            <div style={{ fontSize: 12, color: C.sub, marginBottom: 4 }}>Bénéfice mensuel net</div>
            <div style={{ fontWeight: 900, fontSize: 22, color: C.accent, marginBottom: 10, fontFamily: C.fontDisplay }}>{fmt(benefice)}</div>
            <div style={{ fontSize: 12, color: C.sub, marginBottom: 4 }}>Projection annuelle</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 14 }}>{fmt(annualBenef)}</div>
            <div style={{ borderTop: `1px solid ${C.accentMd}`, paddingTop: 12 }}>
              <div style={{ fontSize: 12, color: C.sub, marginBottom: 4 }}>Zakat à verser (2.5%)</div>
              <div style={{ fontWeight: 900, fontSize: 26, color: C.accent, fontFamily: C.fontDisplay }}>{fmt(zakat)}</div>
              {annualBenef > 0 && (
                <div style={{ color: C.green, fontSize: 11, marginTop: 4, fontWeight: 600 }}>✓ Nisab atteint</div>
              )}
            </div>
          </Card>

          {/* Dépenses récentes */}
          <Card style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, fontFamily: C.fontDisplay }}>💸 Dépenses récentes</div>
            {expenses.length === 0
              ? <div style={{ color: C.sub, fontSize: 13, textAlign: 'center', padding: 20 }}>Aucune dépense</div>
              : expenses.slice(0, 8).map(e => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{e.label}</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                      <Badge color="purple" small>{e.category}</Badge>
                      <span style={{ color: C.muted, fontSize: 10 }}>{new Date(e.createdAt).toLocaleDateString('fr-DZ')}</span>
                    </div>
                  </div>
                  <div style={{ color: C.red, fontWeight: 700, fontSize: 13 }}>-{fmt(e.amount)}</div>
                </div>
              ))
            }
          </Card>
        </div>
      </div>

      {/* ── Modal dépense ── */}
      {modal && (
        <Modal title="+ Nouvelle dépense" onClose={() => setModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input
              label="Description *"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="Loyer du mois..."
            />
            <Input
              label="Montant (DA) *"
              type="number"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="15000"
            />
            <Select
              label="Catégorie"
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
            <Btn variant="ghost" onClick={() => setModal(false)}>Annuler</Btn>
            <Btn variant="danger" onClick={saveExpense} disabled={saving}>
              {saving ? '⏳...' : '✓ Enregistrer'}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
