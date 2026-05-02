// ─── Ticket.js — Impression tickets, factures, bons de livraison ──────────────

import React from 'react';

// ─── Chargement des paramètres d'impression ───────────────────────────────────
export async function loadPrintSettings() {
  try {
    const { db } = await import('../db');
    const rows = await db.settings.toArray();
    const s = {};
    rows.forEach(r => { s[r.key] = r.value; });
    return {
      shopName:    s.shop_name    || 'VenteX AI',
      shopAddress: s.shop_address || 'Algérie',
      shopPhone:    s.shop_phone   || '',
      shopTax:      s.shop_tax     || '',
      footerText:  s.footer_text  || 'Merci de votre confiance !',
      autoPrint:   s.auto_print   === 'true',
      ticketWidth: s.ticket_width || '80mm',
    };
  } catch(e) {
    return { shopName:'VenteX AI', shopAddress:'Algérie', shopPhone:'', shopTax:'',
      footerText:'Merci de votre confiance !', autoPrint:false, ticketWidth:'80mm' };
  }
}

function fmt(n) {
  return (Number(n)||0).toLocaleString('fr-DZ',{minimumFractionDigits:0,maximumFractionDigits:0})+' DA';
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('fr-DZ',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  } catch { return iso||''; }
}

function openPrint(html, title='VenteX AI') {
  const win = window.open('','_blank','width=800,height=700,toolbar=0,menubar=0,scrollbars=1');
  if (!win) { alert('Autorisez les popups pour imprimer.'); return; }
  win.document.write(html);
  win.document.close();
  setTimeout(() => { try { win.focus(); win.print(); } catch(e){} }, 400);
}

