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
  if (r.dd) return '<li><button class="lrow" data-dd="' + esc(r.dd) + '">' + row({ t: r.t, s: r.s, v: r.v, bar: r.bar }).slice(4, -5) + '</button></li>';
  return '<li><span class="ln"><span class="lt">' + esc(r.t) + '</span>' + (r.s ? '<span class="ls">' + esc(r.s) + '</span>' : '') + '</span>' +
    (r.bar != null ? '<span class="lb"><i style="width:' + Math.max(2, Math.min(100, r.bar * 100)).toFixed(1) + '%"></i></span>' : '') +
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
  return '<div class="area"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".38"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>' +
    '<line x1="0" x2="100" y1="' + z + '" y2="' + z + '" stroke="var(--line)" stroke-dasharray="2 3" vector-effect="non-scaling-stroke"/>' +
    '<path d="' + d + ' L100,100 L0,100 Z" fill="url(#' + id + ')"/>' +
    '<path d="' + d + '" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>' +
    '<i class="dot" style="left:100%;top:' + Y(vals[n - 1]).toFixed(2) + '%"></i>' +
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
function tint(i, n) { var p = Math.round(100 - i * (70 / Math.max(1, n - 1))); return 'color-mix(in srgb,var(--accent) ' + p + '%,var(--track))'; }
function donut(items, centre, sub) {
  var tot = items.reduce(function (a, b) { return a + b.v; }, 0) || 1, R = 38, Cc = 2 * Math.PI * R, off = 0, g = '';
  items.forEach(function (it, i) { var l = it.v / tot * Cc; g += '<circle cx="50" cy="50" r="' + R + '" fill="none" stroke="' + tint(i, items.length) + '" stroke-width="15" stroke-dasharray="' + Math.max(0, l - 1).toFixed(2) + ' ' + Cc.toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 50 50)"/>'; off += l; });
  return '<svg class="donut" viewBox="0 0 100 100" role="img" aria-label="Verdeling, totaal ' + esc(centre) + '"><circle cx="50" cy="50" r="' + R + '" fill="none" stroke="var(--track)" stroke-width="15"/>' + g +
    '<text x="50" y="52" text-anchor="middle" class="dc">' + esc(centre) + '</text><text x="50" y="64" text-anchor="middle" class="ds">' + esc(sub || '') + '</text></svg>';
}
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

/* ---------- catalogus ---------- */
var R = {};

R.resultaat = function (M, size) {
  var e = needOwn(M); if (e) return { title: 'Resultaat', body: empty(e) };
  var m = M.m, res = m.resultaat, cash = m.inkomen + m.uitgaven;
  var title = res >= 0 ? J(M, 'Je', 'Jullie') + ' hield' + (M.view === 'SAMEN' ? 'en' : '') + ' ' + eur(res) + ' over ' + M.when
    : cash < 0 ? J(M, 'Je gaf', 'Jullie gaven') + ' ' + eurAbs(cash) + ' meer uit dan er binnenkwam'
    : 'Na sparen kwam' + J(M, ' je', 'en jullie') + ' ' + eurAbs(res) + ' tekort';
  var sub = '<div class="hs">Zonder eenmalige posten: <b class="' + (m.structureel >= 0 ? 'pos' : 'neg') + '">' + (m.structureel >= 0 ? '▲ ' : '▼ ') + signed(m.structureel) + '</b></div>';
  if (size === 'S') return { title: title, body: kpi('Resultaat', eur(res), 'zonder eenmalig ' + signed(m.structureel)) };
  var ser = M.full().map(function (x) { return x.resultaat; });
  return { title: title, cls: 'hero', body: '<div class="hb"><div class="big">' + hero(res) + '</div>' + sub + '</div>' +
    (ser.length > 1 ? '<div class="hc">' + area(ser, { labels: [mShort(M.V[0]), mShort(M.V[M.V.length - 1])] }) + '<div class="cap">Resultaat per volledige maand</div></div>' : '') };
};

function kpiWidget(key, label, goed, needIncome) {
  return function (M, size) {
    if (needIncome) { var e = needOwn(M); if (e) return { title: label, body: empty(e) }; }
    var v = key === 'uitgaven' ? -M.m.uitgaven : M.m[key], r = M.ref(), refv = r ? (key === 'uitgaven' ? -r.uitgaven : r[key]) : null;
    var d = M.P.n === 1 && refv != null && Math.abs(refv) >= 1 ? (v - refv) / Math.abs(refv) : null;
    var title = d == null ? label + ' ' + M.when : Math.abs(d) < 0.03 ? label + ' zoals gewoonlijk' : label + ' ' + pct(Math.abs(d), 0) + (d > 0 ? ' hoger' : ' lager') + ' dan gewoonlijk';
    if (key === 'gespaard' && v <= 0.5) title = J(M, 'Je spaarde', 'Jullie spaarden') + ' niets ' + M.when;
    var foot = refFoot(M, key, key === 'uitgaven' ? -1 : 1) || label;
    return { title: title, body: kpi((d != null ? delta(v, refv, goed) + ' ' : '') + foot, eur(v)) };
  };
}
R.inkomen = kpiWidget('inkomen', 'Inkomen', true, true);
R.uitgaven = kpiWidget('uitgaven', 'Uitgaven', false, false);
R.gespaard = kpiWidget('gespaard', 'Gespaard', true, true);

R.spaarratio = function (M, size) {
  var e = needOwn(M); if (e) return { title: 'Spaarratio', body: empty(e) };
  var r = M.m.spaarratio, t = CFG.SPAARDOEL, s = CFG.SPAARDOEL_STRETCH;
  var title = r == null ? 'Geen inkomen ' + M.when : J(M, 'Je spaarde ', 'Jullie spaarden ') + pct(r) + ', ' + (r >= s ? 'boven je stretchdoel' : r >= t ? 'boven je doel' : 'onder je doel van ' + pct(t, 0));
  if (M.view === 'SAMEN') title = title.replace('je doel', 'jullie doel').replace('je stretchdoel', 'jullie stretchdoel');
  var txt = '<div class="rk"><div class="kl">Doel ' + pct(t, 0) + ' · stretch ' + pct(s, 0) + '</div>' +
    (size !== 'S' ? '<div class="kf">' + eur(M.m.gespaard) + ' van ' + eur(M.m.inkomen) + ' inkomen</div>' : '') + '</div>';
  return { title: title, body: '<div class="rw">' + ring(r || 0, t, s) + txt + '</div>' };
};

R.maandverloop = function (M, size) {
  var e = !M.own;
  var ser = M.series().map(function (x) {
    return { m: x.m, a: x.inkomen, b: -x.uitgaven, r: e || size === 'S' ? null : x.resultaat, sel: x.m >= M.P.from && x.m <= M.P.to, lopend: M.dq.partialMonths.indexOf(x.m) >= 0 };
  });
  var full = M.full(), pos = full.filter(function (x) { return x.resultaat >= 0; }).length;
  var title = e ? 'Uitgaven per maand' : pos + ' van de ' + full.length + ' volledige maanden ' + J(M, 'hield je', 'hielden jullie') + ' geld over';
  var lg = '<div class="lgd">' + (e ? '' : '<span><i class="sw a"></i>Inkomen</span>') + '<span><i class="sw b"></i>Uitgaven</span>' +
    (!e && size !== 'S' ? '<span><i class="sw r"></i>hield over</span><span><i class="sw rn"></i>tekort</span>' : '') + (ser.some(function (x) { return x.lopend; }) ? '<span>* lopend</span>' : '') + '<span class="hint">Tik op een maand</span></div>';
  return { title: title, body: bars(ser, { two: !e }) + lg };
};

R.opgebouwd = function (M, size) {
  var e = needOwn(M); if (e) return { title: 'Opgebouwd resultaat', body: empty(e) };
  var cum = 0, vals = M.full().map(function (x) { cum += x.resultaat; return cum; });
  var title = (cum >= 0 ? 'Sinds ' + mLong(M.V[0]) + ' ' + J(M, 'bouwde je', 'bouwden jullie') + ' ' + eur(cum) + ' op' : 'Sinds ' + mLong(M.V[0]) + ' ' + J(M, 'ging je', 'gingen jullie') + ' ' + eurAbs(cum) + ' achteruit');
  return { title: title, body: '<div class="fill">' + area(vals, { labels: [mShort(M.V[0]), mShort(M.V[M.V.length - 1])] }) + '</div>' + (size !== 'S' ? '<div class="cap">Som van het resultaat over de volledige maanden, na sparen</div>' : '') };
};

function catRows(M) {
  var cats = C.byCategory(M.rows), tot = cats.reduce(function (a, c) { return a + c.bedrag; }, 0), deltas = {};
  if (M.P.n === 1) {
    var allNo = M.all.filter(function (x) { return !x.r.Eenmalig; }), cur = {};
    C.byCategory(M.rows, true).forEach(function (c) { cur[c.cat] = c.bedrag; });
    cats.forEach(function (c) { var a = C.catAvgPrev(allNo, c.cat, M.P.from, 3, M.V); if (a != null && a >= 10) deltas[c.cat] = ((cur[c.cat] || 0) - a) / a; });
  }
  var mx = cats.length ? cats[0].bedrag : 1;
  return { tot: tot, cats: cats, rows: cats.map(function (c) {
    var d = deltas[c.cat], s = pct(c.bedrag / (tot || 1), 0) + ' van het totaal';
    if (d != null && Math.abs(d) >= 0.1) s += ' · ' + (d > 0 ? '▲ ' : '▼ ') + (Math.abs(d) > 3 ? '>300%' : pct(Math.abs(d), 0)) + ' t.o.v. gewoonlijk';
    return { t: c.cat, s: s, v: eur(c.bedrag / M.P.n), bar: c.bedrag / mx, dd: 'cat:' + encodeURIComponent(c.cat) };
  }) };
}
R.categorieen = function (M, size) {
  var c = catRows(M);
  if (!c.cats.length) return { title: 'Geen uitgaven ' + M.when, body: empty('Geen uitgaven in deze periode.') };
  var top = c.cats[0];
  return { title: top.cat + ' is ' + J(M, 'je', 'jullie') + ' grootste uitgave (' + pct(top.bedrag / c.tot, 0) + ')',
    body: listRows(c.rows, size, 'categorieen') + (M.P.n > 1 ? note('Bedragen per maand, gemiddeld over ' + M.P.n + ' maanden.') : '') };
};
R.donut = function (M, size) {
  var cats = C.byCategory(M.rows), tot = cats.reduce(function (a, c) { return a + c.bedrag; }, 0);
  if (!cats.length) return { title: 'Geen uitgaven ' + M.when, body: empty('Geen uitgaven in deze periode.') };
  var k = size === 'S' ? 3 : 5, items = cats.slice(0, k).map(function (c) { return { l: c.cat, v: c.bedrag }; }), rest = cats.slice(k).reduce(function (a, c) { return a + c.bedrag; }, 0);
  if (rest > 0.5) items.push({ l: 'Andere', v: rest });
  var top3 = cats.slice(0, 3).reduce(function (a, c) { return a + c.bedrag; }, 0);
  var parts = items.map(function (it, i) { return { l: it.l, v: it.v, c: tint(i, items.length) }; });
  return { title: 'De top 3 is ' + pct(top3 / (tot || 1), 0) + ' van ' + J(M, 'je', 'jullie') + ' uitgaven',
    body: '<div class="dw">' + donut(items, eur(tot), M.P.n > 1 ? M.P.n + ' maanden' : 'totaal') + (size === 'S' ? '' : legend(parts)) + '</div>' };
};

R.inkomenflow = function (M, size) {
  var e = needOwn(M); if (e) return { title: 'Waar ging ' + J(M, 'je', 'jullie') + ' inkomen heen', body: empty(e) };
  var mode = M.st.wstate.inkomenflow || 'verdeling';
  var tg = toggle('inkomenflow', [['verdeling', 'Verdeling'], ['structureel', 'Structureel']], mode);
  if (mode === 'structureel') {
    var m = M.m, once = m.eenmalig;
    var title = m.structureel >= 0 ? 'Zonder eenmalige posten ' + J(M, 'hield je', 'hielden jullie') + ' ' + eur(m.structureel) + ' over' : 'Ook zonder eenmalige posten ' + J(M, 'kom je', 'komen jullie') + ' ' + eurAbs(m.structureel) + ' tekort';
    return { title: title, body: tg + '<div class="duo">' + kpi('Structureel resultaat', '<span class="' + (m.structureel >= 0 ? 'pos' : 'neg') + '">' + (m.structureel >= 0 ? '▲ ' : '▼ ') + signed(m.structureel) + '</span>') +
      kpi('Eenmalig', '<span class="' + (once >= 0 ? 'pos' : 'neg') + '">' + (once >= 0 ? '▲ ' : '▼ ') + signed(once) + '</span>') + '</div>' +
      (size !== 'S' ? note('Structureel is wat er overblijft zonder eenmalige posten (kolom Eenmalig). Het toont het gewone ritme.') : '') };
  }
  var f = C.incomeFlow(M.rows, M.recKeys());
  var parts = [
    { l: 'Vaste lasten', v: f.vast, c: 'var(--accent)' },
    { l: 'Variabel', v: f.variabel, c: 'color-mix(in srgb,var(--accent) 60%,var(--track))' },
    { l: 'Eenmalig', v: f.eenmalig, c: 'color-mix(in srgb,var(--accent) 35%,var(--track))' },
    { l: 'Gespaard', v: f.gespaard, c: 'var(--pos)' },
    { l: f.over >= 0 ? 'Over' : 'Tekort', v: Math.abs(f.over), c: f.over >= 0 ? 'var(--track)' : 'var(--neg)' }
  ];
  var title = f.inkomen > 0 ? 'Vaste lasten nemen ' + pct(f.vast / f.inkomen, 0) + ' van ' + J(M, 'je', 'jullie') + ' inkomen' : 'Geen inkomen ' + M.when;
  return { title: title, body: tg + stack(parts) + legend(size === 'S' ? parts.slice(0, 2).concat(parts.slice(4)) : parts, f.inkomen > 0 ? f.inkomen : null) };
};

function recRow(r) { return { t: r.naam, s: r.cat + ' · ' + eur(r.perJaar) + ' per jaar', v: eur(r.perMaand), dd: 'cp:' + encodeURIComponent(r.key) }; }
R.vastelasten = function (M, size) {
  var rec = M.rec(), run = rec.filter(function (r) { return r.loopt; }), loans = run.filter(function (r) { return r.lening; }), rest = run.filter(function (r) { return !r.lening && !r.abonnement; });
  var ended = rec.filter(function (r) { return r.lening && !r.loopt; });
  var tl = loans.reduce(function (a, r) { return a + r.perMaand; }, 0), tr = rest.reduce(function (a, r) { return a + r.perMaand; }, 0);
  if (!run.length) return { title: 'Nog geen vaste lasten herkend', body: empty('Vaste lasten verschijnen zodra dezelfde partij minstens 3 maanden terugkomt.') };
  var rows = loans.map(function (r) { var x = recRow(r); x.s = 'Lening · ' + x.s.split(' · ')[1]; return x; }).concat(rest.map(recRow));
  return { title: eur(tl + tr) + ' per maand ligt vast, waarvan ' + eur(tl) + ' leningen',
    body: listRows(rows, size, 'vastelasten') + (ended.length ? note('Afbetaald: ' + ended.map(function (r) { return esc(r.naam) + ' (laatste in ' + mLong(r.laatste) + ', ' + eur(r.perMaand) + ' per maand)'; }).join(', ') + '.') : '') };
};
R.abonnementen = function (M, size) {
  var subs = M.rec().filter(function (r) { return r.loopt && r.abonnement; }), tot = subs.reduce(function (a, r) { return a + r.perMaand; }, 0);
  if (!subs.length) return { title: 'Geen abonnementen herkend', body: empty('Abonnementen verschijnen zodra hetzelfde abonnement minstens 3 maanden terugkomt.') };
  return { title: subs.length + ' abonnement' + (subs.length > 1 ? 'en kosten ' : ' kost ') + J(M, 'je', 'jullie') + ' ' + eur(tot * 12) + ' per jaar', body: listRows(subs.map(recRow), size, 'abonnementen') };
};

function loose(M) { var k = M.recKeys(); return M.rows.filter(function (x) { return !k[C.counterparty(x.r)]; }); }
R.opvallend = function (M, size) {
  var mode = M.st.wstate.opvallend || 'grootste', rows = loose(M);
  var tg = toggle('opvallend', [['grootste', 'Grootste'], ['winkels', 'Top winkels']], mode);
  if (mode === 'winkels') {
    var tp = C.topCounterparties(rows, 1000);
    if (!tp.length) return { title: 'Geen uitgaven ' + M.when, body: tg + empty('Geen uitgaven.') };
    return { title: J(M, 'Je gaf', 'Jullie gaven') + ' het meest uit bij ' + tp[0].naam, body: tg + listRows(tp.map(function (b) { return { t: b.naam, s: b.aantal + (b.aantal > 1 ? ' betalingen' : ' betaling'), v: eur(b.bedrag), dd: 'cp:' + encodeURIComponent(b.key) }; }), size, 'opvallend') };
  }
  var big = C.largest(rows, 1000);
  if (!big.length) return { title: 'Geen uitgaven ' + M.when, body: tg + empty('Geen uitgaven.') };
  return { title: J(M, 'Je', 'Jullie') + ' grootste uitgave: ' + big[0].naam + ' (' + eur(big[0].bedrag) + ')',
    body: tg + listRows(big.map(function (b) { return { t: b.naam, s: dNice(b.datum) + ' · ' + b.cat + (b.eenmalig ? ' · eenmalig' : ''), v: eur(b.bedrag) }; }), size, 'opvallend') };
};

var DAYS = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];
R.weekdag = function (M, size) {
  var wd = C.byWeekday(M.rows), mx = Math.max.apply(null, wd.map(function (d) { return d.bedrag; }).concat(1));
  var top = wd.slice().sort(function (a, b) { return b.bedrag - a.bedrag; })[0];
  if (top.bedrag < 0.5) return { title: 'Geen uitgaven ' + M.when, body: empty('Geen uitgaven.') };
  return { title: DAYS[top.dag].charAt(0).toUpperCase() + DAYS[top.dag].slice(1) + ' is ' + J(M, 'je', 'jullie') + ' duurste dag',
    body: '<div class="bars wk">' + wd.map(function (d) {
      return '<div class="col' + (d.dag === top.dag ? ' sel' : '') + '" role="img" aria-label="' + DAYS[d.dag] + ' ' + eur(d.bedrag) + '"><span class="cb"><i class="b" style="height:' + (d.bedrag / mx * 100).toFixed(1) + '%"></i></span><span class="cl">' + DAYS[d.dag].slice(0, size === 'S' ? 1 : 2) + '</span></div>';
    }).join('') + '</div>' + (size !== 'S' ? '<div class="cap">Zonder eenmalige uitgaven</div>' : '') };
};

