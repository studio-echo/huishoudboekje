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
  var all = C.rowsFor(ctx, v), rows = C.inPeriod(all, P.from, P.to), m = C.metrics(rows);
  var M = { st: st, view: v, P: P, dq: dq, ctx: ctx, all: all, rows: rows, m: m, V: st.V, own: C.hasOwnAccounts(ctx, v), cache: {} };
  M.series = function () { return M.cache.s || (M.cache.s = C.byMonth(all, st.Months)); };
  M.full = function () { return M.cache.f || (M.cache.f = C.byMonth(all, st.V)); };
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
function lines(ser, opts) {
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

/* ---------- catalogus ---------- */
var R = {};

R.verloop = function (M, size) {
  var e = needOwn(M); if (e) return { title: 'Inkomen en uitgaven', body: empty(e) };
  var m = M.m, res = m.resultaat, cash = m.inkomen + m.uitgaven;
  var title = res >= 0 ? J(M, 'Je', 'Jullie') + ' hield' + (M.view === 'SAMEN' ? 'en' : '') + ' ' + eur(res) + ' over ' + M.when
    : cash < 0 ? J(M, 'Je gaf', 'Jullie gaven') + ' ' + eurAbs(cash) + ' meer uit dan er binnenkwam'
    : 'Na sparen kwam' + J(M, ' je', 'en jullie') + ' ' + eurAbs(res) + ' tekort';
  if (size === 'S') return { title: title, body: kpi('na sparen', eur(res), 'zonder eenmalig ' + signed(m.structureel)) };
  var ser = M.full().map(function (x) { return { m: x.m, a: x.inkomen, b: -x.uitgaven, sel: x.m >= M.P.from && x.m <= M.P.to }; });
  var side = '<div class="hb"><div class="big">' + hero(res) + '</div><div class="hs">over na sparen' + (M.P.n > 1 ? ', ' + eur(res / M.P.n) + ' per maand' : '') + '</div>' +
    '<ul class="hl"><li><i class="sw a"></i>Inkomen<b>' + eur(m.inkomen) + '</b></li><li><i class="sw dash"></i>Uitgaven<b>' + eur(-m.uitgaven) + '</b></li><li><i class="sw"></i>Gespaard<b>' + eur(m.gespaard) + '</b></li>' +
    (Math.abs(m.eenmalig) >= 0.5 ? '<li class="mu">Zonder eenmalig<b class="' + (m.structureel >= 0 ? 'pos' : 'neg') + '">' + signed(m.structureel) + '</b></li>' : '') + '</ul></div>';
  return { title: title, cls: 'hero', body: side + '<div class="hc">' + lines(ser) + '</div>' };
};

function kpiWidget(key, label, goed, needIncome) {
  return function (M, size) {
    if (needIncome) { var e = needOwn(M); if (e) return { title: label, body: empty(e) }; }
    var sign = key === 'uitgaven' ? -1 : 1, v = sign * M.m[key], r = M.ref(), refv = r ? sign * r[key] : null;
    var d = M.P.n === 1 && refv != null && Math.abs(refv) >= 1 ? (v - refv) / Math.abs(refv) : null;
    var title = d == null ? label + ' ' + M.when : Math.abs(d) < 0.03 ? label + ' zoals gewoonlijk' : label + ' ' + pct(Math.abs(d), 0) + (d > 0 ? ' hoger' : ' lager') + ' dan gewoonlijk';
    if (key === 'gespaard' && v <= 0.5) title = J(M, 'Je spaarde', 'Jullie spaarden') + ' niets ' + M.when;
    var ser = M.full(), vals = ser.map(function (x) { return sign * x[key]; }), sel = [];
    ser.forEach(function (x, i) { if (x.m >= M.P.from && x.m <= M.P.to) sel.push(i); });
    var foot = (d != null ? delta(v, refv, goed) + ' ' : '') + (refFoot(M, key, sign) || label);
    return { title: title, body: '<div class="kpi kx"><div class="kv">' + eur(v) + '</div><div class="kl">' + foot + '</div></div>' + mini(vals, sel) };
  };
}
R.inkomen = kpiWidget('inkomen', 'Inkomen', true, true);
R.uitgaven = kpiWidget('uitgaven', 'Uitgaven', false, false);
R.gespaard = kpiWidget('gespaard', 'Gespaard', true, true);

/* Aan dit tempo: gemiddeld opzij (gespaard + overgehouden) per volledige maand x 12 */
R.prognose = function (M, size) {
  var e = needOwn(M); if (e) return { title: 'Jaarprognose', body: empty(e) };
  var f = M.full(), n = f.length; if (!n) return { title: 'Jaarprognose', body: empty('Nog geen volledige maand.') };
  var sum = function (k) { return f.reduce(function (a, x) { return a + x[k]; }, 0); };
  var opzij = (sum('gespaard') + sum('resultaat')) / n, struct = (sum('gespaard') + sum('structureel')) / n;
  var title = opzij >= 0 ? 'Aan dit tempo ' + J(M, 'zet je', 'zetten jullie') + ' ' + eur(opzij * 12) + ' per jaar opzij' : 'Aan dit tempo ' + J(M, 'ga je', 'gaan jullie') + ' ' + eurAbs(opzij * 12) + ' per jaar achteruit';
  var sp = mShort(M.V[0]) + '–' + mShort(M.V[n - 1]);
  if (size === 'S') return { title: title, body: kpi('per jaar, gespaard + over', eur(opzij * 12), 'gem. ' + eur(opzij) + ' per maand') };
  return { title: title, body: '<div class="stats">' +
    '<div><b>' + eur(opzij * 12) + '</b><span>netto per jaar</span></div>' +
    '<div><b>' + eur(sum('gespaard') / n * 12) + '</b><span>naar sparen</span></div>' +
    '<div><b>' + eur(struct * 12) + '</b><span>zonder eenmalig</span></div></div>' +
    '<div class="cap">Gespaard plus overgehouden, gemiddeld ' + eur(opzij) + ' per maand (' + sp + ')</div>' };
};

/* Wat er deze maand nog vrij is: verwacht inkomen min vaste kosten, spaardoel en wat al los uitgegeven is */
R.nogvrij = function (M, size) {
  var e = needOwn(M); if (e) return { title: 'Nog vrij deze maand', body: empty(e) };
  var ms = M.st.Months, m = ms[ms.length - 1];
  if (M.dq.partialMonths.indexOf(m) < 0) return { title: 'Geen lopende maand', body: empty('Zodra er boekingen van een nieuwe maand zijn, zie je hier wat er nog vrij is.') };
  var rows = C.inPeriod(M.all, m, m), keys = M.recKeys(), got = C.metrics(rows).inkomen;
  var prev3 = C.byMonth(M.all, C.range(C.addM(M.dq.lastComplete, -2), M.dq.lastComplete), true), avgInc = avg(prev3, 'inkomenStructureel') || 0;
  var inc = Math.max(got, avgInc), fixed = M.rec().filter(function (r) { return r.loopt; }).reduce(function (a, r) { return a + r.perMaand; }, 0);
  var save = CFG.SPAARDOEL * inc, spent = 0;
  rows.forEach(function (x) { if (x.t === 'uitgave' && !keys[C.counterparty(x.r)]) spent -= x.a; });
  var budget = inc - fixed - save, free = budget - spent;
  var lastD = M.dq.maxLast && M.dq.maxLast.slice(0, 7) === m ? +M.dq.maxLast.slice(8) : 0;
  var days = Math.max(1, new Date(Date.UTC(+m.slice(0, 4), +m.slice(5), 0)).getUTCDate() - lastD);
  var title = free >= 0 ? 'Nog ' + eur(free) + ' vrij tot eind ' + mLong(m) + ', ' + eur(free / days) + ' per dag' : J(M, 'Je zit', 'Jullie zitten') + ' ' + eurAbs(free) + ' boven ' + J(M, 'je', 'jullie') + ' ritme voor ' + mLong(m);
  var p = budget > 0 ? Math.min(1, spent / budget) : 1;
  return { title: title, body: '<div class="goal"><div class="gbar"><i style="width:' + (p * 100).toFixed(1) + '%' + (free < 0 ? ';background:var(--neg)' : '') + '"></i></div>' +
    '<div class="gl"><span>' + eur(spent) + ' los uitgegeven</span><span>van ' + eur(Math.max(0, budget)) + (size !== 'S' ? ' · nog ' + days + ' dagen' : '') + '</span></div></div>' +
    (size === 'L' ? '<div class="cap">Inkomen ' + eur(inc) + ' min vaste kosten ' + eur(fixed) + ' en spaardoel ' + eur(save) + '. Boekingen tot ' + dNice(M.dq.maxLast) + '.</div>' : '') };
};

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
R.opgebouwd = function (M, size) {
  var e = needOwn(M); if (e) return { title: 'Opzij gezet', body: empty(e) };
  var cum = 0, cs = 0, f = M.full(), vals = f.map(function (x) { cum += x.resultaat + x.gespaard; cs += x.gespaard; return cum; });
  var title = cum >= 0 ? 'Sinds ' + mLong(M.V[0]) + ' ' + J(M, 'zette je', 'zetten jullie') + ' ' + eur(cum) + ' opzij' : 'Sinds ' + mLong(M.V[0]) + ' ' + J(M, 'ging je', 'gingen jullie') + ' ' + eurAbs(cum) + ' achteruit';
  if (size === 'S') return { title: title, body: kpi('gespaard + overgehouden', eur(cum)) };
  return { title: title, cls: 'hero', body: '<div class="hb"><div class="big">' + hero(cum) + '</div><ul class="hl"><li><i class="sw"></i>Gespaard<b>' + eur(cs) + '</b></li><li><i class="sw a"></i>Overgehouden<b>' + eur(cum - cs) + '</b></li><li class="mu">Gemiddeld per maand<b>' + eur(cum / (f.length || 1)) + '</b></li></ul></div>' +
    '<div class="hc">' + area(vals, { labels: f.map(function (x) { return mShort(x.m); }) }) + '</div>' };
};

/* Categorieen met potje of 'gewoonlijk' als streepje: zie meteen wat ontspoort */
function catModel(M) {
  var cats = C.byCategory(M.rows), n = M.P.n, cur = {}, tot = 0;
  cats.forEach(function (c) { cur[c.cat] = c.bedrag / n; tot += c.bedrag; });
  var lc = M.dq.lastComplete, usualRows = M.all.filter(function (x) { return !x.r.Eenmalig; }), usualMs = M.V.filter(function (m) { return m < M.P.from; }).slice(-3);
  if (usualMs.length < 2) usualMs = M.V.slice(-3);
  var usual = {};
  C.byCategory(C.inPeriod(usualRows, usualMs[0], usualMs[usualMs.length - 1])).forEach(function (c) { usual[c.cat] = c.bedrag / usualMs.length; });
  var pk = C.pockets(M.ctx, M.view, M.rows, n, [], 1), covered = {}, items = [];
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
  var title = f.inkomen > 0 ? 'Vaste kosten nemen ' + pct(f.vast / f.inkomen, 0) + ' van ' + J(M, 'je', 'jullie') + ' inkomen' : 'Geen inkomen ' + M.when;
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
  var title = eur(tot) + ' per maand ligt vast' + (inc > 0 ? ', ' + pct(tot / inc, 0) + ' van ' + J(M, 'je', 'jullie') + ' inkomen' : '');
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
  return o.sort(function (a, b) { return b.w - a.w; });
}
R.opvallend = function (M, size) {
  var mode = M.st.wstate.opvallend || 'signalen';
  var tg = toggle('opvallend', [['signalen', 'Signalen'], ['grootste', 'Grootste'], ['winkels', 'Winkels']], mode);
  if (mode === 'winkels') {
    var tp = C.topCounterparties(loose(M), 1000);
    if (!tp.length) return { title: 'Geen uitgaven ' + M.when, body: tg + empty('Geen uitgaven.') };
    return { title: J(M, 'Je gaf', 'Jullie gaven') + ' het meest uit bij ' + tp[0].naam, body: tg + fitList(tp.map(function (b) { return { t: b.naam, s: b.aantal + (b.aantal > 1 ? ' betalingen' : ' betaling'), v: eur(b.bedrag), dd: 'cp:' + encodeURIComponent(b.key) }; }), 'opvallend') };
  }
  if (mode === 'grootste') {
    var big = C.largest(loose(M), 1000);
    if (!big.length) return { title: 'Geen uitgaven ' + M.when, body: tg + empty('Geen uitgaven.') };
    return { title: J(M, 'Je', 'Jullie') + ' grootste uitgave: ' + big[0].naam + ' (' + eur(big[0].bedrag) + ')', body: tg + fitList(big.map(function (b) { return { t: b.naam, s: dNice(b.datum) + ' · ' + b.cat + (b.eenmalig ? ' · eenmalig' : ''), v: eur(b.bedrag) }; }), 'opvallend') };
  }
  var sg = signals(M);
  if (!sg.length) return { title: 'Niets ongewoons ' + M.when, body: tg + empty('Geen categorie wijkt sterk af, niets werd duurder en er waren geen grote eenmalige uitgaven.') };
  return { title: sg.length === 1 ? '1 ding springt eruit ' + M.when : sg.length + ' dingen springen eruit ' + M.when, body: tg + fitList(sg, 'opvallend') };
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

R.regel = function (M, size) {
  var e = needOwn(M); if (e) return { title: '50/30/20-regel', body: empty(e) };
  var r = C.rule503020(M.ctx, M.rows), inc = r.inkomen;
  if (inc <= 0) return { title: 'Geen inkomen ' + M.when, body: empty('De regel vergelijkt met je inkomen.') };
  var parts = [['nodig', 'Nodig', r.nodig, 0.5], ['wens', 'Wensen', r.wens, 0.3], ['sparen', 'Sparen en over', r.sparen, 0.2]];
  var worst = parts.slice().sort(function (a, b) { return Math.abs(b[2] / inc - b[3]) - Math.abs(a[2] / inc - a[3]); })[0];
  var off = worst[2] / inc - worst[3];
  var title = Math.abs(off) < 0.05 ? J(M, 'Je zit', 'Jullie zitten') + ' dicht bij de 50/30/20-regel'
    : worst[1] + ' ' + (worst[0] === 'sparen' ? 'is' : 'nemen') + ' ' + pct(Math.max(0, worst[2]) / inc, 0) + ' van ' + J(M, 'je', 'jullie') + ' inkomen, doel ' + pct(worst[3], 0);
  return { title: title, body: '<div class="rule">' + parts.map(function (p) {
    var x = Math.max(0, p[2] / inc), good = p[0] === 'sparen' ? x >= p[3] : x <= p[3] + 0.02;
    var inner = '<span class="rh"><b>' + p[1] + '</b><span class="' + (good ? '' : 'neg') + '">' + pct(x, 0) + ' <small>doel ' + pct(p[3], 0) + '</small></span></span>' +
      '<span class="rb"><i style="width:' + Math.min(100, x * 100).toFixed(1) + '%' + (good ? '' : ';background:var(--neg)') + '"></i><b style="left:' + (p[3] * 100) + '%"></b></span>';
    return p[0] === 'sparen' ? '<div class="rr">' + inner + '</div>' : '<button class="rr lrow" data-dd="need:' + p[0] + '">' + inner + '</button>';
  }).join('') + '</div>' + (size === 'L' ? note('Nodig: wonen, boodschappen, vervoer, gezondheid, administratie. De rest telt als wens. Pas dit aan met een kolom Soort in Categorieen.') : '') };
};

R.auto = function (M, size) {
  var lc = M.dq.lastComplete, rows = C.inPeriod(M.all, M.V[0], lc), n = M.V.length, c = C.carCosts(rows);
  var who = M.view === 'SOFIE' ? 'Sofie' : M.view === 'MATS' ? 'Mats' : 'jullie';
  if (c.totaal < 0.5) return { title: 'Wat kost de auto', body: empty('Geen tankbeurten, garage of parking gevonden voor ' + who + '.') };
  var pm = c.totaal / n, py = pm * 12, pd = py / 365, mx = 0;
  var soorten = Object.keys(c.perSoort).filter(function (k) { return c.perSoort[k] > 0.5; }).sort(function (a, b) { return c.perSoort[b] - c.perSoort[a]; });
  soorten.forEach(function (k) { mx = Math.max(mx, c.perSoort[k]); });
  var miss = !(c.perSoort['Verzekering en taks'] > 0.5);
  var head = '<div class="stats"><div><b>' + eur(py) + '</b><span>per jaar</span></div><div><b>' + eur(pm) + '</b><span>per maand</span></div><div><b>' + (pd < 0.5 ? '< €1' : nf2.format(pd)) + '</b><span>per dag</span></div></div>';
  if (size === 'S') return { title: 'De auto kost ' + who + ' ' + eur(pm) + ' per maand', body: head };
  return { title: 'De auto kost ' + who + ' ongeveer ' + eur(py) + ' per jaar', body: head +
    fitList(soorten.map(function (k) { return { t: k, s: pct(c.perSoort[k] / c.totaal, 0) + ' van de autokosten', v: eur(c.perSoort[k] / n) + ' <small>/mnd</small>', bar: c.perSoort[k] / mx, dd: 'car:' + encodeURIComponent(k) }; }), 'auto') +
    note((miss ? 'Geen verzekering of verkeersbelasting gevonden: betaald via een andere rekening? ' : '') + 'Herkend op naam, ' + mShort(M.V[0]) + '–' + mShort(lc) + '.') };
};

R.beleggingen = function (M, size) {
  var b = C.investments(M.ctx, M.view);
  if (!b) {
    /* zonder tabblad: wat er volgens de rekeningen naar sparen en beleggen ging */
    var g = {}, tot = 0;
    C.inPeriod(M.all, M.V[0], M.dq.lastComplete).forEach(function (x) { if (x.t !== 'sparen') return; var k = C.cleanName(x.r.Tegenpartij || x.r.Omschrijving); g[k] = (g[k] || 0) - x.a; tot -= x.a; });
    var ks = Object.keys(g).filter(function (k) { return Math.abs(g[k]) >= 0.5; }).sort(function (a, b) { return g[b] - g[a]; });
    if (!ks.length) return { title: 'Beleggingen', body: empty('Nog geen tabblad Beleggingen in het blad. Zie de gids voor de kolommen.') };
    return { title: eur(tot) + ' ging naar sparen en beleggen sinds ' + mLong(M.V[0]), body: '<div class="kpi kx"><div class="kv">' + eur(tot) + '</div><div class="kl">ingelegd volgens ' + J(M, 'je', 'jullie') + ' rekeningen</div></div>' +
      fitList(ks.map(function (k) { return { t: k, v: eur(g[k]), bar: g[k] / g[ks[0]] }; }), 'beleggingen') + note('Voeg een tabblad Beleggingen toe om ook de waarde en het rendement te zien.') };
  }
  var up = b.winst >= 0;
  var title = J(M, 'Je', 'Jullie') + ' ETF\'s zijn ' + eur(b.waarde) + ' waard' + (b.rendement != null ? ', ' + (up ? '+' : '−') + pct(Math.abs(b.rendement), 0) : '');
  var k = '<div class="kpi kx"><div class="kv">' + eur(b.waarde) + '</div><div class="kl"><span class="' + (up ? 'pos' : 'neg') + '">' + (up ? '▲ ' : '▼ ') + signed(b.winst) + '</span> op ' + eur(b.ingelegd) + ' ingelegd</div></div>';
  var hv = b.hist.map(function (x) { return x.v; });
  if (size === 'S') return { title: title, body: k + mini(hv, hv.length ? [hv.length - 1] : []) };
  return { title: title, body: '<div class="rw">' + k + (hv.length > 1 ? '<div class="spk">' + area(hv) + '</div>' : '') + '</div>' +
    fitList(b.list.map(function (e) { var w = e.waarde - e.ingelegd; return { t: e.etf, s: (e.aantal ? (Math.round(e.aantal * 100) / 100) + ' stuks · ' : '') + 'ingelegd ' + eur(e.ingelegd), v: eur(e.waarde) + ' <small class="' + (w >= 0 ? 'pos' : 'neg') + '">' + signed(w) + '</small>' }; }), 'beleggingen') };
};

/* ---------- doorklikken ---------- */
function txRow(x) { return { t: C.cleanName(x.r.Tegenpartij || x.r.Omschrijving), s: dNice(x.r.Datum) + ' · ' + x.r.Categorie + (x.r.Eenmalig ? ' · eenmalig' : ''), v: eur(-x.a) }; }
function drill(M, spec) {
  var i = spec.indexOf(':'), type = spec.slice(0, i), key = decodeURIComponent(spec.slice(i + 1)), keys, rows = M.rows, title, sub = M.when;
  var exp = function (f) { return function (x) { return x.t === 'uitgave' && f(x); }; };
  if (type === 'cat') { title = key; rows = rows.filter(exp(function (x) { return x.r.Categorie === key; })); }
  else if (type === 'cats') { var cs = key.split('|'); title = cs.join(', '); rows = rows.filter(exp(function (x) { return cs.indexOf(x.r.Categorie) >= 0; })); }
  else if (type === 'freq') { keys = M.freq().keys; title = FREQ.filter(function (f) { return f[0] === key; })[0][1]; rows = rows.filter(exp(function (x) { return (keys[C.counterparty(x.r) || '?'] || 'los') === key; })); }
  else if (type === 'vast') { keys = M.freq().keys; title = key === '1' ? 'Vaste uitgaven' : 'Vrije uitgaven'; rows = rows.filter(exp(function (x) { var k = keys[C.counterparty(x.r) || '?']; return (k && k !== 'los') === (key === '1'); })); }
  else if (type === 'need') { title = key === 'nodig' ? 'Nodig' : 'Wensen'; rows = rows.filter(exp(function (x) { return C.needKind(M.ctx, x.r.Categorie) === key; })); }
  else if (type === 'car') { title = key; sub = 'van ' + mShort(M.V[0]) + ' tot ' + mShort(M.dq.lastComplete); rows = C.inPeriod(M.all, M.V[0], M.dq.lastComplete).filter(exp(function (x) { return C.carKind(x.r) === key; })); }
  else if (type === 'cp') { title = key; sub = 'van ' + mShort(M.V[0]) + ' tot ' + mShort(M.dq.lastComplete); rows = C.inPeriod(M.all, M.V[0], M.dq.lastComplete).filter(exp(function (x) { return C.counterparty(x.r) === key; })); if (rows[0]) title = C.cleanName(rows[0].r.Tegenpartij || rows[0].r.Omschrijving); }
  else return null;
  rows = rows.slice().sort(function (a, b) { return a.r.Datum < b.r.Datum ? 1 : -1; });
  var tot = rows.reduce(function (a, x) { return a - x.a; }, 0);
  /* per maand over alle maanden, zodat je ziet of het normaal is */
  var pm = {};
  var base = type === 'car' || type === 'cp' ? rows : M.all.filter(exp(function (x) {
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

/* Volledige lijst voor "Toon alle" */
var FULL = {
  gedeeld: function (M) { return sharedRows(M, C.householdSplit(M.ctx, M.P.from, M.P.to)); },
  categorieen: function (M) { var c = catModel(M); return c.items.map(function (x) { return catRow(x, c.mx); }); },
  vastelasten: function (M) { return M.rec().filter(function (r) { return r.loopt; }).map(recRow); },
  auto: function (M) { var c = C.carCosts(C.inPeriod(M.all, M.V[0], M.dq.lastComplete)), n = M.V.length; return Object.keys(c.perSoort).filter(function (k) { return c.perSoort[k] > 0.5; }).map(function (k) { return { t: k, v: eur(c.perSoort[k] / n) + ' <small>/mnd</small>', dd: 'car:' + encodeURIComponent(k) }; }); },
  beleggingen: function (M) {
    var b = C.investments(M.ctx, M.view); if (b) return b.list.map(function (e) { return { t: e.etf, s: 'ingelegd ' + eur(e.ingelegd), v: eur(e.waarde) }; });
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

window.W = { render: render, model: model, full: FULL, drill: drill, dataIntro: dataIntro, rowsHtml: function (rows) { return '<ul class="list">' + rows.map(row).join('') + '</ul>'; },
  fmt: { esc: esc, eur: eur, pct: pct, mShort: mShort, mLong: mLong, dNice: dNice } };
})();
