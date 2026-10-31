/* Rekenmodule huishoudboekje. Geen DOM, werkt in browser en Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Calc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var PERSONS = ['MATS', 'SOFIE', 'SAMEN'];
  var OWNER = { MATS: 'Mats', SOFIE: 'Sofie' };
  var JOINT = 'Gezamenlijk';

  function weight(r, p) {
    var m = +r.Aandeel_Mats || 0, s = +r.Aandeel_Sofie || 0;
    return p === 'MATS' ? m : p === 'SOFIE' ? s : m + s;
  }
  function makeCtx(data) {
    var typ = {}, own = {}, acc = {};
    (data.categorieen || []).forEach(function (c) { typ[c.Categorie] = String(c.Type || '').toLowerCase(); });
    (data.rekeningen || []).forEach(function (a) { own[a.Rekening_ID] = a.Eigenaar; acc[a.Rekening_ID] = a; });
    return { typ: typ, own: own, acc: acc, data: data };
  }
  function typeOf(ctx, cat) { return ctx.typ[cat] || 'uitgave'; }
  function ym(d) { return String(d).slice(0, 7); }

  /* Rijen met effectief bedrag voor persoon p, neutrale categorieen eruit */
  function rowsFor(ctx, p, filter) {
    var out = [];
    ctx.data.transacties.forEach(function (r) {
      var t = typeOf(ctx, r.Categorie);
      if (t === 'neutraal') return;
      var w = weight(r, p);
      if (!w) return;
      if (filter && !filter(r)) return;
      out.push({ r: r, t: t, a: r.Bedrag * w, m: ym(r.Datum) });
    });
    return out;
  }
  function metrics(rows, structOnly) {
    var inc = 0, incS = 0, exp = 0, sav = 0, res = 0, struct = 0, once = 0;
    rows.forEach(function (x) {
      if (structOnly && x.r.Eenmalig) return;
      if (x.t === 'inkomen') { inc += x.a; if (!x.r.Eenmalig) incS += x.a; }
      else if (x.t === 'uitgave') exp += x.a;
      else if (x.t === 'sparen') sav += x.a;
      res += x.a;
      if (!x.r.Eenmalig) struct += x.a; else once += x.a;
    });
    return {
      inkomen: inc, inkomenStructureel: incS, uitgaven: exp, gespaard: -sav, resultaat: res,
      structureel: struct, eenmalig: once,
      spaarratio: inc > 0 ? -sav / inc : null,
      overschot: inc > 0 ? (inc + exp) / inc : null
    };
  }
  function inPeriod(rows, from, to) { // maanden 'YYYY-MM' inclusief
    return rows.filter(function (x) { return x.m >= from && x.m <= to; });
  }
  function months(ctx) {
    var s = {};
    ctx.data.transacties.forEach(function (r) { s[ym(r.Datum)] = 1; });
    return Object.keys(s).sort();
  }
  function prev(m) { var y = +m.slice(0, 4), mo = +m.slice(5) - 1; if (!mo) { y--; mo = 12; } return y + '-' + (mo < 10 ? '0' : '') + mo; }
  function addM(m, n) { var y = +m.slice(0, 4), mo = +m.slice(5) - 1 + n; y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12 + 1; return y + '-' + (mo < 10 ? '0' : '') + mo; }
  function range(from, to) { var o = []; for (var m = from; m <= to; m = addM(m, 1)) o.push(m); return o; }
  function lastDayOf(m) { return new Date(Date.UTC(+m.slice(0, 4), +m.slice(5), 0)).getUTCDate(); }

  /* Gebruik van een rekening: kolom Gebruik ('maandelijks' | 'af en toe'). Zonder kolom tellen
     kredietkaart, Revolut en maaltijdcheques als 'af en toe': daar is een maand zonder boeking normaal. */
  var OCCASIONAL_TYPES = /kredietkaart|revolut|maaltijdcheque/i;
  function usage(a) {
    var g = String(a.Gebruik || '').toLowerCase().replace(/[^a-z]/g, '');
    if (g === 'afentoe' || g === 'soms' || g === 'occasioneel') return 'af en toe';
    if (g === 'maandelijks') return 'maandelijks';
    return OCCASIONAL_TYPES.test((a.Type || '') + ' ' + (a.Rekening_ID || '')) ? 'af en toe' : 'maandelijks';
  }
  function active(a) { return String(a.Actief || '').toUpperCase() !== 'NEE'; }

  /* laatste transactiedatum per actieve rekening */
  function lastDates(ctx) {
    var l = {};
    (ctx.data.rekeningen || []).forEach(function (a) { if (active(a)) l[a.Rekening_ID] = null; });
    ctx.data.transacties.forEach(function (r) {
      if (r.Rekening_ID in l && (!l[r.Rekening_ID] || r.Datum > l[r.Rekening_ID])) l[r.Rekening_ID] = r.Datum;
    });
    return l;
  }
  function hasOwnAccounts(ctx, p) {
    if (p === 'SAMEN') return hasOwnAccounts(ctx, 'MATS') && hasOwnAccounts(ctx, 'SOFIE');
    return (ctx.data.rekeningen || []).some(function (a) { return a.Eigenaar === OWNER[p] && active(a); });
  }
  /* Kwaliteit van de data: laatste volledige maand, lopende maanden, rekeningen zonder recente boekingen.
     Een maand is volledig als alle zichtrekeningen tot (bijna) het einde van die maand ingeladen zijn. */
  function dataQuality(ctx) {
    var ld = lastDates(ctx), ms = months(ctx), rek = ctx.data.rekeningen || [];
    var key = rek.filter(function (a) { return /zicht/i.test(a.Type || '') && usage(a) === 'maandelijks' && active(a) && ld[a.Rekening_ID]; });
    if (!key.length) key = rek.filter(function (a) { return active(a) && ld[a.Rekening_ID]; });
    var minLast = key.map(function (a) { return ld[a.Rekening_ID]; }).sort()[0] || (ms.length ? ms[ms.length - 1] + '-28' : null);
    var maxLast = Object.keys(ld).map(function (k) { return ld[k]; }).filter(Boolean).sort().pop() || minLast;
    var lastComplete = null;
    if (minLast) { var mm = ym(minLast); lastComplete = +minLast.slice(8) >= lastDayOf(mm) - 3 ? mm : prev(mm); }
    var partial = ms.filter(function (m) { return m > lastComplete; });
    var stale = rek.filter(function (a) {
      return active(a) && usage(a) === 'maandelijks' && ld[a.Rekening_ID] && ym(ld[a.Rekening_ID]) < lastComplete;
    }).map(function (a) { return a.Naam || a.Rekening_ID; });
    var known = {}, unknown = {};
    (ctx.data.categorieen || []).forEach(function (c) { known[c.Categorie] = 1; });
    ctx.data.transacties.forEach(function (r) { if (!known[r.Categorie]) unknown[r.Categorie || '(leeg)'] = (unknown[r.Categorie || '(leeg)'] || 0) + 1; });
    return {
      stale: stale, lastDates: ld, lastComplete: lastComplete, partialMonths: partial, months: ms,
      sofieComplete: hasOwnAccounts(ctx, 'SOFIE'), maxLast: maxLast, minLast: minLast, unknownCategories: unknown
    };
  }

  function byMonth(rows, ms, structOnly) {
    return ms.map(function (m) { var x = metrics(rows.filter(function (r) { return r.m === m; }), structOnly); x.m = m; return x; });
  }
  function byCategory(rows, structOnly) {
    var o = {};
    rows.forEach(function (x) {
      if (x.t !== 'uitgave') return;
      if (structOnly && x.r.Eenmalig) return;
      o[x.r.Categorie] = (o[x.r.Categorie] || 0) + x.a;
    });
    return Object.keys(o).map(function (k) { return { cat: k, bedrag: -o[k] }; })
      .filter(function (c) { return Math.abs(c.bedrag) > 0.004; })
      .sort(function (a, b) { return b.bedrag - a.bedrag; });
  }
  /* gemiddelde per maand van een categorie over voorgaande n maanden (alleen maanden die bestaan en volledig zijn) */
  function catAvgPrev(rows, cat, month, n, validMonths) {
    var ps = [], m = month;
    for (var i = 0; i < n; i++) { m = prev(m); if (validMonths.indexOf(m) >= 0) ps.push(m); }
    if (ps.length < n) return null;
    var s = 0;
    rows.forEach(function (x) { if (x.t === 'uitgave' && x.r.Categorie === cat && ps.indexOf(x.m) >= 0) s += x.a; });
    return -s / ps.length;
  }

  /* ---------- tegenpartijen ---------- */
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  /* Namen van tegenpartijen veranderen in de tijd (bank, kaart, agent). Eerste treffer wint, volgorde telt. */
  var ALIAS = [
    [/afbetaling fiets|(vader|crelan)\b.*\bfiets|\bfiets\b.*(vader|crelan)/, 'lening fiets'],
    [/woonkrediet|intrest krediet|fintro.*krediet|aflossing krediet/, 'woonkrediet'],
    [/lening vader|rekening vader|crelan/, 'lening vader'],
    [/test achats|test aankoop/, 'test aankoop'],
    [/mobile vikings/, 'mobile vikings'],
    [/apple com|itunes/, 'apple'],
    [/hbo ?max/, 'hbo max'],
    [/frank energie/, 'frank energie'],
    [/seety ?ctech/, 'seety'],
    [/playstation|sony interactive/, 'playstation'],
    [/spotify/, 'spotify'],
    [/netflix/, 'netflix'],
    [/disney/, 'disney plus'],
    [/amazon|amzn/, 'amazon'],
    [/helan/, 'helan'],
    [/ag mobiliteit/, 'ag mobiliteit'],
    [/\blaka\b/, 'laka']
  ];
  var LOANS = { 'woonkrediet': 'Woonkrediet', 'lening vader': 'Lening vader', 'lening fiets': 'Lening fiets' };
  var STOP = /\b(sa|nv|bv|bvba|srl|sarl|ltd|inc|gmbh|belgie|belgium|nederland|ierland|luxembourg|antwerpen|berchem|brussel|etterbeek|hilversum|betaling|europese|domiciliering|overschrijving|in euro)\b/g;
  function counterparty(r) {
    var raw = norm((r.Tegenpartij || '') + ' ' + (r.Omschrijving || ''));
    for (var i = 0; i < ALIAS.length; i++) if (ALIAS[i][0].test(raw)) return ALIAS[i][1];
    var f = function (s) { return norm(String(s || '').replace(/\(.*?\)/g, ' ').replace(/[0-9]+/g, ' ')).replace(STOP, ' ').replace(/\s+/g, ' ').trim(); };
    return f(r.Tegenpartij) || f(r.Omschrijving);
  }
  /* Toonbare naam: zonder haakjes en zonder rekening- of referentienummers */
  function cleanName(s) {
    return String(s || '').replace(/\(.*?\)/g, ' ').replace(/\b[A-Z]{2}\d{2}[\d ]*\b/g, ' ').replace(/[\d][\d\-\/. ]{2,}\d/g, ' ')
      .replace(/\s+/g, ' ').replace(/[\s,;:-]+$/, '').trim() || 'Onbekend';
  }
  function isLoan(key) { return !!LOANS[key]; }

  /* Terugkerende uitgaven: zelfde tegenpartij in minstens minMonths verschillende maanden met een stabiel
     maandbedrag (laatste 3 maanden, spreiding t.o.v. mediaan). 'actief' = betaald in de laatste of voorlaatste maand
     van de reeks. Leningen apart via isLoan. */
  var NOT_FIXED = { 'Boodschappen': 1, 'Horeca & delivery': 1, 'Shopping & aankopen': 1, 'Reizen': 1, 'Vrije tijd & events': 1, 'Persoonlijke verzorging': 1, 'Varia': 1 };
  function median(a) { var s = a.slice().sort(function (x, y) { return x - y; }), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; }
  function recurring(rows, minMonths, lastMonth) {
    var g = {};
    rows.forEach(function (x) {
      if (x.t !== 'uitgave' || x.r.Eenmalig || NOT_FIXED[x.r.Categorie]) return;
      var k = counterparty(x.r); if (!k) return;
      (g[k] = g[k] || []).push(x);
    });
    var out = [];
    Object.keys(g).forEach(function (k) {
      var xs = g[k], tot = {}, cats = {};
      xs.forEach(function (x) { tot[x.m] = (tot[x.m] || 0) - x.a; cats[x.r.Categorie] = (cats[x.r.Categorie] || 0) - x.a; });
      var mk = Object.keys(tot).sort();
      if (mk.length < (minMonths || 3)) return;
      var last3 = mk.slice(-3).map(function (m) { return tot[m]; }), med = median(last3);
      if (med < 1) return;
      var tol = isLoan(k) ? 0.5 : 0.25;
      if (last3.filter(function (v) { return Math.abs(v - med) <= tol * med; }).length < 2) return;
      var laatste = mk[mk.length - 1];
      var cat = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; })[0];
      var avg = med;
      var naam = LOANS[k] || xs[xs.length - 1].r.Tegenpartij || xs[xs.length - 1].r.Omschrijving;
      out.push({
        key: k, naam: cleanName(naam), cat: cat, perMaand: avg, perJaar: avg * 12,
        maanden: mk.length, laatste: laatste, lening: isLoan(k), abonnement: cat === 'Abonnementen',
        actief: !lastMonth || laatste >= prev(lastMonth)
      });
    });
    return out.sort(function (a, b) { return b.perMaand - a.perMaand; });
  }
  function topCounterparties(rows, n) {
    var g = {};
    rows.forEach(function (x) {
      if (x.t !== 'uitgave') return;
      var k = counterparty(x.r); if (!k) return;
      var o = g[k] = g[k] || { key: k, naam: LOANS[k] || cleanName(x.r.Tegenpartij || x.r.Omschrijving), bedrag: 0, aantal: 0 };
      o.bedrag -= x.a; o.aantal++;
    });
    return Object.keys(g).map(function (k) { return g[k]; }).filter(function (o) { return o.bedrag > 0.004; })
      .sort(function (a, b) { return b.bedrag - a.bedrag; }).slice(0, n || 8);
  }
  function largest(rows, n) {
    return rows.filter(function (x) { return x.t === 'uitgave' && x.a < 0; }).sort(function (a, b) { return a.a - b.a; }).slice(0, n || 8)
      .map(function (x) { return { datum: x.r.Datum, naam: cleanName(x.r.Tegenpartij || x.r.Omschrijving), cat: x.r.Categorie, bedrag: -x.a, eenmalig: !!x.r.Eenmalig }; });
  }

  /* Waar ging het inkomen heen: vaste lasten (terugkerend), variabel, eenmalig, gespaard en wat overblijft */
  function incomeFlow(rows, recKeys) {
    var vast = 0, vari = 0, eenm = 0, inc = 0, sav = 0;
    rows.forEach(function (x) {
      if (x.t === 'inkomen') inc += x.a;
      else if (x.t === 'sparen') sav -= x.a;
      else if (x.t === 'uitgave') {
        var a = -x.a;
        if (x.r.Eenmalig) eenm += a; else if (recKeys[counterparty(x.r)]) vast += a; else vari += a;
      }
    });
    return { inkomen: inc, vast: vast, variabel: vari, eenmalig: eenm, gespaard: sav, over: inc - vast - vari - eenm - sav };
  }

  /* Uitgaven per weekdag (0 = maandag) */
  function byWeekday(rows) {
    var o = [0, 0, 0, 0, 0, 0, 0], n = [0, 0, 0, 0, 0, 0, 0];
    rows.forEach(function (x) {
      if (x.t !== 'uitgave' || x.r.Eenmalig) return;
      var d = new Date(String(x.r.Datum).slice(0, 10) + 'T12:00:00Z').getUTCDay();
      var i = (d + 6) % 7; o[i] -= x.a; n[i]++;
    });
    return o.map(function (v, i) { return { dag: i, bedrag: v, aantal: n[i] }; });
  }

  /* Samen: gedeeld (beide aandelen > 0) versus persoonlijk */
  function householdSplit(ctx, from, to) {
    var hh = 0, mats = 0, sofie = 0;
    ctx.data.transacties.forEach(function (r) {
      if (typeOf(ctx, r.Categorie) !== 'uitgave') return;
      var m = ym(r.Datum); if (m < from || m > to) return;
      var am = +r.Aandeel_Mats || 0, as = +r.Aandeel_Sofie || 0;
      if (am > 0 && as > 0) hh -= r.Bedrag * (am + as);
      else { mats -= r.Bedrag * am; sofie -= r.Bedrag * as; }
    });
    return { gedeeld: hh, mats: mats, sofie: sofie, persoonlijk: mats + sofie };
  }

  /* ---------- eerlijkheidsmeter ---------- */
  function jointIds(ctx) {
    return (ctx.data.rekeningen || []).filter(function (a) { return a.Eigenaar === JOINT; }).map(function (a) { return a.Rekening_ID; });
  }
  function daysBetween(a, b) { return Math.abs(Date.parse(a.slice(0, 10)) - Date.parse(b.slice(0, 10))) / 864e5; }
  /* Wie stortte deze storting op de gezamenlijke rekening?
     1) een overschrijving met hetzelfde bedrag vanaf een eigen rekening, hooguit 4 dagen ervoor of erna;
     2) de naam van de tegenpartij; 3) het aandeel als dat eenzijdig is. */
  var SOFIE_RX = /\bsofie\b|\bpartner\b|partnerbijdrage/, MATS_RX = /\bmats\b|persoonlijk/;
  function whoDeposited(ctx, r, transfers) {
    var cents = Math.round(r.Bedrag * 100);
    for (var i = 0; i < transfers.length; i++) {
      var t = transfers[i];
      if (!t.used && Math.round(-t.r.Bedrag * 100) === cents && daysBetween(t.r.Datum, r.Datum) <= 4) { t.used = true; return t.p; }
    }
    var s = norm((r.Tegenpartij || '') + ' ' + (r.Omschrijving || ''));
    if (SOFIE_RX.test(s)) return 'SOFIE';
    if (MATS_RX.test(s)) return 'MATS';
    var am = +r.Aandeel_Mats || 0, as = +r.Aandeel_Sofie || 0;
    if (am > 0 && !as) return 'MATS';
    if (as > 0 && !am) return 'SOFIE';
    return '?';
  }
  /* Iedereen zijn stortingen tegenover zijn eigen aandeel (Bedrag x Aandeel) in de kosten van de gezamenlijke rekening. */
  function fairness(ctx, from, to) {
    var ids = jointIds(ctx), isJoint = {}, dep = { MATS: 0, SOFIE: 0, '?': 0 }, share = { MATS: 0, SOFIE: 0 }, costs = 0;
    ids.forEach(function (id) { isJoint[id] = 1; });
    var transfers = [];
    ctx.data.transacties.forEach(function (r) {
      if (isJoint[r.Rekening_ID] || !(r.Bedrag < 0) || typeOf(ctx, r.Categorie) !== 'neutraal') return;
      var o = ctx.own[r.Rekening_ID], p = o === OWNER.MATS ? 'MATS' : o === OWNER.SOFIE ? 'SOFIE' : null;
      if (p) transfers.push({ r: r, p: p });
    });
    ctx.data.transacties.forEach(function (r) {
      if (!isJoint[r.Rekening_ID]) return;
      var m = ym(r.Datum); if (m < from || m > to) return;
      var t = typeOf(ctx, r.Categorie);
      if (t === 'neutraal') { if (r.Bedrag > 0 && /gezamenlijk/i.test(r.Categorie)) dep[whoDeposited(ctx, r, transfers)] += r.Bedrag; return; }
      if (r.Bedrag >= 0) return;
      costs -= r.Bedrag;
      share.MATS -= r.Bedrag * (+r.Aandeel_Mats || 0);
      share.SOFIE -= r.Bedrag * (+r.Aandeel_Sofie || 0);
    });
    return {
      stortingen: dep, kosten: costs, aandeel: share,
      saldo: { MATS: dep.MATS - share.MATS, SOFIE: dep.SOFIE - share.SOFIE }, heeftRekening: ids.length > 0
    };
  }

  /* ---------- buffer ---------- */
  /* Laatste saldo per rekening x eigen deel, gedeeld door de gemiddelde niet-eenmalige uitgaven per maand
     over de laatste n volledige maanden. Spaarrekeningen staan niet in het blad en tellen dus niet mee. */
  function buffer(ctx, p, lastComplete, n) {
    var last = {};
    (ctx.data.saldi || []).forEach(function (s) {
      if (!last[s.Rekening_ID] || s.Datum > last[s.Rekening_ID].Datum) last[s.Rekening_ID] = s;
    });
    var tot = 0, dates = [], parts = [];
    Object.keys(last).forEach(function (id) {
      var own = ctx.own[id], f;
      if (own === JOINT) f = p === 'SAMEN' ? 1 : 0.5;
      else f = p === 'SAMEN' ? (own === OWNER.MATS || own === OWNER.SOFIE ? 1 : 0) : own === OWNER[p] ? 1 : 0;
      if (!f) return;
      var a = ctx.acc[id];
      if (a && /spaar|beleg/i.test(a.Type || '')) return;
      tot += last[id].Saldo * f; dates.push(last[id].Datum); parts.push({ id: id, naam: a ? a.Naam : id, saldo: last[id].Saldo * f, datum: last[id].Datum });
    });
    if (!dates.length) return null;
    n = n || 3;
    var from = addM(lastComplete, -(n - 1));
    var spend = -metrics(inPeriod(rowsFor(ctx, p), from, lastComplete), true).uitgaven / n;
    dates.sort();
    return { saldo: tot, datum: dates[0], tot: dates[dates.length - 1], perMaand: spend, maanden: spend > 0 ? tot / spend : null, rekeningen: parts };
  }

  /* ---------- notities over de data ---------- */
  /* level 'alert' = echte onderbreking, 'note' = aandachtspunt, 'foot' = voetnoot (enkel in Dataoverzicht) */
  function notes(ctx, dq, view, from, to) {
    var o = [];
    if (dq.stale.length) o.push({ level: 'note', id: 'stale', text: dq.stale.join(', ') + ': geen boekingen in ' + monthNameNl(dq.lastComplete) + '. Gebruik je die rekening nog maandelijks, dan ontbreken er uitgaven. Zet anders Gebruik op "af en toe" in Rekeningen.' });
    if ((view === 'SOFIE' || view === 'SAMEN') && !dq.sofieComplete) o.push({ level: 'note', id: 'sofie', text: 'Sofie heeft nog geen eigen rekeningen in het blad. Haar cijfers komen enkel van de gezamenlijke rekening en gedeelde kaartbetalingen.' });
    var unk = Object.keys(dq.unknownCategories || {});
    if (unk.length) o.push({ level: 'note', id: 'cat', text: 'Onbekende categorie in Transacties: ' + unk.join(', ') + '. Die rijen tellen als uitgave. Voeg ze toe aan Categorieen.' });
    if (from <= '2026-04' && to >= '2026-03') {
      var varia = ctx.data.transacties.some(function (r) { var m = ym(r.Datum); return (m === '2026-03' || m === '2026-04') && r.Categorie === 'Varia' && /beobank/i.test((r.Tegenpartij || '') + ' ' + (r.Omschrijving || '') + ' ' + (r.Nota || '')); });
      if (varia) o.push({ level: 'foot', id: 'beobank', text: 'Maart en april: de afrekeningen van de Beobank-kaart staan onder Varia, niet per categorie.' });
    }
    var shares = ctx.data.transacties.filter(function (r) { var m = ym(r.Datum); return m >= from && m <= to && typeOf(ctx, r.Categorie) === 'neutraal' && r.Bedrag > 0 && /aandelen|computershare|\bspp\b/i.test((r.Tegenpartij || '') + ' ' + (r.Omschrijving || '')) && weight(r, view) > 0; });
    if (shares.length) o.push({ level: 'foot', id: 'aandelen', text: 'Opbrengst uit aandelen staat als Interne overdracht en telt niet mee in inkomen of resultaat.' });
    var bike = recurring(rowsFor(ctx, view), 3, null).filter(function (r) { return r.key === 'lening fiets'; })[0];
    if (bike && bike.laatste >= from && bike.laatste < to) o.push({ level: 'foot', id: 'fiets', text: 'De lening voor de fiets is afbetaald (laatste betaling ' + monthNameNl(bike.laatste) + '). Je vaste lasten zakken daardoor met ongeveer ' + Math.round(bike.perMaand) + ' euro per maand.' });
    return o;
  }
  var MN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  function monthNameNl(m) { return m ? MN[+m.slice(5) - 1] : '?'; }

  return {
    PERSONS: PERSONS, OWNER: OWNER, weight: weight, makeCtx: makeCtx, typeOf: typeOf, rowsFor: rowsFor, metrics: metrics,
    inPeriod: inPeriod, months: months, lastDates: lastDates, dataQuality: dataQuality, prev: prev, addM: addM, range: range,
    byMonth: byMonth, byCategory: byCategory, catAvgPrev: catAvgPrev, recurring: recurring, isLoan: isLoan, usage: usage,
    topCounterparties: topCounterparties, largest: largest, householdSplit: householdSplit, fairness: fairness,
    counterparty: counterparty, incomeFlow: incomeFlow, byWeekday: byWeekday, buffer: buffer, notes: notes,
    hasOwnAccounts: hasOwnAccounts, cleanName: cleanName, jointIds: jointIds, median: median
  };
});