R.gemiddelde = function (M, size) {
  var f = M.full(), n = f.length;
  if (!n) return { title: 'Gemiddelde per maand', body: empty('Nog geen volledige maand.') };
  var a = function (k) { return f.reduce(function (s, x) { return s + x[k]; }, 0) / n; };
  var res = a('resultaat'), sp = mShort(M.V[0]) + ' tot ' + mShort(M.V[n - 1]);
  if (!M.own) return { title: 'Gemiddeld ' + eur(-a('uitgaven')) + ' uitgaven per maand', body: kpi('Uitgaven per maand', eur(-a('uitgaven')), sp) };
  var title = 'Gemiddeld ' + J(M, 'hield je', 'hielden jullie') + ' ' + eur(res) + ' per maand ' + (res >= 0 ? 'over' : 'te weinig');
  if (res < 0) title = 'Gemiddeld ' + J(M, 'kwam je', 'kwamen jullie') + ' ' + eurAbs(res) + ' per maand tekort';
  if (size === 'S') return { title: title, body: kpi('Resultaat per maand', eur(res), sp) };
  return { title: title, body: '<div class="duo">' + kpi('Inkomen', eur(a('inkomen'))) + kpi('Uitgaven', eur(-a('uitgaven'))) + (size === 'L' ? kpi('Gespaard', eur(a('gespaard'))) + kpi('Resultaat', eur(res)) : '') + '</div><div class="cap">Per maand, ' + sp + ' (' + n + ' volledige maanden)</div>' };
};

