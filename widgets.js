/* Widgets: elke widget krijgt het model (cijfers voor weergave en periode) en een grootte (S, M, L)
   en geeft { title, body } terug. Titels zijn conclusies, geen labels. */
(function () {
'use strict';
var C = window.Calc, CFG = window.CONFIG;

/* ---------- opmaak ---------- */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
var nf0 = new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, minimumFractionDigits: 0 });
var nf2 = new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
function eur(n) { var r = Math.round(n); return nf0.format(r === 0 ? 0 : r).replace('-', '−'); }
function eurAbs(n) { return eur(Math.abs(n)); }
function hero(n) {
  var s = nf2.format(Math.abs(n)), i = s.lastIndexOf(','), neg = n < -0.004 ? '−' : '';
  return neg + esc(s.slice(0, i)) + '<span class="dec">' + esc(s.slice(i)) + '</span>';
}
function pct(x, d) { return x == null || !isFinite(x) ? '–' : (x * 100).toFixed(d == null ? 1 : d).replace('.', ',').replace('-', '−') + '%'; }
var MS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
var ML = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
function mShort(m) { return MS[+m.slice(5) - 1]; }
function mLong(m, year) { return ML[+m.slice(5) - 1] + (year ? ' ' + m.slice(0, 4) : ''); }
function dNice(d) { if (!d) return '–'; var p = String(d).slice(0, 10).split('-'); return (+p[2]) + ' ' + MS[+p[1] - 1] + ' ' + p[0]; }
function signed(n) { return (n > 0.5 ? '+' : n < -0.5 ? '−' : '') + eurAbs(n); }
/* goed = true als stijgen goed is (inkomen) en false als dalen goed is (uitgaven) */
function delta(cur, ref, goed) {
  if (ref == null || !isFinite(ref) || Math.abs(ref) < 1) return '';
  var d = (cur - ref) / Math.abs(ref);
  if (Math.abs(d) < 0.03) return '<span class="dt flat">=</span>';
  var up = d > 0, good = up === goed;
  return '<span class="dt ' + (good ? 'pos' : 'neg') + '">' + (up ? '▲ ' : '▼ ') + pct(Math.abs(d), 0) + '</span>';
}
function J(M, je, jullie) { return M.view === 'SAMEN' ? jullie : je; }

/* ---------- bouwstenen (5 componenten) ---------- */
function kpi(label, value, foot) {
  return '<div class="kpi"><div class="kv">' + value + '</div><div class="kl">' + label + '</div>' + (foot ? '<div class="kf">' + foot + '</div>' : '') + '</div>';
}
function listRows(rows, size, id, max) {
  var n = max || (size === 'S' ? 3 : 5), more = rows.length > n;
  return '<ul class="list">' + rows.slice(0, n).map(row).join('') + '</ul>' +
    (more ? '<button class="more" data-more="' + id + '">Toon alle ' + rows.length + '</button>' : '');
}
function row(r) {
  if (r.dd) return '<li><button class="lrow" data-dd="' + esc(r.dd) + '">' + row({ t: r.t, s: r.s, v: r.v, bar: r.bar, tick: r.tick, warn: r.warn }).slice(4, -5) + '</button></li>';
  return '<li><span class="ln"><span class="lt">' + esc(r.t) + '</span>' + (r.s ? '<span class="ls">' + esc(r.s) + '</span>' : '') + '</span>' +
    (r.bar != null ? '<span class="lb"><i style="width:' + Math.max(2, Math.min(100, r.bar * 100)).toFixed(1) + '%' + (r.warn ? ';background:var(--neg)' : '') + '"></i>' + (r.tick != null ? '<b style="left:' + Math.min(100, r.tick * 100).toFixed(1) + '%"></b>' : '') + '</span>' : '') +
    '<span class="lv">' + r.v + '</span></li>';
}
function toggle(id, opts, cur) {
  return '<div class="tg" role="group">' + opts.map(function (o) {
    return '<button data-wt="' + id + ':' + o[0] + '" aria-pressed="' + (o[0] === cur) + '">' + esc(o[1]) + '</button>';
  }).join('') + '</div>';
}
function empty(text) { return '<div class="empty">' + esc(text) + '</div>'; }
function note(text) { return '<p class="nt">' + text + '</p>'; }

/* ---------- grafieken ---------- */
var gid = 0;
/* Vlakgrafiek met verloop. Rekt mee met de kaart; lijndikte blijft gelijk. */
function area(vals, opts) {
  opts = opts || {};
  var n = vals.length; if (n < 2) return '';
  var w = 100, h = 100, mn = Math.min.apply(null, vals.concat(0)), mx = Math.max.apply(null, vals.concat(0)); if (mx === mn) mx = mn + 1;
  var X = function (i) { return i * w / (n - 1); }, Y = function (v) { return 4 + (mx - v) * (h - 8) / (mx - mn); };
  var d = vals.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(2) + ',' + Y(v).toFixed(2); }).join(' ');
  var id = 'ag' + (++gid), z = Y(0).toFixed(2);
  return '<div class="area"><div class="ap"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".38"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>' +
    '<line x1="0" x2="100" y1="' + z + '" y2="' + z + '" stroke="var(--line)" stroke-dasharray="2 3" vector-effect="non-scaling-stroke"/>' +
    '<path d="' + d + ' L100,100 L0,100 Z" fill="url(#' + id + ')"/>' +
    '<path d="' + d + '" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>' +
    '<i class="dot" style="left:100%;top:' + Y(vals[n - 1]).toFixed(2) + '%"></i></div>' +
    (opts.labels ? '<div class="axis">' + opts.labels.map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('') + '</div>' : '') + '</div>';
}
/* Staafgrafiek per maand in HTML: vult de kaart, elke maand is een knop. */
function bars(series, opts) {
  var mx = 1;
  series.forEach(function (s) { mx = Math.max(mx, s.a || 0, s.b || 0); });
  return '<div class="bars' + (opts.two ? ' two' : '') + '">' + series.map(function (s) {
    var lab = mShort(s.m) + (s.lopend ? '*' : '');
    var aria = mLong(s.m, true) + (opts.two ? ': inkomen ' + eur(s.a) + ', uitgaven ' + eur(s.b) : ': ' + eur(s.b)) + (s.lopend ? ', lopende maand' : '');
    return '<button class="col' + (s.sel ? ' sel' : '') + '" data-month="' + s.m + '" aria-label="' + esc(aria) + '"' + (s.sel ? ' aria-current="true"' : '') + '><span class="cb">' +
      (opts.two ? '<i class="a" style="height:' + (s.a / mx * 100).toFixed(1) + '%"></i>' : '') +
      '<i class="b" style="height:' + (Math.max(0, s.b) / mx * 100).toFixed(1) + '%"></i>' +
      (s.r != null ? '<i class="r ' + (s.r >= 0 ? 'pos' : 'neg') + '" title="' + esc(signed(s.r)) + '"></i>' : '') +
      '</span><span class="cl">' + esc(lab) + '</span></button>';
  }).join('') + '</div>';
}
function ring(val, target, stretch) {
  var R = 38, Cc = 2 * Math.PI * R, scale = Math.max(0.2, (val || 0) * 1.15), v = Math.max(0, Math.min(val || 0, scale)) / scale;
  var tick = function (p, c) { var a = (p / scale) * 2 * Math.PI - Math.PI / 2; return '<line x1="' + (50 + (R + 7) * Math.cos(a)).toFixed(2) + '" y1="' + (50 + (R + 7) * Math.sin(a)).toFixed(2) + '" x2="' + (50 + (R + 12) * Math.cos(a)).toFixed(2) + '" y2="' + (50 + (R + 12) * Math.sin(a)).toFixed(2) + '" stroke="' + c + '" stroke-width="3" stroke-linecap="round"/>'; };
  return '<svg class="ring" viewBox="0 0 100 100" role="img" aria-label="Spaarratio ' + pct(val) + ', doel ' + pct(target, 0) + '"><circle cx="50" cy="50" r="' + R + '" fill="none" stroke="var(--track)" stroke-width="11"/>' +
    '<circle cx="50" cy="50" r="' + R + '" fill="none" stroke="var(--accent)" stroke-width="11" stroke-linecap="round" stroke-dasharray="' + (v * Cc).toFixed(2) + ' ' + Cc.toFixed(2) + '" transform="rotate(-90 50 50)"/>' +
    tick(target, 'var(--ink)') +
    '<text x="50" y="56" text-anchor="middle" class="rt">' + pct(val) + '</text></svg>';
}
/* Tinten van de accentkleur, van vol naar zacht */
function stack(parts) {
  var tot = parts.reduce(function (a, p) { return a + Math.max(0, p.v); }, 0) || 1;
  return '<div class="stack" role="img" aria-label="' + esc(parts.map(function (p) { return p.l + ' ' + eur(p.v); }).join(', ')) + '">' +
    parts.map(function (p) { return p.v > 0 ? '<i style="flex:' + (p.v / tot).toFixed(4) + ';background:' + p.c + '"></i>' : ''; }).join('') + '</div>';
}
function legend(parts, total) {
  return '<ul class="list lg">' + parts.filter(function (p) { return Math.abs(p.v) >= 0.5; }).map(function (p) {
    return '<li><span class="ln"><i class="sw" style="background:' + p.c + '"></i><span class="lt">' + esc(p.l) + '</span></span><span class="lv">' + eur(p.v) + (total ? ' <small>' + pct(p.v / total, 0) + '</small>' : '') + '</span></li>';
  }).join('') + '</ul>';
}

/* ---------- model ---------- */
function avg(list, key) { if (!list.length) return null; return list.reduce(function (a, x) { return a + x[key]; }, 0) / list.length; }
function model(st) {
  var ctx = st.ctx, v = st.view, P = st.P, dq = st.dq;
  /* all = echte bedragen; allS = periodieke uitgaven gespreid (voor maandgrafieken en een losse maand) */
  var all = C.rowsFor(ctx, v), allS = C.rowsFor(ctx, v, null, { spread: true });
  var rows = C.inPeriod(P.n === 1 ? allS : all, P.from, P.to), m = C.metrics(rows);
  var M = { st: st, view: v, P: P, dq: dq, ctx: ctx, all: all, allS: allS, rows: rows, m: m, ms: C.metrics(rows, true), V: st.V, own: C.hasOwnAccounts(ctx, v), cache: {} };
  M.series = function () { return M.cache.s || (M.cache.s = C.byMonth(allS, st.Months)); };
  M.full = function () { return M.cache.f || (M.cache.f = C.byMonth(allS, st.V)); };
  M.checks = function () { return M.cache.ck || (M.cache.ck = C.checkRows(rows)); };
  /* referentie: gemiddelde van de 3 volledige maanden voor de periode */
  M.ref = function () {
    if (M.cache.r !== undefined) return M.cache.r;
    var before = st.V.filter(function (x) { return x < P.from; }).slice(-3);
    var b = before.length === 3 ? C.byMonth(all, before) : [];
    return (M.cache.r = b.length ? { inkomen: avg(b, 'inkomen'), uitgaven: avg(b, 'uitgaven'), gespaard: avg(b, 'gespaard'), resultaat: avg(b, 'resultaat'), from: before[0], to: before[2] } : null);
  };
  M.rec = function () {
    if (M.cache.rec) return M.cache.rec;
    var lc = dq.lastComplete, list = C.recurring(C.inPeriod(all, st.V[0], lc), 3, lc);
    list.forEach(function (r) { r.loopt = r.lening ? r.laatste === lc : r.actief; });
    return (M.cache.rec = list);
  };
  M.recKeys = function () { var k = {}; M.rec().forEach(function (r) { if (r.loopt) k[r.key] = 1; }); return k; };
  M.freq = function () {
    if (M.cache.fq) return M.cache.fq;
    return (M.cache.fq = C.frequency(C.inPeriod(all, st.V[0], dq.lastComplete), M.recKeys()));
  };
  M.when = P.kind === 'maand' ? 'in ' + mLong(P.from) : P.kind === 'kwartaal' ? 'in ' + P.label : P.kind === 'jaar' ? 'in ' + P.from.slice(0, 4) : 'sinds ' + mLong(P.from);
  M.perMonth = function (x) { return x / P.n; };
  return M;
}
function refFoot(M, key, mult) {
  var r = M.ref(); if (!r || M.P.n !== 1) return M.P.n > 1 ? 'gem. ' + eur(M.m[key] * (mult || 1) / M.P.n) + ' per maand' : '';
  return 'gewoonlijk ' + eur(r[key] * (mult || 1)) + ' (' + mShort(r.from) + '–' + mShort(r.to) + ')';
}
function needOwn(M) {
  if (M.own) return null;
  var who = M.view === 'SAMEN' ? 'Sofie' : M.view === 'SOFIE' ? 'Sofie' : 'Mats';
  return 'Nog geen eigen rekening van ' + who + ' in het blad. Deze tegel vult zich vanzelf zodra die er is.';
}

/* ---------- nieuwe grafieken ---------- */
/* Twee lijnen (inkomen en uitgaven) met het verschil ertussen groen of rood. Elke maand is een knop. */
var lines = function (ser, opts) {
  var n = ser.length; if (n < 2) return '';
  var mx = 1; ser.forEach(function (s) { mx = Math.max(mx, s.a, s.b); });
  var X = function (i) { return (i + 0.5) / n * 100; }, Y = function (v) { return 6 + (1 - v / mx) * 88; };
  var pa = ser.map(function (s, i) { return X(i).toFixed(2) + ',' + Y(s.a).toFixed(2); }), pb = ser.map(function (s, i) { return X(i).toFixed(2) + ',' + Y(s.b).toFixed(2); });
  var x0 = X(0).toFixed(2), x1 = X(n - 1).toFixed(2), id = 'ln' + (++gid);
  var under = function (p) { return 'M' + p.join(' L') + ' L' + x1 + ',100 L' + x0 + ',100 Z'; };
  var above = function (p) { return 'M' + p.join(' L') + ' L' + x1 + ',0 L' + x0 + ',0 Z'; };
  var sel = ser.map(function (s, i) { return s.sel ? i : -1; }).filter(function (i) { return i >= 0; });
  var band = sel.length ? '<rect x="' + (X(sel[0]) - 50 / n).toFixed(2) + '" width="' + (sel.length * 100 / n).toFixed(2) + '" y="0" height="100" fill="var(--card2)"/>' : '';
  var svg = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs>' +
    '<clipPath id="' + id + 'a"><path d="' + above(pb) + '"/></clipPath><clipPath id="' + id + 'b"><path d="' + above(pa) + '"/></clipPath></defs>' + band +
    '<path d="' + under(pa) + '" fill="var(--pos)" fill-opacity=".16" clip-path="url(#' + id + 'a)"/>' +
    '<path d="' + under(pb) + '" fill="var(--neg)" fill-opacity=".16" clip-path="url(#' + id + 'b)"/>' +
    '<path d="M' + pb.join(' L') + '" fill="none" stroke="var(--muted)" stroke-width="2" stroke-dasharray="5 4" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>' +
    '<path d="M' + pa.join(' L') + '" fill="none" stroke="var(--accent)" stroke-width="2.75" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  var dots = sel.map(function (i) { return '<i class="pt a" style="left:' + X(i) + '%;top:' + Y(ser[i].a) + '%"></i><i class="pt b" style="left:' + X(i) + '%;top:' + Y(ser[i].b) + '%"></i>'; }).join('');
  var cols = ser.map(function (s) {
    return '<button class="lc' + (s.sel ? ' sel' : '') + '" data-month="' + s.m + '" aria-label="' + esc(mLong(s.m, true) + ': inkomen ' + eur(s.a) + ', uitgaven ' + eur(s.b) + (s.lopend ? ', lopende maand' : '')) + '"' + (s.sel ? ' aria-current="true"' : '') + '><span>' + esc(mShort(s.m) + (s.lopend ? '*' : '')) + '</span></button>';
  }).join('');
  return '<div class="lines"><div class="lplot">' + svg + dots + '</div><div class="lcols">' + cols + '</div></div>';
}
/* Kleine lijn onder een getal; de gekozen periode krijgt een punt */
function mini(vals, sel) {
  var n = vals.length; if (n < 2) return '';
  var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals); if (mx - mn < 1) { mx += 1; mn -= 1; }
  var X = function (i) { return i / (n - 1) * 100; }, Y = function (v) { return 8 + (mx - v) / (mx - mn) * 84; };
  var d = vals.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(2) + ',' + Y(v).toFixed(2); }).join(' ');
  return '<div class="mini"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + '" fill="none" stroke="var(--accent)" stroke-width="2" stroke-opacity=".55" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>' +
    sel.map(function (i) { return '<i style="left:' + X(i) + '%;top:' + Y(vals[i]) + '%"></i>'; }).join('') + '</div>';
}
/* Lijst die zich aanpast aan de hoogte van de tegel (app.js verbergt wat niet past) */
function fitList(rows, id, cls) {
  return '<ul class="list fl' + (cls ? ' ' + cls : '') + '" data-fit="1">' + rows.slice(0, 40).map(row).join('') + '</ul><button class="more" data-more="' + id + '" hidden>Toon alle ' + rows.length + '</button>';
}

