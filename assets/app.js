// NovaFacture — générateur de factures et devis, 100 % dans le navigateur (aucune donnée envoyée).
(function () {
  "use strict";
  const C = window.NOVA_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const STORE = "novafacture.v1";
  const UI_EN = document.documentElement.lang === "en";
  const L = (fr, en) => (UI_EN ? en : fr);

  // Préréglages fiscaux. Taux vérifiés nov. 2026 — l'utilisateur peut toujours choisir "Personnalisé".
  const PRESETS = {
    "qc": { labelEn: "Canada — Quebec (GST 5% + QST 9.975%)", label: "Canada — Québec (TPS 5 % + TVQ 9,975 %)", cur: "CAD", taxes: [["TPS", 5], ["TVQ", 9.975]], ids: ["N° TPS", "N° TVQ"] },
    "on": { labelEn: "Canada — Ontario (HST 13%)", label: "Canada — Ontario (TVH 13 %)", cur: "CAD", taxes: [["TVH", 13]], ids: ["N° TPS/TVH"] },
    "atl15": { labelEn: "Canada — NB, NL, PEI (HST 15%)", label: "Canada — N.-B., T.-N.-L., Î.-P.-É. (TVH 15 %)", cur: "CAD", taxes: [["TVH", 15]], ids: ["N° TPS/TVH"] },
    "ns": { labelEn: "Canada — Nova Scotia (HST 14%)", label: "Canada — Nouvelle-Écosse (TVH 14 %)", cur: "CAD", taxes: [["TVH", 14]], ids: ["N° TPS/TVH"] },
    "ca5": { labelEn: "Canada — other provinces (GST 5%)", label: "Canada — autres provinces (TPS 5 %)", cur: "CAD", taxes: [["TPS", 5]], ids: ["N° TPS"] },
    "ca0": { labelEn: "Canada — small supplier (no tax)", legalEn: "Small supplier, not registered for GST/HST.", label: "Canada — petit fournisseur (sans taxes)", cur: "CAD", taxes: [], ids: [], legal: "Petit fournisseur non inscrit aux fichiers de la TPS et de la TVQ." },
    "fr20": { labelEn: "France — VAT 20%", label: "France — TVA 20 %", cur: "EUR", taxes: [["TVA", 20]], ids: ["SIRET", "N° TVA intracom."], legal: "Pénalités de retard : 3 fois le taux d'intérêt légal. Indemnité forfaitaire pour frais de recouvrement : 40 €. Pas d'escompte pour paiement anticipé." },
    "frae": { labelEn: "France — micro-entrepreneur (VAT exempt)", label: "France — micro-entrepreneur (franchise de TVA)", cur: "EUR", taxes: [], ids: ["SIRET"], legal: "TVA non applicable, art. 293 B du CGI.\nPénalités de retard : 3 fois le taux d'intérêt légal. Indemnité forfaitaire pour frais de recouvrement : 40 €." },
    "be21": { labelEn: "Belgium — VAT 21%", label: "Belgique — TVA 21 %", cur: "EUR", taxes: [["TVA", 21]], ids: ["N° d'entreprise / TVA"] },
    "befr": { labelEn: "Belgium — small business exemption", label: "Belgique — franchise des petites entreprises", cur: "EUR", taxes: [], ids: ["N° d'entreprise"], legal: "Régime particulier de franchise des petites entreprises — TVA non applicable." },
    "ch": { labelEn: "Switzerland — VAT 8.1%", label: "Suisse — TVA 8,1 %", cur: "CHF", taxes: [["TVA", 8.1]], ids: ["IDE / N° TVA"] },
    "ci": { labelEn: "Côte d'Ivoire — VAT 18%", label: "Côte d'Ivoire — TVA 18 %", cur: "XOF", taxes: [["TVA", 18]], ids: ["NCC", "RCCM"] },
    "sn": { labelEn: "Senegal — VAT 18%", label: "Sénégal — TVA 18 %", cur: "XOF", taxes: [["TVA", 18]], ids: ["NINEA", "RCCM"] },
    "cm": { labelEn: "Cameroon — VAT 19.25%", label: "Cameroun — TVA 19,25 %", cur: "XAF", taxes: [["TVA", 19.25]], ids: ["NIU", "RCCM"] },
    "cd": { labelEn: "DR Congo — VAT 16%", label: "RD Congo — TVA 16 %", cur: "CDF", taxes: [["TVA", 16]], ids: ["NIF", "RCCM"] },
    "uk": { labelEn: "United Kingdom — VAT 20%", label: "Royaume-Uni — TVA (VAT) 20 %", cur: "GBP", taxes: [["TVA", 20]], ids: ["VAT No."] },
    "au": { labelEn: "Australia — GST 10%", label: "Australie — GST 10 %", cur: "AUD", taxes: [["TPS", 10]], ids: ["ABN"], legal: "Facture fiscale (Tax invoice).", legalEn: "Tax invoice." },
    "us": { labelEn: "United States — no sales tax", label: "États-Unis — sans taxe de vente", cur: "USD", taxes: [], ids: ["EIN (optional)"] },
    "none": { labelEn: "No tax", label: "Sans taxe", cur: "USD", taxes: [], ids: [] },
    "custom": { labelEn: "Custom (1 tax)", label: "Personnalisé (1 taxe)", cur: "USD", taxes: [["Taxe", 10]], ids: [], custom: true }
  };
  const CURRENCIES = ["CAD", "EUR", "USD", "GBP", "AUD", "CHF", "XOF", "XAF", "CDF", "MAD"];

  const T = {
    fr: { invoice: "FACTURE", quote: "DEVIS", from: "Émetteur", to: "Facturé à", toQ: "Client", num: "N°", date: "Date", due: "Échéance", valid: "Valable jusqu'au", receipt: "REÇU", paidOn: "Payé le", toR: "Reçu de", paid: "PAYÉ — merci !", discount: "Remise", net: "Total HT après remise", deposit: "Acompte reçu", balance: "Reste à payer", payOnline: "Payer en ligne", desc: "Description", qty: "Qté", price: "Prix unitaire", amount: "Montant", sub: "Sous-total", total: "Total", made: "Document créé gratuitement avec NovaFacture" },
    en: { invoice: "INVOICE", quote: "QUOTE", from: "From", to: "Bill to", toQ: "Client", num: "No.", date: "Date", due: "Due date", valid: "Valid until", receipt: "RECEIPT", paidOn: "Paid on", toR: "Received from", paid: "PAID — thank you!", discount: "Discount", net: "Subtotal after discount", deposit: "Deposit received", balance: "Balance due", payOnline: "Pay online", desc: "Description", qty: "Qty", price: "Unit price", amount: "Amount", sub: "Subtotal", total: "Total", made: "Created for free with NovaFacture" }
  };

  // Noms des taxes sur un document en anglais
  const TAX_EN = { TPS: "GST", TVQ: "QST", TVH: "HST", TVA: "VAT", Taxe: "Tax" };
  const taxName = (n) => (state.lang === "en" && TAX_EN[n]) || n;

  const today = () => new Date().toISOString().slice(0, 10);
  const addDays = (d, n) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

  const defaults = () => ({
    type: "invoice", lang: UI_EN ? "en" : "fr", preset: UI_EN ? "on" : "qc", currency: "CAD", customName: L("Taxe", "Tax"), customRate: 10,
    number: "2026-001", date: today(), due: addDays(today(), 30),
    seller: "", sellerIds: "", client: "", logo: "",
    lines: [{ d: "", q: 1, p: 0 }],
    notes: L("Paiement sous 30 jours par virement ou PayPal. Merci de votre confiance !", "Payment due within 30 days by bank transfer or PayPal. Thank you for your business!"),
    legal: "", discount: "", deposit: "", payLink: ""
  });

  let state = load() || defaults();
  if (!state.date) state.date = today();

  function load() { try { return JSON.parse(localStorage.getItem(STORE)); } catch { return null; } }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* stockage indisponible */ } }

  function money(v) {
    const n = Number.isFinite(v) ? v : 0;
    const zeroDec = ["XOF", "XAF", "CDF"].includes(state.currency);
    try {
      return new Intl.NumberFormat(state.lang === "en" ? "en-CA" : "fr-CA", { style: "currency", currency: state.currency, minimumFractionDigits: zeroDec ? 0 : 2, maximumFractionDigits: zeroDec ? 0 : 2 }).format(n);
    } catch { return n.toFixed(2) + " " + state.currency; }
  }
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const round2 = (n) => ["XOF", "XAF", "CDF"].includes(state.currency) ? Math.round(n) : Math.round((n + Number.EPSILON) * 100) / 100;

  function taxes() {
    const p = PRESETS[state.preset] || PRESETS.none;
    if (p.custom) return [[state.customName || "Taxe", Number(state.customRate) || 0]];
    return p.taxes;
  }

  function compute() {
    const gross = round2(state.lines.reduce((s, l) => s + (Number(l.q) || 0) * (Number(l.p) || 0), 0));
    // Remise globale en % appliquée avant taxes (0 à 100).
    const pct = Math.min(100, Math.max(0, Number(String(state.discount || "").replace(",", ".")) || 0));
    const disc = round2(gross * pct / 100);
    const sub = round2(gross - disc);
    const tx = taxes().map(([n, r]) => [n, r, round2(sub * r / 100)]);
    const total = round2(sub + tx.reduce((s, t) => s + t[2], 0));
    return { gross, pct, disc, sub, tx, total };
  }

  // ---------- Formulaire ----------
  function fillSelects() {
    $("#preset").innerHTML = Object.entries(PRESETS).map(([k, v]) => `<option value="${k}">${esc(UI_EN ? v.labelEn : v.label)}</option>`).join("");
    $("#currency").innerHTML = CURRENCIES.map((c) => `<option>${c}</option>`).join("");
  }

  function bindField(id, key, after) {
    const el = $("#" + id);
    el.value = state[key] ?? "";
    el.addEventListener("input", () => { state[key] = el.value; if (after) after(); render(); });
  }

  function renderLines() {
    const box = $("#lines");
    box.innerHTML = "";
    state.lines.forEach((l, i) => {
      const row = document.createElement("div");
      row.className = "line";
      row.innerHTML = `<input aria-label="Description" placeholder="${L("Description du service", "Service description")}" value="${esc(l.d)}">
        <input aria-label="${L("Quantité", "Quantity")}" type="number" step="any" min="0" value="${esc(l.q)}">
        <input aria-label="${L("Prix unitaire", "Unit price")}" type="number" step="any" min="0" value="${esc(l.p)}">
        <button type="button" title="${L("Supprimer la ligne", "Remove line")}" aria-label="${L("Supprimer la ligne", "Remove line")}">×</button>`;
      const [d, q, p, del] = row.children;
      d.addEventListener("input", () => { l.d = d.value; render(); });
      q.addEventListener("input", () => { l.q = q.value; render(); });
      p.addEventListener("input", () => { l.p = p.value; render(); });
      del.addEventListener("click", () => { if (state.lines.length > 1) state.lines.splice(i, 1); else state.lines[0] = { d: "", q: 1, p: 0 }; renderLines(); render(); });
      box.appendChild(row);
    });
  }

  function applyPreset() {
    const p = PRESETS[state.preset];
    state.currency = p.cur;
    $("#currency").value = state.currency;
    state.legal = (UI_EN && p.legalEn) || p.legal || "";
    $("#legal").value = state.legal;
    $("#sellerIds").placeholder = p.ids.length ? p.ids.join(" : …\n") + " : …" : L("Numéros d'entreprise (facultatif)", "Business numbers (optional)");
    $("#customBox").hidden = !p.custom;
  }

  // ---------- Aperçu ----------
  function render() {
    const t = T[state.lang] || T.fr;
    const isQ = state.type === "quote", isR = state.type === "receipt";
    const { gross, pct, disc, sub, tx, total } = compute();
    const dep = Math.max(0, Number(String(state.deposit || "").replace(",", ".")) || 0);
    const link = /^https?:\/\//i.test(String(state.payLink || "").trim()) ? String(state.payLink).trim() : "";
    const rows = state.lines.filter((l) => l.d || Number(l.p)).map((l) => {
      const amt = round2((Number(l.q) || 0) * (Number(l.p) || 0));
      return `<tr><td>${esc(l.d)}</td><td class="num">${esc(l.q)}</td><td class="num">${money(Number(l.p) || 0)}</td><td class="num">${money(amt)}</td></tr>`;
    }).join("") || `<tr><td colspan="4" style="color:#999">—</td></tr>`;

    $("#doc").innerHTML = `
      <div class="dhead">
        <div>${state.logo ? `<img class="dlogo" src="${esc(state.logo)}" alt="Logo">` : ""}<h1>${isR ? t.receipt : isQ ? t.quote : t.invoice}</h1></div>
        <div class="meta">
          <div><b>${t.num}</b> ${esc(state.number)}</div>
          <div><b>${t.date}</b> ${esc(state.date)}</div>
          ${state.due ? `<div><b>${isR ? t.paidOn : isQ ? t.valid : t.due}</b> ${esc(state.due)}</div>` : ""}
        </div>
      </div>
      <div class="parties">
        <div><h3>${t.from}</h3><div>${esc(state.seller) || "<span style='color:#aaa'>" + L("Votre nom / entreprise", "Your name / business") + "</span>"}</div><div style="color:#555;margin-top:4px">${esc(state.sellerIds)}</div></div>
        <div><h3>${isR ? t.toR : isQ ? t.toQ : t.to}</h3><div>${esc(state.client) || "<span style='color:#aaa'>" + L("Nom du client", "Client name") + "</span>"}</div></div>
      </div>
      <table><thead><tr><th>${t.desc}</th><th class="num">${t.qty}</th><th class="num">${t.price}</th><th class="num">${t.amount}</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="totals">
        ${disc > 0 ? `<div><span>${t.sub}</span><span>${money(gross)}</span></div><div><span>${t.discount} (${state.lang === "en" ? pct + "%" : String(pct).replace(".", ",") + " %"})</span><span>− ${money(disc)}</span></div><div><span>${t.net}</span><span>${money(sub)}</span></div>` : `<div><span>${t.sub}</span><span>${money(sub)}</span></div>`}
        ${tx.map(([n, r, a]) => `<div><span>${esc(taxName(n))} (${state.lang === "en" ? r + "%" : String(r).replace(".", ",") + " %"})</span><span>${money(a)}</span></div>`).join("")}
        <div class="grand"><span>${t.total}</span><span>${money(total)}</span></div>
        ${dep > 0 && !isR && !isQ ? `<div><span>${t.deposit}</span><span>− ${money(dep)}</span></div><div class="grand"><span>${t.balance}</span><span>${money(round2(total - dep))}</span></div>` : ""}
      </div>
      ${link && !isR && !isQ ? `<div class="paylink"><b>${t.payOnline} :</b> <a href="${esc(link)}">${esc(link)}</a></div>` : ""}
      ${isR ? `<div class="paid-stamp">${t.paid}</div>` : ""}
      ${state.notes ? `<div class="notes">${esc(state.notes)}</div>` : ""}
      ${state.legal ? `<div class="legal">${esc(state.legal)}</div>` : ""}
      <div class="foot">${t.made}</div>`;
    save();
  }

  function toast(msg) { const el = $("#toast"); el.textContent = msg; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 2200); }

  function nextNumber(n) {
    const m = String(n).match(/^(.*?)(\d+)$/);
    if (!m) return n + "-2";
    return m[1] + String(Number(m[2]) + 1).padStart(m[2].length, "0");
  }

  function init() {
    fillSelects();
    ["type", "lang", "number", "date", "due", "seller", "sellerIds", "client", "notes", "legal", "customName", "customRate", "discount", "deposit", "payLink"].forEach((k) => bindField(k, k));
    bindField("currency", "currency");
    const preset = $("#preset");
    preset.value = state.preset;
    $("#customBox").hidden = !PRESETS[state.preset]?.custom;
    preset.addEventListener("change", () => { state.preset = preset.value; applyPreset(); render(); });

    $("#addLine").addEventListener("click", () => { state.lines.push({ d: "", q: 1, p: 0 }); renderLines(); render(); });
    $("#print").addEventListener("click", () => { render(); window.print(); });
    $("#newDoc").addEventListener("click", () => {
      state.number = nextNumber(state.number); state.date = today(); state.due = addDays(today(), 30);
      state.client = ""; state.lines = [{ d: "", q: 1, p: 0 }];
      ["number", "date", "due", "client"].forEach((k) => ($("#" + k).value = state[k]));
      renderLines(); render(); toast(L("Nouveau document — vos coordonnées sont conservées", "New document — your details are kept"));
    });
    $("#reset").addEventListener("click", () => { if (confirm(L("Effacer toutes les données saisies sur cet appareil ?", "Erase all data entered on this device?"))) { state = defaults(); save(); location.reload(); } });
    $("#logo").addEventListener("change", (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (f.size > 400000) { toast(L("Logo trop lourd (max 400 Ko)", "Logo too large (max 400 KB)")); return; }
      const r = new FileReader(); r.onload = () => { state.logo = r.result; render(); }; r.readAsDataURL(f);
    });
    $("#noLogo").addEventListener("click", () => { state.logo = ""; $("#logo").value = ""; render(); });

    // Bouton d'achat du kit
    document.querySelectorAll("[data-kit-buy]").forEach((a) => {
      if (C.kitCheckoutUrl) { a.href = C.kitCheckoutUrl; a.target = "_blank"; a.rel = "noopener"; }
    });
    document.querySelectorAll("[data-kit-price]").forEach((el) => (el.textContent = (UI_EN ? C.kitPriceEn : C.kitPrice) || ""));

    renderLines(); render();
  }

  const FIELDS = ["type", "lang", "number", "date", "due", "seller", "sellerIds", "client", "notes", "legal", "customName", "customRate", "currency", "discount", "deposit", "payLink"];
  // Charge un document complet dans le formulaire (utilisé par « Mes documents »). Le logo actuel est conservé si absent.
  function applyState(s) {
    const logo = state.logo;
    state = Object.assign(defaults(), JSON.parse(JSON.stringify(s)));
    if (!state.logo) state.logo = logo;
    if (!Array.isArray(state.lines) || !state.lines.length) state.lines = [{ d: "", q: 1, p: 0 }];
    FIELDS.forEach((k) => { const el = $("#" + k); if (el) el.value = state[k] ?? ""; });
    $("#preset").value = state.preset;
    $("#customBox").hidden = !PRESETS[state.preset]?.custom;
    renderLines(); render();
  }

  window.NovaFacture = { compute, PRESETS, applyState, nextNumber, toast, money, get state() { return state; } };
  document.addEventListener("DOMContentLoaded", init);
})();