R.vergelijking = function (M, size) {
  var cur = M.P.to, prv = C.prev(cur);
  if (M.st.Months.indexOf(prv) < 0) return { title: 'Vergelijking met vorige maand', body: empty('Er is geen maand voor ' + mLong(cur) + ' om mee te vergelijken.') };
  var a = C.metrics(C.inPeriod(M.all, cur, cur)), b = C.metrics(C.inPeriod(M.all, prv, prv));
  var du = -a.uitgaven - -b.uitgaven;
  var title = 'Uitgaven ' + eurAbs(du) + (du > 0 ? ' hoger' : ' lager') + ' dan ' + mLong(prv);
  var line = function (l, x, y, goed) { var d = x - y; return { t: l, s: mShort(prv) + ' ' + eur(y), v: eur(x) + ' <small class="' + (Math.abs(d) < 0.5 ? '' : (d > 0) === goed ? 'pos' : 'neg') + '">' + (d > 0.5 ? '▲' : d < -0.5 ? '▼' : '=') + ' ' + eurAbs(d) + '</small>' }; };
  var rows = (M.own ? [line('Inkomen', a.inkomen, b.inkomen, true)] : []).concat([line('Uitgaven', -a.uitgaven, -b.uitgaven, false)]).concat(M.own ? [line('Gespaard', a.gespaard, b.gespaard, true), line('Resultaat', a.resultaat, b.resultaat, true)] : []);
  var ca = {}, cb = {};
  C.byCategory(C.inPeriod(M.all, cur, cur)).forEach(function (c) { ca[c.cat] = c.bedrag; });
  C.byCategory(C.inPeriod(M.all, prv, prv)).forEach(function (c) { cb[c.cat] = c.bedrag; });
  var moves = Object.keys(Object.assign({}, ca, cb)).map(function (k) { return { k: k, d: (ca[k] || 0) - (cb[k] || 0) }; }).sort(function (x, y) { return Math.abs(y.d) - Math.abs(x.d); })[0];
  return { title: title, body: '<div class="cap">' + esc(mLong(cur, true)) + ' versus ' + esc(mLong(prv)) + '</div><ul class="list">' + rows.slice(0, size === 'S' ? 2 : 4).map(function (r) { return '<li><span class="ln"><span class="lt">' + esc(r.t) + '</span><span class="ls">' + esc(r.s) + '</span></span><span class="lv">' + r.v + '</span></li>'; }).join('') + '</ul>' +
    (moves && size !== 'S' ? note('Grootste verschuiving: ' + esc(moves.k) + ' ' + (moves.d > 0 ? '▲ ' : '▼ ') + eurAbs(moves.d) + '.') : '') };
};