/* Markeert een cijfer dat steunt op boekingen met CHECK in de Nota */
function checkFlag(M) { return ''; }
function checkFlagOld(M) { var n = M.checks().length; return n ? '<br><button class="lk ck" data-dd="check:1">⚠ ' + n + ' te controleren</button>' : ''; }

/* ---------- catalogus ---------- */
var R = {};

function kpiWidget(key, label, goed, needIncome) {
  return function (M, size) {
    if (needIncome) { var e = needOwn(M); if (e) return { title: label, body: empty(e) }; }
    var sign = key === 'uitgaven' ? -1 : 1, v = sign * M.m[key], r = M.ref(), refv = r ? sign * r[key] : null;
    var d = M.P.n === 1 && refv != null && Math.abs(refv) >= 1 ? (v - refv) / Math.abs(refv) : null;
    var title = d == null ? label + ' ' + M.when : Math.abs(d) < 0.03 ? label + ' zoals gewoonlijk' : label + ' ' + pct(Math.abs(d), 0) + (d > 0 ? ' hoger' : ' lager') + ' dan gewoonlijk';
    if (key === 'gespaard' && v <= 0.5) title = J(M, 'Je spaarde', 'Jullie spaarden') + ' niets ' + M.when;
    var ser = M.full(), vals = ser.map(function (x) { return sign * x[key]; }), sel = [];
    ser.forEach(function (x, i) { if (x.m >= M.P.from && x.m <= M.P.to) sel.push(i); });
    var sv = sign * M.ms[key], foot = (d != null ? delta(v, refv, goed) + ' ' : '') + (refFoot(M, key, sign) || label);
    return { title: title, body: '<div class="kpi kx"><div class="kv">' + eur(v) + '</div><div class="kl">' + foot + '</div></div>' + mini(vals, sel) };
  };
}
R.inkomen = kpiWidget('inkomen', 'Inkomen', true, true);
R.uitgaven = kpiWidget('uitgaven', 'Uitgaven', false, false);
R.gespaard = kpiWidget('gespaard', 'Gespaard', true, true);

/* Aan dit tempo: gemiddeld opzij (gespaard + overgehouden) per volledige maand x 12 */
R.spaarratio = function (M, size) {
  var e = needOwn(M); if (e) return { title: 'Spaarratio', body: empty(e) };
  var r = M.m.spaarratio, t = CFG.SPAARDOEL, s = CFG.SPAARDOEL_STRETCH;
  var title = r == null ? 'Geen inkomen ' + M.when : J(M, 'Je spaarde ', 'Jullie spaarden ') + pct(r, 0) + ', ' + (r >= s ? 'boven ' + J(M, 'je', 'jullie') + ' stretchdoel' : r >= t ? 'boven ' + J(M, 'je', 'jullie') + ' doel' : 'onder ' + J(M, 'je', 'jullie') + ' doel van ' + pct(t, 0));
  return { title: title, body: '<div class="rw">' + ring(r || 0, t, s) + '<div class="rk"><div class="kl">Doel ' + pct(t, 0) + ' · stretch ' + pct(s, 0) + '</div>' +
    (size !== 'S' ? '<div class="kf">' + eur(M.m.gespaard) + ' van ' + eur(M.m.inkomen) + '</div>' : '') + '</div></div>' };
};

R.maandverloop = function (M, size) {
  var e = !M.own;
  var ser = M.series().map(function (x) {
    return { m: x.m, a: x.inkomen, b: -x.uitgaven, r: e || size === 'S' ? null : x.resultaat, sel: x.m >= M.P.from && x.m <= M.P.to, lopend: M.dq.partialMonths.indexOf(x.m) >= 0 };
  });
  var full = M.full(), pos = full.filter(function (x) { return x.resultaat >= 0; }).length;
  var title = e ? 'Uitgaven per maand' : pos + ' van de ' + full.length + ' volledige maanden ' + J(M, 'hield je', 'hielden jullie') + ' geld over';
  var lg = '<div class="lgd">' + (e ? '' : '<span><i class="sw a"></i>Inkomen</span>') + '<span><i class="sw b"></i>Uitgaven</span>' +
    (!e && size !== 'S' ? '<span><i class="sw r"></i>hield over</span><span><i class="sw rn"></i>tekort</span>' : '') + '</div>';
  return { title: title, body: bars(ser, { two: !e }) + lg };
};

/* Opzij gezet: gespaard + overgehouden, opgeteld over de volledige maanden */
function catModel(M) {
  var cats = C.byCategory(M.rows), n = M.P.n, cur = {}, tot = 0;
  cats.forEach(function (c) { cur[c.cat] = c.bedrag / n; tot += c.bedrag; });
  var lc = M.dq.lastComplete, usualRows = M.all.filter(function (x) { return !x.r.Eenmalig; }), usualMs = M.V.filter(function (m) { return m < M.P.from; }).slice(-3);
  if (usualMs.length < 2) usualMs = M.V.slice(-3);
  var usual = {};
  C.byCategory(C.inPeriod(usualRows, usualMs[0], usualMs[usualMs.length - 1])).forEach(function (c) { usual[c.cat] = c.bedrag / usualMs.length; });
  var pk = { voorstel: true, list: [] }, covered = {}, items = [];
  if (!pk.voorstel) pk.list.forEach(function (p) {
    p.cats.forEach(function (c) { covered[c] = 1; });
    items.push({ naam: p.naam, cats: p.cats, v: p.uitgegeven, ref: p.budget, pot: true });
  });
  Object.keys(cur).forEach(function (c) { if (!covered[c]) items.push({ naam: c, cats: [c], v: cur[c], ref: usual[c] || null, pot: false }); });
  items.sort(function (a, b) { return b.v - a.v; });
  var mx = Math.max.apply(null, items.map(function (x) { return Math.max(x.v, x.ref || 0); }).concat(1));
  return { items: items, mx: mx, tot: tot / n, pots: !pk.voorstel, usualMs: usualMs };
}
function catRow(it, mx) {
  var over = it.ref != null && it.v > it.ref * (it.pot ? 1 : 1.15) && it.v - it.ref >= (it.pot ? 1 : 15);
  var s = it.pot ? 'potje ' + eur(it.ref) : it.ref != null ? 'gewoonlijk ' + eur(it.ref) : 'nieuw';
  if (it.ref != null && Math.abs(it.v - it.ref) >= 15) s += ' · ' + (it.v > it.ref ? '▲ ' : '▼ ') + eurAbs(it.v - it.ref);
  return { t: it.naam, s: s, v: '<span class="' + (over ? 'neg' : '') + '">' + eur(it.v) + '</span>', bar: it.v / mx, tick: it.ref != null ? it.ref / mx : null, warn: over, dd: 'cats:' + encodeURIComponent(it.cats.join('|')) };
}
R.categorieen = function (M, size) {
  var c = catModel(M);
  if (!c.items.length) return { title: 'Geen uitgaven ' + M.when, body: empty('Geen uitgaven in deze periode.') };
  var over = c.items.filter(function (x) { return catRow(x, c.mx).warn; }), top = c.items[0];
  var title = c.pots ? (over.filter(function (x) { return x.pot; }).length ? over.filter(function (x) { return x.pot; }).length + ' potje' + (over.filter(function (x) { return x.pot; }).length > 1 ? 's' : '') + ' over budget' : 'Alle potjes binnen budget')
    : over.length ? over[0].naam + ' ' + eurAbs(over[0].v - over[0].ref) + ' boven gewoonlijk' : top.naam + ' is ' + J(M, 'je', 'jullie') + ' grootste uitgave (' + pct(top.v / c.tot, 0) + ')';
  return { title: title, body: '<div class="lgd"><span>' + (M.P.n > 1 ? 'Per maand' : mLong(M.P.from, true)) + '</span><span><i class="tk"></i>' + (c.pots ? 'potje of gewoonlijk' : 'gewoonlijk (' + mShort(c.usualMs[0]) + '–' + mShort(c.usualMs[c.usualMs.length - 1]) + ')') + '</span></div>' + fitList(c.items.map(function (x) { return catRow(x, c.mx); }), 'categorieen', 'wide') };
};

R.inkomenflow = function (M, size) {
  var e = needOwn(M); if (e) return { title: 'Waar ging ' + J(M, 'je', 'jullie') + ' inkomen heen', body: empty(e) };
  var f = C.incomeFlow(M.rows, M.recKeys());
  var parts = [
    { l: 'Vaste kosten', v: f.vast, c: 'var(--accent)' },
    { l: 'Los uitgegeven', v: f.variabel, c: 'color-mix(in srgb,var(--accent) 60%,var(--track))' },
    { l: 'Eenmalig', v: f.eenmalig, c: 'color-mix(in srgb,var(--accent) 35%,var(--track))' },
    { l: 'Gespaard', v: f.gespaard, c: 'var(--pos)' },
    { l: f.over >= 0 ? 'Over' : 'Tekort', v: Math.abs(f.over), c: f.over >= 0 ? 'var(--track)' : 'var(--neg)' }
  ];
  var title = f.inkomen <= 0 ? 'Geen inkomen ' + M.when : f.over >= 0 ? pct((f.gespaard + f.over) / f.inkomen, 0) + ' van ' + J(M, 'je', 'jullie') + ' inkomen werd niet uitgegeven' : J(M, 'Je', 'Jullie') + ' kwam' + (M.view === 'SAMEN' ? 'en' : '') + ' ' + eurAbs(f.over) + ' tekort ' + M.when;
  if (size === 'S' || f.inkomen <= 0) return { title: title, body: stack(parts) + legend(parts.slice(0, 2), f.inkomen > 0 ? f.inkomen : null) };
  var mx = Math.max.apply(null, parts.map(function (p) { return p.v; }).concat(1));
  return { title: title, body: '<div class="flow">' + parts.filter(function (p) { return p.v >= 0.5; }).map(function (p) {
    return '<div class="rr"><span class="rh"><b><i class="sw" style="background:' + p.c + '"></i>' + p.l + '</b><span>' + eur(p.v / M.P.n) + ' <small>' + pct(p.v / f.inkomen, 0) + '</small></span></span><span class="rb"><i style="width:' + (p.v / mx * 100).toFixed(1) + '%;background:' + p.c + '"></i></span></div>';
  }).join('') + '</div>' + (M.P.n > 1 ? note('Per maand, inkomen ' + eur(f.inkomen / M.P.n) + '.') : '') };
};

function recRow(r) {
  var s = (r.lening ? 'Lening' : r.abonnement ? 'Abonnement' : r.cat) + ' · ' + eur(r.perJaar) + ' per jaar';
  return { t: r.naam, s: s, v: eur(r.perMaand) + (r.stijging ? ' <small class="neg">▲ ' + eur(r.stijging) + '</small>' : ''), dd: 'cp:' + encodeURIComponent(r.key) };
}
R.vastelasten = function (M, size) {
  var rec = M.rec(), run = rec.filter(function (r) { return r.loopt; }), ended = rec.filter(function (r) { return r.lening && !r.loopt; });
  if (!run.length) return { title: 'Nog geen vaste kosten herkend', body: empty('Vaste kosten verschijnen zodra dezelfde partij minstens 3 maanden terugkomt.') };
  var tot = run.reduce(function (a, r) { return a + r.perMaand; }, 0), up = run.filter(function (r) { return r.stijging; });
  var inc = avg(M.full(), 'inkomenStructureel');
  var big = run.slice().sort(function (a, b) { return b.perMaand - a.perMaand; })[0];
  var title = up.length ? up.length + (up.length > 1 ? ' vaste kosten werden' : ' vaste kost werd') + ' duurder' : big.naam + ' is ' + J(M, 'je', 'jullie') + ' grootste vaste kost';
  var subs = run.filter(function (r) { return r.abonnement; }).reduce(function (a, r) { return a + r.perMaand; }, 0), loans = run.filter(function (r) { return r.lening; }).reduce(function (a, r) { return a + r.perMaand; }, 0);
  return { title: title, body: '<div class="chips"><span><b>' + eur(loans) + '</b> leningen</span><span><b>' + eur(subs) + '</b> abonnementen</span><span><b>' + eur(tot - loans - subs) + '</b> andere</span>' +
    (up.length ? '<span class="neg"><b>' + up.length + '</b> duurder</span>' : '') + '</div>' +
    fitList(run.map(recRow), 'vastelasten') + (ended.length && size === 'L' ? note('Afbetaald: ' + ended.map(function (r) { return esc(r.naam) + ' (laatste in ' + mLong(r.laatste) + ')'; }).join(', ') + '.') : '') };
};

