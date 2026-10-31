(function () {
'use strict';
var C = window.Calc, CFG = window.CONFIG;
var $ = function (s) { return document.querySelector(s); };
var COL = { MATS: 'var(--mats)', SOFIE: 'var(--sofie)', SAMEN: 'var(--samen)' };
var LBL = { MATS: 'MATS', SOFIE: 'SOFIE', SAMEN: 'SAMEN' };
var S = { person: 'MATS', per: 'maand', month: null, struct: false, data: null, ctx: null, dq: null, src: '', V: [] };
try { var sp = localStorage.getItem('hb_person'); if (C.PERSONS.indexOf(sp) >= 0) S.person = sp; } catch (e) {}

/* ---------- helpers ---------- */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
var nf0 = new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
var nf2 = new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
function eur(n) { return nf0.format(Math.round(n * 100) / 100 === 0 ? 0 : n); }
function eur2(n) { return nf2.format(n); }
function hero(n) {
  var s = nf2.format(Math.abs(n)), i = s.lastIndexOf(','), neg = n < 0 ? '−' : '';
  return neg + s.slice(0, i) + '<span class="dec">' + s.slice(i) + '</span>';
}
function pct(x, d) { return x == null ? '–' : (x * 100).toFixed(d == null ? 1 : d).replace('.', ',') + '%'; }
function mName(m, long) { var d = new Date(m + '-15T12:00:00'); return d.toLocaleDateString('nl-BE', long ? { month: 'long', year: 'numeric' } : { month: 'short' }).replace('.', ''); }
function dNice(d) { return d ? new Date(d + 'T12:00:00').toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' }) : '–'; }
function sgn(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + eur(Math.abs(n)); }
function cls(n) { return n > 0.005 ? 'pos' : n < -0.005 ? 'neg' : ''; }
function arrow(n) { return n > 0.005 ? '▲ ' : n < -0.005 ? '▼ ' : ''; }

/* ---------- laden ---------- */
function validate(d) {
  if (!d || !d.transacties || !d.rekeningen || !d.categorieen) throw new Error('Het blad mist Transacties, Rekeningen of Categorieen.');
  var need = ['Datum', 'Rekening_ID', 'Categorie', 'Bedrag', 'Aandeel_Mats', 'Aandeel_Sofie', 'Eenmalig'];
  if (!d.transacties.length) throw new Error('Het tabblad Transacties is leeg.');
  var r = d.transacties[0];
  need.forEach(function (k) { if (!(k in r)) throw new Error('Kolom "' + k + '" ontbreekt in Transacties. Is de structuur van het blad aangepast?'); });
  var num = function (x) { return typeof x === 'number' ? x : parseFloat(String(x).replace(/\./g, function (m, i, s) { return s.indexOf(',') >= 0 ? '' : m; }).replace(',', '.')); };
  d.transacties.forEach(function (t, i) {
    t.Bedrag = num(t.Bedrag); t.Aandeel_Mats = num(t.Aandeel_Mats); t.Aandeel_Sofie = num(t.Aandeel_Sofie);
    if (isNaN(t.Bedrag) || isNaN(t.Aandeel_Mats) || isNaN(t.Aandeel_Sofie)) throw new Error('Rij ' + (i + 2) + ' in Transacties heeft een Bedrag of Aandeel dat geen getal is.');
    t.Eenmalig = +t.Eenmalig ? 1 : 0; t.Datum = String(t.Datum).slice(0, 10);
  });
  (d.saldi || []).forEach(function (s) { s.Saldo = +s.Saldo; s.Datum = String(s.Datum).slice(0, 10); });
  return d;
}
function setData(d, src) {
  S.data = validate(d); S.src = src; S.ctx = C.makeCtx(S.data); S.dq = C.dataQuality(S.ctx);
  var first = CFG.EERSTE_VOLLEDIGE_MAAND, L = S.dq.lastComplete;
  if (L < first) first = S.dq.months[0];
  S.V = C.range(first, L);
  if (!S.month || S.V.indexOf(S.month) < 0) S.month = L;
}
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function showLock(msg) { $('#lock').hidden = false; $('#lockerr').textContent = msg || ''; $('#pw').focus(); }
function load(force) {
  var u = new URLSearchParams(location.search);
  if (u.get('src') === 'fixture') return fetch('data/fixture.json').then(function (r) { return r.json(); }).then(function (d) { setData(d, 'fixture'); render(); });
  if (!CFG.API_URL) return fetch('data/demo.json').then(function (r) { return r.json(); }).then(function (d) { setData(d, 'demo'); render(); });
  var pw = lsGet('hb_pw');
  if (!pw) { showLock(); return Promise.resolve(); }
  S.banner = '';
  return fetch(CFG.API_URL + '?p=' + encodeURIComponent(pw), { redirect: 'follow' }).catch(function () { var e = new Error('Geen verbinding.'); e.net = true; throw e; }).then(function (r) { return r.json().catch(function () { throw new Error('Onverwacht antwoord van het Apps Script. Controleer de implementatie.'); }); }).then(function (d) {
    if (d && d.error === 'unauthorized') { lsSet('hb_pw', ''); showLock('Wachtwoord klopt niet.'); return; }
    if (d && d.error === 'locked') { showLock('Te veel pogingen. Probeer later opnieuw.'); return; }
    if (d && d.error) throw new Error(d.error);
    setData(d, 'live'); lsSet('hb_cache', JSON.stringify(d)); lsSet('hb_cache_at', new Date().toISOString()); $('#lock').hidden = true; render();
  }).catch(function (e) {
    var c = lsGet('hb_cache');
    if (c) { try { setData(JSON.parse(c), 'cache'); S.banner = e.net ? '' : 'Nieuwe gegevens konden niet geladen worden: ' + (e.message || e) + ' De laatst opgeslagen versie wordt getoond.'; render(); return; } catch (x) {} }
    $('#view').innerHTML = '<div class="warn"><b>Geen gegevens</b>' + esc(e.message || e) + '</div>';
  });
}
$('#lockform').addEventListener('submit', function (e) { e.preventDefault(); lsSet('hb_pw', $('#pw').value); $('#pw').value = ''; load(); });

/* ---------- periode ---------- */
function period() {
  var L = S.dq.lastComplete, yr = L.slice(0, 4), p = S.per;
  if (p === 'maand') return { from: S.month, to: S.month, n: 1, label: mName(S.month, true), partial: false };
  if (p === '3m') { var f = C.addM(L, -2); if (f < S.V[0]) f = S.V[0]; return { from: f, to: L, n: C.range(f, L).length, label: mName(f) + ' tot ' + mName(L, true), partial: false }; }
  if (p === 'volledig') return { from: S.V[0], to: L, n: S.V.length, label: mName(S.V[0]) + ' tot ' + mName(L, true), partial: false };
  var ms = C.range(yr + '-01', S.dq.months[S.dq.months.length - 1]);
  return { from: yr + '-01', to: yr + '-12', n: Math.max(1, S.V.length), label: 'Heel ' + yr + ' (' + (S.dq.partialMonths.length ? 'incl. lopende maanden' : 'tot nu') + ')', partial: S.dq.partialMonths.length > 0 };
}

/* ---------- charts ---------- */
var gid = 0;
function spark(vals, h) {
  h = h || 70; var w = 300, n = vals.length; if (n < 2) return '';
  var mn = Math.min.apply(null, vals.concat(0)), mx = Math.max.apply(null, vals.concat(0)); if (mx === mn) mx = mn + 1;
  var X = function (i) { return 6 + i * (w - 12) / (n - 1); }, Y = function (v) { return 6 + (mx - v) * (h - 12) / (mx - mn); };
  var pts = vals.map(function (v, i) { return [X(i), Y(v)]; }), d = 'M' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' L');
  var id = 'g' + (++gid);
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Verloop per maand"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".45"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>' +
    '<line x1="0" x2="' + w + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" stroke="var(--line)" stroke-dasharray="3 4"/>' +
    '<path d="' + d + ' L' + X(n - 1) + ',' + Y(0) + ' L' + X(0) + ',' + Y(0) + ' Z" fill="url(#' + id + ')"/><path d="' + d + '" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="' + X(n - 1) + '" cy="' + Y(vals[n - 1]) + '" r="5" fill="var(--accent)"/></svg>';
}
function monthBars(series, showRes) {
  var n = series.length; if (!n) return '<div class="empty">Geen maanden</div>';
  var w = 600, h = 220, pl = 6, pb = 24, pt = 12, mx = 1, mn = 0;
  series.forEach(function (s) { mx = Math.max(mx, s.a, s.b); if (showRes) { mx = Math.max(mx, s.r); mn = Math.min(mn, s.r); } });
  var Y = function (v) { return pt + (mx - v) * (h - pt - pb) / (mx - mn); }, bw = (w - pl * 2) / n, g = '';
  series.forEach(function (s, i) {
    var x = pl + i * bw, b = Math.min(26, bw * .3), cx = x + bw / 2, op = s.sel === false ? .35 : 1;
    g += '<rect x="' + (cx - b - 2) + '" y="' + Y(s.a) + '" width="' + b + '" height="' + Math.max(1, Y(0) - Y(s.a)) + '" rx="5" fill="var(--accent)" opacity="' + op + '"/>';
    g += '<rect x="' + (cx + 2) + '" y="' + Y(s.b) + '" width="' + b + '" height="' + Math.max(1, Y(0) - Y(s.b)) + '" rx="5" fill="color-mix(in srgb,var(--accent) 38%,var(--card2))" stroke="var(--accent)" stroke-width="1.5" opacity="' + op + '"/>';
    g += '<text x="' + cx + '" y="' + (h - 6) + '" text-anchor="middle">' + esc(mName(s.m)) + (s.lopend ? '*' : '') + '</text>';
  });
  if (showRes) {
    var pts = series.map(function (s, i) { return (pl + i * bw + bw / 2).toFixed(1) + ',' + Y(s.r).toFixed(1); });
    g += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/>';
    series.forEach(function (s, i) { g += '<circle cx="' + (pl + i * bw + bw / 2) + '" cy="' + Y(s.r) + '" r="4.5" fill="' + (s.r >= 0 ? 'var(--pos)' : 'var(--neg)') + '" stroke="var(--card)" stroke-width="2"/>'; });
  }
  g += '<line x1="0" x2="' + w + '" y1="' + Y(0) + '" y2="' + Y(0) + '" stroke="var(--line)"/>';
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Maandoverzicht">' + g + '</svg>';
}
function ring(val, target, stretch) {
  var R = 54, Cc = 2 * Math.PI * R, scale = 0.2, v = Math.max(0, Math.min(val || 0, scale)) / scale;
  var tick = function (p, c) { var a = (p / scale) * 2 * Math.PI - Math.PI / 2; return '<line x1="' + (70 + (R - 9) * Math.cos(a)) + '" y1="' + (70 + (R - 9) * Math.sin(a)) + '" x2="' + (70 + (R + 9) * Math.cos(a)) + '" y2="' + (70 + (R + 9) * Math.sin(a)) + '" stroke="' + c + '" stroke-width="3" stroke-linecap="round"/>'; };
  return '<svg viewBox="0 0 140 140" style="max-width:150px" role="img" aria-label="Spaarratio ' + pct(val) + '"><circle cx="70" cy="70" r="' + R + '" fill="none" stroke="var(--card2)" stroke-width="14"/>' +
    '<circle cx="70" cy="70" r="' + R + '" fill="none" stroke="var(--accent)" stroke-width="14" stroke-linecap="round" stroke-dasharray="' + (v * Cc).toFixed(1) + ' ' + Cc.toFixed(1) + '" transform="rotate(-90 70 70)"/>' +
    tick(target, 'var(--ink)') + tick(stretch, 'var(--muted)') +
    '<text x="70" y="76" text-anchor="middle" style="font:700 24px -apple-system,sans-serif;fill:var(--ink)">' + pct(val, 1) + '</text></svg>';
}
function stacked(parts, total) {
  var x = 0, g = '';
  parts.forEach(function (p) { if (p.v <= 0) return; var w = p.v / total * 100; g += '<rect x="' + x.toFixed(2) + '" y="0" width="' + Math.max(0, w - .6).toFixed(2) + '" height="26" rx="6" fill="' + p.c + '"/>'; x += w; });
  return '<svg viewBox="0 0 100 26" preserveAspectRatio="none" style="height:26px" role="img" aria-label="Verdeling van het inkomen">' + g + '</svg>';
}
function legend(parts) { return '<div class="legend">' + parts.filter(function (p) { return p.v > 0.5; }).map(function (p) { return '<span><i style="background:' + p.c + '"></i>' + esc(p.l) + ' ' + eur(p.v) + '</span>'; }).join('') + '</div>'; }
var PAL = ['var(--accent)', '#F5B94A', '#A78BFA', '#34D399', '#F472B6', '#60A5FA', '#94A3B8'];
function donut(items, centre, sub) {
  var tot = items.reduce(function (a, b) { return a + b.v; }, 0) || 1, R = 56, Cc = 2 * Math.PI * R, off = 0, g = '';
  items.forEach(function (it, i) { var l = it.v / tot * Cc; g += '<circle cx="80" cy="80" r="' + R + '" fill="none" stroke="' + PAL[i % PAL.length] + '" stroke-width="22" stroke-dasharray="' + Math.max(0, l - 2).toFixed(1) + ' ' + Cc.toFixed(1) + '" stroke-dashoffset="' + (-off).toFixed(1) + '" transform="rotate(-90 80 80)"/>'; off += l; });
  return '<svg viewBox="0 0 160 160" style="max-width:190px;margin:auto" role="img" aria-label="Verdeling"><circle cx="80" cy="80" r="' + R + '" fill="none" stroke="var(--card2)" stroke-width="22"/>' + g +
    '<text x="80" y="80" text-anchor="middle" style="font:700 20px -apple-system,sans-serif;fill:var(--ink)">' + centre + '</text><text x="80" y="98" text-anchor="middle">' + esc(sub || '') + '</text></svg>';
}
function dlegend(items) { return '<div style="flex:1;min-width:150px">' + items.map(function (it, i) { return '<div class="row"><i style="width:12px;height:12px;border-radius:4px;background:' + PAL[i % PAL.length] + '"></i><span class="n">' + esc(it.l) + '</span><b>' + eur(it.v) + '</b></div>'; }).join('') + '</div>'; }
function hbars(items, per, deltas) {
  if (!items.length) return '<div class="empty">Geen uitgaven</div>';
  var mx = items[0].bedrag || 1;
  return items.map(function (it) {
    var d = deltas && deltas[it.cat], pill = '';
    if (d != null) { var p = d; pill = '<span class="pill ' + (p > .1 ? 'up' : p < -.1 ? 'down' : 'flat') + '">' + (p > .1 ? '▲ ' : p < -.1 ? '▼ ' : '') + (Math.abs(p) > 3 ? '>300' : Math.abs(Math.round(p * 100))) + '%</span>'; }
    return '<div style="padding:8px 0"><div class="row" style="padding:0"><span class="n">' + esc(it.cat) + '</span>' + pill + '<b>' + eur(it.bedrag / per) + '</b></div><div class="bt"><i style="width:' + (it.bedrag / mx * 100).toFixed(1) + '%"></i></div></div>';
  }).join('');
}

/* ---------- views ---------- */
function warnSofie() {
  if (S.dq.sofieComplete) return '';
  return '<div class="warn"><b>Gegevens van Sofie zijn nog niet volledig</b>Er zijn nog geen eigen rekeningen van Sofie geladen. Haar cijfers komen enkel van de gezamenlijke rekening (50%) en gedeelde kaartbetalingen. Inkomen, resultaat en spaarratio van SOFIE en SAMEN zijn daarom niet betrouwbaar en worden niet getoond.</div>';
}
function qualityNotes(P) {
  var n = '', dq = S.dq;
  if (S.src === 'cache') n += '<div class="warn"><b>Offline</b>Je ziet de laatst opgeslagen gegevens' + (lsGet('hb_cache_at') ? ' van ' + dNice(lsGet('hb_cache_at').slice(0, 10)) : '') + '.</div>';
  if (S.banner) n += '<div class="warn"><b>Let op</b>' + esc(S.banner) + '</div>';
  if (dq.stale.length) n += '<div class="warn"><b>Rekening zonder recente boekingen</b>' + dq.stale.map(esc).join(', ') + ': geen boekingen in de laatste maanden. Als je die rekening nog gebruikt, ontbreken er uitgaven.</div>';
  if (P.partial) n += '<div class="warn"><b>Lopende maand</b>' + dq.partialMonths.map(function (m) { return mName(m, true); }).join(', ') + ' ' + (dq.partialMonths.length > 1 ? 'zijn' : 'is') + ' nog niet volledig ingeladen (laatste volledige maand: ' + mName(dq.lastComplete, true) + '). Cijfers voor die maanden zijn onvolledig.</div>';
  var early = S.V.filter(function (m) { return m <= '2026-04'; });
  if (P.from <= '2026-04' && P.to >= '2026-03') n += '<div class="warn"><b>Let op bij maart en april</b>Afrekeningen van de Beobank staan in die maanden nog onder Varia. De categorieen daar zijn minder betrouwbaar.</div>';
  return n;
}
function personView(p) {
  var P = period(), isS = p === 'SOFIE';
  var all = C.rowsFor(S.ctx, p), rows = C.inPeriod(all, P.from, P.to);
  var m = C.metrics(rows, S.struct), per = P.n;
  var vMonths = C.range(P.from < S.dq.months[0] ? S.dq.months[0] : P.from, P.to > S.dq.months[S.dq.months.length - 1] ? S.dq.months[S.dq.months.length - 1] : P.to);
  var mser = C.byMonth(all, vMonths, S.struct);
  var h = '<div class="grid fade">';
  if (isS) h += warnSofie();
  h += qualityNotes(P);
  // hero
  if (!isS) {
    var cum = 0, cv = C.byMonth(all, S.per === 'jaar' ? vMonths : S.V, S.struct).map(function (x) { cum += x.resultaat; return cum; });
    h += '<section class="card h s8"><h2>' + (S.struct ? 'Structureel resultaat' : 'Resultaat') + ' · ' + esc(P.label) + '</h2><div class="big ' + cls(S.struct ? m.structureel : m.resultaat) + '">' + hero(S.struct ? m.structureel : m.resultaat) + '</div>' +
      '<div class="muted sm" style="margin-top:6px">' + (m.resultaat >= 0 ? 'Na sparen blijft er over' : (m.inkomen + m.uitgaven < 0 ? 'Je gaf meer uit dan er binnenkwam' : 'Na sparen houd je niets over')) + (S.struct ? ' (zonder eenmalige posten)' : '') + '</div>' +
      (cv.length > 1 ? '<div style="margin-top:14px">' + spark(cv) + '<div class="muted sm">Opgebouwd resultaat per maand</div></div>' : '') +
      '<div class="kp"><div><b>' + eur(m.inkomen) + '</b><span>Inkomen</span></div><div><b>' + eur(-m.uitgaven) + '</b><span>Uitgaven</span></div><div><b>' + eur(m.gespaard) + '</b><span>Gespaard</span></div></div></section>';
  } else {
    h += '<section class="card h s8 solo"><h2>Uitgaven · ' + esc(P.label) + '</h2><div class="big">' + hero(-m.uitgaven) + '</div><div class="muted sm" style="margin-top:6px">Haar deel van gezamenlijke en gedeelde kosten. Eigen uitgaven ontbreken nog.</div>' +
      '<div style="margin-top:14px">' + spark(C.byMonth(all, S.per === 'jaar' ? vMonths : S.V, S.struct).map(function (x) { return -x.uitgaven; })) + '</div></section>';
  }
  // spaarratio
  if (!isS) {
    var lg = S.struct ? null : m.spaarratio, tgt = CFG.SPAARDOEL, need = Math.max(0, tgt * m.inkomen - m.gespaard);
    h += '<section class="card s4"><h2>Spaarratio</h2><div class="flex">' + ring(m.spaarratio, tgt, CFG.SPAARDOEL_STRETCH) + '<div style="flex:1;min-width:120px"><div class="sm"><b>Doel ' + pct(tgt, 0) + '</b> van je inkomen</div><div class="sm muted">Stretch ' + pct(CFG.SPAARDOEL_STRETCH, 0) + '</div>' +
      '<div class="sm" style="margin-top:10px">' + (m.inkomen <= 0 ? 'Geen inkomen in deze periode.' : need > 0 ? 'Nog <b>' + eur(need) + '</b> te sparen voor het doel.' : '' + (m.inkomen + m.uitgaven < 0 ? '<span class="neg">Gespaard, maar je gaf meer uit dan er binnenkwam.</span>' : '<span class="pos">▲ Doel gehaald</span>') + '') + '</div></div></div>' +
      (mser.length > 1 ? '<div class="legend">' + mser.map(function (x) { return '<span>' + esc(mName(x.m)) + ' ' + pct(x.spaarratio, 0) + '</span>'; }).join('') + '</div>' : '') + '</section>';
  }
  // waar ging inkomen heen
  var rec = C.recurring(C.inPeriod(all, S.V[0], S.dq.lastComplete), 3, C.addM(S.dq.lastComplete, -1)), rk = {}; rec.forEach(function (r) { rk[r.key] = 1; });
  var vast = 0, vari = 0, eenm = 0;
  rows.forEach(function (x) { if (x.t !== 'uitgave') return; var a = -x.a; if (x.r.Eenmalig) { if (!S.struct) eenm += a; } else if (rk[C.counterparty(x.r)]) vast += a; else vari += a; });
  if (!isS) {
    var out = vast + vari + eenm + m.gespaard, tot = Math.max(m.inkomen, out), rest = m.inkomen - out;
    var parts = [{ l: 'Vaste lasten', v: vast, c: 'var(--accent)' }, { l: 'Variabel', v: vari, c: '#F5B94A' }, { l: 'Eenmalig', v: eenm, c: '#A78BFA' }, { l: 'Gespaard', v: m.gespaard, c: 'var(--pos)' }, { l: 'Over', v: Math.max(0, rest), c: 'var(--card2)' }];
    h += '<section class="card s6"><h2>Waar ging je inkomen heen</h2>' + stacked(parts, tot || 1) + legend(parts) + (rest < -0.5 ? '<div class="sm neg" style="margin-top:10px">▼ Tekort van ' + eur(-rest) + ' in deze periode.</div>' : '') + '</section>';
    // structureel vs eenmalig
    var oneOff = rows.filter(function (x) { return x.r.Eenmalig && x.t === 'uitgave'; }).reduce(function (a, x) { return a - x.a; }, 0);
    h += '<section class="card s6"><h2>Structureel versus eenmalig</h2><div class="kp" style="margin-top:0"><div><b class="' + cls(m.structureel) + '">' + sgn(m.structureel) + '</b><span>Structureel resultaat</span></div><div><b>' + eur(oneOff) + '</b><span>Eenmalige uitgaven</span></div></div>' +
      '<div class="sm muted" style="margin-top:12px">Structureel is wat je overhoudt zonder eenmalige posten. Dat is het getal om je eigenlijke ritme mee te beoordelen.</div></section>';
  }
  // maandoverzicht
  var cser = C.byMonth(all, S.per === 'jaar' ? vMonths : S.V, S.struct);
  var ms2 = cser.map(function (x) { return { sel: x.m >= P.from && x.m <= P.to, m: x.m, a: x.inkomen, b: -x.uitgaven, r: x.resultaat, lopend: S.dq.partialMonths.indexOf(x.m) >= 0 }; });
  if (isS) ms2 = ms2.map(function (x) { return { m: x.m, a: 0, b: x.b, r: 0, lopend: x.lopend }; });
  h += '<section class="card s8"><h2>' + (isS ? 'Uitgaven per maand' : 'Inkomen en uitgaven per maand') + '</h2>' + monthBars(ms2, !isS) + '<div class="legend">' + (isS ? '' : '<span><i style="background:var(--accent)"></i>Inkomen</span>') + '<span><i style="background:color-mix(in srgb,var(--accent) 38%,var(--card2));border:1.5px solid var(--accent)"></i>Uitgaven</span>' + (isS ? '' : '<span>● resultaat na sparen</span>') + (ms2.some(function (x) { return x.lopend; }) ? '<span>* lopende maand</span>' : '') + '</div></section>';
  // categorieen
  var cats = C.byCategory(rows, S.struct), deltas = null, allNo = all.filter(function (x) { return !x.r.Eenmalig; }), curNo = {};
  C.byCategory(rows, true).forEach(function (c) { curNo[c.cat] = c.bedrag; });
  if (S.per === 'maand') { deltas = {}; cats.forEach(function (c) { var a = C.catAvgPrev(allNo, c.cat, S.month, 3, S.V); if (a != null && a >= 10) deltas[c.cat] = ((curNo[c.cat] || 0) - a) / a; }); }
  h += '<section class="card s4"><h2>Per categorie' + (per > 1 ? ' (gem. per maand)' : '') + '</h2>' + hbars(cats.slice(0, 9), per, deltas) +
    (S.per === 'maand' ? (Object.keys(deltas).length ? '<div class="sm muted">Pijltje: verschil met het gemiddelde van de 3 maanden ervoor.</div>' : '<div class="sm muted">Vergelijking met de 3 voorgaande maanden kan pas vanaf ' + (S.V[3] ? mName(S.V[3], true) : 'later') + '.</div>') : '') + '</section>';
  // vaste lasten
  h += fixedCard(rec.filter(function (r) { return !isS || true; }));
  // grootste
  var big = C.largest(rows, 6), tp = C.topCounterparties(rows, 6);
  h += '<section class="card s6"><h2>Grootste uitgaven</h2>' + (big.map(function (b) { return '<div class="row"><span class="n">' + esc(b.naam) + '<div class="sm muted">' + dNice(b.datum) + (b.eenmalig ? ' · eenmalig' : '') + '</div></span><b>' + eur(b.bedrag) + '</b></div>'; }).join('') || '<div class="empty">Geen</div>') + '</section>';
  h += '<section class="card s6"><h2>Meeste uitgegeven bij</h2>' + (tp.map(function (b) { return '<div class="row"><span class="n">' + esc(b.naam) + '<div class="sm muted">' + b.aantal + 'x</div></span><b>' + eur(b.bedrag) + '</b></div>'; }).join('') || '<div class="empty">Geen</div>') + '</section>';
  if (p === 'MATS') h += bufferCard(rec, p);
  h += '</div>';
  return h;
}
function loanish(n) { return /woonkrediet|rekening vader|lening|terugbetaling/i.test(n.naam) && !/provisie/i.test(n.naam); }
function fixedCard(rec) {
  var loans = rec.filter(loanish), subs = rec.filter(function (r) { return !loanish(r); });
  var tl = loans.reduce(function (a, r) { return a + r.perMaand; }, 0), ts = subs.reduce(function (a, r) { return a + r.perMaand; }, 0);
  var list = function (xs) { return xs.slice(0, 7).map(function (r) { return '<div class="row"><span class="n">' + esc(r.naam) + '<div class="sm muted">' + esc(r.cat) + '</div></span><span class="sm muted">' + eur(r.perJaar) + '/jaar</span><b>' + eur(r.perMaand) + '</b></div>'; }).join(''); };
  return '<section class="card s6"><h2>Vaste lasten en abonnementen</h2><div class="kp" style="margin-top:0"><div><b>' + eur(ts) + '</b><span>Per maand vast</span></div><div><b>' + eur(tl) + '</b><span>Leningen per maand</span></div></div>' +
    '<h2 style="margin-top:16px">Vast</h2>' + (list(subs) || '<div class="empty">Nog niets herkend</div>') + (loans.length ? '<h2 style="margin-top:16px">Leningen</h2>' + list(loans) : '') +
    '<div class="sm muted" style="margin-top:8px">Automatisch herkend: zelfde partij in minstens 3 maanden met een stabiel bedrag.</div></section>';
}
function bufferCard(rec, p) {
  var sal = S.data.saldi || [], last = {};
  sal.forEach(function (s) { if (!last[s.Rekening_ID] || s.Datum > last[s.Rekening_ID].Datum) last[s.Rekening_ID] = s; });
  var tot = 0, dates = [];
  Object.keys(last).forEach(function (id) { var own = S.ctx.own[id], f = own === 'Gezamenlijk' ? (p === 'SAMEN' ? 1 : .5) : (own === 'Mats' && p === 'MATS' ? 1 : 0); tot += last[id].Saldo * f; if (f) dates.push(last[id].Datum); });
  if (!dates.length) return '';
  var fx = C.inPeriod(C.rowsFor(S.ctx, p), C.addM(S.dq.lastComplete, -2), S.dq.lastComplete), fixed = -C.metrics(fx, true).uitgaven / 3, mo = fixed > 0 ? tot / fixed : null;
  return '<section class="card s6"><h2>Buffer op de rekeningen</h2><div class="big" style="font-size:44px">' + hero(tot) + '</div><div class="muted sm" style="margin-top:6px">Stand ' + dNice(dates.sort().pop()) + ' (zicht, eigen deel)</div>' +
    (mo != null ? '<div style="margin-top:12px">Dekt ongeveer <b>' + mo.toFixed(1).replace('.', ',') + ' maanden</b> van je gemiddelde uitgaven (laatste 3 maanden, zonder eenmalig).</div>' : '') +
    '<div class="sm muted" style="margin-top:8px">Spaargeld en beleggingen zitten niet in dit blad en tellen dus niet mee.</div></section>';
}
function samenView() {
  var P = period(), h = '<div class="grid fade">' + warnSofie() + qualityNotes(P);
  var all = C.rowsFor(S.ctx, 'SAMEN', function (r) { return r.Aandeel_Mats > 0 && r.Aandeel_Sofie > 0; });
  var rows = C.inPeriod(all, P.from, P.to), per = P.n, m = C.metrics(rows, S.struct), tot = -m.uitgaven;
  var vm = C.range(P.from < S.dq.months[0] ? S.dq.months[0] : P.from, P.to > S.dq.months[S.dq.months.length - 1] ? S.dq.months[S.dq.months.length - 1] : P.to);
  var ms = C.byMonth(all, vm, S.struct);
  h += '<section class="card h s8"><h2>Huishoudkosten · ' + esc(P.label) + '</h2><div class="big">' + hero(tot / per) + '</div><div class="muted sm" style="margin-top:6px">per maand, kosten waar jullie allebei een deel van dragen</div>' +
    '<div style="margin-top:14px">' + spark(C.byMonth(all, S.per === 'jaar' ? vm : S.V, S.struct).map(function (x) { return -x.uitgaven; })) + '</div>' +
    '<div class="kp"><div><b>' + eur(tot) + '</b><span>Totaal periode</span></div><div><b>' + eur(tot / 2 / per) + '</b><span>Per persoon per maand</span></div></div></section>';
  var cats = C.byCategory(rows, S.struct), top = cats.slice(0, 5).map(function (c) { return { l: c.cat, v: c.bedrag }; }), rest = cats.slice(5).reduce(function (a, c) { return a + c.bedrag; }, 0);
  if (rest > 0) top.push({ l: 'Andere', v: rest });
  h += '<section class="card s4"><h2>Waar gaat het naartoe</h2><div class="flex">' + donut(top, eur(tot), 'totaal') + dlegend(top) + '</div></section>';
  var fr = C.fairness(S.ctx, P.from, P.to), dep = fr.stortingen, half = fr.kosten / 2, dm = (dep.MATS - fr.aandeel.MATS) - (dep.SOFIE - fr.aandeel.SOFIE);
  var mxv = Math.max(dep.MATS, dep.SOFIE, half, 1);
  var bar = function (l, v, c) { return '<div style="padding:8px 0"><div class="row" style="padding:0"><span class="n">' + l + '</span><b>' + eur(v) + '</b></div><div class="bt"><i style="width:' + (v / mxv * 100).toFixed(1) + '%;background:' + c + '"></i></div></div>'; };
  h += '<section class="card s6"><h2>Eerlijk verdeeld op de gezamenlijke rekening</h2>' + bar('Mats stortte', dep.MATS, 'var(--mats)') + bar('Sofie stortte', dep.SOFIE, 'var(--sofie)') + bar('Helft van de kosten', half, 'var(--muted)') +
    '<div class="sm" style="margin-top:10px">' + (Math.abs(dm) < 50 ? '<span class="pos">Netjes in evenwicht.</span>' : (dm > 0 ? 'Mats' : 'Sofie') + ' droeg <b>' + eur(Math.abs(dm) / 2) + '</b> meer bij dan zijn of haar deel van de kosten.') + '</div>' +
    '<div class="sm muted" style="margin-top:8px">Enkel de gezamenlijke rekening. Kosten die Mats via kaart of Revolut voorschiet en later verrekent, tellen hier niet mee. Wie stort wordt afgeleid uit de naam van de tegenpartij.' + (dep['?'] > 0 ? ' Niet toegewezen: ' + eur(dep['?']) + '.' : '') + '</div></section>';
  var hs = C.householdSplit(S.ctx, P.from, P.to);
  h += '<section class="card s6"><h2>Maand per maand</h2>' + monthBars(C.byMonth(all, S.per === 'jaar' ? vm : S.V, S.struct).map(function (x) { return { sel: x.m >= P.from && x.m <= P.to, m: x.m, a: 0, b: -x.uitgaven, r: 0, lopend: S.dq.partialMonths.indexOf(x.m) >= 0 }; }), false) + '</section>';
  h += fixedCard(C.recurring(C.inPeriod(all, S.V[0], S.dq.lastComplete), 3, C.addM(S.dq.lastComplete, -1)));
  h += '<section class="card s6"><h2>Gedeeld versus persoonlijk</h2><div class="kp" style="margin-top:0"><div><b>' + eur(hs.huishouden) + '</b><span>Gedeeld (beide dragen mee)</span></div><div><b>' + eur(hs.persoonlijk) + '</b><span>Persoonlijk geboekt</span></div></div><div class="sm muted" style="margin-top:10px">Persoonlijk geboekt is nu enkel van Mats, tot Sofie haar eigen rekeningen toevoegt.</div></section>';
  var big = C.largest(rows, 6);
  h += '<section class="card s6"><h2>Grootste gedeelde uitgaven</h2>' + (big.map(function (b) { return '<div class="row"><span class="n">' + esc(b.naam) + '<div class="sm muted">' + dNice(b.datum) + '</div></span><b>' + eur(b.bedrag) + '</b></div>'; }).join('') || '<div class="empty">Geen</div>') + '</section>';
  h += bufferCard([], 'SAMEN').replace(/<div style="margin-top:12px">Dekt[^]*?<\/div>/, '');
  return h + '</div>';
}

/* ---------- shell ---------- */
function controls() {
  var h = '', P = period();
  [['maand', 'Maand'], ['3m', '3 maanden'], ['volledig', 'Volledige maanden'], ['jaar', 'Dit jaar']].forEach(function (x) { h += '<button class="chip" data-per="' + x[0] + '" aria-pressed="' + (S.per === x[0]) + '">' + x[1] + '</button>'; });
  if (S.per === 'maand') {
    var i = S.V.indexOf(S.month);
    h += '<button class="step" data-st="-1" aria-label="Vorige maand"' + (i <= 0 ? ' disabled' : '') + '>‹</button><span class="mlabel">' + esc(mName(S.month, true)) + '</span><button class="step" data-st="1" aria-label="Volgende maand"' + (i >= S.V.length - 1 ? ' disabled' : '') + '>›</button>';
  }
  if (S.person !== 'SAMEN' && S.person !== 'SOFIE') h += '<button class="chip" data-struct="1" aria-pressed="' + S.struct + '" style="margin-left:auto">Zonder eenmalig</button>';
  if (S.person === 'SAMEN') h += '<button class="chip" data-struct="1" aria-pressed="' + S.struct + '" style="margin-left:auto">Zonder eenmalig</button>';
  $('#controls').innerHTML = h;
}
function render() {
  $('#lock').hidden = true;
  var pe = $('#persons');
  pe.innerHTML = C.PERSONS.map(function (p) { return '<button role="tab" style="--c:' + COL[p] + '" aria-selected="' + (p === S.person) + '" data-p="' + p + '">' + LBL[p] + '</button>'; }).join('');
  document.documentElement.style.setProperty('--accent', COL[S.person]);
    controls();
  try { $('#view').innerHTML = S.person === 'SAMEN' ? samenView() : personView(S.person); }
  catch (e) { $('#view').innerHTML = '<div class="warn"><b>Er ging iets mis bij het tekenen</b>' + esc(e.message) + '</div>'; console.error(e); }
  var ld = S.dq.lastDates, at = lsGet('hb_cache_at');
  var srcTxt = S.src === 'demo' ? 'DEMO met verzonnen gegevens' : S.src === 'cache' ? 'Offline: laatst opgeslagen versie van ' + (at ? dNice(at.slice(0, 10)) : '?') : S.src === 'fixture' ? 'TESTDATA' : 'Live uit het blad';
  var bd = document.getElementById('badge'); if (S.src === 'demo' || S.src === 'fixture') { if (!bd) { bd = document.createElement('div'); bd.id = 'badge'; bd.className = 'badge'; document.body.appendChild(bd); } bd.textContent = S.src === 'demo' ? 'DEMO' : 'TESTDATA'; } else if (bd) bd.remove();
  $('#foot').innerHTML = esc(srcTxt) + '. Laatste boeking: ' + dNice(S.dq.maxLast) + '<details class="src"><summary>Databronnen</summary>Laatste volledige maand: ' + esc(mName(S.dq.lastComplete, true)) + '<br>' +
    Object.keys(ld).map(function (k) { var a = S.data.rekeningen.filter(function (r) { return r.Rekening_ID === k; })[0]; return esc(a ? a.Naam : k) + ': ' + dNice(ld[k]); }).join(' · ') + '</details>';
}
document.addEventListener('click', function (e) {
  var t = e.target.closest('button'); if (!t) return;
  if (t.dataset.p) { S.person = t.dataset.p; lsSet('hb_person', S.person); render(); }
  else if (t.dataset.per) { S.per = t.dataset.per; render(); }
  else if (t.dataset.st) { var i = S.V.indexOf(S.month) + (+t.dataset.st); if (i >= 0 && i < S.V.length) { S.month = S.V[i]; render(); } }
  else if (t.dataset.struct) { S.struct = !S.struct; render(); }
  else if (t.id === 'menu') menu();
});
function menu() {
  var t = lsGet('hb_theme') || 'auto', n = t === 'auto' ? 'light' : t === 'light' ? 'dark' : 'auto';
  var lab = { auto: 'Automatisch', light: 'Licht', dark: 'Donker' };
  var a = window.prompt ? null : null; // geen blokkerende dialogen
  var el = document.createElement('div'); el.className = 'lock'; el.innerHTML = '<div class="card"><h1>Instellingen</h1><button class="chip" id="m-theme" style="min-height:52px">Thema: ' + lab[t] + '</button><button class="chip" id="m-reload" style="min-height:52px">Gegevens vernieuwen</button><button class="chip" id="m-out" style="min-height:52px">Wachtwoord vergeten op dit toestel</button><button class="primary" id="m-close">Sluiten</button></div>';
  document.body.appendChild(el);
  el.addEventListener('click', function (e) {
    var id = e.target.id; if (!id) return;
    if (id === 'm-theme') { lsSet('hb_theme', n); applyTheme(); el.remove(); }
    if (id === 'm-reload') { el.remove(); load(true); }
    if (id === 'm-out') { lsSet('hb_pw', ''); lsSet('hb_cache', ''); el.remove(); load(); }
    if (id === 'm-close') el.remove();
  });
}
function applyTheme() { var t = lsGet('hb_theme') || 'auto'; if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); }
applyTheme();
if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) navigator.serviceWorker.register('sw.js').catch(function () {});
load();
})();
