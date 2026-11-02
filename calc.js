/* Rekenmodule huishoudboekje. Geen DOM, werkt in browser en Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Calc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var PERSONS = ['MATS', 'SOFIE', 'SAMEN'];
  var OWNER = { MATS: 'Mats', SOFIE: 'Sofie' };
  var JOINT_CAT = 'Overdracht gezamenlijke rekening', CONTRIB_CAT = 'Bijdrage gezamenlijke rekening';
  var JOINT = 'Gezamenlijk';

  function weight(r, p) {
    var m = +r.Aandeel_Mats || 0, s = +r.Aandeel_Sofie || 0;
    return p === 'MATS' ? m : p === 'SOFIE' ? s : m + s;
  }
  function makeCtx(data) {
    var typ = {}, own = {}, acc = {};
    (data.categorieen || []).forEach(function (c) { typ[c.Categorie] = String(c.Type || '').toLowerCase(); });
    (data.rekeningen || []).forEach(function (a) { own[a.Rekening_ID] = a.Eigenaar; acc[a.Rekening_ID] = a; });
    /* Loon naar de volgende maand schuiven staat standaard aan; 'NEE' bij ALLE.LOON_VERSCHUIVEN zet het af */
    var lv = (data.instellingen || []).filter(function (x) { return x.Sleutel === 'ALLE.LOON_VERSCHUIVEN'; })[0];
    return { typ: typ, own: own, acc: acc, data: data, loonVerschuiven: !(lv && /^n/i.test(String(lv.Waarde))) };
  }
  function isCommon(ctx, id) {
    var a = ctx.acc[id];
    return ctx.own[id] === JOINT || (!!a && /krediet/i.test(a.Type || ''));
  }
  function typeOf(ctx, cat) { return ctx.typ[cat] || 'uitgave'; }
  function ym(d) { return String(d).slice(0, 7); }

  /* Rijen met effectief bedrag voor persoon p. Vier groepen volgens Categorieen.Type: inkomen, uitgave, sparen
     en neutraal; neutraal (o.a. Interne overdracht, kaartafrekeningen) telt nergens mee.
     Samen = enkel de gemeenschappelijke potten (gezamenlijke rekening en kredietkaart), elk bedrag x (Aandeel_Mats + Aandeel_Sofie).
     Periodieke uitgaven (Reizen, VME-voorschot, kooklessen, Nota met 'periodiek' of 'geannualiseerd') worden over hun periode
     gespreid als opts.spread, zodat ze geen maandpiek geven in maandgrafieken. Zonder spread: echte bedragen op de echte datum. */
  function rowsFor(ctx, p, filter, opts) {
    var out = [], raw = !(opts && opts.spread);
    ctx.data.transacties.forEach(function (r) {
      var t = typeOf(ctx, r.Categorie), w;
      if (p === 'SAMEN') {
        if (t === 'neutraal' || !isCommon(ctx, r.Rekening_ID)) return;
        w = (+r.Aandeel_Mats || 0) + (+r.Aandeel_Sofie || 0);
      } else {
        /* Persoonlijk = enkel de eigen rekeningen en kaarten, volledig bedrag. De storting naar de gezamenlijke
           rekening is dan een eigen uitgave ('Bijdrage gezamenlijke rekening'); wat op de gezamenlijke rekening
           gebeurt, staat enkel bij Samen. */
        if (ctx.own[r.Rekening_ID] !== OWNER[p]) return;
        if (t === 'neutraal') {
          if (!(r.Categorie === JOINT_CAT && r.Bedrag < 0)) return;
          r = Object.assign({}, r, { Categorie: CONTRIB_CAT }); t = 'uitgave';
        }
        w = 1;
      }
      if (!w) return;
      if (filter && !filter(r)) return;
      var a = r.Bedrag * w, m = ym(r.Datum), n = raw || t !== 'uitgave' ? 0 : spreadMonths(r);
      /* Loon dat na de 15de binnenkomt, is het budget van de volgende maand */
      if (t === 'inkomen' && r.Categorie === 'Loon' && ctx.loonVerschuiven !== false && +String(r.Datum).slice(8, 10) >= 15) m = addM(m, 1);
      if (n > 1) for (var i = 0; i < n; i++) out.push({ r: r, t: t, a: a / n, m: addM(m, i), sp: n, si: i });
      else out.push({ r: r, t: t, a: a, m: m });
    });
    return out;
  }
  function txt(r) { return String((r.Tegenpartij || '') + ' ' + (r.Omschrijving || '') + ' ' + (r.Nota || '')).toLowerCase(); }
  /* Over hoeveel maanden een periodieke uitgave gespreid wordt (0 = niet) */
  function spreadMonths(r) {
    if (+r.Eenmalig) return 0;
    var s = txt(r), nota = String(r.Nota || '').toLowerCase();
    if (r.Categorie === 'Reizen') return 12;
    if (/\bvme\b/.test(s) && /voorschot/.test(s)) return 3;
    if (/kookles/.test(s)) return 12;
    if (/periodiek|geannualiseerd|annualiseren/.test(nota)) { var k = nota.match(/(\d+)[- ]?maand/); return k ? Math.min(36, +k[1]) : 12; }
    return 0;
  }
  function isCheck(r) { return /^\s*check\b/i.test(String(r.Nota || '')); }
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
  function daysAgo(d, today) {
    var t = today ? new Date(today) : new Date();
    return (t - new Date(String(d).slice(0, 10) + 'T00:00:00')) / 864e5;
  }
  function dataQuality(ctx) {
    var ld = lastDates(ctx), ms = months(ctx), rek = ctx.data.rekeningen || [];
    var key = rek.filter(function (a) { return /zicht/i.test(a.Type || '') && usage(a) === 'maandelijks' && active(a) && ld[a.Rekening_ID]; });
    if (!key.length) key = rek.filter(function (a) { return active(a) && ld[a.Rekening_ID]; });
    var minLast = key.map(function (a) { return ld[a.Rekening_ID]; }).sort()[0] || (ms.length ? ms[ms.length - 1] + '-28' : null);
    var maxLast = Object.keys(ld).map(function (k) { return ld[k]; }).filter(Boolean).sort().pop() || minLast;
    var lastComplete = null;
    /* Een maand loopt nooit: de laatste maand met gegevens telt als afgerond. Een rekening die achterloopt, staat bij de aandachtspunten. */
    if (maxLast) lastComplete = ym(maxLast);
    var partial = ms.filter(function (m) { return m > lastComplete; });
    var stale = rek.filter(function (a) {
      /* Pas melden als de laatste boeking meer dan een maand oud is: de gegevens komen maandelijks binnen. */
      return active(a) && usage(a) === 'maandelijks' && ld[a.Rekening_ID] && ym(ld[a.Rekening_ID]) < lastComplete && daysAgo(ld[a.Rekening_ID], ctx.data.vandaag) > 31;
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
      /* maandelijks = de laatste 3 betaalmaanden liggen telkens hoogstens 2 maanden uit elkaar (geen kwartaal- of jaarbetaling) */
      var l3 = mk.slice(-3); if (monthGap(l3[0], l3[1]) > 2 || monthGap(l3[1], l3[2]) > 2) return;
      var last3 = mk.slice(-3).map(function (m) { return tot[m]; }), med = median(last3);
      if (med < 1) return;
      var tol = isLoan(k) ? 0.5 : 0.25;
      if (last3.filter(function (v) { return Math.abs(v - med) <= tol * med; }).length < 2) return;
      var laatste = mk[mk.length - 1];
      var cat = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; })[0];
      var avg = med;
      var naam = LOANS[k] || xs[xs.length - 1].r.Tegenpartij || xs[xs.length - 1].r.Omschrijving;
      /* prijsstijging: laatste maandbedrag tegenover de mediaan van de maanden ervoor */
      var vorig = mk.length >= 3 ? median(mk.slice(0, -1).slice(-4).map(function (m) { return tot[m]; })) : null, nu = tot[laatste];
      var stijging = vorig && nu - vorig >= 1 && nu > vorig * 1.05 && nu < vorig * 2 ? nu - vorig : 0;
      out.push({
        key: k, naam: cleanName(naam), cat: cat, perMaand: avg, perJaar: avg * 12, laatsteBedrag: nu, stijging: stijging,
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

  /* ---------- bijdragen gezamenlijke rekening ---------- */
  /* Storting per persoon = positieve bedragen op de gezamenlijke rekening in 'Overdracht gezamenlijke rekening',
     toegewezen via Aandeel_Mats / Aandeel_Sofie (0/0 = niet toegewezen, apart geteld). Aandeel in de kosten =
     niet-neutrale uitgaven op de gezamenlijke rekening en de gezamenlijke kredietkaart (die wordt via de
     gezamenlijke rekening afgerekend), bedrag x aandeel. Per maand voor de grafiek. */
  function jointContrib(ctx, from, to) {
    var per = {}, tot = { dep: { MATS: 0, SOFIE: 0 }, share: { MATS: 0, SOFIE: 0 }, kosten: 0, los: 0, losBedrag: 0 };
    range(from, to).forEach(function (m) { per[m] = { m: m, dep: { MATS: 0, SOFIE: 0 }, kosten: 0 }; });
    ctx.data.transacties.forEach(function (r) {
      var m = ym(r.Datum); if (!per[m] || !isCommon(ctx, r.Rekening_ID)) return;
      var t = typeOf(ctx, r.Categorie), am = +r.Aandeel_Mats || 0, as = +r.Aandeel_Sofie || 0;
      if (r.Categorie === 'Overdracht gezamenlijke rekening' && r.Bedrag > 0 && ctx.own[r.Rekening_ID] === JOINT) {
        if (!am && !as) { tot.los++; tot.losBedrag += r.Bedrag; return; }
        per[m].dep.MATS += r.Bedrag * am; per[m].dep.SOFIE += r.Bedrag * as;
        tot.dep.MATS += r.Bedrag * am; tot.dep.SOFIE += r.Bedrag * as; return;
      }
      if (t !== 'uitgave') return;
      tot.share.MATS -= r.Bedrag * am; tot.share.SOFIE -= r.Bedrag * as;
      per[m].kosten -= r.Bedrag * (am + as); tot.kosten -= r.Bedrag * (am + as);
    });
    tot.dekking = { MATS: tot.share.MATS > 0 ? tot.dep.MATS / tot.share.MATS : null, SOFIE: tot.share.SOFIE > 0 ? tot.dep.SOFIE / tot.share.SOFIE : null };
    tot.saldo = { MATS: tot.dep.MATS - tot.share.MATS, SOFIE: tot.dep.SOFIE - tot.share.SOFIE };
    tot.maanden = Object.keys(per).sort().map(function (k) { return per[k]; });
    return tot;
  }

  /* ---------- vermogen ---------- */
  /* Laatste saldo per zichtrekening (Saldi) x eigen deel, ETF-waarde (Beleggingen) en wat ontbreekt.
     Verschil met vorige maand: saldo op of voor het einde van de vorige maand. Niets wordt verzonnen. */
  function wealth(ctx, view, asOf) {
    var parts = [], missing = [], byAcc = {}, end = (asOf || '9999-12') + '-31';
    (ctx.data.saldi || []).forEach(function (s) {
      if (String(s.Datum).slice(0, 10) > end) return; (byAcc[s.Rekening_ID] = byAcc[s.Rekening_ID] || []).push({ d: String(s.Datum).slice(0, 10), v: num_(s.Saldo) }); });
    Object.keys(byAcc).forEach(function (id) {
      var own = ctx.own[id], a = ctx.acc[id] || {}, f;
      if (view === 'SAMEN') f = own === JOINT ? 1 : 0; else f = own === OWNER[view] ? 1 : 0;
      if (!f || /krediet/i.test(a.Type || '')) return;
      var l = byAcc[id].sort(function (x, y) { return x.d < y.d ? -1 : 1; }), last = l[l.length - 1];
      var cut = prev(ym(last.d)) + '-31', pr = l.filter(function (x) { return x.d <= cut; }).pop();
      parts.push({ soort: /spaar/i.test(a.Type || '') ? 'sparen' : 'rekening', naam: a.Naam || id, v: last.v * f, vorig: pr ? pr.v * f : null, datum: last.d });
    });
    var bel = (ctx.data.beleggingen || []).filter(function (r) { return String(r.Datum).slice(0, 10) <= end; });
    var inv = view === 'SAMEN' ? null : investments({ own: ctx.own, acc: ctx.acc, typ: ctx.typ, data: { beleggingen: bel } }, view);
    if (inv) {
      var h = inv.hist || [], pv = h.length > 1 ? h[h.length - 2].v : null;
      parts.push({ soort: 'beleggen', naam: 'ETF\'s (marktwaarde)', v: inv.waarde, vorig: pv, datum: inv.datum });
    }
    /* stortingen naar sparen of beleggen zonder saldo of marktwaarde: enkel inleg bekend */
    var inleg = 0;
    rowsFor(ctx, view).forEach(function (x) { if (x.t === 'sparen' && x.m <= end.slice(0, 7)) inleg -= x.a; });
    var hasSav = parts.some(function (p) { return p.soort === 'sparen'; });
    if (inleg > 0.5 && !hasSav) missing.push({ naam: 'Spaarrekening', tekst: 'geen saldo in het blad, enkel stortingen bekend', inleg: inleg });
    var tot = parts.reduce(function (a, p) { return a + p.v; }, 0), withPrev = parts.filter(function (p) { return p.vorig != null; });
    /* Verschil op een maand: verandering van de onderdelen met een vorige stand, plus wat deze maand naar sparen of
       beleggen ging als die onderdelen (spaarrekening, ETF's) geen vorige stand hebben. Anders lijkt geld dat je
       overzet naar sparen een verlies. Koersschommelingen van ETF's zonder vorige stand tellen dan niet mee. */
    var rek = withPrev.reduce(function (a, p) { return a + p.v - p.vorig; }, 0), naarSparen = 0;
    var gaps = missing.length > 0 || parts.some(function (p) { return p.soort !== 'rekening' && p.vorig == null; });
    if (gaps) rowsFor(ctx, view).forEach(function (x) { if (x.t === 'sparen' && x.m === end.slice(0, 7)) naarSparen -= x.a; });
    return { parts: parts, missing: missing, totaal: tot, verschilRekening: rek, naarSparen: naarSparen,
      verschil: withPrev.length ? rek + naarSparen : null, zonderVorig: parts.length - withPrev.length };
  }

  /* ---------- reizen ---------- */
  /* Per reis uit de Nota-tag 'Reis: <bestemming> <maand> <jaar>' */
  function trips(rows) {
    var g = {};
    rows.forEach(function (x) {
      if (x.t !== 'uitgave') return;
      var k = String(x.r.Nota || '').match(/reis:\s*([^().,;]+?\s(?:jan|feb|maart|mrt|apr|april|mei|jun|juni|jul|juli|aug|sep|sept|okt|nov|dec)[a-z]*\.?\s\d{4})/i);
      if (!k) return;
      var key = k[1].replace(/\s+/g, ' ').trim(), o = g[key.toLowerCase()] = g[key.toLowerCase()] || { naam: key, bedrag: 0, aantal: 0 };
      o.bedrag -= x.a; o.aantal++;
    });
    return Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.bedrag - a.bedrag; });
  }
  function checkRows(rows) { var seen = [], o = []; rows.forEach(function (x) { if (isCheck(x.r) && seen.indexOf(x.r) < 0) { seen.push(x.r); o.push(x); } }); return o; }

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
      if (own === JOINT) f = p === 'SAMEN' ? 1 : 0;
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

  /* ---------- hoe vaak komt een uitgave terug ---------- */
  /* Per tegenpartij: maandelijks (herkend als vaste last), per kwartaal (ongeveer om de 3 maanden),
     jaarlijks (verzekering, taks en dergelijke, of een groot bedrag dat in de reeks maar 1 keer voorkomt
     buiten de variabele categorieen) en los (de rest: boodschappen, restaurant, winkels). */
  var YEARLY_RX = /verzeker|insurance|vivium|ethias|belasting|taks|\btax\b|spf fin|fod fin|lidgeld|jaarbijdrage|jaarabonnement|mutualiteit|helan|onderhoud ketel|keuring/;
  function monthGap(a, b) { return (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5) - +a.slice(5)); }
  /* Bedragen per maand liggen binnen 25% van elkaar (een abonnement, geen losse aankopen) */
  function similar(xs) {
    var pm = {}; xs.forEach(function (x) { pm[x.m] = (pm[x.m] || 0) - x.a; });
    var v = Object.keys(pm).map(function (k) { return pm[k]; }), mn = Math.min.apply(null, v), mx = Math.max.apply(null, v);
    return mx <= mn * 1.25 + 1;
  }
  function frequency(rows, recKeys) {
    var g = {};
    rows.forEach(function (x) {
      if (x.t !== 'uitgave' || +x.r.Eenmalig) return;
      var k = counterparty(x.r) || '?';
      (g[k] = g[k] || []).push(x);
    });
    var out = { maandelijks: 0, kwartaal: 0, jaarlijks: 0, los: 0 }, keys = {};
    Object.keys(g).forEach(function (k) {
      var xs = g[k], ms = {}, tot = 0;
      xs.forEach(function (x) { ms[x.m] = 1; tot -= x.a; });
      var mk = Object.keys(ms).sort(), kind = 'los', var_ = NOT_FIXED[xs[0].r.Categorie];
      var raw = norm((xs[0].r.Tegenpartij || '') + ' ' + (xs[0].r.Omschrijving || '') + ' ' + xs[0].r.Categorie);
      if (recKeys && recKeys[k]) kind = 'maandelijks';
      else if (!var_ && mk.length >= 3 && mk.every(function (m, i) { return !i || Math.abs(monthGap(mk[i - 1], m) - 3) <= 1; }) && similar(xs)) kind = 'kwartaal';
      else if (!var_ && YEARLY_RX.test(raw) && mk.length <= 2) kind = 'jaarlijks';
      else if (xs.some(function (x) { return /jaarlijks|jaarabonnement|per jaar/i.test(String(x.r.Nota || '')); }) && mk.length <= 2) kind = 'jaarlijks';
      if (tot < 0) kind = 'los';
      out[kind] += tot; keys[k] = kind;
    });
    out.keys = keys;
    return out;
  }
  /* Vast of vrij per maand: vast = alles wat terugkomt (maandelijks, kwartaal, jaarlijks), vrij = de rest */
  function fixedFree(rows, freqKeys, ms) {
    return ms.map(function (m) {
      var v = 0, f = 0;
      rows.forEach(function (x) {
        if (x.m !== m || x.t !== 'uitgave') return;
        var k = freqKeys[counterparty(x.r) || '?'];
        if (k && k !== 'los') v -= x.a; else f -= x.a;
      });
      return { m: m, vast: v, vrij: f };
    });
  }

  /* ---------- 50/30/20 ---------- */
  /* Nodig (50%), wens (30%), sparen en overschot (20%). Kolom Soort in Categorieen (nodig/wens) wint. */
  var NEEDS = { 'Woonkost': 1, 'Boodschappen': 1, 'Mobiliteit & parking': 1, 'Gezondheid': 1, 'Administratie & overheid': 1 };
  function needKind(ctx, cat) {
    if (cat === CONTRIB_CAT) return 'nodig';
    var c = (ctx.data.categorieen || []).filter(function (x) { return x.Categorie === cat; })[0];
    var s = c ? String(c.Soort || '').toLowerCase() : '';
    if (/nodig|behoefte|need/.test(s)) return 'nodig';
    if (/wens|want|luxe/.test(s)) return 'wens';
    return NEEDS[cat] ? 'nodig' : 'wens';
  }
  function rule503020(ctx, rows) {
    var inc = 0, nodig = 0, wens = 0, cats = { nodig: {}, wens: {} };
    rows.forEach(function (x) {
      if (x.t === 'inkomen') inc += x.a;
      else if (x.t === 'uitgave') { var k = needKind(ctx, x.r.Categorie); if (k === 'nodig') nodig -= x.a; else wens -= x.a; cats[k][x.r.Categorie] = (cats[k][x.r.Categorie] || 0) - x.a; }
    });
    return { inkomen: inc, nodig: nodig, wens: wens, sparen: inc - nodig - wens, cats: cats };
  }

  /* ---------- auto ---------- */
  /* Herkend op naam van winkel of omschrijving, want er is geen categorie Auto. */
  var CAR = [
    ['Brandstof en laden', /\b(total|totalenergies|q8|esso|shell|lukoil|dats ?24|texaco|gabriels|gulf|octa|aral|bp|allego|ionity|fastned|shell recharge|tankstation|tanken|brandstof)\b/],
    ['Onderhoud en herstel', /garage|donckers|jorssen|toyota|volkswagen|peugeot|renault|kia|hyundai|skoda|carglass|autokeuring|keuring|banden|vulco|norauto|midas|carwash|car wash|autowas|\bvab\b|touring/],
    ['Verzekering en taks', /autoverzekering|vivium|verzekering auto|omnium|verkeersbelasting|inschrijvingstaks|\bbiv\b|vlaamse belastingdienst|vlabel/],
    ['Parkeren en tol', /parking|parkeer|q ?park|interparking|indigo|seety|4411|tol |peage|vignet|arrive|stationnement/]
  ];
  function carKind(r) {
    var s = norm((r.Tegenpartij || '') + ' ' + (r.Omschrijving || '') + ' ' + (r.Nota || ''));
    for (var i = 0; i < CAR.length; i++) if (CAR[i][1].test(s)) return CAR[i][0];
    return null;
  }
  function carCosts(rows) {
    var o = {}, list = [];
    CAR.forEach(function (c) { o[c[0]] = 0; });
    rows.forEach(function (x) {
      if (x.t !== 'uitgave') return;
      var k = carKind(x.r); if (!k) return;
      o[k] -= x.a; list.push(x);
    });
    var tot = Object.keys(o).reduce(function (a, k) { return a + o[k]; }, 0);
    return { perSoort: o, totaal: tot, rows: list };
  }

  /* ---------- pockets ---------- */
  /* Tabblad Pockets: Naam, Categorieen (komma's), Bedrag (per maand), Wie (Mats, Sofie, Samen). Geen voorstel:
     de bedragen kies je zelf (of je financieel adviseur), in het blad of in het dashboard. */
  function pocketList(ctx, view) {
    return (ctx.data.pockets || []).filter(function (p) {
      var w = String(p.Wie || '').toUpperCase().trim(); return p.Naam && (w === view || (!w && view === 'SAMEN'));
    }).map(function (p) {
      return { naam: String(p.Naam), cats: String(p.Categorieen || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean), budget: num_(p.Bedrag), wie: String(p.Wie || '').trim(), jaar: /jaar/i.test(String(p.Periode || '')) };
    });
  }
  function num_(x) { if (typeof x === 'number') return x; var s = String(x == null ? '' : x).replace(/\s|€/g, ''); if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.'); return parseFloat(s) || 0; }
  /* Persoonlijke pockets tellen enkel wat van de eigen rekeningen gaat, zonder maaltijdcheques (de budgetten
     gelden bovenop de cheques). Gezamenlijke uitgaven vallen onder de pockets van Samen. */
  function pocketRows(ctx, view, rows) {
    if (view === 'SAMEN') return rows;
    return rows.filter(function (x) { var a = ctx.acc[x.r.Rekening_ID] || {}; return ctx.own[x.r.Rekening_ID] === OWNER[view] && !/maaltijd/i.test(a.Type || ''); });
  }
  function pockets(ctx, view, rows, nMonths) {
    rows = pocketRows(ctx, view, rows);
    return pocketList(ctx, view).filter(function (p) { return p.budget > 0 && p.cats.length; }).map(function (p) {
      var s = 0; rows.forEach(function (x) { if (x.t === 'uitgave' && p.cats.indexOf(x.r.Categorie) >= 0) s -= x.a; });
      p.uitgegeven = s / (nMonths || 1); return p;
    });
  }

  /* ---------- beleggingen (ETF) ---------- */
  /* Tabblad Beleggingen: een momentopname per datum en ETF (Datum, Rekening_ID, Naam, ISIN, Hoeveelheid, Koers,
     Belegde_Waarde = wat je betaalde, Huidige_Waarde). Eigenaar volgt uit Rekeningen of het voorvoegsel MATS-/SOFIE-. */
  function ownerOfAccount(ctx, id) {
    var o = ctx.own[id]; if (o) return o === OWNER.MATS ? 'MATS' : o === OWNER.SOFIE ? 'SOFIE' : 'SAMEN';
    return /^MATS/i.test(id) ? 'MATS' : /^SOFIE/i.test(id) ? 'SOFIE' : 'SAMEN';
  }
  function investments(ctx, view) {
    var rows = (ctx.data.beleggingen || []).filter(function (r) {
      return r.Datum && (r.Naam || r.ISIN) && (view === 'SAMEN' || ownerOfAccount(ctx, r.Rekening_ID || '') === view);
    });
    if (!rows.length) return null;
    var dates = {}, latest = {};
    rows.forEach(function (r) {
      var d = String(r.Datum).slice(0, 10), k = r.ISIN || r.Naam;
      (dates[d] = dates[d] || {})[k] = r;
      if (!latest[k] || d >= String(latest[k].Datum).slice(0, 10)) latest[k] = r;
    });
    var last = Object.keys(dates).sort().pop();
    var list = Object.keys(latest).filter(function (k) { return String(latest[k].Datum).slice(0, 10) === last && num_(latest[k].Hoeveelheid) !== 0; }).map(function (k) {
      var r = latest[k];
      return { naam: String(r.Naam || k), isin: r.ISIN || '', aantal: num_(r.Hoeveelheid), ingelegd: num_(r.Belegde_Waarde), waarde: num_(r.Huidige_Waarde), wie: ownerOfAccount(ctx, r.Rekening_ID || '') };
    }).sort(function (a, b) { return b.waarde - a.waarde; });
    var hist = Object.keys(dates).sort().map(function (d) {
      var s = 0, i = 0; Object.keys(dates[d]).forEach(function (k) { s += num_(dates[d][k].Huidige_Waarde); i += num_(dates[d][k].Belegde_Waarde); });
      return { d: d, v: s, ingelegd: i };
    });
    var waarde = list.reduce(function (a, e) { return a + e.waarde; }, 0), ingelegd = list.reduce(function (a, e) { return a + e.ingelegd; }, 0);
    return { list: list, datum: last, waarde: waarde, ingelegd: ingelegd, winst: waarde - ingelegd, rendement: ingelegd > 0 ? (waarde - ingelegd) / ingelegd : null, hist: hist };
  }

  /* ---------- soorten vaste kosten ---------- */
  /* Mobiliteit eerst: 'AG Mobiliteit en Parkeren' (Antwerpse parkeerdienst) is geen verzekering */
  var FIXED_TYPES = [
    ['Mobiliteit', /mobiliteit|parkeren|seety|nmbs|de lijn|velo/],
    ['Wonen en leningen', /woonkrediet|lening|hypothe|huur|syndic|krediet/],
    ['Verzekeringen', /verzeker|insurance|vivium|ethias|\bag\b|baloise|allianz|axa|dvv|laka|mutualiteit|helan|ziekenfonds/],
    ['Energie en water', /energie|engie|luminus|eneco|fluvius|water|farys|pidpa|de watergroep|elektric|gas\b|frank energie|bolt/],
    ['Telecom en internet', /proximus|telenet|orange|base\b|mobile vikings|scarlet|internet|gsm/],
    ['Abonnementen', /^$/],
    ['Bank en administratie', /bank|fintro|bnp|kbc|belfius|ing\b|bijdrage|pakketkost|doccle|fod|spf|belasting/]
  ];
  function fixedType(r) {
    if (r.abonnement) return 'Abonnementen';
    if (r.lening) return 'Wonen en leningen';
    var s = norm(r.key + ' ' + r.naam + ' ' + r.cat);
    for (var i = 0; i < FIXED_TYPES.length; i++) if (FIXED_TYPES[i][1].test(s) && FIXED_TYPES[i][0] !== 'Abonnementen') return FIXED_TYPES[i][0];
    return r.cat === 'Woonkost' ? 'Wonen en leningen' : 'Andere';
  }

  /* ---------- verwachte vaste kosten per maand ---------- */
  /* Voor de n maanden na 'from': elke maandelijkse vaste kost, de kwartaal- en jaarbetalingen in hun verwachte
     maand, en vaste bedragen uit pockets (bv. de bijdrage aan de gezamenlijke rekening). */
  function projection(rec, ups, extras, from, n) {
    var out = [];
    for (var i = 1; i <= n; i++) {
      var m = addM(from, i), items = [];
      rec.forEach(function (r) { if (r.loopt) items.push({ naam: r.naam, bedrag: r.perMaand, kind: 'maandelijks' }); });
      (extras || []).forEach(function (x) { items.push({ naam: x.naam, bedrag: x.bedrag, kind: 'maandelijks' }); });
      ups.forEach(function (u) {
        var step = u.kind === 'kwartaal' ? 3 : 12, d = u.volgende;
        while (d < m) d = addM(d, step);
        if (d === m) items.push({ naam: u.naam, bedrag: u.bedrag, kind: u.kind });
      });
      items.sort(function (a, b) { return b.bedrag - a.bedrag; });
      out.push({ m: m, items: items, totaal: items.reduce(function (a, x) { return a + x.bedrag; }, 0) });
    }
    return out;
  }

  /* ---------- wat komt eraan: kwartaal- en jaarbetalingen ---------- */
  /* Per tegenpartij die per kwartaal of per jaar betaald wordt: laatste betaling en de verwachte volgende maand. */
  function upcoming(rows, freqKeys, lastMonth) {
    var g = {};
    rows.forEach(function (x) {
      if (x.t !== 'uitgave') return;
      var k = counterparty(x.r) || '?', kind = freqKeys[k];
      if (kind !== 'kwartaal' && kind !== 'jaarlijks') return;
      var o = g[k] = g[k] || { key: k, kind: kind, naam: cleanName(x.r.Tegenpartij || x.r.Omschrijving), laatste: '', bedrag: 0, cat: x.r.Categorie };
      if (x.m > o.laatste) { o.laatste = x.m; o.bedrag = 0; }
      if (x.m === o.laatste) o.bedrag -= x.a;
    });
    return Object.keys(g).map(function (k) { var o = g[k]; o.volgende = addM(o.laatste, o.kind === 'kwartaal' ? 3 : 12); return o; })
      .filter(function (o) { return o.bedrag >= 1; })
      .sort(function (a, b) { return a.volgende < b.volgende ? -1 : a.volgende > b.volgende ? 1 : b.bedrag - a.bedrag; });
  }

  /* ---------- FIRE ---------- */
  /* Vermogen groeit elk jaar met rendement r en 12 x de maandelijkse inleg. Geeft het eerste jaar waarin het doel
     gehaald wordt, en de reeks per jaar (max. 60 jaar). Alle bedragen in euro van vandaag (reëel rendement). */
  function fire(start, perMonth, r, target, maxYears) {
    var w = start, series = [{ y: 0, v: w }], hit = w >= target ? 0 : null;
    for (var y = 1; y <= (maxYears || 60); y++) {
      w = w * (1 + r) + perMonth * 12;
      series.push({ y: y, v: w });
      if (hit === null && w >= target) hit = y;
    }
    return { jaren: hit, reeks: series };
  }

  /* ---------- notities over de data ---------- */
  /* level 'alert' = echte onderbreking, 'note' = aandachtspunt, 'foot' = voetnoot (enkel in Dataoverzicht) */
  function notes(ctx, dq, view, from, to) {
    var o = [];
    if (dq.stale.length) o.push({ level: 'note', id: 'stale', text: dq.stale.join(', ') + ': al meer dan een maand niet bijgewerkt. Laad de nieuwe afschriften op, of zet Gebruik op "af en toe" in Rekeningen als je die rekening niet meer maandelijks gebruikt.' });
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
    PERSONS: PERSONS, OWNER: OWNER, jointContrib: jointContrib, pocketRows: pocketRows, wealth: wealth, trips: trips, isCheck: isCheck, checkRows: checkRows, spreadMonths: spreadMonths, weight: weight, makeCtx: makeCtx, typeOf: typeOf, rowsFor: rowsFor, metrics: metrics,
    inPeriod: inPeriod, months: months, lastDates: lastDates, dataQuality: dataQuality, prev: prev, addM: addM, range: range,
    byMonth: byMonth, byCategory: byCategory, catAvgPrev: catAvgPrev, recurring: recurring, isLoan: isLoan, usage: usage,
    topCounterparties: topCounterparties, largest: largest, householdSplit: householdSplit, fairness: fairness,
    counterparty: counterparty, incomeFlow: incomeFlow, byWeekday: byWeekday, buffer: buffer, notes: notes,
    hasOwnAccounts: hasOwnAccounts, cleanName: cleanName, jointIds: jointIds, median: median,
    frequency: frequency, fixedFree: fixedFree, rule503020: rule503020, needKind: needKind, carKind: carKind, carCosts: carCosts,
    pockets: pockets, pocketList: pocketList, investments: investments, monthGap: monthGap, fixedType: fixedType, upcoming: upcoming, projection: projection, fire: fire, num: num_, ownerOfAccount: ownerOfAccount
  };
});