function loose(M) { var k = M.recKeys(); return M.rows.filter(function (x) { return !k[C.counterparty(x.r)]; }); }
/* Signalen: wat wijkt af van gewoonlijk, wat werd duurder, wat was eenmalig */
function signals(M) {
  var o = [], c = catModel(M);
  c.items.forEach(function (it) {
    if (it.pot || it.ref == null) return;
    var d = it.v - it.ref;
    if (Math.abs(d) >= 30 && Math.abs(d) >= 0.25 * it.ref) o.push({ w: Math.abs(d), t: it.naam, s: (d > 0 ? 'meer' : 'minder') + ' dan gewoonlijk (' + eur(it.ref) + ')', v: '<span class="' + (d > 0 ? 'neg' : 'pos') + '">' + (d > 0 ? '▲ ' : '▼ ') + eurAbs(d) + '</span>', dd: 'cat:' + encodeURIComponent(it.naam) });
  });
  M.rec().forEach(function (r) { if (r.loopt && r.stijging) o.push({ w: r.stijging * 12, t: r.naam + ' werd duurder', s: 'nu ' + eur(r.laatsteBedrag) + ' per maand, ' + eur(r.stijging * 12) + ' per jaar extra', v: '<span class="neg">▲ ' + eur(r.stijging) + '</span>', dd: 'cp:' + encodeURIComponent(r.key) }); });
  M.rows.forEach(function (x) { if (x.t === 'uitgave' && x.r.Eenmalig && -x.a >= 50) o.push({ w: -x.a * 0.5, t: C.cleanName(x.r.Tegenpartij || x.r.Omschrijving), s: 'eenmalig · ' + dNice(x.r.Datum) + ' · ' + x.r.Categorie, v: eur(-x.a) }); });
  /* Grote kwartaal- of jaarbetalingen die de komende 2 maanden verwacht worden, met de pocket die ze opvangt */
  var lc = M.dq.lastComplete, ps = C.pockets(M.ctx, M.view, [], 1);
  C.upcoming(C.inPeriod(M.all, M.V[0], lc), M.freq().keys, lc).forEach(function (b) {
    if (b.bedrag < 100 || b.volgende <= lc || b.volgende > C.addM(lc, 2)) return;
    var p = ps.filter(function (x) { return x.cats.indexOf(b.cat) >= 0; })[0];
    o.push({ bill: 1, w: 1e9 + b.bedrag, t: b.naam + ' komt eraan', s: (b.kind === 'kwartaal' ? 'per kwartaal' : 'per jaar') + ' · verwacht in ' + mLong(b.volgende) + (p ? ' · pocket ' + p.naam + ' (' + eur(p.budget) + ' per maand)' : ''), v: '<span class="neg">' + eur(b.bedrag) + '</span>', dd: 'cp:' + encodeURIComponent(b.key) });
  });
  return o.sort(function (a, b) { return b.w - a.w; });
}
/* Jaaroverzicht: het laatste volledige jaar (of dit jaar tot nu, als er nog geen volledig jaar is) */
R.jaaroverzicht = function (M, size) {
  var lc = M.dq.lastComplete, first = M.dq.months[0] || lc;
  if (!lc) return { title: 'Jaaroverzicht', body: empty('Nog geen volledige maand.') };
  var y = lc.slice(5) === '12' ? +lc.slice(0, 4) : +lc.slice(0, 4) - 1, sofar = false;
  if (first > y + '-12') { y = +lc.slice(0, 4); sofar = true; }
  var from = first > y + '-01' ? first : y + '-01', to = sofar ? lc : y + '-12';
  var rows = C.inPeriod(M.all, from, to), mt = C.metrics(rows), ms = C.range(from, to);
  var prev = C.inPeriod(M.all, (y - 1) + '-01', (y - 1) + '-12'), pm = prev.length && first <= (y - 1) + '-01' ? C.metrics(prev) : null;
  var label = sofar ? y + ' tot en met ' + mLong(lc) : String(y);
  var sav = M.view !== 'SAMEN';
  var stats = [[eur(mt.inkomen), M.view === 'SAMEN' ? 'gestort' : 'inkomen'], [eur(-mt.uitgaven), 'uitgaven' + (pm && pm.uitgaven ? ' (' + (mt.uitgaven < pm.uitgaven ? '▲ ' : '▼ ') + pct(Math.abs(mt.uitgaven / pm.uitgaven - 1), 0) + ' tegenover ' + (y - 1) + ')' : '')]];
  if (sav) stats.push([eur(mt.gespaard), 'gespaard'], [pct(mt.spaarratio, 0), 'spaarratio']);
  else stats.push([eur(mt.resultaat), 'over in de pot']);
  /* Pockets: in hoeveel maanden bleef elke pocket binnen budget */
  var pk = 0, pt = 0;
  ms.forEach(function (m) { C.pockets(M.ctx, M.view, C.inPeriod(rows, m, m), 1).forEach(function (p) { pt++; if (p.uitgegeven <= p.budget) pk++; }); });
  if (pt) stats.push([pk + '/' + pt, 'keer een pocket binnen budget']);
  var bc = C.byCategory(rows), cats = bc.map(function (c) { return { k: c.cat, v: c.bedrag }; }).filter(function (c) { return c.v >= 1; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 4);
  var mx = cats.length ? cats[0].v : 1;
  var big = C.largest(rows, 2);
  var title = sav ? label + ': ' + eur(mt.gespaard) + ' gespaard, ' + pct(mt.spaarratio, 0) + ' van ' + J(M, 'je', 'jullie') + ' inkomen' : label + ': ' + eur(-mt.uitgaven) + ' samen uitgegeven';
  return { title: title, body: '<div class="stats">' + stats.map(function (x) { return '<div><b>' + x[0] + '</b><span>' + x[1] + '</span></div>'; }).join('') + '</div>' +
    '<div class="cap">Grootste categorieën, per maand gemiddeld</div>' + '<ul class="list">' + cats.map(function (c) { return row({ t: c.k, s: eur(c.v / ms.length) + ' per maand', v: eur(c.v), bar: c.v / mx }); }).join('') + '</ul>' +
    (big.length ? '<div class="cap">Grootste aankopen</div><ul class="list">' + big.map(function (b) { return row({ t: b.naam, s: dNice(b.datum) + ' · ' + b.cat, v: eur(b.bedrag) }); }).join('') + '</ul>' : '') };
};

R.gemiddelde = function (M, size) {
  var f = M.full(), n = f.length;
  if (!n) return { title: 'Gemiddelde per maand', body: empty('Nog geen volledige maand.') };
  var a = function (k) { return f.reduce(function (s, x) { return s + x[k]; }, 0) / n; }, res = a('resultaat'), sp = mShort(M.V[0]) + '–' + mShort(M.V[n - 1]);
  var title = !M.own ? 'Gemiddeld ' + eur(-a('uitgaven')) + ' uitgaven per maand' : res >= 0 ? 'Gemiddeld ' + J(M, 'hield je', 'hielden jullie') + ' ' + eur(res) + ' per maand over' : 'Gemiddeld ' + J(M, 'kwam je', 'kwamen jullie') + ' ' + eurAbs(res) + ' per maand tekort';
  var st = M.own ? [['Inkomen', a('inkomen')], ['Uitgaven', -a('uitgaven')], ['Gespaard', a('gespaard')], ['Over na sparen', res]] : [['Uitgaven', -a('uitgaven')]];
  if (size === 'S') st = st.slice(0, 2);
  return { title: title, body: '<div class="stats">' + st.map(function (x) { return '<div><b>' + eur(x[1]) + '</b><span>' + x[0] + '</span></div>'; }).join('') + '</div><div class="cap">Per maand, ' + sp + ' (' + n + ' volledige maanden)</div>' };
};

R.buffer = function (M, size) {
  var b = C.buffer(M.ctx, M.view, M.dq.lastComplete, 3);
  if (!b) return { title: 'Buffer', body: empty('Nog geen saldo in het tabblad Saldi.') };
  var mo = b.maanden;
  var title = mo == null ? 'Buffer: ' + eur(b.saldo) : J(M, 'Je', 'Jullie') + ' buffer dekt ' + mo.toFixed(1).replace('.', ',') + ' maand' + (mo.toFixed(1) === '1.0' ? '' : 'en') + ' uitgaven';
  var p = mo == null ? 0 : Math.min(1, mo / 6);
  return { title: title, body: '<div class="goal"><div class="gbar"><i style="width:' + (p * 100).toFixed(1) + '%"></i><b style="left:50%" title="3 maanden"></b></div>' +
    '<div class="gl"><span>' + eur(b.saldo) + ' op zicht</span><span>gezond: 3–6 mnd</span></div></div>' };
};

R.spaardoel = function (M, size) {
  if (M.view === 'SAMEN') {
    var rr = ['MATS', 'SOFIE'].map(function (p) { var m = C.metrics(C.inPeriod(C.rowsFor(M.ctx, p), M.P.from, M.P.to)); return { p: p, g: m.gespaard, t: CFG.SPAARDOEL * m.inkomenStructureel }; });
    var hit = rr.filter(function (x) { return x.t > 0 && x.g >= x.t; }).length;
    return { title: hit === 2 ? 'Allebei jullie spaardoel gehaald' : hit === 1 ? (rr[0].g >= rr[0].t ? 'Mats' : 'Sofie') + ' haalde het spaardoel' : 'Geen van beiden haalde het spaardoel', body: '<div class="goal">' + rr.map(function (x) {
      return '<div class="gl"><span>' + (x.p === 'MATS' ? 'Mats' : 'Sofie') + ' ' + eur(x.g) + '</span><span>doel ' + eur(x.t) + '</span></div><div class="gbar thin"><i style="width:' + Math.min(100, x.t ? x.g / x.t * 100 : 0).toFixed(1) + '%;background:var(--' + x.p.toLowerCase() + ')"></i></div>';
    }).join('') + '</div>' };
  }
  var e = needOwn(M); if (e) return { title: 'Spaardoel', body: empty(e) };
  var inc = M.m.inkomenStructureel, g = M.m.gespaard, t = CFG.SPAARDOEL * inc, s = CFG.SPAARDOEL_STRETCH * inc;
  if (inc <= 0) return { title: 'Geen vast inkomen ' + M.when, body: empty('Het spaardoel is ' + pct(CFG.SPAARDOEL, 0) + ' van het vaste inkomen.') };
  var title = g >= s ? 'Stretchdoel gehaald: ' + eur(g) + ' gespaard' : g >= t ? 'Doel gehaald, nog ' + eur(s - g) + ' tot de stretch' : 'Nog ' + eur(t - g) + ' tot ' + J(M, 'je', 'jullie') + ' spaardoel';
  var p = Math.min(1, g / (s || 1));
  return { title: title, body: '<div class="goal"><div class="gbar"><i style="width:' + (p * 100).toFixed(1) + '%"></i><b style="left:' + (t / s * 100).toFixed(1) + '%" title="doel"></b></div>' +
    '<div class="gl"><span>' + eur(g) + ' gespaard</span><span>doel ' + eur(t) + (size !== 'S' ? ' · stretch ' + eur(s) : '') + '</span></div></div>' };
};

function accRows(M) {
  var ld = M.dq.lastDates, rek = M.st.data.rekeningen || [];
  return Object.keys(ld).map(function (k) {
    var a = rek.filter(function (r) { return r.Rekening_ID === k; })[0] || {};
    return { t: a.Naam || k, s: (a.Type || 'rekening') + ' · ' + C.usage(a), v: ld[k] ? dNice(ld[k]) : 'geen boekingen', d: ld[k] || '' };
  }).sort(function (a, b) { return a.t < b.t ? -1 : 1; });
}
function dataIntro(M) {
  var dq = M.dq;
  return '<p class="nt" style="margin-bottom:12px">Volledig ingeladen tot en met ' + mLong(dq.lastComplete, true) + ' (alle rekeningen: ' + mLong(M.V[0]) + ' tot ' + mLong(M.V[M.V.length - 1], true) + ').' + (dq.partialMonths.length ? ' ' + dq.partialMonths.map(function (m) { return mLong(m); }).join(', ') + ' loopt nog.' : '') + ' Hieronder de laatste boeking per rekening.</p>';
}

R.eerlijkheid = function (M, size) {
  var f = C.fairness(M.ctx, M.P.from, M.P.to);
  if (!f.heeftRekening) return { title: 'Eerlijkheidsmeter', body: empty('Geen gezamenlijke rekening (Eigenaar = Gezamenlijk) in Rekeningen.') };
  var dm = f.saldo.MATS, ds = f.saldo.SOFIE, who = dm >= ds ? 'MATS' : 'SOFIE', top = Math.max(dm, ds);
  var title = Math.abs(dm) < 25 && Math.abs(ds) < 25 ? 'Netjes in evenwicht ' + M.when
    : top > 0 ? (who === 'MATS' ? 'Mats' : 'Sofie') + ' stortte ' + eurAbs(top) + ' meer dan ' + (who === 'MATS' ? 'zijn' : 'haar') + ' deel van de kosten'
    : 'Samen ' + eurAbs(dm + ds) + ' minder gestort dan de kosten';
  var mx = Math.max(f.stortingen.MATS, f.stortingen.SOFIE, f.aandeel.MATS, f.aandeel.SOFIE, 1);
  var bar = function (who, col) {
    return '<div class="fr"><div class="frh"><b>' + (who === 'MATS' ? 'Mats' : 'Sofie') + '</b><span class="' + (f.saldo[who] >= 0 ? 'pos' : 'neg') + '">' + (f.saldo[who] >= 0 ? '▲ ' : '▼ ') + signed(f.saldo[who]) + '</span></div>' +
      '<div class="frb"><i style="width:' + (f.stortingen[who] / mx * 100).toFixed(1) + '%;background:var(--' + col + ')"></i></div>' +
      '<div class="frb thin"><i style="width:' + (f.aandeel[who] / mx * 100).toFixed(1) + '%"></i></div>' +
      '<div class="frl">stortte ' + eur(f.stortingen[who]) + ' · eigen deel kosten ' + eur(f.aandeel[who]) + '</div></div>';
  };
  return { title: title, body: bar('MATS', 'mats') + bar('SOFIE', 'sofie') +
    (size !== 'S' ? note('Enkel de gezamenlijke rekening. Eigen deel = bedrag x aandeel per uitgave.' + (f.stortingen['?'] > 0.5 ? ' Niet toe te wijzen: ' + eur(f.stortingen['?']) + '.' : '')) : '') };
};

function sharedRows(M, h) {
  var shared = {}, rows = [];
  M.ctx.data.transacties.forEach(function (r) {
    var m = r.Datum.slice(0, 7); if (m < M.P.from || m > M.P.to || C.typeOf(M.ctx, r.Categorie) !== 'uitgave' || !(+r.Aandeel_Mats > 0 && +r.Aandeel_Sofie > 0)) return;
    shared[r.Categorie] = (shared[r.Categorie] || 0) - r.Bedrag * ((+r.Aandeel_Mats) + (+r.Aandeel_Sofie));
  });
  Object.keys(shared).sort(function (a, b) { return shared[b] - shared[a]; }).forEach(function (k) { if (shared[k] >= 0.5) rows.push({ t: k, s: 'gedeeld', v: eur(shared[k] / M.P.n), bar: shared[k] / h.gedeeld, dd: 'cat:' + encodeURIComponent(k) }); });
  return rows;
}
R.gedeeld = function (M, size) {
  var h = C.householdSplit(M.ctx, M.P.from, M.P.to), tot = h.gedeeld + h.persoonlijk;
  if (tot < 0.5) return { title: 'Gedeeld versus persoonlijk', body: empty('Geen uitgaven ' + M.when + '.') };
  var parts = [{ l: 'Gedeeld', v: h.gedeeld, c: 'var(--accent)' }, { l: 'Persoonlijk Mats', v: h.mats, c: 'var(--mats)' }, { l: 'Persoonlijk Sofie', v: h.sofie, c: 'var(--sofie)' }];
  var rows = sharedRows(M, h);
  return { title: pct(h.gedeeld / tot, 0) + ' van jullie uitgaven is gedeeld', body: stack(parts) + legend(parts, tot) + (size !== 'S' && rows.length ? '<div class="cap">Gedeeld per categorie' + (M.P.n > 1 ? ', per maand' : '') + '</div>' + fitList(rows, 'gedeeld') : '') +
    (!M.st.dq.sofieComplete && size !== 'S' ? note('Persoonlijke uitgaven van Sofie ontbreken tot haar rekeningen in het blad staan.') : '') };
};

var FREQ = [['maandelijks', 'Elke maand'], ['kwartaal', 'Per kwartaal'], ['jaarlijks', 'Per jaar'], ['los', 'Los, wisselend']];
/* ---------- vast versus vrij, ritme, 50/30/20, potjes, auto, beleggingen ---------- */
function stacked(series) {
  var mx = 1;
  series.forEach(function (s) { mx = Math.max(mx, s.a + s.b); });
  return '<div class="bars stk">' + series.map(function (s) {
    var aria = mLong(s.m, true) + ': vast ' + eur(s.a) + ', vrij ' + eur(s.b) + (s.lopend ? ', lopende maand' : '');
    return '<button class="col' + (s.sel ? ' sel' : '') + '" data-month="' + s.m + '" aria-label="' + esc(aria) + '"' + (s.sel ? ' aria-current="true"' : '') + '><span class="cb">' +
      '<i class="a" style="height:' + (Math.max(0, s.a) / mx * 100).toFixed(1) + '%"></i><i class="b" style="height:' + (Math.max(0, s.b) / mx * 100).toFixed(1) + '%"></i>' +
      '</span><span class="cl">' + esc(mShort(s.m) + (s.lopend ? '*' : '')) + '</span></button>';
  }).join('') + '</div>';
}
R.vastvrij = function (M, size) {
  var keys = M.freq().keys, per = C.fixedFree(M.rows, keys, C.range(M.P.from, M.P.to));
  var v = per.reduce(function (a, x) { return a + x.vast; }, 0), f = per.reduce(function (a, x) { return a + x.vrij; }, 0);
  if (v + f < 0.5) return { title: 'Geen uitgaven ' + M.when, body: empty('Geen uitgaven in deze periode.') };
  var ser = C.fixedFree(M.all, keys, M.st.Months).map(function (x) { return { m: x.m, a: x.vast, b: x.vrij, sel: x.m >= M.P.from && x.m <= M.P.to, lopend: M.dq.partialMonths.indexOf(x.m) >= 0 }; });
  var title = pct(v / (v + f), 0) + ' van ' + J(M, 'je', 'jullie') + ' uitgaven ligt vast, ' + eur(f / M.P.n) + ' per maand is vrij';
  var o = { maandelijks: 0, kwartaal: 0, jaarlijks: 0, los: 0 };
  M.rows.forEach(function (x) { if (x.t === 'uitgave') o[keys[C.counterparty(x.r) || '?'] || 'los'] -= x.a; });
  var rit = size === 'S' ? '' : '<div class="chips rit">' + FREQ.map(function (q) { return '<button class="lk" data-dd="freq:' + q[0] + '"><b>' + eur(o[q[0]] / M.P.n) + '</b> ' + q[1].toLowerCase() + '</button>'; }).join('') + '</div>';
  return { title: title, body: stacked(ser) + '<div class="lgd"><button class="lk" data-dd="vast:1"><i class="sw a"></i>Vast ' + eur(v / M.P.n) + '</button><button class="lk" data-dd="vast:0"><i class="sw b"></i>Vrij ' + eur(f / M.P.n) + '</button>' + (M.P.n > 1 ? '<span>per maand</span>' : '') + '</div>' + rit };
};

/* ---------- doorklikken ---------- */
function txRow(x) { return { t: C.cleanName(x.r.Tegenpartij || x.r.Omschrijving), s: dNice(x.r.Datum) + ' · ' + x.r.Categorie + (x.r.Eenmalig ? ' · eenmalig' : '') + (x.sp ? ' · deel ' + (x.si + 1) + ' van ' + x.sp + ' (gespreid)' : ''), v: eur(-x.a) }; }
function drill(M, spec) {
  var i = spec.indexOf(':'), type = spec.slice(0, i), key = decodeURIComponent(spec.slice(i + 1)), keys, rows = M.rows, title, sub = M.when;
  var exp = function (f) { return function (x) { return x.t === 'uitgave' && f(x); }; };
  if (type === 'pk') { var pc = key.split('|'); title = pc.join(', '); rows = C.pocketRows(M.ctx, M.view, rows).filter(exp(function (x) { return pc.indexOf(x.r.Categorie) >= 0; })); }
  else if (type === 'check') { title = 'Nog te controleren'; rows = M.checks(); }
  else if (type === 'cat') { title = key; rows = rows.filter(exp(function (x) { return x.r.Categorie === key; })); }
  else if (type === 'cats') { var cs = key.split('|'); title = cs.join(', '); rows = rows.filter(exp(function (x) { return cs.indexOf(x.r.Categorie) >= 0; })); }
  else if (type === 'freq') { keys = M.freq().keys; title = FREQ.filter(function (f) { return f[0] === key; })[0][1]; rows = rows.filter(exp(function (x) { return (keys[C.counterparty(x.r) || '?'] || 'los') === key; })); }
  else if (type === 'vast') { keys = M.freq().keys; title = key === '1' ? 'Vaste uitgaven' : 'Vrije uitgaven'; rows = rows.filter(exp(function (x) { var k = keys[C.counterparty(x.r) || '?']; return (k && k !== 'los') === (key === '1'); })); }
  else if (type === 'need') { title = key === 'nodig' ? 'Nodig' : 'Wensen'; rows = rows.filter(exp(function (x) { return C.needKind(M.ctx, x.r.Categorie) === key; })); }
  else if (type === 'ftype') { title = key; sub = 'van ' + mShort(M.V[0]) + ' tot ' + mShort(M.dq.lastComplete); var tk = {}; M.rec().forEach(function (r) { if (r.loopt && C.fixedType(r) === key) tk[r.key] = 1; }); rows = C.inPeriod(M.all, M.V[0], M.dq.lastComplete).filter(exp(function (x) { return tk[C.counterparty(x.r)]; })); }
  else if (type === 'car') { title = key; sub = 'van ' + mShort(M.V[0]) + ' tot ' + mShort(M.dq.lastComplete); rows = C.inPeriod(M.all, M.V[0], M.dq.lastComplete).filter(exp(function (x) { return C.carKind(x.r) === key; })); }
  else if (type === 'cp') { title = key; sub = 'van ' + mShort(M.V[0]) + ' tot ' + mShort(M.dq.lastComplete); rows = C.inPeriod(M.all, M.V[0], M.dq.lastComplete).filter(exp(function (x) { return C.counterparty(x.r) === key; })); if (rows[0]) title = C.cleanName(rows[0].r.Tegenpartij || rows[0].r.Omschrijving); }
  else return null;
  rows = rows.slice().sort(function (a, b) { return a.r.Datum < b.r.Datum ? 1 : -1; });
  var tot = rows.reduce(function (a, x) { return a - x.a; }, 0);
  /* per maand over alle maanden, zodat je ziet of het normaal is */
  var pm = {};
  var base = type === 'car' || type === 'cp' || type === 'ftype' || type === 'check' ? rows : type === 'pk' ? C.pocketRows(M.ctx, M.view, M.allS).filter(exp(function (x) { return key.split('|').indexOf(x.r.Categorie) >= 0; })) : M.all.filter(exp(function (x) {
    if (type === 'cat') return x.r.Categorie === key;
    if (type === 'cats') return key.split('|').indexOf(x.r.Categorie) >= 0;
    if (type === 'need') return C.needKind(M.ctx, x.r.Categorie) === key;
    var k = keys[C.counterparty(x.r) || '?'] || 'los';
    return type === 'freq' ? k === key : (k !== 'los') === (key === '1');
  }));
  base.forEach(function (x) { pm[x.m] = (pm[x.m] || 0) - x.a; });
  var ms = M.st.Months, mx = Math.max.apply(null, ms.map(function (m) { return pm[m] || 0; }).concat(1));
  var chart = '<div class="bars wk dd">' + ms.map(function (m) {
    var sel = m >= M.P.from && m <= M.P.to;
    return '<div class="col' + (sel ? ' sel' : '') + '" role="img" aria-label="' + esc(mLong(m, true) + ' ' + eur(pm[m] || 0)) + '"><span class="cb"><i class="b" style="height:' + ((pm[m] || 0) / mx * 100).toFixed(1) + '%"></i></span><span class="cl">' + mShort(m) + '</span></div>';
  }).join('') + '</div>';
  return { title: title, html: '<p class="nt"><b>' + eur(tot) + '</b> ' + esc(sub) + ', ' + rows.length + ' betaling' + (rows.length === 1 ? '' : 'en') + '.</p>' + chart +
    (rows.length ? '<ul class="list">' + rows.map(txRow).map(row).join('') + '</ul>' : empty('Geen betalingen in deze periode.')) };
}

/* ================= v4: assen, netto, uitgaven, pockets, vaste kosten, sparen, FIRE ================= */
/* Mooie schaalverdeling: 3 tot 5 streepjes, ronde bedragen */
function ticks(mn, mx) {
  if (mx <= mn) mx = mn + 1;
  var raw = (mx - mn) / 4, p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / p;
  var step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p, o = [];
  for (var v = Math.floor(mn / step) * step; v < mx + step * 0.999; v += step) o.push(Math.round(v * 100) / 100);
  return o;
}
function kEur(v) { var a = Math.abs(v); if (a >= 1e6) return (v < 0 ? '−' : '') + '€' + (a / 1e6).toFixed(a % 1e6 ? 1 : 0).replace('.', ',') + 'M'; return (v < 0 ? '−' : '') + '€' + (a >= 1000 ? (a / 1000).toFixed(a % 1000 && a < 10000 ? 1 : 0).replace('.', ',') + 'k' : Math.round(a)); }
/* Assenkruis: geeft { Y, grid (svg), labels (html) } voor waarden tussen mn en mx (0 altijd in beeld) */
function axis(mn, mx, fmt) {
  var t = ticks(Math.min(0, mn), Math.max(0, mx)), lo = t[0], hi = t[t.length - 1];
  var Y = function (v) { return 2 + (hi - v) / (hi - lo) * 96; };
  return { Y: Y, lo: lo, hi: hi,
    grid: t.map(function (v) { return '<line x1="0" x2="100" y1="' + Y(v).toFixed(2) + '" y2="' + Y(v).toFixed(2) + '" stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke"' + (v === 0 ? '' : ' stroke-dasharray="2 4"') + '/>'; }).join(''),
    labels: '<div class="ya">' + t.map(function (v) { return '<span style="top:' + Y(v).toFixed(2) + '%">' + (fmt || kEur)(v) + '</span>'; }).join('') + '</div>' };
}

/* Twee lijnen met y-as. ser: {m, a, b, sel} */
lines = function (ser) {
  var n = ser.length; if (n < 2) return '';
  var mx = 1; ser.forEach(function (s) { mx = Math.max(mx, s.a, s.b); });
  var ax = axis(0, mx), Y = ax.Y, X = function (i) { return (i + 0.5) / n * 100; };
  var pa = ser.map(function (s, i) { return X(i).toFixed(2) + ',' + Y(s.a).toFixed(2); }), pb = ser.map(function (s, i) { return X(i).toFixed(2) + ',' + Y(s.b).toFixed(2); });
  var x0 = X(0).toFixed(2), x1 = X(n - 1).toFixed(2), id = 'ln' + (++gid);
  var under = function (p) { return 'M' + p.join(' L') + ' L' + x1 + ',100 L' + x0 + ',100 Z'; }, above = function (p) { return 'M' + p.join(' L') + ' L' + x1 + ',0 L' + x0 + ',0 Z'; };
  var sel = ser.map(function (s, i) { return s.sel ? i : -1; }).filter(function (i) { return i >= 0; });
  var band = sel.length ? '<rect x="' + (X(sel[0]) - 50 / n).toFixed(2) + '" width="' + (sel.length * 100 / n).toFixed(2) + '" y="0" height="100" fill="var(--card2)"/>' : '';
  var svg = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><clipPath id="' + id + 'a"><path d="' + above(pb) + '"/></clipPath><clipPath id="' + id + 'b"><path d="' + above(pa) + '"/></clipPath></defs>' + band + ax.grid +
    '<path d="' + under(pa) + '" fill="var(--pos)" fill-opacity=".16" clip-path="url(#' + id + 'a)"/><path d="' + under(pb) + '" fill="var(--neg)" fill-opacity=".16" clip-path="url(#' + id + 'b)"/>' +
    '<path d="M' + pb.join(' L') + '" fill="none" stroke="var(--muted)" stroke-width="2" stroke-dasharray="5 4" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>' +
    '<path d="M' + pa.join(' L') + '" fill="none" stroke="var(--accent)" stroke-width="2.75" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  var dots = sel.map(function (i) { return '<i class="pt a" style="left:' + X(i) + '%;top:' + Y(ser[i].a) + '%"></i><i class="pt b" style="left:' + X(i) + '%;top:' + Y(ser[i].b) + '%"></i>'; }).join('');
  var cols = ser.map(function (s) { return '<button class="lc' + (s.sel ? ' sel' : '') + '" data-month="' + s.m + '" aria-label="' + esc(mLong(s.m, true) + ': inkomen ' + eur(s.a) + ', uitgaven ' + eur(s.b)) + '"' + (s.sel ? ' aria-current="true"' : '') + '><span>' + esc(mShort(s.m)) + '</span></button>'; }).join('');
  return '<div class="chart"><div class="lines">' + ax.labels.replace('class="ya"', 'class="ya"') + '<div class="lplot">' + svg + dots + '</div><div class="lcols">' + cols + '</div></div></div>';
};
/* Staven met y-as; groups: per maand een lijst {v, c, l}. Optionele doellijn. */
function vbars(ms, groups, goal, opts) {
  opts = opts || {};
  var mx = goal || 0; groups.forEach(function (g) { g.forEach(function (b) { mx = Math.max(mx, b.v); }); });
  var mn = 0; groups.forEach(function (g) { g.forEach(function (b) { mn = Math.min(mn, b.v); }); });
  var ax = axis(mn, mx), Y = ax.Y;
  if (opts.line) opts.line.forEach(function (v) { if (v != null) { mx = Math.max(mx, v); mn = Math.min(mn, v); } });
  ax = axis(mn, mx); Y = ax.Y;
  var lp = opts.line ? opts.line.map(function (v, i) { return v == null ? null : ((i + 0.5) / ms.length * 100).toFixed(2) + ',' + Y(v).toFixed(2); }).filter(Boolean) : [];
  var svg = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' + ax.grid + (lp.length > 1 ? '<path d="M' + lp.join(' L') + '" fill="none" stroke="var(--ink)" stroke-width="2" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>' : '') + (goal ? '<line x1="0" x2="100" y1="' + Y(goal).toFixed(2) + '" y2="' + Y(goal).toFixed(2) + '" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/>' : '') + '</svg>';
  var cols = ms.map(function (m, i) {
    var g = groups[i];
    return '<button class="vc' + (opts.sel && opts.sel(m) ? ' sel' : '') + '" data-month="' + m + '" aria-label="' + esc(mLong(m, true) + ': ' + g.map(function (b) { return (b.l ? b.l + ' ' : '') + eur(b.v); }).join(', ')) + '">' +
      '<span class="vb">' + g.map(function (b) { var top = Y(Math.max(0, b.v)), bot = Y(Math.min(0, b.v)); return '<i style="top:' + top.toFixed(2) + '%;height:' + Math.max(0.6, bot - top).toFixed(2) + '%;background:' + b.c + '"></i>'; }).join('') + '</span><span class="cl">' + mShort(m) + '</span></button>';
  }).join('');
  return '<div class="chart">' + ax.labels + '<div class="vplot">' + svg + '<div class="vcols">' + cols + '</div></div></div>';
}
/* Donut met klikbare stukken (data-dd) */
var PAL = ['var(--accent)', 'color-mix(in srgb,var(--accent) 72%,var(--card))', 'color-mix(in srgb,var(--accent) 52%,var(--card))', 'color-mix(in srgb,var(--accent) 36%,var(--card))', 'color-mix(in srgb,var(--accent) 24%,var(--card))', 'color-mix(in srgb,var(--accent) 15%,var(--card))', 'color-mix(in srgb,var(--muted) 30%,var(--card))'];
function pie(items, centre, sub) {
  var tot = items.reduce(function (a, b) { return a + b.v; }, 0) || 1, R0 = 36, Cc = 2 * Math.PI * R0, off = 0;
  var g = items.map(function (it, i) {
    var l = it.v / tot * Cc, s = '<circle class="sl" cx="50" cy="50" r="' + R0 + '" fill="none" stroke="' + it.c + '" stroke-width="20" stroke-dasharray="' + Math.max(0, l - 0.8).toFixed(2) + ' ' + Cc.toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 50 50)"' + (it.dd ? ' data-dd="' + esc(it.dd) + '"' : '') + '><title>' + esc(it.l + ' ' + eur(it.v)) + '</title></circle>';
    off += l; return s;
  }).join('');
  return '<svg class="pie" viewBox="0 0 100 100" role="img" aria-label="' + esc(items.map(function (i) { return i.l + ' ' + eur(i.v); }).join(', ')) + '">' + g +
    '<text x="50" y="50" text-anchor="middle" class="dc">' + esc(centre) + '</text><text x="50" y="61" text-anchor="middle" class="ds">' + esc(sub || '') + '</text></svg>';
}
function pieLegend(items, tot) {
  return '<ul class="list lg pl">' + items.map(function (p) {
    var inner = '<span class="ln"><i class="sw" style="background:' + p.c + '"></i><span class="lt">' + esc(p.l) + '</span></span><span class="lv">' + eur(p.v) + ' <small>' + pct(p.v / (tot || 1), 0) + '</small></span>';
    return '<li>' + (p.dd ? '<button class="lrow" data-dd="' + esc(p.dd) + '">' + inner + '</button>' : inner) + '</li>';
  }).join('') + '</ul>';
}
function topItems(list, k, dd) {
  var tot = list.reduce(function (a, c) { return a + c.v; }, 0), top = list.slice(0, k), rest = list.slice(k).reduce(function (a, c) { return a + c.v; }, 0);
  var items = top.map(function (c, i) { return { l: c.l, v: c.v, c: PAL[i], dd: dd ? dd(c) : null }; });
  if (rest >= 0.5) items.push({ l: 'Andere', v: rest, c: PAL[6], dd: dd && list.slice(k).length ? 'cats:' + encodeURIComponent(list.slice(k).map(function (c) { return c.l; }).join('|')) : null });
  return { items: items, tot: tot };
}