R.buffer = function (M, size) {
  var b = C.buffer(M.ctx, M.view, M.dq.lastComplete, 3);
  if (!b) return { title: 'Buffer', body: empty('Nog geen saldo in het tabblad Saldi.') };
  var mo = b.maanden;
  var title = mo == null ? 'Buffer: ' + eur(b.saldo) : J(M, 'Je', 'Jullie') + ' buffer dekt ' + mo.toFixed(1).replace('.', ',') + ' maand' + (mo.toFixed(1) === '1.0' ? '' : 'en') + ' uitgaven';
  return { title: title, body: kpi('Op zichtrekeningen, ' + dNice(b.datum), eur(b.saldo), size === 'S' ? 'zonder spaargeld' : 'Uitgaven zonder eenmalig: ' + eur(b.perMaand) + ' per maand (laatste 3 maanden). Spaargeld telt niet mee.') };
};

R.spaardoel = function (M, size) {
  var e = needOwn(M); if (e) return { title: 'Spaardoel', body: empty(e) };
  var inc = M.m.inkomenStructureel, g = M.m.gespaard, t = CFG.SPAARDOEL * inc, s = CFG.SPAARDOEL_STRETCH * inc;
  if (inc <= 0) return { title: 'Geen vast inkomen ' + M.when, body: empty('Het spaardoel is ' + pct(CFG.SPAARDOEL, 0) + ' van het structurele inkomen.') };
  var title = g >= s ? 'Stretchdoel gehaald: ' + eur(g) + ' gespaard' : g >= t ? 'Doel gehaald, nog ' + eur(s - g) + ' tot de stretch' : 'Nog ' + eur(t - g) + ' tot ' + J(M, 'je', 'jullie') + ' spaardoel';
  var p = Math.min(1, g / (s || 1));
  return { title: title, body: '<div class="goal"><div class="gbar"><i style="width:' + (p * 100).toFixed(1) + '%"></i><b style="left:' + (t / s * 100).toFixed(1) + '%" title="doel"></b></div>' +
    '<div class="gl"><span>' + eur(g) + ' gespaard</span><span>doel ' + eur(t) + (size !== 'S' ? ' · stretch ' + eur(s) : '') + '</span></div></div>' +
    (size !== 'S' ? '<div class="cap">' + pct(CFG.SPAARDOEL, 0) + ' en ' + pct(CFG.SPAARDOEL_STRETCH, 0) + ' van het structurele inkomen (' + eur(inc) + ')</div>' : '') };
};

