(function () {
  "use strict";
  var CFG = window.SZYBKA_OFERTA || {};
  var FREE_LIMIT = 3;

  // ---------- helpers ----------
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };
  var fmt = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function money(n) {
    var p = Math.abs(n).toFixed(2).split(".");
    return (n < 0 ? "-" : "") + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0") + "," + p[1] + " zł";
  }
  function num(v) { var n = parseFloat(String(v == null ? "" : v).replace(/\s/g, "").replace(",", ".")); return isFinite(n) ? n : 0; }
  function round2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function pad(n, l) { n = String(n); while (n.length < l) n = "0" + n; return n; }
  function todayISO() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2); }
  function fmtDate(iso) { if (!iso) return ""; var p = iso.split("-"); return p.length === 3 ? p[2] + "." + p[1] + "." + p[0] : iso; }
  function addDays(iso, n) {
    var p = iso.split("-"); if (p.length !== 3) return "";
    var d = new Date(+p[0], +p[1] - 1, +p[2]); d.setDate(d.getDate() + n);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1, 2) + "-" + pad(d.getDate(), 2);
  }
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("on");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("on"); }, 2600);
  }

  // ---------- state ----------
  var INDUSTRIES = {
    ogolna: { name: "Ogólna", chips: [
      { desc: "Robocizna", unit: "godz." }, { desc: "Materiały wg specyfikacji", unit: "kpl." },
      { desc: "Usługa wg opisu", unit: "usł." }, { desc: "Dojazd", unit: "km" } ] },
    budowlane: { name: "Budowlane i remonty", chips: [
      { desc: "Demontaż i przygotowanie podłoża", unit: "m²" }, { desc: "Gładzie i malowanie", unit: "m²" },
      { desc: "Układanie płytek", unit: "m²" }, { desc: "Materiały wg kosztorysu", unit: "kpl." },
      { desc: "Wywóz odpadów", unit: "usł." }, { desc: "Dojazd", unit: "km" } ] },
    instalacje: { name: "Instalacje (woda, gaz, ogrzewanie)", chips: [
      { desc: "Montaż instalacji", unit: "godz." }, { desc: "Rury i kształtki", unit: "kpl." },
      { desc: "Uruchomienie i próba szczelności", unit: "usł." }, { desc: "Materiały pomocnicze", unit: "kpl." },
      { desc: "Dojazd", unit: "km" } ] },
    elektryka: { name: "Elektryka", chips: [
      { desc: "Montaż punktu elektrycznego", unit: "szt." }, { desc: "Prowadzenie przewodów", unit: "m" },
      { desc: "Montaż rozdzielnicy", unit: "szt." }, { desc: "Pomiary i protokół", unit: "usł." },
      { desc: "Dojazd", unit: "km" } ] },
    metal: { name: "Metal i spawalnictwo", chips: [
      { desc: "Spawanie MIG/MAG — konstrukcje stalowe", unit: "godz." }, { desc: "Cięcie i przygotowanie elementów", unit: "godz." },
      { desc: "Szlifowanie i obróbka spoin", unit: "godz." }, { desc: "Montaż na obiekcie", unit: "godz." },
      { desc: "Materiał wg specyfikacji", unit: "kpl." }, { desc: "Zabezpieczenie antykorozyjne", unit: "m²" }, { desc: "Dojazd", unit: "km" } ] },
    grafika: { name: "Grafika i marketing", chips: [
      { desc: "Projekt graficzny", unit: "usł." }, { desc: "Poprawki wg uwag klienta", unit: "godz." },
      { desc: "Teksty na stronę lub do materiałów", unit: "usł." }, { desc: "Posty w mediach społecznościowych", unit: "szt." },
      { desc: "Opieka nad profilem firmowym", unit: "mies." } ] },
    sprzatanie: { name: "Sprzątanie", chips: [
      { desc: "Sprzątanie powierzchni", unit: "m²" }, { desc: "Sprzątanie po remoncie", unit: "m²" },
      { desc: "Mycie okien", unit: "m²" }, { desc: "Środki czystości", unit: "kpl." }, { desc: "Dojazd", unit: "km" } ] },
    ogrod: { name: "Ogrody i zieleń", chips: [
      { desc: "Koszenie trawnika", unit: "m²" }, { desc: "Przycinka drzew i krzewów", unit: "godz." },
      { desc: "Sadzenie roślin", unit: "szt." }, { desc: "Wywóz odpadów zielonych", unit: "usł." }, { desc: "Dojazd", unit: "km" } ] },
    transport: { name: "Transport i przeprowadzki", chips: [
      { desc: "Przejazd", unit: "km" }, { desc: "Załadunek i rozładunek", unit: "godz." },
      { desc: "Wynajem pojazdu", unit: "doba" }, { desc: "Pakowanie i zabezpieczenie", unit: "kpl." } ] }
  };
  var industry = LS.get("so_industry", "ogolna"); if (!INDUSTRIES[industry]) industry = "ogolna";

  function newItem(p) {
    p = p || {};
    return { id: uid(), desc: p.desc || "", qty: p.qty || "1", unit: p.unit || "szt.", price: p.price || "", vat: p.vat || "23" };
  }
  function fmtNumber(c) { return "OF/" + new Date().getFullYear() + "/" + pad(c, 3); }
  function nextNumber() { return fmtNumber((LS.get("so_counter", 0) || 0) + 1); }
  function blankOffer() {
    return {
      id: uid(), number: nextNumber(), date: todayISO(), validDays: "14", title: "",
      client: { name: "", nip: "", address: "", contact: "" },
      items: [newItem()], delivery: "", payment: "przelew, 7 dni od wystawienia faktury", warranty: "", notes: ""
    };
  }
  var state = {
    seller: Object.assign({ name: "", nip: "", phone: "", address: "", email: "", bank: "", vatExempt: false }, LS.get("so_seller", {})),
    offer: LS.get("so_draft", null) || blankOffer()
  };
  var pro = false;

  function isPro() { return pro; }
  function persist() { LS.set("so_seller", state.seller); LS.set("so_draft", state.offer); }

  // ---------- calculations ----------
  function calc() {
    var groups = {}, net = 0, lines = [];
    state.offer.items.forEach(function (it) {
      var n = round2(num(it.qty) * num(it.price));
      var v = state.seller.vatExempt ? "zw" : it.vat;
      net += n; groups[v] = (groups[v] || 0) + n;
      lines.push({ it: it, net: n, vat: v });
    });
    var vatTotal = 0, vatRows = [];
    Object.keys(groups).forEach(function (k) {
      var rate = k === "zw" ? 0 : num(k);
      var amt = round2(groups[k] * rate / 100);
      vatTotal += amt; vatRows.push({ rate: k, net: round2(groups[k]), vat: amt });
    });
    net = round2(net); vatTotal = round2(vatTotal);
    return { lines: lines, net: net, vat: vatTotal, gross: round2(net + vatTotal), vatRows: vatRows };
  }

  // ---------- preview ----------
  function nl(s) { return esc(s); }
  function renderPreview() {
    var o = state.offer, s = state.seller, c = calc();
    var logo = isPro() ? LS.get("so_logo", "") : "";
    var valid = num(o.validDays) > 0 ? fmtDate(addDays(o.date, Math.round(num(o.validDays)))) : "";
    var h = "";
    h += '<div class="p-head"><div class="p-seller">' +
      (logo ? '<img class="p-logo" alt="" src="' + esc(logo) + '">' : "") +
      "<b>" + (esc(s.name) || '<span class="muted">Nazwa Twojej firmy</span>') + "</b><br>" +
      (s.address ? esc(s.address) + "<br>" : "") +
      (s.nip ? "NIP " + esc(s.nip) + "<br>" : "") +
      [s.phone, s.email].filter(Boolean).map(esc).join(" · ") +
      '</div><div class="p-title"><h1>Oferta</h1><div>nr ' + (esc(o.number) || "—") + "<br>z dnia " + fmtDate(o.date) +
      (valid ? "<br>ważna do " + valid : "") + "</div></div></div>";

    h += '<div class="p-parties"><div><h3>Sprzedawca</h3>' + (esc(s.name) || "—") + "</div><div><h3>Nabywca</h3>" +
      (o.client.name ? "<b>" + esc(o.client.name) + "</b><br>" : '<span class="muted">Nazwa klienta</span><br>') +
      (o.client.address ? esc(o.client.address) + "<br>" : "") +
      (o.client.nip ? "NIP " + esc(o.client.nip) + "<br>" : "") +
      (o.client.contact ? "Kontakt: " + esc(o.client.contact) : "") + "</div></div>";

    if (o.title) h += '<div class="p-subject">' + esc(o.title) + "</div>";

    h += '<table class="p-items"><thead><tr><th>Lp.</th><th>Opis</th><th class="r">Ilość</th><th>J.m.</th><th class="r">Cena netto</th><th class="r">VAT</th><th class="r">Wartość netto</th></tr></thead><tbody>';
    c.lines.forEach(function (l, i) {
      h += "<tr><td>" + (i + 1) + '</td><td class="desc">' + (nl(l.it.desc) || '<span class="muted">—</span>') + '</td><td class="r">' + esc(l.it.qty) +
        "</td><td>" + esc(l.it.unit) + '</td><td class="r">' + money(num(l.it.price)) + '</td><td class="r">' + (l.vat === "zw" ? "zw." : esc(l.vat) + "%") +
        '</td><td class="r">' + money(l.net) + "</td></tr>";
    });
    h += "</tbody></table>";

    h += '<div class="p-sum"><div><span>Razem netto</span><span>' + money(c.net) + "</span></div>";
    c.vatRows.forEach(function (r) {
      if (r.rate === "zw") return;
      h += "<div><span>VAT " + esc(r.rate) + "%</span><span>" + money(r.vat) + "</span></div>";
    });
    h += '<div class="gross"><span>' + (s.vatExempt ? "Do zapłaty" : "Razem brutto") + "</span><span>" + money(c.gross) + "</span></div></div>";

    var terms = [["Termin realizacji", o.delivery], ["Płatność", o.payment], ["Gwarancja", o.warranty], ["Numer konta", s.bank]].filter(function (t) { return t[1]; });
    if (terms.length) h += '<dl class="p-terms">' + terms.map(function (t) { return "<dt>" + t[0] + "</dt><dd>" + esc(t[1]) + "</dd>"; }).join("") + "</dl>";
    if (o.notes) h += '<div class="p-notes">' + nl(o.notes) + "</div>";
    if (s.vatExempt) h += '<div class="p-small">Sprzedawca zwolniony podmiotowo z VAT na podstawie art. 113 ust. 1 ustawy o podatku od towarów i usług.</div>';
    h += '<div class="p-foot"><span>' + (esc(s.name) || "") + "</span><span>" + (isPro() ? "" : "Wygenerowano w Szybkiej Ofercie — wersja demo") + "</span></div>";
    $("#sheet").innerHTML = h;
  }

  // ---------- form binding ----------
  function getPath(path) {
    var p = path.split("."), o = state; for (var i = 0; i < p.length; i++) { o = o[p[i]]; if (o == null) return ""; } return o;
  }
  function setPath(path, val) {
    var p = path.split("."), o = state; for (var i = 0; i < p.length - 1; i++) o = o[p[i]]; o[p[p.length - 1]] = val;
  }
  function fillForm() {
    document.querySelectorAll("[data-b]").forEach(function (el) {
      var v = getPath(el.getAttribute("data-b"));
      if (el.type === "checkbox") el.checked = !!v; else el.value = v;
    });
    renderRows(); renderChips(); renderLogoNote();
  }
  $("#form").addEventListener("input", function (e) {
    var el = e.target, b = el.getAttribute("data-b");
    if (b) {
      setPath(b, el.type === "checkbox" ? el.checked : el.value);
    } else if (el.hasAttribute("data-f")) {
      var row = el.closest(".row"), it = state.offer.items.find(function (x) { return x.id === row.dataset.id; });
      if (it) { it[el.getAttribute("data-f")] = el.value; row.classList.toggle("noprice", !num(it.price) && !!it.desc); }
    } else return;
    persist(); renderPreview();
  });
  $("#form").addEventListener("change", function (e) { if (e.target.id === "logoFile") onLogo(e.target); });

  // ---------- rows ----------
  var VATS = ["23", "8", "5", "0", "zw"];
  function renderRows() {
    var wrap = $("#rows"); wrap.innerHTML = "";
    state.offer.items.forEach(function (it) {
      var d = document.createElement("div");
      d.className = "row" + (!num(it.price) && it.desc ? " noprice" : ""); d.dataset.id = it.id;
      d.innerHTML =
        '<label class="c-qty">Ilość<input data-f="qty" inputmode="decimal" value="' + esc(it.qty) + '"></label>' +
        '<label class="c-unit">J.m.<input data-f="unit" list="units" value="' + esc(it.unit) + '"></label>' +
        '<label class="c-price">Cena netto, zł<input data-f="price" inputmode="decimal" value="' + esc(it.price) + '"></label>' +
        '<label class="c-vat">VAT<select data-f="vat">' + VATS.map(function (v) { return '<option value="' + v + '"' + (v === it.vat ? " selected" : "") + ">" + (v === "zw" ? "zw." : v + "%") + "</option>"; }).join("") + "</select></label>" +
        '<label class="c-desc">Opis<textarea rows="2" data-f="desc">' + esc(it.desc) + "</textarea></label>" +
        '<div class="c-act"><button type="button" data-act="lib">Zapisz w bibliotece</button><button type="button" data-act="del">Usuń</button></div>';
      wrap.appendChild(d);
    });
  }
  $("#rows").addEventListener("click", function (e) {
    var act = e.target.getAttribute("data-act"); if (!act) return;
    var row = e.target.closest(".row"), id = row.dataset.id;
    var it = state.offer.items.find(function (x) { return x.id === id; });
    if (act === "del") {
      state.offer.items = state.offer.items.filter(function (x) { return x.id !== id; });
      if (!state.offer.items.length) state.offer.items.push(newItem());
      renderRows(); persist(); renderPreview();
    } else if (act === "lib") {
      if (!isPro()) { toast("Biblioteka pozycji jest w wersji Pro."); return; }
      if (!it.desc.trim()) { toast("Najpierw wpisz opis pozycji."); return; }
      var lib = LS.get("so_lib", []); lib.push({ desc: it.desc, unit: it.unit, price: it.price, vat: it.vat });
      LS.set("so_lib", lib); renderChips(); toast("Pozycja zapisana w bibliotece.");
    }
  });
  $("#addRow").addEventListener("click", function () {
    state.offer.items.push(newItem()); renderRows(); persist(); renderPreview();
    var tas = document.querySelectorAll('#rows textarea'); tas[tas.length - 1].focus();
  });

  var sel = $("#industry");
  Object.keys(INDUSTRIES).forEach(function (k) { var o = document.createElement("option"); o.value = k; o.textContent = INDUSTRIES[k].name; sel.appendChild(o); });
  sel.value = industry;
  sel.addEventListener("change", function () { industry = sel.value; LS.set("so_industry", industry); renderChips(); });
  function renderChips() {
    var wrap = $("#chips"); wrap.innerHTML = "";
    var all = INDUSTRIES[industry].chips.concat(isPro() ? LS.get("so_lib", []) : []);
    all.forEach(function (c, i) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = c.desc.length > 34 ? c.desc.slice(0, 33) + "…" : c.desc;
      b.title = c.desc; b.addEventListener("click", function () {
        var last = state.offer.items[state.offer.items.length - 1];
        var blank = last && !last.desc && !num(last.price);
        if (blank) { last.desc = c.desc; last.unit = c.unit || last.unit; if (c.price) last.price = c.price; if (c.vat) last.vat = c.vat; }
        else state.offer.items.push(newItem(c));
        renderRows(); persist(); renderPreview();
      });
      wrap.appendChild(b);
    });
  }

  // ---------- logo (Pro) ----------
  function renderLogoNote() {
    $("#logoNote").textContent = isPro() ? (LS.get("so_logo", "") ? "Logo zapisane w tej przeglądarce." : "Wybierz plik PNG lub JPG.") : "Logo jest w wersji Pro.";
    $("#logoFile").disabled = !isPro(); $("#logoClear").hidden = !(isPro() && LS.get("so_logo", ""));
  }
  function onLogo(input) {
    var f = input.files && input.files[0]; if (!f || !isPro()) return;
    var img = new Image(), url = URL.createObjectURL(f);
    img.onload = function () {
      var max = 400, sc = Math.min(1, max / img.width), cv = document.createElement("canvas");
      cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      if (LS.set("so_logo", cv.toDataURL("image/png"))) { renderLogoNote(); renderPreview(); toast("Logo dodane."); }
      else toast("Nie udało się zapisać logo — plik jest za duży.");
    };
    img.onerror = function () { toast("Nie można odczytać tego pliku jako obrazu."); };
    img.src = url;
  }
  $("#logoClear").addEventListener("click", function () { try { localStorage.removeItem("so_logo"); } catch (e) {} renderLogoNote(); renderPreview(); });

  // ---------- actions ----------
  $("#btnPrint").addEventListener("click", function () { window.print(); });

  $("#btnNew").addEventListener("click", function () {
    if (!confirm("Zacząć nową ofertę? Niezapisane zmiany w tej ofercie znikną.")) return;
    state.offer = blankOffer(); fillForm(); persist(); renderPreview(); toast("Nowa oferta gotowa.");
  });

  $("#btnCopy").addEventListener("click", function () {
    var o = state.offer, s = state.seller, c = calc(), t = [];
    t.push("OFERTA nr " + o.number + " z dnia " + fmtDate(o.date));
    if (o.title) t.push(o.title);
    t.push("");
    c.lines.forEach(function (l, i) {
      t.push((i + 1) + ". " + l.it.desc.replace(/\s*\n\s*/g, " ") + " — " + l.it.qty + " " + l.it.unit + " × " + money(num(l.it.price)) + " = " + money(l.net));
    });
    t.push("");
    t.push("Razem netto: " + money(c.net));
    if (!s.vatExempt) { t.push("VAT: " + money(c.vat)); t.push("Razem brutto: " + money(c.gross)); }
    else t.push("Sprzedawca zwolniony z VAT (art. 113 ust. 1).");
    if (o.delivery) t.push("Termin realizacji: " + o.delivery);
    if (o.payment) t.push("Płatność: " + o.payment);
    if (o.warranty) t.push("Gwarancja: " + o.warranty);
    if (num(o.validDays) > 0) t.push("Oferta ważna do: " + fmtDate(addDays(o.date, Math.round(num(o.validDays)))));
    if (o.notes) { t.push(""); t.push(o.notes); }
    t.push(""); t.push([s.name, s.phone, s.email].filter(Boolean).join(", "));
    var text = t.join("\n");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast("Skopiowano. Wklej do wiadomości."); }, function () { toast("Nie udało się skopiować — przeglądarka zablokowała schowek."); });
    } else toast("Ta przeglądarka nie pozwala kopiować automatycznie.");
  });

  // ---------- saved offers ----------
  function history() { return LS.get("so_history", []); }
  function renderSaved() {
    var list = history(), box = $("#savedList");
    if (!list.length) { box.innerHTML = '<p>Brak zapisanych ofert. Kliknij „Zapisz bieżącą ofertę”.</p>'; }
    else box.innerHTML = list.map(function (o) {
      var save = JSON.parse(JSON.stringify(o)); var tot = 0;
      o.items.forEach(function (it) { var n = num(it.qty) * num(it.price); tot += n * (1 + (it.vat === "zw" ? 0 : num(it.vat)) / 100); });
      return '<div class="saved-row"><b>' + esc(o.number) + " · " + esc(o.client.name || "bez nazwy klienta") + '</b><span class="acts"><button type="button" data-open="' + esc(o.id) + '">Otwórz</button><button type="button" data-del="' + esc(o.id) + '">Usuń</button></span><small>' + fmtDate(o.date) + (o.title ? " · " + esc(o.title) : "") + "</small></div>";
    }).join("");
    if (!isPro()) box.insertAdjacentHTML("beforeend", '<p><small>Wersja demo zapisuje do ' + FREE_LIMIT + " ofert (zajęte: " + list.length + ").</small></p>");
  }
  $("#btnSaved").addEventListener("click", function () { renderSaved(); $("#dlgSaved").showModal(); });
  $("#savedList").addEventListener("click", function (e) {
    var open = e.target.getAttribute("data-open"), del = e.target.getAttribute("data-del"), list = history();
    if (open) {
      var o = list.find(function (x) { return x.id === open; });
      if (o) { state.offer = JSON.parse(JSON.stringify(o)); fillForm(); persist(); renderPreview(); $("#dlgSaved").close(); toast("Oferta otwarta."); }
    } else if (del) {
      if (!confirm("Usunąć tę ofertę na stałe?")) return;
      LS.set("so_history", list.filter(function (x) { return x.id !== del; })); renderSaved();
    }
  });
  $("#btnSave").addEventListener("click", function () {
    var list = history(), o = state.offer, idx = list.findIndex(function (x) { return x.id === o.id; });
    if (idx === -1 && !isPro() && list.length >= FREE_LIMIT) { toast("Limit wersji demo: " + FREE_LIMIT + " oferty. Usuń starą lub odblokuj Pro."); return; }
    var copy = JSON.parse(JSON.stringify(o));
    if (idx === -1) {
      list.unshift(copy);
      var c = LS.get("so_counter", 0) || 0;
      if (o.number === fmtNumber(c + 1)) LS.set("so_counter", c + 1);
    } else list[idx] = copy;
    if (LS.set("so_history", list)) { toast("Oferta zapisana."); renderSaved(); } else toast("Nie udało się zapisać — pamięć przeglądarki jest pełna.");
  });
  $("#btnExport").addEventListener("click", function () {
    if (!isPro()) { toast("Kopia zapasowa jest w wersji Pro."); return; }
    var data = { seller: state.seller, history: history(), lib: LS.get("so_lib", []), counter: LS.get("so_counter", 0) };
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = "szybka-oferta-kopia-" + todayISO() + ".json"; document.body.appendChild(a); a.click(); a.remove();
  });
  $("#importFile").addEventListener("change", function (e) {
    var f = e.target.files[0]; if (!f) return;
    if (!isPro()) { toast("Wczytywanie kopii jest w wersji Pro."); e.target.value = ""; return; }
    var r = new FileReader();
    r.onload = function () {
      try {
        var d = JSON.parse(r.result);
        if (!d || typeof d !== "object" || !Array.isArray(d.history)) throw new Error("bad");
        if (!confirm("Wczytać kopię? Zastąpi zapisane oferty i dane firmy w tej przeglądarce.")) return;
        LS.set("so_history", d.history); LS.set("so_lib", Array.isArray(d.lib) ? d.lib : []); LS.set("so_counter", +d.counter || 0);
        if (d.seller && typeof d.seller === "object") { Object.assign(state.seller, d.seller); }
        persist(); fillForm(); renderPreview(); renderSaved(); toast("Kopia wczytana.");
      } catch (err) { toast("To nie jest plik kopii Szybkiej Oferty."); }
    };
    r.readAsText(f); e.target.value = "";
  });

  // ---------- Pro ----------
  function sha256(str) {
    if (!(window.crypto && crypto.subtle)) return Promise.reject(new Error("no-crypto"));
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return pad(b.toString(16), 2); }).join("");
    });
  }
  function validHash(h) { return (CFG.licenseHashes || []).indexOf(h) !== -1; }
  function applyProState() {
    $("#btnPro").textContent = pro ? "Wersja Pro" : "Wersja demo";
    $("#proStatus").textContent = pro ? "Wersja Pro jest odblokowana w tej przeglądarce." : "Teraz używasz wersji demo.";
    var buy = $("#proBuy");
    if (CFG.checkoutUrl) buy.href = CFG.checkoutUrl;
    else buy.href = "mailto:" + (CFG.contactEmail || "") + "?subject=" + encodeURIComponent("Kod Pro — Szybka Oferta");
    buy.textContent = "Kup kod Pro" + (CFG.price ? " (" + CFG.price + ")" : "");
    renderChips(); renderLogoNote(); renderPreview();
  }
  $("#btnPro").addEventListener("click", function () { $("#proMsg").textContent = ""; $("#dlgPro").showModal(); });
  $("#proApply").addEventListener("click", function () {
    var code = $("#proCode").value.trim().toUpperCase(), msg = $("#proMsg");
    if (!code) { msg.textContent = "Wpisz kod z wiadomości e-mail."; return; }
    sha256(code).then(function (h) {
      if (validHash(h)) { LS.set("so_pro", h); pro = true; msg.textContent = "Kod przyjęty. Wersja Pro odblokowana."; applyProState(); }
      else msg.textContent = "Ten kod nie pasuje. Sprawdź, czy nie ma literówki.";
    }, function () { msg.textContent = "Ta przeglądarka nie obsługuje weryfikacji kodu. Otwórz stronę przez https."; });
  });
  var savedHash = LS.get("so_pro", "");
  if (savedHash && validHash(savedHash)) pro = true;

  // ---------- start ----------
  fillForm(); applyProState();
})();