/* ---------- Overzicht ---------- */
R.verloop = function (M, size) {
  var e = needOwn(M); if (e) return { title: 'Inkomen min uitgaven', body: empty(e) };
  /* Over = inkomen min uitgaven (sparen is geen uitgave). Daarvan ging een deel naar sparen, de rest bleef op de rekening. */
  var m = M.m, vs = m.inkomen + m.uitgaven, g = m.gespaard, net = vs - g, svs = M.ms.inkomen + M.ms.uitgaven;
  var title = M.view === 'SAMEN' ? 'Gezamenlijke uitgaven ' + eurAbs(m.uitgaven) + ' ' + M.when
    : vs >= 0 ? eur(vs) + ' over ' + M.when + (g > 0.5 ? ', waarvan ' + eur(g) + ' gespaard' : '') : eurAbs(vs) + ' meer uitgegeven dan verdiend ' + M.when;
  if (size === 'S') return { title: title, body: kpi('inkomen min uitgaven', eur(vs), g > 0.5 ? eur(g) + ' naar sparen' : '') };
  var f = M.full(), samen = M.view === 'SAMEN', val = function (x) { return samen ? -x.uitgaven : x.inkomen + x.uitgaven; };
  var avg3 = f.map(function (x, i) { var w = f.slice(Math.max(0, i - 2), i + 1); return w.length < 3 ? null : w.reduce(function (a, y) { return a + val(y); }, 0) / 3; });
  var groups = f.map(function (x) { var r = val(x), left = r - x.gespaard; return samen ? [{ v: r, c: 'var(--accent)', l: 'uitgaven' }] : [{ v: x.gespaard, c: 'var(--pos)', l: 'gespaard' }, { v: left, c: left >= 0 ? 'var(--accent)' : 'var(--neg)', l: 'bleef op rekening' }]; });
  var ch = vbars(f.map(function (x) { return x.m; }), groups, 0, { sel: function (mm) { return mm >= M.P.from && mm <= M.P.to; }, line: avg3 }) +
    '<div class="lgd">' + (samen ? '<span><i class="sw a"></i>Gezamenlijke uitgaven</span>' : '<span><i class="sw" style="background:var(--pos)"></i>Gespaard</span><span><i class="sw a"></i>Bleef op rekening</span>') + '<span><i class="dl"></i>Inkomen min uitgaven, gemiddelde 3 maanden</span></div>';
  if (samen) return { title: title, body: ch };
  var once = Math.abs(svs - vs) >= 0.5 ? '<p class="nt">Zonder eenmalige uitgaven: ' + eur(svs) + '</p>' : '';
  var side = '<div class="hb"><div class="big">' + hero(vs) + '</div><div class="hs">inkomen min uitgaven</div><ul class="hl"><li><i class="sw" style="background:var(--pos)"></i>Gespaard<b>' + eur(g) + '</b></li><li>Bleef op rekening<b class="' + (net >= 0 ? '' : 'neg') + '">' + eur(net) + '</b></li></ul>' + once + '</div>';
  if (size === 'L') return { title: title, cls: 'hero', body: side + '<div class="hc">' + ch + '</div>' };
  return { title: title, body: '<div class="stats sm"><div><b>' + eur(vs) + '</b><span>inkomen min uitgaven</span></div><div><b>' + eur(g) + '</b><span>gespaard</span></div><div><b class="' + (net >= 0 ? '' : 'neg') + '">' + eur(net) + '</b><span>bleef op rekening</span></div></div>' + ch + once };
};