function accRows(M) {
  var ld = M.dq.lastDates, rek = M.st.data.rekeningen || [];
  return Object.keys(ld).map(function (k) {
    var a = rek.filter(function (r) { return r.Rekening_ID === k; })[0] || {};
    return { t: a.Naam || k, s: (a.Type || 'rekening') + ' · ' + C.usage(a), v: ld[k] ? dNice(ld[k]) : 'geen boekingen', d: ld[k] || '' };
  }).sort(function (a, b) { return a.t < b.t ? -1 : 1; });
}
R.dataoverzicht = function (M, size) {
  var dq = M.dq, rows = accRows(M), foots = M.st.notes.filter(function (n) { return n.level !== 'alert'; });
  var n = size === 'L' ? 6 : size === 'M' ? 4 : 0;
  var chips = n ? '<ul class="accs">' + rows.slice(0, n).map(function (r) { return '<li><span class="lt">' + esc(r.t) + '</span><span class="ls">' + esc(r.v) + '</span></li>'; }).join('') + '</ul>' : '';
  return { title: 'Volledig ingeladen tot en met ' + mLong(dq.lastComplete, true),
    body: '<p class="nt">Volledig = alle rekeningen ingeladen: ' + mLong(M.V[0]) + ' tot ' + mLong(M.V[M.V.length - 1], true) + '.' + (dq.partialMonths.length ? ' ' + dq.partialMonths.map(function (m) { return mLong(m); }).join(', ') + ' loopt nog.' : '') + '</p>' + chips +
      '<button class="more" data-more="dataoverzicht">' + rows.length + ' rekeningen' + (foots.length ? ' en ' + foots.length + ' voetnoot' + (foots.length > 1 ? 'en' : '') : '') + '</button>' };
};

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

