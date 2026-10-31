/* Rekenmodule huishoudboekje. Geen DOM, werkt in browser en Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Calc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var PERSONS = ['MATS', 'SOFIE', 'SAMEN'];

  function weight(r, p) {
    var m = +r.Aandeel_Mats || 0, s = +r.Aandeel_Sofie || 0;
    return p === 'MATS' ? m : p === 'SOFIE' ? s : m + s;
  }
  function makeCtx(data) {
    var typ = {};
    (data.categorieen || []).forEach(function (c) { typ[c.Categorie] = c.Type; });
    var own = {};
    (data.rekeningen || []).forEach(function (a) { own[a.Rekening_ID] = a.Eigenaar; });
    return { typ: typ, own: own, data: data };
  }
  function typeOf(ctx, cat) { return ctx.typ[cat] || 'uitgave'; }
  function ym(d) { return d.slice(0, 7); }

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
    var inc = 0, exp = 0, sav = 0, res = 0, struct = 0, once = 0;
    rows.forEach(function (x) {
      if (structOnly && x.r.Eenmalig) return;
      if (x.t === 'inkomen') inc += x.a;
      else if (x.t === 'uitgave') exp += x.a;
      else if (x.t === 'sparen') sav += x.a;
      res += x.a;
      if (!x.r.Eenmalig) struct += x.a; else once += x.a;
    });
    return {
      inkomen: inc, uitgaven: exp, gespaard: -sav, resultaat: res,
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
  /* laatste transactiedatum per actieve rekening */
  function lastDates(ctx) {
    var l = {};
    (ctx.data.rekeningen || []).forEach(function (a) { if (a.Actief !== 'NEE') l[a.Rekening_ID] = null; });
    ctx.data.transacties.forEach(function (r) {
      if (r.Rekening_ID in l && (!l[r.Rekening_ID] || r.Datum > l[r.Rekening_ID])) l[r.Rekening_ID] = r.Datum;
    });
    return l;
  }
  function dataQuality(ctx) {
    var ld = lastDates(ctx), ms = months(ctx);
    var key = (ctx.data.rekeningen || []).filter(function (a) { return a.Type === 'Zichtrekening' && a.Actief !== 'NEE' && ld[a.Rekening_ID]; });
    var minLast = key.map(function (a) { return ld[a.Rekening_ID]; }).sort()[0];
    var maxLast = Object.keys(ld).map(function (k) { return ld[k]; }).filter(Boolean).sort().pop();
    // laatste volledige maand: de maand van minLast als minLast >= laatste dag - 3, anders de maand ervoor
    var lastDay = function (m) { var y = +m.slice(0, 4), mo = +m.slice(5); return new Date(Date.UTC(y, mo, 0)).getUTCDate(); };
    var mm = ym(minLast), full = +minLast.slice(8) >= lastDay(mm) - 3;
    var lastComplete = full ? mm : prev(mm);
    var partial = ms.filter(function (m) { return m > lastComplete; });
    var sofieAccounts = (ctx.data.rekeningen || []).filter(function (a) { return a.Eigenaar === 'Sofie'; }).length;
    var stale = (ctx.data.rekeningen || []).filter(function (a) { return a.Type !== 'Maaltijdcheques' && a.Actief !== 'NEE' && ld[a.Rekening_ID] && ym(ld[a.Rekening_ID]) < lastComplete; }).map(function (a) { return a.Naam || a.Rekening_ID; });
    return { stale: stale, lastDates: ld, lastComplete: lastComplete, partialMonths: partial, months: ms, sofieComplete: sofieAccounts > 0, maxLast: maxLast, minLast: minLast };
  }
  function prev(m) { var y = +m.slice(0, 4), mo = +m.slice(5) - 1; if (!mo) { y--; mo = 12; } return y + '-' + (mo < 10 ? '0' : '') + mo; }
  function addM(m, n) { var y = +m.slice(0, 4), mo = +m.slice(5) - 1 + n; y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12 + 1; return y + '-' + (mo < 10 ? '0' : '') + mo; }
  function range(from, to) { var o = []; for (var m = from; m <= to; m = addM(m, 1)) o.push(m); return o; }

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
    return Object.keys(o).map(function (k) { return { cat: k, bedrag: -o[k] }; }).sort(function (a, b) { return b.bedrag - a.bedrag; });
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
  function norm(s) { return (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  var ALIAS = [[/woonkrediet|intrest krediet|fintro.*krediet/, 'woonkrediet'], [/lening vader|crelan|rekening vader/, 'lening vader'], [/test achats|test aankoop/, 'test aankoop'], [/mobile vikings/, 'mobile vikings']];
  function counterparty(r) {
    var raw = norm((r.Tegenpartij || '') + ' ' + (r.Omschrijving || ''));
    for (var i = 0; i < ALIAS.length; i++) if (ALIAS[i][0].test(raw)) return ALIAS[i][1];
    var f = function (s) { return norm((s || '').replace(/\(.*?\)/g, ' ').replace(/[0-9]+/g, ' ')); };
    return f(r.Tegenpartij) || f(r.Omschrijving);
  }

  /* Terugkerende uitgaven: zelfde tegenpartij in >= minMonths verschillende maanden, bedrag stabiel (spreiding <= 25%) */
  var NOT_FIXED = { 'Boodschappen': 1, 'Horeca & delivery': 1, 'Shopping & aankopen': 1, 'Reizen': 1, 'Vrije tijd & events': 1, 'Persoonlijke verzorging': 1 };
  function recurring(rows, minMonths, since) {
    var g = {};
    rows.forEach(function (x) {
      if (x.t !== 'uitgave' || x.r.Eenmalig || NOT_FIXED[x.r.Categorie]) return;
      var k = counterparty(x.r); if (!k) return;
      (g[k] = g[k] || []).push(x);
    });
    var out = [];
    Object.keys(g).forEach(function (k) {
      var xs = g[k], ms = {}, tot = {};
      xs.forEach(function (x) { ms[x.m] = 1; tot[x.m] = (tot[x.m] || 0) + x.a; });
      var mk = Object.keys(ms);
      if (mk.length < (minMonths || 3)) return;
      var vals = mk.map(function (m) { return -tot[m]; }), avg = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
      var mx = Math.max.apply(null, vals), mn = Math.min.apply(null, vals);
      var loose = k === 'woonkrediet' || k === 'lening vader';
      if (avg < 1 || (mx - mn) / avg > (loose ? 0.8 : 0.25)) return;
      if (since && mk.slice().sort().pop() < since) return;
      out.push({ key: k, naam: xs[0].r.Tegenpartij || xs[0].r.Omschrijving, cat: xs[0].r.Categorie, perMaand: avg, perJaar: avg * 12, maanden: mk.length, laatste: mk.sort().pop() });
    });
    return out.sort(function (a, b) { return b.perMaand - a.perMaand; });
  }
  function topCounterparties(rows, n) {
    var g = {};
    rows.forEach(function (x) {
      if (x.t !== 'uitgave') return;
      var k = counterparty(x.r); if (!k) return;
      var o = g[k] = g[k] || { naam: x.r.Tegenpartij || x.r.Omschrijving, bedrag: 0, aantal: 0 };
      o.bedrag -= x.a; o.aantal++;
    });
    return Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.bedrag - a.bedrag; }).slice(0, n || 8);
  }
  function largest(rows, n) {
    return rows.filter(function (x) { return x.t === 'uitgave'; }).sort(function (a, b) { return a.a - b.a; }).slice(0, n || 8)
      .map(function (x) { return { datum: x.r.Datum, naam: x.r.Tegenpartij || x.r.Omschrijving, cat: x.r.Categorie, bedrag: -x.a, eenmalig: !!x.r.Eenmalig }; });
  }
  /* Samen: huishoudelijk (beide aandelen > 0) versus persoonlijk */
  function householdSplit(ctx, from, to) {
    var hh = 0, pers = 0, g = { MATS: 0, SOFIE: 0 };
    ctx.data.transacties.forEach(function (r) {
      var t = typeOf(ctx, r.Categorie); if (t !== 'uitgave') return;
      var m = ym(r.Datum); if (m < from || m > to) return;
      var a = -r.Bedrag * ((+r.Aandeel_Mats || 0) + (+r.Aandeel_Sofie || 0));
      if (r.Aandeel_Mats > 0 && r.Aandeel_Sofie > 0) hh += a; else pers += a;
    });
    return { huishouden: hh, persoonlijk: pers };
  }
  /* Eerlijkheidsmeter: wie stort op de gezamenlijke rekening? Onderscheid via genormaliseerde tegenpartij van stortingen. */
  var SOFIE_RX = /sofie|partner/;
  var MATS_RX = /^mats|via persoonlijk|persoonlijk/;
  function whoDeposited(r) {
    var s = norm(r.Tegenpartij) + ' ' + norm(r.Omschrijving);
    if (/mats|persoonlijk/.test(s)) return 'MATS';
    if (SOFIE_RX.test(s)) return 'SOFIE';
    return '?';
  }
  function fairness(ctx, from, to) {
    var dep = { MATS: 0, SOFIE: 0, '?': 0 }, share = { MATS: 0, SOFIE: 0 }, costs = 0;
    ctx.data.transacties.forEach(function (r) {
      if (r.Rekening_ID !== 'GEZ-BE57') return;
      var m = ym(r.Datum); if (m < from || m > to) return;
      if (r.Categorie === 'Overdracht gezamenlijke rekening' && r.Bedrag > 0) dep[whoDeposited(r)] += r.Bedrag;
      else if (typeOf(ctx, r.Categorie) === 'uitgave') { costs -= r.Bedrag; share.MATS -= r.Bedrag * (+r.Aandeel_Mats || 0); share.SOFIE -= r.Bedrag * (+r.Aandeel_Sofie || 0); }
    });
    return { stortingen: dep, kosten: costs, aandeel: share };
  }
  return {
    PERSONS: PERSONS, weight: weight, makeCtx: makeCtx, typeOf: typeOf, rowsFor: rowsFor, metrics: metrics,
    inPeriod: inPeriod, months: months, lastDates: lastDates, dataQuality: dataQuality, prev: prev, addM: addM, range: range,
    byMonth: byMonth, byCategory: byCategory, catAvgPrev: catAvgPrev, recurring: recurring,
    topCounterparties: topCounterparties, largest: largest, householdSplit: householdSplit, fairness: fairness, counterparty: counterparty
  };
});