/* Vermogen: wat er nu is en het verschil met vorige maand. Ontbrekende bronnen staan er expliciet bij. */
R.vermogen = function (M, size) {
  var asOf = M.P.to > M.dq.lastComplete ? M.dq.lastComplete : M.P.to, w = C.wealth(M.ctx, M.view, asOf), when = 'eind ' + mLong(asOf);
  if (!w.parts.length) return { title: 'Vermogen', body: empty('Geen saldo in Saldi tot ' + mLong(M.P.to, true) + '.') };
  var ch = w.verschil, title = 'Vermogen ' + when + ': ' + eur(w.totaal);
  var cols = { rekening: 'var(--accent)', sparen: 'var(--pos)', beleggen: 'color-mix(in srgb,var(--pos) 55%,var(--card))' };
  var pos = w.parts.filter(function (p) { return p.v > 0; }), tp = pos.reduce(function (a, p) { return a + p.v; }, 0) || 1;
  var bar = '<div class="wbar">' + pos.map(function (p, i) { return '<i style="width:' + (p.v / tp * 100).toFixed(1) + '%;background:' + (p.soort === 'rekening' && i % 2 ? 'color-mix(in srgb,var(--accent) 60%,var(--card))' : cols[p.soort]) + '"></i>'; }).join('') + '</div>';
  var leg = '<div class="wleg">' + w.parts.map(function (p, i) { return '<div><i style="background:' + (p.soort === 'rekening' && i % 2 ? 'color-mix(in srgb,var(--accent) 60%,var(--card))' : cols[p.soort]) + '"></i><span>' + esc(p.naam) + '</span><b>' + eur(p.v) + '</b></div>'; }).join('') + '</div>';
  var miss = w.missing.map(function (x) { return '<p class="nt">' + esc(x.naam) + ': ' + esc(x.tekst) + ' (' + eur(x.inleg) + '). Geef me de stand om die mee te tellen.</p>'; }).join('') +
    (M.view === 'SAMEN' ? '<p class="nt">Enkel de gezamenlijke rekening.</p>' : '');
  return { title: title, body: '<div class="kpi kx"><div class="kv">' + eur(w.totaal) + '</div><div class="kl">' + (ch != null ? '<span class="' + (ch >= 0 ? 'pos' : 'neg') + '">' + (ch >= 0 ? '▲ ' : '▼ ') + eurAbs(ch) + '</span> op een maand' + (w.naarSparen > 0.5 ? ' <small>(rekeningen ' + (w.verschilRekening >= 0 ? '+' : '−') + eurAbs(w.verschilRekening) + ', naar sparen en ETF\'s +' + eur(w.naarSparen) + ')</small>' : '') : 'geen stand de maand ervoor') + '</div></div>' + bar + leg + miss };
};

/* Bijdragen aan de gezamenlijke rekening: jaar tot nu en de laatste 3 maanden */
R.bijdrage = function (M, size) {
  var lc = M.dq.lastComplete; if (!lc) return { title: 'Bijdragen gezamenlijke rekening', body: empty('Nog geen volledige maand.') };
  var y = C.jointContrib(M.ctx, lc.slice(0, 4) + '-01', lc), q = C.jointContrib(M.ctx, C.addM(lc, -2), lc);
  if (!y.kosten && !y.dep.MATS && !y.dep.SOFIE) return { title: 'Bijdragen gezamenlijke rekening', body: empty('Geen boekingen op de gezamenlijke rekening dit jaar.') };
  var nm = { MATS: 'Mats', SOFIE: 'Sofie' }, cov = function (t, p) { return t.dekking[p] == null ? '–' : pct(t.dekking[p], 0); };
  var los = y.los ? '<p class="nt">⚠ ' + y.los + ' storting' + (y.los > 1 ? 'en' : '') + ' (' + eur(y.losBedrag) + ') zonder Aandeel: niet toegewezen.</p>' : '';
  if (M.view !== 'SAMEN') {
    var p = M.view;
    return { title: nm[p] + ' dekte ' + cov(y, p) + ' van ' + (p === 'MATS' ? 'zijn' : 'haar') + ' deel van de gezamenlijke kosten dit jaar', body: '<div class="stats"><div><b>' + cov(y, p) + '</b><span>dit jaar (' + eur(y.dep[p]) + ' van ' + eur(y.share[p]) + ')</span></div><div><b>' + cov(q, p) + '</b><span>laatste 3 maanden</span></div></div>' + los };
  }
  var d = y.saldo.MATS - y.saldo.SOFIE, ahead = d >= 0 ? 'Mats' : 'Sofie';
  var title = Math.abs(d) < 25 ? 'Jullie dragen dit jaar evenveel bij' : ahead + ' droeg dit jaar ' + eurAbs(d) + ' meer bij dan ' + (ahead === 'Mats' ? 'Sofie' : 'Mats') + ' ten opzichte van zijn of haar deel';
  var tbl = '<div class="stats">' + ['MATS', 'SOFIE'].map(function (p) { return '<div><b>' + cov(y, p) + '</b><span>' + nm[p] + ' dit jaar: ' + eur(y.dep[p]) + ' gestort, deel ' + eur(y.share[p]) + ' · laatste 3 maanden: ' + cov(q, p) + '</span></div>'; }).join('') +
    '<div><b>' + eur(y.kosten / Math.max(1, y.maanden.length)) + '</b><span>gezamenlijke kosten per maand (' + eur(y.kosten) + ' dit jaar)</span></div></div>';
  var chart = size === 'L' ? vbars(y.maanden.map(function (x) { return x.m; }), y.maanden.map(function (x) { return [{ v: x.dep.MATS, c: 'var(--mats)', l: 'Mats' }, { v: x.dep.SOFIE, c: 'var(--sofie)', l: 'Sofie' }]; }), 0, { line: y.maanden.map(function (x) { return x.kosten; }) }) +
    '<div class="lgd"><span><i class="sw" style="background:var(--mats)"></i>Mats</span><span><i class="sw" style="background:var(--sofie)"></i>Sofie</span><span><i class="dl"></i>Gezamenlijke kosten</span><span>Losse maanden misleiden: jullie storten op andere dagen</span></div>' : '';
  return { title: title, body: tbl + chart + los };
};

/* Reizen: dit jaar tegenover het jaarbudget, plus het totaal per reis uit de Nota */
R.reizen = function (M, size) {
  var lc = M.dq.lastComplete || M.P.to, yr = lc.slice(0, 4), rows = C.inPeriod(M.all, yr + '-01', lc), spent = 0;
  rows.forEach(function (x) { if (x.t === 'uitgave' && x.r.Categorie === 'Reizen') spent -= x.a; });
  var pk = C.pockets(M.ctx, M.view, [], 1).filter(function (p) { return p.cats.indexOf('Reizen') >= 0; })[0], bud = pk ? (pk.jaar ? pk.budget : pk.budget * 12) : null;
  var tr = C.trips(rows), title = 'Reizen ' + yr + ': ' + eur(spent) + (bud ? ' van ' + eur(bud) : '');
  var bar = bud ? '<div class="goal"><div class="gbar"><i style="width:' + Math.min(100, spent / bud * 100).toFixed(1) + '%"></i></div><div class="kl">' + (spent > bud ? '<span class="neg">' + eurAbs(spent - bud) + ' over het jaarbudget</span>' : 'Nog ' + eur(bud - spent) + ' in het jaarbudget') + '</div></div>' : '';
  return { title: title, body: bar + (tr.length ? '<div class="cap">Per reis</div><ul class="list">' + tr.map(function (t) { return row({ t: t.naam, s: t.aantal + ' betalingen', v: eur(t.bedrag) }); }).join('') + '</ul>' : empty('Zet "Reis: Barcelona maart 2026" in de Nota om per reis te tellen.')) };
};
R.prognose = function (M, size) {
  var e = needOwn(M); if (e) return { title: 'Jaarprognose', body: empty(e) };
  var f = M.full(), n = f.length; if (!n) return { title: 'Jaarprognose', body: empty('Nog geen volledige maand.') };
  var sum = function (k) { return f.reduce(function (a, x) { return a + x[k]; }, 0); };
  var net = (sum('inkomen') + sum('uitgaven')) / n, sp = sum('gespaard') / n, once = f.reduce(function (a, x) { return a + x.eenmalig; }, 0) / n;
  var title = net >= 0 ? 'Aan dit tempo ' + J(M, 'hou je', 'houden jullie') + ' ' + eur(net * 12) + ' per jaar over' : 'Aan dit tempo ' + J(M, 'geef je', 'geven jullie') + ' ' + eurAbs(net * 12) + ' per jaar meer uit dan er binnenkomt';
  return { title: title, body: '<div class="stats"><div><b>' + eur(net * 12) + '</b><span>over per jaar</span></div><div><b>' + eur(sp * 12) + '</b><span>naar sparen</span></div>' +
    (size !== 'S' ? '<div><b>' + eur((net - once) * 12) + '</b><span>zonder eenmalig</span></div>' : '') + '</div><div class="cap">Gemiddelde van ' + mShort(M.V[0]) + '–' + mShort(M.V[n - 1]) + ' × 12</div>' };
};
R.veranderingen = function (M, size) {
  var sg = signals(M);
  if (!sg.length) return { title: 'Niets ongewoons ' + M.when, body: empty('Geen categorie wijkt sterk af en niets werd duurder.') };
  if (sg[0].bill) return { title: sg[0].t + ': ' + sg[0].v.replace(/<[^>]+>/g, '') + ' in ' + sg[0].s.split('verwacht in ')[1].split(' ·')[0], body: fitList(sg, 'veranderingen') };
  return { title: sg.length === 1 ? '1 ding veranderde ' + M.when : sg.length + ' dingen veranderden ' + M.when, body: fitList(sg, 'veranderingen') };
};