R.gedeeld = function (M, size) {
  var h = C.householdSplit(M.ctx, M.P.from, M.P.to), tot = h.gedeeld + h.persoonlijk;
  if (tot < 0.5) return { title: 'Gedeeld versus persoonlijk', body: empty('Geen uitgaven ' + M.when + '.') };
  var parts = [{ l: 'Gedeeld', v: h.gedeeld, c: 'var(--accent)' }, { l: 'Persoonlijk Mats', v: h.mats, c: 'var(--mats)' }, { l: 'Persoonlijk Sofie', v: h.sofie, c: 'var(--sofie)' }];
  return { title: pct(h.gedeeld / tot, 0) + ' van jullie uitgaven is gedeeld', body: stack(parts) + legend(parts, tot) +
    (!M.st.dq.sofieComplete && size !== 'S' ? note('Persoonlijke uitgaven van Sofie ontbreken tot haar rekeningen in het blad staan.') : '') };
};

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
  return { title: title, body: stacked(ser) + '<div class="lgd"><button class="lk" data-dd="vast:1"><i class="sw a"></i>Vast ' + eur(v / M.P.n) + '</button><button class="lk" data-dd="vast:0"><i class="sw b"></i>Vrij ' + eur(f / M.P.n) + '</button>' + (M.P.n > 1 ? '<span>per maand</span>' : '') + '</div>' };
};

