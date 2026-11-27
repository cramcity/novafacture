// NovaFacture v2 — « Mes documents » : historique, statuts de paiement, relances, reçus, clients, récurrence, sauvegarde.
// 100 % local (localStorage). Rien n'est envoyé à un serveur. Ne modifie pas le générateur : utilise window.NovaFacture.
(function () {
  "use strict";
  const EN = document.documentElement.lang === "en";
  const L = (fr, en) => (EN ? en : fr);
  const DOCS = "novafacture.docs.v1", CLIENTS = "novafacture.clients.v1";
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const read = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { alert(L("Stockage plein ou indisponible : exportez une sauvegarde.", "Storage full or unavailable: export a backup.")); return false; } };
  const today = () => new Date().toISOString().slice(0, 10);
  const addMonths = (d, n) => { if (!d) return d; const x = new Date(d + "T12:00:00"); x.setMonth(x.getMonth() + n); return x.toISOString().slice(0, 10); };
  const NF = () => window.NovaFacture;
  const fmt = (v, cur) => { try { return new Intl.NumberFormat(EN ? "en-CA" : "fr-CA", { style: "currency", currency: cur, maximumFractionDigits: ["XOF", "XAF", "CDF"].includes(cur) ? 0 : 2 }).format(v); } catch { return v + " " + cur; } };
  const TYPE = { invoice: L("Facture", "Invoice"), quote: L("Devis", "Quote"), receipt: L("Reçu", "Receipt") };
  const STATUS = { draft: L("Brouillon", "Draft"), sent: L("Envoyée", "Sent"), paid: L("Payée", "Paid"), accepted: L("Accepté", "Accepted") };

  function statusOf(d) {
    if (d.state.type === "invoice" && d.status === "sent" && d.state.due && d.state.due < today()) return "overdue";
    return d.status;
  }
  const statusLabel = (s) => (s === "overdue" ? L("EN RETARD", "OVERDUE") : STATUS[s] || s);

  function snapshot() {
    const s = JSON.parse(JSON.stringify(NF().state));
    delete s.logo; // le logo reste dans le générateur (économise l'espace)
    return s;
  }

  function saveCurrent() {
    const s = snapshot();
    const { total } = NF().compute();
    const docs = read(DOCS);
    const i = docs.findIndex((d) => d.state.type === s.type && d.state.number === s.number);
    const rec = { id: i >= 0 ? docs[i].id : Date.now().toString(36), savedAt: new Date().toISOString(), status: i >= 0 ? docs[i].status : (s.type === "receipt" ? "paid" : "draft"), total, currency: s.currency, state: s };
    if (i >= 0) docs[i] = rec; else docs.unshift(rec);
    if (write(DOCS, docs)) { NF().toast(i >= 0 ? L("Document mis à jour", "Document updated") : L("Document enregistré", "Document saved")); renderList(); }
  }

  function nextMonth() {
    const s = snapshot();
    s.number = NF().nextNumber(s.number);
    s.date = addMonths(s.date || today(), 1);
    s.due = addMonths(s.due, 1);
    NF().applyState(s);
    NF().toast(L("Copie créée pour le mois suivant — vérifiez puis enregistrez", "Copy created for next month — check it, then save"));
    window.scrollTo({ top: $("#outil").offsetTop - 60, behavior: "smooth" });
  }

  function reminderLink(d) {
    const s = d.state, client = (s.client || "").split("\n")[0];
    const subj = L(`Rappel — facture n° ${s.number}`, `Reminder — invoice #${s.number}`);
    const body = L(
      `Bonjour ${client},\n\nSauf erreur de ma part, la facture n° ${s.number} de ${fmt(d.total, d.currency)}, échue le ${s.due}, n'a pas encore été réglée. Il s'agit peut-être d'un simple oubli.\n\nMerci de me confirmer la date de paiement prévue.\n\nCordialement,\n${(s.seller || "").split("\n")[0]}`,
      `Hi ${client},\n\nUnless I'm mistaken, invoice #${s.number} for ${fmt(d.total, d.currency)}, due on ${s.due}, has not been paid yet. It may simply have slipped through.\n\nCould you confirm the expected payment date?\n\nBest regards,\n${(s.seller || "").split("\n")[0]}`);
    return `mailto:?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`;
  }

  function makeReceipt(d) {
    const s = JSON.parse(JSON.stringify(d.state));
    s.type = "receipt"; s.number = "R-" + s.number; s.date = today(); s.due = today();
    NF().applyState(s);
    NF().toast(L("Reçu prêt — enregistrez-le ou téléchargez le PDF", "Receipt ready — save it or download the PDF"));
    window.scrollTo({ top: $("#outil").offsetTop - 60, behavior: "smooth" });
  }

  function renderList() {
    const box = $("#nf-docs"); if (!box) return;
    const docs = read(DOCS);
    // Résumé par devise
    const sum = {};
    docs.filter((d) => d.state.type === "invoice").forEach((d) => {
      const c = (sum[d.currency] ||= { inv: 0, paid: 0, due: 0, late: 0 });
      c.inv += d.total;
      const st = statusOf(d);
      if (st === "paid") c.paid += d.total; else { c.due += d.total; if (st === "overdue") c.late++; }
    });
    const cards = Object.entries(sum).map(([cur, c]) => `<div class="nf-kpi"><b>${cur}</b><span>${L("Facturé", "Invoiced")} ${fmt(c.inv, cur)}</span><span>${L("Encaissé", "Paid")} ${fmt(c.paid, cur)}</span><span class="${c.late ? "late" : ""}">${L("À recevoir", "Outstanding")} ${fmt(c.due, cur)}${c.late ? ` · ${c.late} ${L("en retard", "overdue")}` : ""}</span></div>`).join("");
    const rows = docs.map((d) => {
      const st = statusOf(d), s = d.state;
      const opts = (s.type === "quote" ? ["draft", "sent", "accepted"] : s.type === "receipt" ? ["paid"] : ["draft", "sent", "paid"]).map((k) => `<option value="${k}" ${d.status === k ? "selected" : ""}>${STATUS[k]}</option>`).join("");
      return `<tr data-id="${esc(d.id)}">
        <td>${TYPE[s.type] || s.type}<br><small>${esc(s.number)}</small></td>
        <td>${esc((s.client || "—").split("\n")[0])}<br><small>${esc(s.date)}</small></td>
        <td class="num">${fmt(d.total, d.currency)}</td>
        <td><span class="nf-st ${st}">${statusLabel(st)}</span><br><select data-act="status" aria-label="${L("Statut", "Status")}">${opts}</select></td>
        <td class="nf-act">
          <button type="button" class="btn ghost small" data-act="open">${L("Ouvrir", "Open")}</button>
          ${s.type === "invoice" && st !== "paid" ? `<a class="btn ghost small" href="${reminderLink(d)}">${L("Relancer", "Remind")}</a>` : ""}
          ${s.type === "invoice" && st === "paid" ? `<button type="button" class="btn ghost small" data-act="receipt">${L("Reçu", "Receipt")}</button>` : ""}
          <button type="button" class="btn ghost small" data-act="del" aria-label="${L("Supprimer", "Delete")}">×</button>
        </td></tr>`;
    }).join("");
    box.innerHTML = (cards ? `<div class="nf-kpis">${cards}</div>` : "") + (docs.length
      ? `<div class="nf-table"><table><thead><tr><th>${L("Document", "Document")}</th><th>${L("Client / date", "Client / date")}</th><th class="num">${L("Total", "Total")}</th><th>${L("Statut", "Status")}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<p style="color:var(--muted)">${L("Aucun document enregistré. Remplissez le formulaire puis cliquez sur « Enregistrer ce document ».", "No saved documents yet. Fill in the form, then click \"Save this document\".")}</p>`);
  }

  function onListClick(e) {
    const tr = e.target.closest("tr[data-id]"); if (!tr) return;
    const act = e.target.dataset.act; if (!act || act === "status") return;
    const docs = read(DOCS), i = docs.findIndex((d) => d.id === tr.dataset.id); if (i < 0) return;
    if (act === "open") { NF().applyState(docs[i].state); window.scrollTo({ top: $("#outil").offsetTop - 60, behavior: "smooth" }); }
    if (act === "receipt") makeReceipt(docs[i]);
    if (act === "del" && confirm(L("Supprimer ce document de l'historique ?", "Delete this document from history?"))) { docs.splice(i, 1); write(DOCS, docs); renderList(); }
  }
  function onListChange(e) {
    if (e.target.dataset.act !== "status") return;
    const tr = e.target.closest("tr[data-id]"); const docs = read(DOCS); const d = docs.find((x) => x.id === tr.dataset.id);
    if (d) { d.status = e.target.value; write(DOCS, docs); renderList(); }
  }

  // ---------- Clients ----------
  function renderClients() {
    const sel = $("#nf-client-pick"); if (!sel) return;
    const cl = read(CLIENTS);
    sel.innerHTML = `<option value="">${L("— Clients enregistrés —", "— Saved clients —")}</option>` + cl.map((c, i) => `<option value="${i}">${esc(c.split("\n")[0])}</option>`).join("");
  }
  function saveClient() {
    const v = ($("#client").value || "").trim();
    if (!v) { NF().toast(L("Saisissez d'abord le client", "Enter the client first")); return; }
    const cl = read(CLIENTS).filter((c) => c.split("\n")[0] !== v.split("\n")[0]);
    cl.unshift(v); write(CLIENTS, cl.slice(0, 200)); renderClients(); NF().toast(L("Client enregistré", "Client saved"));
  }
  function pickClient(e) {
    const cl = read(CLIENTS), v = cl[e.target.value]; if (v == null) return;
    const el = $("#client"); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); e.target.value = "";
  }

  // ---------- Sauvegarde ----------
  function exportAll() {
    const data = { app: "NovaFacture", version: 2, exportedAt: new Date().toISOString(), current: NF().state, docs: read(DOCS), clients: read(CLIENTS) };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = `novafacture-sauvegarde-${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  // Export CSV (Excel / comptable) : FR = séparateur « ; » et virgule décimale, EN = « , » et point.
  function exportCsv() {
    const docs = read(DOCS);
    if (!docs.length) { NF().toast(L("Aucun document à exporter", "No documents to export")); return; }
    const SEP = EN ? "," : ";";
    const num = (v) => { const s = (Math.round((Number(v) || 0) * 100) / 100).toFixed(2); return EN ? s : s.replace(".", ","); };
    const cell = (v) => { let s = String(v ?? "").replace(/\r?\n/g, " ").trim(); if (/^[=+@\t]|^-(?![\d.,]+$)/.test(s)) s = "'" + s; return /[";,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const head = EN
      ? ["Type", "Number", "Date", "Due date", "Client", "Status", "Subtotal", "Taxes", "Total", "Deposit received", "Balance due", "Currency"]
      : ["Type", "Numéro", "Date", "Échéance", "Client", "Statut", "Sous-total", "Taxes", "Total", "Acompte reçu", "Reste à payer", "Devise"];
    const rows = docs.slice().sort((a, b) => String(a.state.date || "").localeCompare(String(b.state.date || ""))).map((d) => {
      const s = d.state;
      const gross = Math.round((s.lines || []).reduce((t, l) => t + (Number(l.q) || 0) * (Number(l.p) || 0), 0) * 100) / 100;
      const pct = Math.min(100, Math.max(0, Number(String(s.discount || "").replace(",", ".")) || 0));
      const sub = Math.round((gross - Math.round(gross * pct) / 100) * 100) / 100; // sous-total après remise (base taxable)
      const dep = s.type === "invoice" ? Math.max(0, Number(String(s.deposit || "").replace(",", ".")) || 0) : 0;
      return [TYPE[s.type] || s.type, s.number, s.date, s.type === "receipt" ? "" : s.due, (s.client || "").split("\n")[0], statusLabel(statusOf(d)),
        num(sub), num(d.total - sub), num(d.total), dep ? num(dep) : "", s.type === "invoice" ? num(d.status === "paid" ? 0 : d.total - dep) : "", d.currency].map(cell).join(SEP);
    });
    const csv = "﻿" + [head.join(SEP), ...rows].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `novafacture-${L("historique", "history")}-${today()}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    NF().toast(L(`${docs.length} document(s) exporté(s) en CSV`, `${docs.length} document(s) exported to CSV`));
  }
  function importAll(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (d.app !== "NovaFacture" || !Array.isArray(d.docs)) throw new Error("format");
        if (!confirm(L(`Importer ${d.docs.length} document(s) et ${(d.clients || []).length} client(s) ? Ils s'ajoutent à vos données actuelles.`, `Import ${d.docs.length} document(s) and ${(d.clients || []).length} client(s)? They will be added to your current data.`))) return;
        const docs = read(DOCS), ids = new Set(docs.map((x) => x.id));
        d.docs.forEach((x) => { if (x && x.state && !ids.has(x.id)) docs.push(x); });
        write(DOCS, docs);
        const cl = read(CLIENTS); (d.clients || []).forEach((c) => { if (typeof c === "string" && !cl.includes(c)) cl.push(c); }); write(CLIENTS, cl);
        renderList(); renderClients(); NF().toast(L("Sauvegarde importée", "Backup imported"));
      } catch { alert(L("Fichier de sauvegarde invalide.", "Invalid backup file.")); }
    };
    r.readAsText(file);
  }

  function mount() {
    if (!NF() || !NF().applyState) return;
    // Sélecteur de clients sous le champ client
    const client = $("#client");
    const bar = document.createElement("div"); bar.className = "row"; bar.style.marginTop = "6px";
    bar.innerHTML = `<select id="nf-client-pick" aria-label="${L("Clients enregistrés", "Saved clients")}"></select><button type="button" class="btn ghost small" id="nf-client-save">${L("Enregistrer ce client", "Save this client")}</button>`;
    client.insertAdjacentElement("afterend", bar);
    $("#nf-client-pick").addEventListener("change", pickClient);
    $("#nf-client-save").addEventListener("click", saveClient);

    // Bouton « Enregistrer » dans les actions
    const actions = $(".actions");
    const sv = document.createElement("button"); sv.type = "button"; sv.className = "btn"; sv.id = "nf-save"; sv.textContent = L("Enregistrer ce document", "Save this document");
    actions.prepend(sv); sv.addEventListener("click", saveCurrent);

    // Section « Mes documents »
    const sec = document.createElement("section"); sec.className = "section"; sec.id = "mes-documents";
    sec.innerHTML = `<div class="card">
      <h2 style="margin-top:0">${L("Mes documents", "My documents")}</h2>
      <p style="color:var(--muted);margin-top:0">${L("Historique, suivi des paiements, relances et reçus. Tout reste sur cet appareil : exportez une sauvegarde régulièrement.", "History, payment tracking, reminders and receipts. Everything stays on this device: export a backup regularly.")}</p>
      <div class="actions" style="margin:10px 0">
        <button type="button" class="btn ghost small" id="nf-next">${L("Dupliquer pour le mois suivant", "Duplicate for next month")}</button>
        <button type="button" class="btn ghost small" id="nf-csv">${L("Exporter en CSV (Excel)", "Export to CSV (Excel)")}</button>
        <button type="button" class="btn ghost small" id="nf-export">${L("Exporter une sauvegarde", "Export a backup")}</button>
        <label class="btn ghost small" style="margin:0">${L("Importer une sauvegarde", "Import a backup")}<input type="file" id="nf-import" accept="application/json,.json" hidden></label>
      </div>
      <div id="nf-docs"></div>
    </div>`;
    $("main#outil").insertAdjacentElement("afterend", sec);
    $("#nf-next").addEventListener("click", nextMonth);
    $("#nf-csv").addEventListener("click", exportCsv);
    $("#nf-export").addEventListener("click", exportAll);
    $("#nf-import").addEventListener("change", (e) => { if (e.target.files[0]) importAll(e.target.files[0]); e.target.value = ""; });
    $("#nf-docs").addEventListener("click", onListClick);
    $("#nf-docs").addEventListener("change", onListChange);
    renderClients(); renderList();
  }
  // Après l'initialisation du générateur (app.js écoute aussi DOMContentLoaded et est chargé avant)
  document.addEventListener("DOMContentLoaded", () => setTimeout(mount, 0));
})();