/* ---------- Uitgaven ---------- */
R.donut = function (M, size) {
  var cats = C.byCategory(M.rows).map(function (c) { return { l: c.cat, v: c.bedrag / M.P.n }; });
  if (!cats.length) return { title: 'Geen uitgaven ' + M.when, body: empty('Geen uitgaven in deze periode.') };
  var t = topItems(cats, size === 'S' ? 4 : 6, function (c) { return 'cat:' + encodeURIComponent(c.l); });
  var top = cats[0];
  return { title: top.l + ' is ' + pct(top.v / t.tot, 0) + ' van ' + J(M, 'je', 'jullie') + ' uitgaven ' + M.when,
    body: '<div class="dw">' + pie(t.items, eur(t.tot), M.P.n > 1 ? 'per maand' : 'uitgegeven') + (size === 'S' ? '' : pieLegend(t.items, t.tot)) + '</div>' };
};
R.winkels = function (M, size) {
  /* Enkel plaatsen waar je terugkeert (2+ betalingen): losse grote aankopen staan al in 'Grootste losse uitgaven'. */
  var all = C.topCounterparties(loose(M), 1000), tp = all.filter(function (b) { return b.aantal > 1; });
  if (!tp.length) return { title: 'Geen terugkerende winkels ' + M.when, body: empty('Nergens meer dan één keer betaald.') };
  var mx = tp[0].bedrag;
  return { title: tp[0].naam + ': ' + tp[0].aantal + ' keer, samen ' + eur(tp[0].bedrag), body: fitList(tp.map(function (b) { return { t: b.naam, s: b.aantal + (b.aantal > 1 ? ' betalingen' : ' betaling'), v: eur(b.bedrag), bar: b.bedrag / mx, dd: 'cp:' + encodeURIComponent(b.key) }; }), 'winkels') };
};
R.eenmalig = function (M, size) {
  var big = C.largest(loose(M), 1000);
  if (!big.length) return { title: 'Geen uitgaven ' + M.when, body: empty('Geen uitgaven.') };
  return { title: 'Grootste: ' + big[0].naam + ' (' + eur(big[0].bedrag) + ')', body: fitList(big.map(function (b) { return { t: b.naam, s: dNice(b.datum) + ' · ' + b.cat + (b.eenmalig ? ' · eenmalig' : ''), v: eur(b.bedrag) }; }), 'eenmalig') };
};

/* ---------- Pockets ---------- */
function ringSmall(p, over) {
  var R0 = 40, Cc = 2 * Math.PI * R0, v = Math.min(1, p);
  return '<svg class="pring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="' + R0 + '" fill="none" stroke="var(--track)" stroke-width="12"/>' +
    '<circle cx="50" cy="50" r="' + R0 + '" fill="none" stroke="' + (over ? 'var(--neg)' : 'var(--accent)') + '" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + (v * Cc).toFixed(2) + ' ' + Cc.toFixed(2) + '" transform="rotate(-90 50 50)"/>' +
    '<text x="50" y="57" text-anchor="middle" class="rt">' + Math.round(p * 100) + '%</text></svg>';
}
R.pockets = function (M, size) {
  var ps = C.pockets(M.ctx, M.view, M.rows, M.P.n);
  var btn = '<button class="btn sm2" data-act="pockets">' + (ps.length ? 'Pockets aanpassen' : 'Pockets instellen') + '</button>';
  if (!ps.length) return { title: 'Nog geen pockets voor ' + (M.view === 'SAMEN' ? 'Samen' : M.view === 'MATS' ? 'Mats' : 'Sofie'), body: '<div class="empty col"><p>Een pocket is een budget per maand voor een of meer categorieën, zoals Boodschappen €400 of Uit eten €150. Je ziet dan elke maand of je binnen blijft.</p>' + btn + '</div>' };
  /* Jaarpotten (naam met jaar of reis, of enkel Reizen): jaar tot nu tegenover 12 x het maandbedrag, geen maandalarm */
  var lc = M.dq.lastComplete || M.P.to, yr = lc.slice(0, 4), ytd = C.pocketRows(M.ctx, M.view, C.inPeriod(M.all, yr + '-01', lc));
  ps.forEach(function (p) {
    if (!p.jaar) return;
    var sp = 0; ytd.forEach(function (x) { if (x.t === 'uitgave' && p.cats.indexOf(x.r.Categorie) >= 0) sp -= x.a; });
    p.uitgegeven = sp;
  });
  var ok = ps.filter(function (p) { return p.uitgegeven <= p.budget + 0.5; }).length, cov = {}, outside = 0, tb = 0, tu = 0;
  ps.forEach(function (p) { p.cats.forEach(function (c) { cov[c] = 1; }); if (!p.jaar) { tb += p.budget; tu += p.uitgegeven; } });
  C.pocketRows(M.ctx, M.view, M.rows).forEach(function (x) { if (x.t === 'uitgave' && !cov[x.r.Categorie]) outside -= x.a; });
  var cards = ps.map(function (p) {
    var r = p.budget ? Math.max(0, p.uitgegeven) / p.budget : 0, over = p.uitgegeven > p.budget + 0.5, left = p.budget - p.uitgegeven;
    return '<button class="pk' + (over ? ' over' : '') + '" data-dd="pk:' + encodeURIComponent(p.cats.join('|')) + '">' + ringSmall(r, over) +
      '<span class="pkt"><b>' + esc(p.naam) + '</b>' + (p.cats.length > 1 || p.cats[0].toLowerCase().indexOf(p.naam.toLowerCase().split(' ')[0]) < 0 ? '<small>' + esc(p.cats.join(', ')) + '</small>' : '') + '<span>' + (p.uitgegeven < 0 ? eur(0) + ' (' + eurAbs(p.uitgegeven) + ' terug)' : eur(p.uitgegeven)) + ' van ' + eur(p.budget) + (p.jaar ? ' in ' + yr : '') + '</span><span class="' + (over ? 'neg' : 'pos') + '">' + (over ? eurAbs(left) + ' over budget' : 'nog ' + eur(left)) + '</span></span></button>';
  }).join('');
  /* per maand: alles in pockets samen tegenover het totale budget */
  var mcov = {}; ps.forEach(function (p) { if (!p.jaar) p.cats.forEach(function (c) { mcov[c] = 1; }); });
  var hist = M.V.map(function (m) { var s = 0; M.allS.forEach(function (x) { if (x.m === m && x.t === 'uitgave' && mcov[x.r.Categorie]) s -= x.a; }); return [{ v: s, c: s > tb + 0.5 ? 'var(--neg)' : 'var(--accent)' }]; });
  var chart = false ? '<div class="pkc">' + vbars(M.V, hist, tb, { sel: function (m) { return m >= M.P.from && m <= M.P.to; } }) + '<div class="lgd"><span><i class="sw a"></i>Uitgegeven in pockets per maand</span><span><i class="dl"></i>Totaal budget ' + eur(tb) + '</span></div></div>' : '';
  return { title: ok + ' van ' + ps.length + ' pockets binnen budget ' + M.when, body: '<div class="pkh"><span>' + eur(tu) + ' van ' + eur(tb) + (M.P.n > 1 ? ' per maand' : '') + ' · buiten pockets ' + eur(outside / M.P.n) + '</span>' + btn + '</div><div class="pks">' + cards + '</div>' + chart };
};
R.regel = function (M, size) {
  var e = needOwn(M); if (e) return { title: '50/30/20-regel', body: empty(e) };
  var r = C.rule503020(M.ctx, M.rows), inc = r.inkomen;
  if (inc <= 0) return { title: 'Geen inkomen ' + M.when, body: empty('De regel vergelijkt met je inkomen.') };
  var parts = [['nodig', 'Nodig', r.nodig, 0.5], ['wens', 'Wensen', r.wens, 0.3], ['sparen', 'Niet uitgegeven', r.sparen, 0.2]];
  var worst = parts.slice().sort(function (a, b) { return Math.abs(b[2] / inc - b[3]) - Math.abs(a[2] / inc - a[3]); })[0], off = worst[2] / inc - worst[3];
  var title = Math.abs(off) < 0.05 ? '50/30/20: ' + J(M, 'je zit', 'jullie zitten') + ' er dicht bij' : '50/30/20: ' + worst[1].toLowerCase() + ' ' + pct(Math.max(0, worst[2]) / inc, 0) + ' van ' + J(M, 'je', 'jullie') + ' inkomen, richtlijn ' + pct(worst[3], 0);
  return { title: title, body: '<div class="rule row">' + parts.map(function (p) {
    var x = Math.max(0, p[2] / inc), good = p[0] === 'sparen' ? x >= p[3] : x <= p[3] + 0.02;
    var inner = '<span class="rh"><b>' + p[1] + '</b><span class="' + (good ? '' : 'neg') + '">' + pct(x, 0) + ' <small>richtlijn ' + pct(p[3], 0) + '</small></span></span>' +
      '<span class="rb"><i style="width:' + Math.min(100, x * 100).toFixed(1) + '%' + (good ? '' : ';background:var(--neg)') + '"></i><b style="left:' + (p[3] * 100) + '%"></b></span>';
    return p[0] === 'sparen' ? '<div class="rr">' + inner + '</div>' : '<button class="rr lrow" data-dd="need:' + p[0] + '">' + inner + '</button>';
  }).join('') + '</div>' };
};