var FREQ = [['maandelijks', 'Elke maand', 'var(--accent)'], ['kwartaal', 'Per kwartaal', 'color-mix(in srgb,var(--accent) 65%,var(--track))'], ['jaarlijks', 'Per jaar', 'color-mix(in srgb,var(--accent) 38%,var(--track))'], ['los', 'Los, wisselend', 'var(--track)']];
R.ritme = function (M, size) {
  var keys = M.freq().keys, o = { maandelijks: 0, kwartaal: 0, jaarlijks: 0, los: 0 };
  M.rows.forEach(function (x) { if (x.t === 'uitgave') o[keys[C.counterparty(x.r) || '?'] || 'los'] -= x.a; });
  var tot = o.maandelijks + o.kwartaal + o.jaarlijks + o.los;
  if (tot < 0.5) return { title: 'Geen uitgaven ' + M.when, body: empty('Geen uitgaven in deze periode.') };
  var parts = FREQ.map(function (f) { return { k: f[0], l: f[1], v: o[f[0]], c: f[2] }; });
  return { title: pct(o.maandelijks / tot, 0) + ' van ' + J(M, 'je', 'jullie') + ' uitgaven komt elke maand terug',
    body: stack(parts) + '<ul class="list lg">' + parts.map(function (p) {
      return '<li><button class="lrow" data-dd="freq:' + p.k + '"><span class="ln"><i class="sw" style="background:' + p.c + '"></i><span class="lt">' + esc(p.l) + '</span></span><span class="lv">' + eur(p.v) + ' <small>' + pct(p.v / tot, 0) + '</small></span></button></li>';
    }).join('') + '</ul>' };
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

R.potjes = function (M, size) {
  var lc = M.dq.lastComplete, from3 = C.addM(lc, -2), p = C.pockets(M.ctx, M.view, M.rows, M.P.n, C.inPeriod(M.all, from3, lc), 3);
  if (!p.list.length) return { title: 'Potjes', body: empty('Maak een tabblad Potjes met Naam, Categorieen en Bedrag.') };
  var over = p.list.filter(function (x) { return x.uitgegeven > x.budget + 0.5; });
  var title = !over.length ? 'Alle ' + p.list.length + ' potjes binnen budget' : over.length + ' van de ' + p.list.length + ' potjes over budget: ' + over.map(function (x) { return x.naam; }).slice(0, 2).join(', ');
  var rows = p.list.map(function (x) {
    var r = x.uitgegeven / x.budget, bad = x.uitgegeven > x.budget + 0.5;
    return '<li><button class="lrow pj" data-dd="cats:' + encodeURIComponent(x.cats.join('|')) + '"><span class="rh"><b>' + esc(x.naam) + '</b><span' + (bad ? ' class="neg"' : '') + '>' + eur(x.uitgegeven) + ' <small>van ' + eur(x.budget) + '</small></span></span>' +
      '<span class="rb"><i style="width:' + Math.min(100, r * 100).toFixed(1) + '%' + (bad ? ';background:var(--neg)' : '') + '"></i></span></button></li>';
  });
  var n = size === 'S' ? 2 : size === 'M' ? 4 : 8;
  return { title: title, body: '<ul class="list pots">' + rows.slice(0, n).join('') + '</ul>' +
    (p.voorstel ? note('Voorstel op basis van ' + mShort(from3) + ' tot ' + mShort(lc) + '. Maak een tabblad Potjes voor eigen potjes.') : M.P.n > 1 ? note('Per maand, gemiddeld over ' + M.P.n + ' maanden.') : '') };
};

R.auto = function (M, size) {
  var lc = M.dq.lastComplete, rows = C.inPeriod(M.all, M.V[0], lc), n = M.V.length, c = C.carCosts(rows);
  if (c.totaal < 0.5) return { title: 'Wat kost de auto', body: empty('Geen tankbeurten, garage of parking gevonden voor ' + (M.view === 'MATS' ? 'Mats' : M.view === 'SOFIE' ? 'Sofie' : 'jullie') + '.') };
  var pm = c.totaal / n, py = pm * 12, pd = py / 365, who = M.view === 'SOFIE' ? 'Sofie' : M.view === 'MATS' ? 'Mats' : 'jullie';
  var title = 'De auto kost ' + who + ' ongeveer ' + eur(py) + ' per jaar';
  var soorten = Object.keys(c.perSoort).filter(function (k) { return c.perSoort[k] > 0.5; }).sort(function (a, b) { return c.perSoort[b] - c.perSoort[a]; });
  var miss = !(c.perSoort['Verzekering en taks'] > 0.5);
  return { title: title, body: '<div class="duo">' + kpi('per maand', eur(pm)) + kpi('per dag', eur(pd) === eur(0) ? '< €1' : nf2.format(pd)) + (size === 'L' ? kpi('per jaar', eur(py)) : '') + '</div>' +
    (size !== 'S' ? '<ul class="list lg">' + soorten.slice(0, size === 'M' ? 2 : 4).map(function (k) {
      return '<li><button class="lrow" data-dd="car:' + encodeURIComponent(k) + '"><span class="ln"><span class="lt">' + esc(k) + '</span></span><span class="lv">' + eur(c.perSoort[k] / n) + ' <small>per maand</small></span></button></li>';
    }).join('') + '</ul>' : '') +
    (size === 'L' ? note('Op basis van ' + mShort(M.V[0]) + ' tot ' + mShort(lc) + ', herkend op naam (tankstation, garage, parking).' + (miss ? ' Geen verzekering of verkeersbelasting gevonden: die lopen misschien via een andere rekening.' : '')) : '') };
};

function spark(vals) {
  if (vals.length < 2) return '';
  return '<div class="spk">' + area(vals) + '</div>';
}
R.beleggingen = function (M, size) {
  var b = C.investments(M.ctx, M.view);
  if (!b) return { title: 'Beleggingen', body: empty('Maak een tabblad Beleggingen met Datum, ETF, Soort, Bedrag.') };
  var up = b.winst >= 0;
  var title = (M.view === 'SAMEN' ? 'Jullie' : 'Je') + ' ETF\'s zijn ' + eur(b.waarde) + ' waard' + (b.rendement != null ? ', ' + (up ? '+' : '−') + pct(Math.abs(b.rendement), 0) : '');
  var k = kpi('ingelegd ' + eur(b.ingelegd), eur(b.waarde), '<span class="' + (up ? 'pos' : 'neg') + '">' + (up ? '▲ ' : '▼ ') + signed(b.winst) + '</span>');
  if (size === 'S') return { title: title, body: k };
  var hv = b.hist.map(function (x) { return x.v; });
  return { title: title, body: '<div class="rw">' + k + (hv.length > 1 ? spark(hv) : '') + '</div>' +
    (size === 'L' ? listRows(b.list.map(function (e) { var w = e.waarde - e.ingelegd; return { t: e.etf, s: (e.aantal ? (Math.round(e.aantal * 100) / 100) + ' stuks · ' : '') + 'ingelegd ' + eur(e.ingelegd) + (e.datum ? ' · waarde van ' + dNice(e.datum) : ''), v: eur(e.waarde) + ' <small class="' + (w >= 0 ? 'pos' : 'neg') + '">' + signed(w) + '</small>' }; }), size, 'beleggingen', 3) : '') };
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
  categorieen: function (M) { return catRows(M).rows; },
  vastelasten: function (M) { var run = M.rec().filter(function (r) { return r.loopt && !r.abonnement; }); return run.map(recRow); },
  abonnementen: function (M) { return M.rec().filter(function (r) { return r.loopt && r.abonnement; }).map(recRow); },
  opvallend: function (M) {
    if ((M.st.wstate.opvallend || 'grootste') === 'winkels') return C.topCounterparties(loose(M), 1000).map(function (b) { return { t: b.naam, s: b.aantal + (b.aantal > 1 ? ' betalingen' : ' betaling'), v: eur(b.bedrag) }; });
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

window.W = { render: render, model: model, full: FULL, drill: drill, rowsHtml: function (rows) { return '<ul class="list">' + rows.map(row).join('') + '</ul>'; },
  fmt: { esc: esc, eur: eur, pct: pct, mShort: mShort, mLong: mLong, dNice: dNice } };
})();