// ─── TICKET DE CAISSE ─────────────────────────────────────────────────────────
export async function printTicket(sale, items, shopNameArg) {
  const ps = await loadPrintSettings();
  const shopName = shopNameArg || ps.shopName;
  const num  = 'VX-'+String(sale.id).padStart(4,'0');
  const date = fmtDate(sale.createdAt);
  const rows = items.map(i=>`
    <tr>
      <td style="padding:3px 0;font-size:12px;">${i.productName}</td>
      <td style="text-align:center;font-size:12px;">${i.qty}</td>
      <td style="text-align:right;font-size:12px;">${fmt(i.unitPrice)}</td>
      <td style="text-align:right;font-size:12px;font-weight:bold;">${fmt(i.unitPrice*i.qty)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Ticket ${num}</title>
  <style>
    @page { margin:4mm; size:80mm auto; }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:'Courier New',monospace; font-size:12px; width:72mm; margin:0 auto; background:#fff; color:#000; }
    .center { text-align:center; }
    .bold { font-weight:bold; }
    .line { border-top:1px dashed #333; margin:5px 0; }
    table { width:100%; border-collapse:collapse; }
    th { font-size:11px; border-bottom:1px solid #333; padding:3px 0; }
    .total-row td { font-size:14px; font-weight:bold; border-top:1px dashed #333; padding:4px 0; }
    .badge { background:#000; color:#fff; padding:2px 8px; font-size:11px; }
  </style>
  </head><body>
  <div class="center bold" style="font-size:16px;margin-bottom:2px;">${shopName}</div>
  ${ps.shopAddress?`<div class="center" style="font-size:11px;">${ps.shopAddress}</div>`:''}
  ${ps.shopPhone?`<div class="center" style="font-size:11px;">Tél: ${ps.shopPhone}</div>`:''}
  <div class="line"></div>
  <div class="center bold">TICKET DE CAISSE</div>
  <div style="display:flex;justify-content:space-between;font-size:11px;margin:3px 0;">
    <span>${num}</span><span>${date}</span>
  </div>
  ${sale.clientName&&sale.clientName!=='Passage'?`<div style="font-size:11px;">Client: <b>${sale.clientName}</b></div>`:''}
  ${sale.employeeName?`<div style="font-size:11px;">Vendeur: ${sale.employeeName}</div>`:''}
  <div class="line"></div>
  <table>
    <thead><tr>
      <th style="text-align:left;">Désignation</th>
      <th style="text-align:center;">Qté</th>
      <th style="text-align:right;">P.U</th>
      <th style="text-align:right;">Total</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="line"></div>
  <table>
    ${sale.discount>0?`<tr><td style="font-size:12px;">Sous-total</td><td style="text-align:right;font-size:12px;">${fmt(sale.subtotal||sale.total)}</td></tr>`:''}
    ${sale.discount>0?`<tr><td style="font-size:12px;">Remise</td><td style="text-align:right;font-size:12px;color:#666;">-${fmt(sale.discount)}</td></tr>`:''}
    ${sale.tva>0?`<tr><td style="font-size:12px;">TVA ${sale.tvaRate||''}%</td><td style="text-align:right;font-size:12px;">${fmt(sale.tva)}</td></tr>`:''}
    <tr class="total-row"><td>TOTAL TTC</td><td style="text-align:right;">${fmt(sale.total)}</td></tr>
    ${sale.status==='crédit'?`<tr><td style="font-size:12px;">Versé</td><td style="text-align:right;font-size:12px;">${fmt(sale.paid)}</td></tr>`:''}
    ${sale.status==='crédit'?`<tr><td style="font-size:12px;font-weight:bold;">Reste dû</td><td style="text-align:right;font-size:12px;font-weight:bold;">${fmt(Number(sale.total)-Number(sale.paid))}</td></tr>`:''}
  </table>
  <div class="line"></div>
  <div class="center" style="font-size:11px;">Mode: ${sale.payMode||'cash'} · <span class="badge">${sale.status==='payé'?'PAYÉ':'CRÉDIT'}</span></div>
  <div class="line"></div>
  <div class="center" style="font-size:11px;margin-top:4px;">${ps.footerText}</div>
  <div class="center" style="font-size:10px;margin-top:2px;color:#666;">VenteX AI · 100% Offline</div>
  </body></html>`;
  openPrint(html, `Ticket ${num}`);
}

// ─── FACTURE A4 ───────────────────────────────────────────────────────────────
export async function printInvoice(sale, items, client, shopSettings) {
  const ps  = await loadPrintSettings();
  const sn  = shopSettings?.name || ps.shopName;
  const num = 'VX-'+String(sale.id).padStart(4,'0');
  const isProforma = !!sale.proforma;
  const title = isProforma ? 'FACTURE PROFORMA' : 'FACTURE';

  const rows = items.map((i,idx)=>`
    <tr style="background:${idx%2===0?'#F8FAFC':'#fff'}">
      <td style="padding:8px 10px;font-size:13px;">${idx+1}</td>
      <td style="padding:8px 10px;font-size:13px;font-weight:600;">${i.productName}</td>
      <td style="padding:8px 10px;font-size:13px;text-align:center;">${i.qty}</td>
      <td style="padding:8px 10px;font-size:13px;text-align:right;">${fmt(i.unitPrice)}</td>
      <td style="padding:8px 10px;font-size:13px;text-align:right;font-weight:700;color:#1B4FD8;">${fmt(i.unitPrice*i.qty)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>${title} ${num}</title>
  <style>
    @page { margin:15mm; size:A4; }
    * { box-sizing:border-box; }
    body { font-family:'Segoe UI',Arial,sans-serif; font-size:13px; color:#1E293B; background:#fff; margin:0; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:30px; padding-bottom:20px; border-bottom:3px solid #1B4FD8; }
    .shop-name { font-size:26px; font-weight:900; color:#1B4FD8; letter-spacing:-0.5px; }
    .doc-title { font-size:22px; font-weight:900; color:#1E293B; text-align:right; }
    .doc-num { font-size:13px; color:#64748B; text-align:right; margin-top:4px; }
    .meta { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:24px; }
    .meta-box { background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:12px 16px; }
    .meta-label { font-size:10px; font-weight:700; color:#94A3B8; text-transform:uppercase; letter-spacing:.8px; margin-bottom:6px; }
    table { width:100%; border-collapse:collapse; margin-bottom:16px; }
    thead { background:#1B4FD8; }
    thead th { color:#fff; padding:10px 12px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.6px; text-align:left; }
    thead th:last-child, thead th:nth-child(3), thead th:nth-child(4) { text-align:right; }
    .totals { margin-left:auto; width:280px; }
    .totals table { border:1px solid #E2E8F0; border-radius:8px; overflow:hidden; }
    .totals td { padding:8px 14px; font-size:13px; }
    .totals tr:last-child td { font-size:16px; font-weight:900; background:#1B4FD8; color:#fff; }
    .footer { margin-top:30px; padding-top:16px; border-top:1px solid #E2E8F0; display:flex; justify-content:space-between; font-size:11px; color:#94A3B8; }
    ${isProforma?'.doc-title { color:#F59E0B; } thead { background:#F59E0B; } .totals tr:last-child td { background:#F59E0B; }':''}
  </style></head><body>

  <div class="header">
    <div>
      <div class="shop-name">${sn}</div>
      <div style="font-size:12px;color:#64748B;margin-top:4px;">${ps.shopAddress}</div>
      ${ps.shopPhone?`<div style="font-size:12px;color:#64748B;">Tél: ${ps.shopPhone}</div>`:''}
      ${ps.shopTax?`<div style="font-size:12px;color:#64748B;">NIF: ${ps.shopTax}</div>`:''}
    </div>
    <div>
      <div class="doc-title">${title}</div>
      <div class="doc-num">N° ${num}</div>
      <div class="doc-num">Date: ${fmtDate(sale.createdAt)}</div>
    </div>
  </div>

  <div class="meta">
    <div class="meta-box">
      <div class="meta-label">Facturé à</div>
      <div style="font-weight:700;font-size:14px;">${sale.clientName||'Client de passage'}</div>
      ${client?.phone?`<div style="font-size:12px;color:#64748B;margin-top:2px;">Tél: ${client.phone}</div>`:''}
      ${client?.address?`<div style="font-size:12px;color:#64748B;">${client.address}</div>`:''}
    </div>
    <div class="meta-box">
      <div class="meta-label">Détails facture</div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="color:#64748B;">Mode paiement</span>
        <span style="font-weight:600;">${sale.payMode||'Espèce'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="color:#64748B;">Statut</span>
        <span style="font-weight:700;color:${sale.status==='payé'?'#10B981':'#F59E0B'};">${(sale.status||'payé').toUpperCase()}</span>
      </div>
      ${sale.employeeName?`<div style="display:flex;justify-content:space-between;"><span style="color:#64748B;">Vendeur</span><span>${sale.employeeName}</span></div>`:''}
    </div>
  </div>

  <table>
    <thead><tr>
      <th style="width:40px;">#</th>
      <th>Désignation</th>
      <th style="width:60px;text-align:center;">Qté</th>
      <th style="width:120px;text-align:right;">Prix U.</th>
      <th style="width:130px;text-align:right;">Total TTC</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <table>
      ${sale.discount>0?`<tr><td>Sous-total</td><td style="text-align:right;">${fmt(sale.subtotal||sale.total)}</td></tr>`:''}
      ${sale.discount>0?`<tr><td>Remise</td><td style="text-align:right;color:#EF4444;">-${fmt(sale.discount)}</td></tr>`:''}
      ${sale.tva>0?`<tr><td>TVA ${sale.tvaRate||''}%</td><td style="text-align:right;">${fmt(sale.tva)}</td></tr>`:''}
      <tr><td>TOTAL TTC</td><td style="text-align:right;">${fmt(sale.total)}</td></tr>
      ${sale.status==='crédit'?`<tr style="background:#FFFBEB;"><td>Versé</td><td style="text-align:right;color:#10B981;">${fmt(sale.paid)}</td></tr>`:''}
      ${sale.status==='crédit'?`<tr style="background:#FEF2F2;"><td>Reste dû</td><td style="text-align:right;color:#EF4444;">${fmt(Number(sale.total)-Number(sale.paid))}</td></tr>`:''}
    </table>
  </div>

  ${sale.note?`<div style="margin-top:16px;padding:10px 14px;background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0;font-size:12px;color:#64748B;"><strong>Note:</strong> ${sale.note}</div>`:''}

  <div class="footer">
    <div>${ps.footerText}</div>
    <div>VenteX AI · ${sn}</div>
  </div>

  </body></html>`;
  openPrint(html, `${title} ${num}`);
}

// ─── BON DE LIVRAISON ─────────────────────────────────────────────────────────
export async function printDelivery(sale, items, client) {
  const ps     = await loadPrintSettings();
  const num    = 'BL-'+String(sale.id).padStart(4,'0');
  const isA5   = !!sale.formatA5;
  const size   = isA5 ? 'A5' : 'A4';
  const fsize  = isA5 ? '11px' : '13px';

  const rows = items.map((i,idx)=>`
    <tr style="background:${idx%2===0?'#F8FAFC':'#fff'}">
      <td style="padding:7px 10px;font-size:${fsize};">${idx+1}</td>
      <td style="padding:7px 10px;font-size:${fsize};font-weight:600;">${i.productName}</td>
      <td style="padding:7px 10px;font-size:${fsize};text-align:center;font-weight:700;color:#1B4FD8;">${i.qty}</td>
      <td style="padding:7px 10px;font-size:${fsize};text-align:right;">${fmt(i.unitPrice)}</td>
      <td style="padding:7px 10px;font-size:${fsize};text-align:right;font-weight:700;">${fmt(i.unitPrice*i.qty)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Bon de Livraison ${num}</title>
  <style>
    @page { margin:10mm; size:${size}; }
    * { box-sizing:border-box; }
    body { font-family:'Segoe UI',Arial,sans-serif; font-size:${fsize}; color:#1E293B; background:#fff; margin:0; }
    .header { display:flex; justify-content:space-between; align-items:center; padding-bottom:14px; border-bottom:3px solid #06B6D4; margin-bottom:18px; }
    .shop-name { font-size:${isA5?'18px':'22px'}; font-weight:900; color:#06B6D4; }
    .doc-title { font-size:${isA5?'18px':'22px'}; font-weight:900; text-transform:uppercase; color:#0F172A; }
    table { width:100%; border-collapse:collapse; }
    thead { background:#0F172A; }
    thead th { color:#fff; padding:8px 10px; font-size:10px; font-weight:700; text-transform:uppercase; text-align:left; }
    .sig { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:30px; }
    .sig-box { border:1px dashed #CBD5E1; border-radius:8px; padding:12px; }
    .sig-label { font-size:10px; font-weight:700; color:#94A3B8; text-transform:uppercase; margin-bottom:30px; }
  </style></head><body>

  <div class="header">
    <div>
      <div class="shop-name">${ps.shopName}</div>
      <div style="font-size:11px;color:#64748B;">${ps.shopAddress} ${ps.shopPhone?'· Tél: '+ps.shopPhone:''}</div>
    </div>
    <div style="text-align:right;">
      <div class="doc-title">Bon de Livraison</div>
      <div style="font-size:12px;color:#64748B;">N° ${num} · ${fmtDate(sale.createdAt)}</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
    <div style="background:#ECFEFF;border:1px solid #A5F3FC;border-radius:8px;padding:10px 14px;">
      <div style="font-size:10px;font-weight:700;color:#06B6D4;text-transform:uppercase;margin-bottom:4px;">Livré à</div>
      <div style="font-weight:700;font-size:${isA5?'12px':'14px'};">${sale.clientName||'Client'}</div>
      ${client?.phone?`<div style="font-size:11px;color:#64748B;">Tél: ${client.phone}</div>`:''}
    </div>
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:10px 14px;">
      <div style="font-size:10px;font-weight:700;color:#94A3B8;text-transform:uppercase;margin-bottom:4px;">Infos</div>
      ${sale.employeeName?`<div style="font-size:12px;">Vendeur: <b>${sale.employeeName}</b></div>`:''}
      <div style="font-size:12px;">Articles: <b>${items.length}</b> · Qté: <b>${items.reduce((s,i)=>s+i.qty,0)}</b></div>
    </div>
  </div>

  <table>
    <thead><tr>
      <th style="width:36px;">#</th>
      <th>Désignation</th>
      <th style="width:60px;text-align:center;">Qté</th>
      <th style="width:110px;text-align:right;">Prix U.</th>
      <th style="width:120px;text-align:right;">Montant</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr style="border-top:2px solid #0F172A;">
        <td colspan="4" style="padding:8px 10px;font-weight:700;text-align:right;">TOTAL TTC</td>
        <td style="padding:8px 10px;font-weight:900;font-size:15px;text-align:right;color:#1B4FD8;">${fmt(sale.total)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="sig">
    <div class="sig-box"><div class="sig-label">Signature Vendeur</div></div>
    <div class="sig-box"><div class="sig-label">Signature Client / Cachet</div></div>
  </div>

  </body></html>`;
  openPrint(html, `BL ${num}`);
}

// ─── EXPORTS SUPPLÉMENTAIRES POUR COMPATIBILITÉ ────────────────────────────────
export const printQuote = async (sale, items, client, shopSettings) => {
  // Le devis utilise la même structure que la facture proforma
  return printInvoice({ ...sale, proforma: true }, items, client, shopSettings);
};

export function PrintSettingsPanel() {
  return (
    <div style={{ padding: '15px', background: '#1e293b', borderRadius: '8px', color: '#fff' }}>
      <h3 style={{ marginBottom: '10px', fontSize: '16px' }}>Configuration de l'imprimante</h3>
      <p style={{ fontSize: '13px', color: '#94a3b8' }}>L'imprimante thermique est prête pour le format 80mm.</p>
    </div>
  );
}