/* ---------- Vaste kosten ---------- */
function fixedRun(M) { return M.rec().filter(function (r) { return r.loopt; }); }
R.vastsoort = function (M, size) {
  var run = fixedRun(M);
  if (!run.length) return { title: 'Nog geen vaste kosten herkend', body: empty('Vaste kosten verschijnen zodra dezelfde partij minstens 3 maanden terugkomt.') };
  var by = {}; run.forEach(function (r) { var t = C.fixedType(r); by[t] = (by[t] || 0) + r.perMaand; });
  var list = Object.keys(by).map(function (k) { return { l: k, v: by[k] }; }).sort(function (a, b) { return b.v - a.v; });
  var t = topItems(list, 6, function (c) { return 'ftype:' + encodeURIComponent(c.l); }), inc = avg(M.full(), 'inkomenStructureel');
  return { title: eur(t.tot) + ' per maand ligt vast' + (inc > 0 ? ', ' + pct(t.tot / inc, 0) + ' van ' + J(M, 'je', 'jullie') + ' inkomen' : ''),
    body: '<div class="dw">' + pie(t.items, eur(t.tot), 'per maand') + (size === 'S' ? '' : pieLegend(t.items, t.tot)) + '</div>' };
};
/* Inzichten: de geselecteerde maand in gewone taal, plus wat je deze maand in de gaten houdt */
R.inzichten = function (M, size) {
  var e = M.view !== 'SAMEN' && needOwn(M); if (e) return { title: 'Inzichten', body: empty(e) };
  var m = M.m, r = M.ref(), samen = M.view === 'SAMEN', vs = m.inkomen + m.uitgaven, left = vs - m.gespaard;
  var noise = function (cat) { return cat === 'Bijdrage gezamenlijke rekening'; };
  var dd = function (k) { return ' data-dd="' + k + '" role="button" tabindex="0"'; };
  var card = function (cls, t, sub, inner) { return '<section class="ix ' + cls + '"><header><h4>' + t + '</h4>' + (sub ? '<span>' + sub + '</span>' : '') + '</header>' + inner + '</section>'; };
  var delta = function (v, ref, goodUp) {
    if (ref == null || Math.abs(ref) < 1) return '';
    var d = v - ref, good = goodUp ? d >= 0 : d <= 0;
    return Math.abs(d) < 1 ? '<em>zoals gewoonlijk</em>' : '<em class="' + (good ? 'pos' : 'neg') + '">' + (d > 0 ? '▲ ' : '▼ ') + eurAbs(d) + '</em>';
  };
  /* pockets */
  var ps = C.pockets(M.ctx, M.view, M.rows, M.P.n).filter(function (p) { return !p.jaar && !p.cats.every(noise); });
  var over = ps.filter(function (p) { return p.uitgegeven > p.budget + 0.5; }).sort(function (a, b) { return (b.uitgegeven - b.budget) - (a.uitgegeven - a.budget); });
  var okN = ps.length - over.length, score = ps.length ? okN / ps.length : null;
  /* 1. hero: score + kerncijfers */
  var R0 = 30, Cc = 2 * Math.PI * R0, sc = score == null ? 0 : score;
  var ring = '<div class="ixring" role="img" aria-label="' + okN + ' van ' + ps.length + ' pockets binnen budget"><svg viewBox="0 0 72 72"><circle cx="36" cy="36" r="' + R0 + '" fill="none" stroke="var(--track)" stroke-width="8"/>' +
    '<circle cx="36" cy="36" r="' + R0 + '" fill="none" stroke="' + (sc >= 0.75 ? 'var(--pos)' : sc >= 0.5 ? 'var(--accent)' : 'var(--neg)') + '" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + (sc * Cc).toFixed(1) + ' ' + Cc.toFixed(1) + '" transform="rotate(-90 36 36)"/></svg>' +
    '<div class="ixrc"><b>' + (ps.length ? okN + '/' + ps.length : '–') + '</b><small>pockets ok</small></div></div>';
  var kpis = samen
    ? [['Uitgegeven', eurAbs(m.uitgaven), delta(-m.uitgaven, r ? -r.uitgaven : null, false)]]
    : [['Inkomen', eur(m.inkomen), delta(m.inkomen, r ? r.inkomen : null, true)], ['Uitgegeven', eurAbs(m.uitgaven), delta(-m.uitgaven, r ? -r.uitgaven : null, false)],
       ['Gespaard', eur(m.gespaard), delta(m.gespaard, r ? r.gespaard : null, true)], ['Op rekening', '<span class="' + (left < 0 ? 'neg' : '') + '">' + eur(left) + '</span>', '']];
  if (samen) { var ff = C.fixedFree(M.rows, M.freq().keys, C.range(M.P.from, M.P.to)).reduce(function (a, x) { a.v += x.vast; a.f += x.vrij; return a; }, { v: 0, f: 0 }); kpis.push(['Vaste kosten', eur(ff.v), ''], ['Vrij uitgegeven', eur(ff.f), '']); }
  var verdict = samen ? 'Jullie gaven ' + eurAbs(m.uitgaven) + ' uit van de gezamenlijke rekening'
    : vs >= 0 ? 'Je hield ' + eur(vs) + ' over en spaarde ' + pct(m.spaarratio || 0, 0) + ' van je inkomen' : 'Je gaf ' + eurAbs(vs) + ' meer uit dan je verdiende';
  var hero = '<section class="ix ixhero">' + ring + '<div class="ixv"><p class="ixk">' + esc(mLong(M.P.to, true)) + (M.P.n > 1 ? ' · ' + M.P.n + ' maanden' : '') + '</p><p class="ixt">' + verdict + '</p>' +
    '<div class="ixs">' + kpis.map(function (k) { return '<div><span>' + k[0] + '</span><b>' + k[1] + '</b>' + k[2] + '</div>'; }).join('') + '</div></div></section>';
  /* 2. pockets over budget als balkjes */
  var pkHtml = over.length ? '<ul class="ixb">' + over.slice(0, 4).map(function (p) {
    var f = Math.min(1, p.budget / p.uitgegeven);
    return '<li' + dd('pk:' + encodeURIComponent(p.cats.join('|'))) + '><div class="ixl"><span>' + esc(p.naam) + '</span><b class="neg">+' + eurAbs(p.uitgegeven - p.budget) + '</b></div><div class="ixbar"><i class="in" style="width:' + (f * 100).toFixed(1) + '%"></i><i class="ov" style="width:' + ((1 - f) * 100).toFixed(1) + '%"></i></div></li>';
  }).join('') + '</ul>' : '<div class="ixok">✓ Alle pockets binnen budget</div>';
  /* 3. hoger en lager: balkjes rond het midden */
  var c = catModel(M), diffs = c.items.filter(function (it) { return !it.pot && !noise(it.naam) && it.ref != null && Math.abs(it.v - it.ref) >= 30; }).sort(function (a, b) { return Math.abs(b.v - b.ref) - Math.abs(a.v - a.ref); }).slice(0, 4);
  var dmx = Math.max.apply(null, diffs.map(function (it) { return Math.abs(it.v - it.ref); }).concat(1));
  var dfHtml = diffs.length ? '<ul class="ixd">' + diffs.map(function (it) {
    var d = it.v - it.ref, w = (Math.abs(d) / dmx * 50).toFixed(1);
    return '<li' + dd('cat:' + encodeURIComponent(it.naam)) + '><span class="n">' + esc(it.naam) + '</span><span class="track"><i class="' + (d > 0 ? 'up' : 'dn') + '" style="width:' + w + '%"></i></span><b class="' + (d > 0 ? 'neg' : 'pos') + '">' + (d > 0 ? '+' : '−') + eurAbs(d) + '</b></li>';
  }).join('') + '</ul>' : '<div class="ixok">Niets week sterk af van gewoonlijk</div>';
  /* 4. grootste losse uitgaven */
  var big = C.largest(loose(M).filter(function (x) { return !noise(x.r.Categorie); }), 3), bmx = big.length ? big[0].bedrag : 1;
  var bgHtml = big.length ? '<ul class="ixb">' + big.map(function (b, i) {
    return '<li><div class="ixl"><span><i class="ixrk">' + (i + 1) + '</i>' + esc(b.naam) + '<small>' + dNice(b.datum) + ' · ' + esc(b.cat) + '</small></span><b>' + eur(b.bedrag) + '</b></div><div class="ixbar"><i class="in" style="width:' + (b.bedrag / bmx * 100).toFixed(1) + '%"></i></div></li>';
  }).join('') + '</ul>' : '<div class="ixok">Geen losse uitgaven</div>';
  /* 5. komt eraan */
  var lc = M.dq.lastComplete, next = C.addM(M.P.to > lc ? lc : M.P.to, 1);
  var up = C.upcoming(C.inPeriod(M.all, M.V[0], lc), M.freq().keys, lc).filter(function (b) { return b.volgende === next && b.bedrag >= 20; });
  var dear = M.rec().filter(function (x) { return x.loopt && x.stijging; }).slice(0, 2);
  var nx = up.map(function (b) { return '<li><span class="ixchip">' + mShort(next) + '</span><span>' + esc(b.naam) + '</span><b>' + eur(b.bedrag) + '</b></li>'; })
    .concat(dear.map(function (x) { return '<li><span class="ixchip neg">duurder</span><span>' + esc(x.naam) + '</span><b class="neg">+' + eur(x.stijging) + '/m</b></li>'; }));
  /* 6. acties */
  var todo = [];
  over.slice(0, 2).forEach(function (p) { todo.push({ ic: '◔', t: 'Rem af op <b>' + esc(p.naam) + '</b>', s: eurAbs(p.uitgegeven - p.budget) + ' boven het budget van ' + eur(p.budget) }); });
  up.forEach(function (b) { todo.push({ ic: '→', t: 'Zet <b>' + eur(b.bedrag) + '</b> klaar', s: 'voor ' + esc(b.naam) + ' in ' + mLong(next) }); });
  if (!samen) {
    var A = adviceModel(M), goal = CFG.SPAARDOEL * m.inkomenStructureel;
    if (A && A.avail > 0) todo.push({ ic: '↗', t: 'Zet <b>' + eur(A.avail) + '</b> opzij', s: 'naar sparen of beleggen; ' + eur(A.keep) + ' blijft voor volgende maand', good: 1 });
    else if (A) todo.push({ ic: '⏸', t: 'Laat je saldo staan', s: eur(A.cur) + ' op je rekening, volgende maand kost ongeveer ' + eur(A.keep) });
    if (m.gespaard + 0.5 < goal) todo.push({ ic: '◎', t: 'Nog <b>' + eur(goal - m.gespaard) + '</b> tot je spaardoel', s: 'doel ' + pct(CFG.SPAARDOEL, 0) + ' van je vaste inkomen' });
    else if (goal > 0) todo.push({ ic: '★', t: 'Spaardoel gehaald', s: eur(m.gespaard) + ' gespaard, doel was ' + eur(goal), good: 1 });
  }
  var todoHtml = todo.length ? '<ol class="ixa">' + todo.slice(0, 4).map(function (t) { return '<li class="' + (t.good ? 'good' : '') + '"><i aria-hidden="true">' + t.ic + '</i><div><p>' + t.t + '</p><small>' + t.s + '</small></div></li>'; }).join('') + '</ol>' : '<div class="ixok">✓ Niets bijzonders, zo doorgaan</div>';
  var title = 'Inzichten ' + M.when;
  return { title: title, cls: 'insw', body: '<div class="ixg">' + hero +
    card('ixp', 'Pockets over budget', over.length ? over.length + ' van ' + ps.length : '', pkHtml) +
    card('ixc', 'Anders dan gewoonlijk', 'vs 3 maanden ervoor', dfHtml) +
    card('ixbig', 'Grootste losse uitgaven', '', bgHtml) +
    card('ixn', 'Komt eraan', '', nx.length ? '<ul class="ixu">' + nx.join('') + '</ul>' : '<div class="ixok">Geen grote rekeningen volgende maand</div>') +
    card('ixt2', 'Deze maand', 'wat je kan doen', todoHtml) + '</div>' };
};

/* Maandadvies: wat blijft op de rekening voor volgende maand, wat gaat naar de spaarbuffer en wat naar ETF's.
   Rekenregel op basis van eigen instellingen (BUFFER_DOEL, ETF_DEEL, SPAARREKENING), geen beleggingsadvies. */
function adviceModel(M) {
  var lc = M.dq.lastComplete, to = M.P.to > lc ? lc : M.P.to, next = C.addM(to, 1);
  var w = C.wealth(M.ctx, M.view, to), cur = w.parts.filter(function (p) { return p.soort === 'rekening'; }).reduce(function (a, p) { return a + p.v; }, 0);
  if (!w.parts.some(function (p) { return p.soort === 'rekening'; })) return null;
  var last3 = C.byMonth(M.allS, C.range(C.addM(to, -2), to), true), spend = -last3.reduce(function (a, x) { return a + x.uitgaven; }, 0) / 3;
  var bills = C.upcoming(C.inPeriod(M.all, M.V[0], to), M.freq().keys, to).filter(function (b) { return b.volgende === next; }).reduce(function (a, b) { return a + b.bedrag; }, 0);
  var keep = spend + bills, avail = cur - keep;
  var savNow = setting(M, 'SPAARREKENING') != null ? C.num(setting(M, 'SPAARREKENING')) : (w.parts.filter(function (p) { return p.soort === 'sparen'; })[0] || {}).v;
  var target = setting(M, 'BUFFER_DOEL') != null ? C.num(setting(M, 'BUFFER_DOEL')) : Math.round(spend * 3 / 100) * 100;
  var etfPct = setting(M, 'ETF_DEEL') != null ? C.num(setting(M, 'ETF_DEEL')) / 100 : null;
  var toSav = 0, toEtf = 0, rest = Math.max(0, avail), note = [];
  if (savNow == null) note.push('Vul de stand van je spaarrekening in om de buffer mee te rekenen.');
  else { toSav = Math.min(rest, Math.max(0, target - savNow)); rest -= toSav; }
  if (etfPct == null) { if (rest > 0) note.push('Kies via Instellingen welk deel van het overschot naar ETF\'s gaat.'); }
  else { toEtf = rest * etfPct; toSav += rest - toEtf; rest = 0; }
  return { to: to, next: next, cur: cur, spend: spend, bills: bills, keep: keep, avail: avail, savNow: savNow, target: target, etfPct: etfPct, toSav: toSav, toEtf: toEtf, rest: rest, note: note };
}
R.advies = function (M, size) {
  if (M.view === 'SAMEN') return { title: 'Maandadvies', body: empty('Het maandadvies staat bij Mats en Sofie: sparen en beleggen gebeurt per persoon.') };
  var A = adviceModel(M); if (!A) return { title: 'Maandadvies', body: empty('Nog geen saldo van je zichtrekening in Saldi.') };
  var next = A.next, keep = A.keep, spend = A.spend, bills = A.bills, avail = A.avail, savNow = A.savNow, target = A.target, etfPct = A.etfPct, toSav = A.toSav, toEtf = A.toEtf, rest = A.rest, note = A.note, cur = A.cur;
  var title = avail <= 0 ? 'Laat alles op je rekening staan voor ' + mLong(next) : 'Advies voor ' + mLong(next) + ': ' + eur(avail) + ' kan weg van je rekening';
  var item = function (v, l, c) { return '<div><b' + (c ? ' class="' + c + '"' : '') + '>' + eur(v) + '</b><span>' + l + '</span></div>'; };
  return { title: title, body: '<div class="stats">' + item(keep, 'houd op je rekening (' + eur(spend) + ' uitgaven' + (bills ? ' + ' + eur(bills) + ' rekeningen' : '') + ')') +
    item(toSav, 'naar de spaarrekening' + (savNow != null ? ' (buffer ' + eur(target) + ')' : ''), 'pos') + item(etfPct == null ? rest : toEtf, etfPct == null ? 'naar sparen of beleggen' : 'naar ETF\'s', 'pos') + '</div>' +
    '<p class="nt">Rekening nu ' + eur(cur) + '. ' + note.join(' ') + ' Een rekenregel op basis van jullie eigen instellingen, geen beleggingsadvies.</p><button class="btn sm2" data-act="fire">Instellingen</button>' };
};
R.komend = function (M, size) {
  var up = C.upcoming(C.inPeriod(M.all, M.V[0], M.dq.lastComplete), M.freq().keys, M.dq.lastComplete).filter(function (o) { return o.bedrag >= 20; });
  if (!up.length) return { title: 'Geen kwartaal- of jaarbetalingen herkend', body: empty('Betalingen die om de 3 of 12 maanden terugkomen, verschijnen hier met de maand waarin ze verwacht worden.') };
  return { title: 'Volgende: ' + up[0].naam + ' in ' + mLong(up[0].volgende) + ' (' + eur(up[0].bedrag) + ')', body: fitList(up.map(function (o) { return { t: o.naam, s: (o.kind === 'kwartaal' ? 'per kwartaal' : 'per jaar') + ' · verwacht ' + mShort(o.volgende) + ' ' + o.volgende.slice(0, 4), v: eur(o.bedrag), dd: 'cp:' + encodeURIComponent(o.key) }; }), 'komend') };
};

R.auto = function (M, size) {
  var lc = M.dq.lastComplete, rows = C.inPeriod(M.all, M.V[0], lc), n = M.V.length, c = C.carCosts(rows);
  var who = M.view === 'SOFIE' ? 'Sofie' : M.view === 'MATS' ? 'Mats' : 'jullie';
  if (c.totaal < 0.5) return { title: 'Wat kost de auto', body: empty('Geen tankbeurten, garage of parking gevonden voor ' + who + '.') };
  var pm = c.totaal / n, py = pm * 12, pd = py / 365, mx = 0;
  var soorten = Object.keys(c.perSoort).filter(function (k) { return c.perSoort[k] > 0.5; }).sort(function (a, b) { return c.perSoort[b] - c.perSoort[a]; });
  soorten.forEach(function (k) { mx = Math.max(mx, c.perSoort[k]); });
  var miss = !(c.perSoort['Verzekering en taks'] > 0.5);
  var head = '<div class="stats"><div><b>' + eur(pm) + '</b><span>per maand</span></div><div><b>' + (pd < 0.5 ? '< €1' : nf2.format(pd)) + '</b><span>per dag</span></div>' + (size !== 'S' ? '<div><b>' + eur(py) + '</b><span>per jaar</span></div>' : '') + '</div>';
  return { title: 'De auto kost ' + who + ' ongeveer ' + eur(py) + ' per jaar', body: head +
    fitList(soorten.map(function (k) { return { t: k, s: pct(c.perSoort[k] / c.totaal, 0) + ' van de autokosten', v: eur(c.perSoort[k] / n) + ' <small>/mnd</small>', bar: c.perSoort[k] / mx, dd: 'car:' + encodeURIComponent(k) }; }), 'auto') +
    (size !== 'S' || miss ? note((miss ? 'Geen verzekering of verkeersbelasting gevonden.' : '') + (size !== 'S' ? ' Herkend op naam, ' + mShort(M.V[0]) + '–' + mShort(lc) + '.' : '')) : '') };
};

/* ---------- Sparen ---------- */
function perPerson(M, fn) { return ['MATS', 'SOFIE'].map(function (p) { var all = C.rowsFor(M.ctx, p); return fn(p, all, C.byMonth(all, M.V)); }); }
R.spaarverloop = function (M, size) {
  var V = M.V, sel = function (m) { return m >= M.P.from && m <= M.P.to; };
  if (M.view === 'SAMEN') {
    var pp = perPerson(M, function (p, all, f) { return { p: p, f: f, avg: avg(f, 'gespaard') || 0 }; });
    var groups = V.map(function (m, i) { return [{ v: pp[0].f[i].gespaard, c: 'var(--mats)', l: 'Mats' }, { v: pp[1].f[i].gespaard, c: 'var(--sofie)', l: 'Sofie' }]; });
    return { title: 'Gemiddeld per maand: Mats spaarde ' + eur(pp[0].avg) + ', Sofie ' + eur(pp[1].avg), body: vbars(V, groups, 0, { sel: sel }) + '<div class="lgd"><span><i class="sw" style="background:var(--mats)"></i>Mats</span><span><i class="sw" style="background:var(--sofie)"></i>Sofie</span><span>Jullie sparen elk apart</span></div>' };
  }
  var e = needOwn(M); if (e) return { title: 'Gespaard per maand', body: empty(e) };
  var f = M.full(), a = avg(f, 'gespaard') || 0, inc = avg(f, 'inkomenStructureel') || 0, goal = CFG.SPAARDOEL * inc;
  var hit = f.filter(function (x) { return x.gespaard >= CFG.SPAARDOEL * x.inkomenStructureel - 0.5; }).length;
  return { title: 'Je spaarde gemiddeld ' + eur(a) + ' per maand, doel gehaald in ' + hit + ' van ' + f.length + ' maanden',
    body: vbars(V, f.map(function (x) { return [{ v: x.gespaard, c: 'var(--accent)' }]; }), goal, { sel: sel }) + '<div class="lgd"><span><i class="sw a"></i>Naar sparen en beleggen</span><span><i class="dl"></i>Doel ' + pct(CFG.SPAARDOEL, 0) + ' van je inkomen (' + eur(goal) + ')</span></div>' };
};
R.beleggingen = function (M, size) {
  var b = C.investments(M.ctx, M.view);
  if (!b) {
    var g = {}, tot = 0;
    C.inPeriod(M.all, M.V[0], M.dq.lastComplete).forEach(function (x) { if (x.t !== 'sparen') return; var k = C.cleanName(x.r.Tegenpartij || x.r.Omschrijving); g[k] = (g[k] || 0) - x.a; tot -= x.a; });
    var ks = Object.keys(g).filter(function (k) { return Math.abs(g[k]) >= 0.5; }).sort(function (a, b) { return g[b] - g[a]; });
    if (!ks.length) return { title: 'Beleggingen', body: empty('Nog geen beleggingen in het tabblad Beleggingen en geen overschrijvingen naar sparen.') };
    return { title: 'Geen ETF\'s; ' + eur(tot) + ' ging naar sparen sinds ' + mLong(M.V[0]), body: fitList(ks.map(function (k) { return { t: k, s: 'naar sparen', v: eur(g[k]), bar: g[k] / g[ks[0]] }; }), 'beleggingen') + note('Beleggingen verschijnen hier zodra ze in het tabblad Beleggingen staan.') };
  }
  var up = b.winst >= 0;
  var title = (M.view === 'SAMEN' ? 'Jullie' : 'Je') + ' ETF\'s zijn ' + eur(b.waarde) + ' waard, ' + (up ? '+' : '−') + pct(Math.abs(b.rendement || 0), 1) + ' rendement';
  var k = '<div class="kpi kx"><div class="kv">' + eur(b.waarde) + '</div><div class="kl"><span class="' + (up ? 'pos' : 'neg') + '">' + (up ? '▲ ' : '▼ ') + signed(b.winst) + '</span> op ' + eur(b.ingelegd) + ' ingelegd · ' + dNice(b.datum) + '</div></div>';
  if (size === 'S') return { title: title, body: k };
  var short = function (s) { return String(s).replace(/\b(UCITS|ETF|USD|EUR|ACC|ACCUMULATION|ACCUMULATING|DIST|A)\b/gi, '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); }); };
  var mxv = Math.max.apply(null, b.list.map(function (e) { return e.waarde; }).concat(1));
  return { title: title, body: k + (b.hist.length > 1 ? '<div class="spk">' + area(b.hist.map(function (x) { return x.v; })) + '</div>' : '') +
    fitList(b.list.map(function (e) { var w = e.waarde - e.ingelegd; return { t: short(e.naam), s: e.aantal + ' stuks · ingelegd ' + eur(e.ingelegd) + (M.view === 'SAMEN' ? ' · ' + (e.wie === 'MATS' ? 'Mats' : e.wie === 'SOFIE' ? 'Sofie' : 'samen') : ''), v: eur(e.waarde) + ' <small class="' + (w >= 0 ? 'pos' : 'neg') + '">' + signed(w) + '</small>', bar: e.waarde / mxv }; }), 'beleggingen') +
    (b.hist.length < 2 ? note('Het verloop verschijnt zodra er een tweede maand in het tabblad staat.') : '') };
};
R.opzij = function (M, size) {
  var one = function (p) { var f = C.byMonth(C.rowsFor(M.ctx, p), M.V), b = C.investments(M.ctx, p); return { sp: f.reduce(function (a, x) { return a + x.gespaard; }, 0), etf: b ? b.waarde : 0 }; };
  if (M.view === 'SAMEN') {
    var a = one('MATS'), s = one('SOFIE');
    return { title: 'Sinds ' + mLong(M.V[0]) + ' naar sparen: Mats ' + eur(a.sp) + ', Sofie ' + eur(s.sp), body: '<div class="stats"><div><b class="cm">' + eur(a.sp) + '</b><span>Mats gespaard</span></div><div><b class="cs">' + eur(s.sp) + '</b><span>Sofie gespaard</span></div></div>' };
  }
  var o = one(M.view);
  return { title: 'Sinds ' + mLong(M.V[0]) + ' ging ' + eur(o.sp) + ' naar sparen en beleggen', body: '<div class="stats"><div><b>' + eur(o.sp) + '</b><span>naar sparen en beleggen</span></div>' + (o.etf ? '<div><b>' + eur(o.etf) + '</b><span>ETF-waarde nu</span></div>' : '') + '<div><b>' + eur(o.sp / M.V.length) + '</b><span>per maand</span></div></div>' };
};

/* ---------- FIRE ---------- */
function setting(M, k) {
  var r = (M.ctx.data.instellingen || []).filter(function (x) { return String(x.Sleutel) === M.view + '.' + k; })[0];
  return r && String(r.Waarde).trim() !== '' ? r.Waarde : null;
}
function fireModel(M) {
  var f = M.full(), n = f.length || 1, b = C.investments(M.ctx, M.view), buf = C.buffer(M.ctx, M.view, M.dq.lastComplete, 3);
  var exp = -f.reduce(function (a, x) { return a + x.uitgaven; }, 0) / n;
  var doel = C.num(setting(M, 'FIRE_DOEL')), voorlopig = !doel; if (!doel) doel = 25 * exp * 12;
  var barista = C.num(setting(M, 'BARISTA_DOEL')) || null;
  var start = setting(M, 'STARTVERMOGEN') != null ? C.num(setting(M, 'STARTVERMOGEN')) : (b ? b.waarde : 0) + (buf ? buf.saldo : 0);
  var inleg = setting(M, 'INLEG') != null ? C.num(setting(M, 'INLEG')) : f.reduce(function (a, x) { return a + x.gespaard; }, 0) / n;
  var r = setting(M, 'RENDEMENT') != null ? C.num(setting(M, 'RENDEMENT')) / 100 : 0.05, gj = C.num(setting(M, 'GEBOORTEJAAR')) || null;
  return { doel: doel, barista: barista, voorlopig: voorlopig, start: start, inleg: inleg, r: r, gj: gj, exp: exp, startAuto: setting(M, 'STARTVERMOGEN') == null, inlegAuto: setting(M, 'INLEG') == null };
}
/* Twee doelen: Barista FIRE (deeltijds werken dekt de rest) en volledige FIRE */
R.fire = function (M, size) {
  var e = needOwn(M); if (e) return { title: 'FIRE', body: empty(e) };
  var F = fireModel(M), full = C.fire(F.start, F.inleg, F.r, F.doel, 60), bar = F.barista ? C.fire(F.start, F.inleg, F.r, F.barista, 60) : null;
  var more = C.fire(F.start, F.inleg + 100, F.r, F.doel, 60);
  var nowY = +M.dq.lastComplete.slice(0, 4);
  var at = function (j) { return j == null ? 'niet binnen 60 jaar' : F.gj ? 'op je ' + (nowY + j - F.gj) : 'in ' + (nowY + j); };
  var wie = J(M, 'je', 'jullie');
  var title = full.jaren == null && !(bar && bar.jaren != null) ? 'Aan dit tempo haal' + (M.view === 'SAMEN' ? ' jullie' : ' je') + ' FIRE niet binnen 60 jaar'
    : bar ? 'Barista FIRE ' + at(bar.jaren) + ', volledige FIRE ' + at(full.jaren) : 'Aan dit tempo bereik' + (M.view === 'SAMEN' ? ' jullie' : ' je') + ' FIRE ' + at(full.jaren) + ' (over ' + full.jaren + ' jaar)';
  var yrs = Math.min(60, (full.jaren || 45) + 4), ser = full.reeks.slice(0, yrs + 1), mx = Math.max(F.doel, ser[ser.length - 1].v);
  var ax = axis(0, mx), Y = ax.Y, X = function (i) { return i / (ser.length - 1) * 100; };
  var d = ser.map(function (s, i) { return (i ? 'L' : 'M') + X(i).toFixed(2) + ',' + Y(s.v).toFixed(2); }).join(' ');
  var goal = function (v, c) { return '<line x1="0" x2="100" y1="' + Y(v).toFixed(2) + '" y2="' + Y(v).toFixed(2) + '" stroke="' + c + '" stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/>'; };
  var svg = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' + ax.grid +
    '<path d="' + d + ' L100,' + Y(0).toFixed(2) + ' L0,' + Y(0).toFixed(2) + ' Z" fill="var(--accent)" fill-opacity=".12"/><path d="' + d + '" fill="none" stroke="var(--accent)" stroke-width="2.75" vector-effect="non-scaling-stroke"/>' +
    goal(F.doel, 'var(--pos)') + (F.barista ? goal(F.barista, 'var(--muted)') : '') + '</svg>';
  var dot = function (res, v) { return res && res.jaren != null && res.jaren <= yrs ? '<i class="pt a" style="left:' + X(res.jaren) + '%;top:' + Y(v) + '%"></i>' : ''; };
  var lab = []; for (var i = 0; i < ser.length; i += Math.max(1, Math.round(ser.length / 6))) lab.push('<span style="left:' + X(i) + '%">' + (F.gj ? (nowY + i - F.gj) + ' j' : nowY + i) + '</span>');
  var chart = '<div class="chart"><div class="lines">' + ax.labels + '<div class="lplot">' + svg + dot(full, F.doel) + dot(bar, F.barista) +
    '<span class="gl2" style="top:' + Y(F.doel) + '%">Volledige FIRE ' + kEur(F.doel) + '</span>' + (F.barista ? '<span class="gl2 mu" style="top:' + Y(F.barista) + '%">Barista FIRE ' + kEur(F.barista) + '</span>' : '') + '</div><div class="xa">' + lab.join('') + '</div></div></div>';
  var gain = full.jaren != null && more.jaren != null ? full.jaren - more.jaren : null;
  var side = '<div class="hb"><ul class="hl">' + (F.barista ? '<li>Barista FIRE<b>' + kEur(F.barista) + '</b></li>' : '') + '<li>Volledige FIRE<b>' + kEur(F.doel) + '</b></li><li class="mu">Nu<b>' + eur(F.start) + '</b></li><li>Inleg per maand<b>' + eur(F.inleg) + '</b></li><li>Rendement<b>' + pct(F.r, 1) + '</b></li></ul>' +
    (gain ? '<p class="nt" style="margin-top:12px">€100 meer per maand: <b>' + gain + ' jaar</b> vroeger volledige FIRE.</p>' : '') + (F.voorlopig ? '<p class="nt">Voorlopig doel: 25 × ' + wie + ' jaaruitgaven (' + eur(F.exp * 12) + ').</p>' : '') + '</div>';
  return { title: title, cls: 'hero', body: side + '<div class="hc">' + chart + '</div>' };
};
R.fireinst = function (M, size) {
  var e = needOwn(M); if (e) return { title: 'FIRE-instellingen', body: empty(e) };
  var F = fireModel(M);
  var chip = function (l, v, auto) { return '<span><b>' + v + '</b> ' + l + (auto ? ' <small>(automatisch)</small>' : '') + '</span>'; };
  return { title: 'Aannames' + (F.voorlopig ? ': vul het FIRE-bedrag in van je adviseur' : ''), body: '<div class="pkh"><div class="chips">' + (F.barista ? chip('Barista FIRE', kEur(F.barista), false) : '') + chip('volledige FIRE', kEur(F.doel), F.voorlopig) + chip('nu belegd en op rekening', eur(F.start), F.startAuto) + chip('inleg per maand', eur(F.inleg), F.inlegAuto) + chip('rendement na inflatie', pct(F.r, 1), setting(M, 'RENDEMENT') == null) + chip('geboortejaar', F.gj || '–', false) + '</div><button class="btn sm2" data-act="fire">Aanpassen</button></div>' };
};

/* Volledige lijst voor "Toon alle" */
var FULL = {
  veranderingen: function (M) { return signals(M); },
  winkels: function (M) { return C.topCounterparties(loose(M), 1000).map(function (b) { return { t: b.naam, s: b.aantal + (b.aantal > 1 ? ' betalingen' : ' betaling'), v: eur(b.bedrag), dd: 'cp:' + encodeURIComponent(b.key) }; }); },
  eenmalig: function (M) { return C.largest(loose(M), 1000).map(function (b) { return { t: b.naam, s: dNice(b.datum) + ' · ' + b.cat, v: eur(b.bedrag) }; }); },
  komend: function (M) { return C.upcoming(C.inPeriod(M.all, M.V[0], M.dq.lastComplete), M.freq().keys, M.dq.lastComplete).map(function (o) { return { t: o.naam, s: 'verwacht ' + mShort(o.volgende) + ' ' + o.volgende.slice(0, 4), v: eur(o.bedrag) }; }); },
  gedeeld: function (M) { return sharedRows(M, C.householdSplit(M.ctx, M.P.from, M.P.to)); },
  categorieen: function (M) { var c = catModel(M); return c.items.map(function (x) { return catRow(x, c.mx); }); },
  vastelasten: function (M) { return M.rec().filter(function (r) { return r.loopt; }).map(recRow); },
  auto: function (M) { var c = C.carCosts(C.inPeriod(M.all, M.V[0], M.dq.lastComplete)), n = M.V.length; return Object.keys(c.perSoort).filter(function (k) { return c.perSoort[k] > 0.5; }).map(function (k) { return { t: k, v: eur(c.perSoort[k] / n) + ' <small>/mnd</small>', dd: 'car:' + encodeURIComponent(k) }; }); },
  beleggingen: function (M) {
    var b = C.investments(M.ctx, M.view); if (b) return b.list.map(function (e) { return { t: e.naam, s: e.aantal + ' stuks · ingelegd ' + eur(e.ingelegd), v: eur(e.waarde) }; });
    return C.inPeriod(M.all, M.V[0], M.dq.lastComplete).filter(function (x) { return x.t === 'sparen'; }).sort(function (a, b) { return a.r.Datum < b.r.Datum ? 1 : -1; }).map(function (x) { return { t: C.cleanName(x.r.Tegenpartij || x.r.Omschrijving), s: dNice(x.r.Datum), v: eur(-x.a) }; });
  },
  opvallend: function (M) {
    var mode = M.st.wstate.opvallend || 'signalen';
    if (mode === 'signalen') return signals(M);
    if (mode === 'winkels') return C.topCounterparties(loose(M), 1000).map(function (b) { return { t: b.naam, s: b.aantal + (b.aantal > 1 ? ' betalingen' : ' betaling'), v: eur(b.bedrag), dd: 'cp:' + encodeURIComponent(b.key) }; });
    return C.largest(loose(M), 1000).map(function (b) { return { t: b.naam, s: dNice(b.datum) + ' · ' + b.cat, v: eur(b.bedrag) }; });
  },
  dataoverzicht: function (M) {
    return accRows(M).map(function (r) { return { t: r.t, s: r.s, v: esc(r.v) }; })
      .concat(M.st.notes.filter(function (n) { return n.level !== 'alert'; }).map(function (n) { return { t: n.level === 'note' ? 'Aandachtspunt' : 'Voetnoot', s: n.text, v: '' }; }));
  }
};

function render(id, M, size) {
  var f = R[id];
  if (!f) return { title: 'Onbekende widget', body: empty('Deze widget bestaat niet meer.') };
  try { return f(M, size); }
  catch (e) { if (window.console) console.error(id, e); return { title: 'Deze tegel kon niet getekend worden', body: empty(e.message || String(e)) }; }
}

window.W = { fireModel: fireModel, render: render, model: model, full: FULL, drill: drill, dataIntro: dataIntro, rowsHtml: function (rows) { return '<ul class="list">' + rows.map(row).join('') + '</ul>'; },
  fmt: { esc: esc, eur: eur, pct: pct, mShort: mShort, mLong: mLong, dNice: dNice } };
})();
