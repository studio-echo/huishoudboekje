(function () {
'use strict';
var C = window.Calc, L = window.Layout, W = window.W, CFG = window.CONFIG, F = W.fmt, esc = F.esc;
var $ = function (s, el) { return (el || document).querySelector(s); };
var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
var COL = { MATS: 'var(--mats)', SOFIE: 'var(--sofie)', SAMEN: 'var(--samen)' };
var LBL = { MATS: 'Mats', SOFIE: 'Sofie', SAMEN: 'Samen' };
var S = { pg: {}, view: 'MATS', per: 'maand', month: null, data: null, ctx: null, dq: null, src: '', alert: '', edit: false, wstate: {}, layouts: {}, notesOpen: false };
var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

var PERS = ['maand', 'kwartaal', 'jaar', 'alles'], PLBL = { maand: 'Maand', kwartaal: 'Kwartaal', jaar: 'Jaar', alles: 'Alles' };
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
(function () { var v = lsGet('hb_person'); if (C.PERSONS.indexOf(v) >= 0) S.view = v; /* bij opstarten altijd de laatste maand */ })();

/* ---------- laden en controleren ---------- */
function fail(msg) { var e = new Error(msg); e.data = true; throw e; }
function num(x) {
  if (typeof x === 'number') return x;
  var s = String(x == null ? '' : x).trim().replace(/\s|€/g, '');
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  return s === '' ? 0 : parseFloat(s);
}
function validate(d) {
  if (!d || typeof d !== 'object') fail('Het antwoord van het blad is leeg.');
  ['transacties', 'rekeningen', 'categorieen'].forEach(function (k) {
    if (!Array.isArray(d[k])) fail('Het tabblad ' + { transacties: 'Transacties', rekeningen: 'Rekeningen', categorieen: 'Categorieen' }[k] + ' ontbreekt of is hernoemd.');
  });
  if (!d.transacties.length) fail('Het tabblad Transacties is leeg.');
  var need = function (rows, tab, cols) {
    if (!rows.length) return;
    cols.forEach(function (k) { if (!(k in rows[0])) fail('Kolom "' + k + '" ontbreekt in het tabblad ' + tab + '. Is de structuur van het blad aangepast? Zet de kolomnaam terug.'); });
  };
  need(d.transacties, 'Transacties', ['Datum', 'Rekening_ID', 'Categorie', 'Bedrag', 'Aandeel_Mats', 'Aandeel_Sofie', 'Eenmalig']);
  need(d.rekeningen, 'Rekeningen', ['Rekening_ID', 'Eigenaar', 'Type']);
  need(d.categorieen, 'Categorieen', ['Categorie', 'Type']);
  d.transacties.forEach(function (t, i) {
    t.Bedrag = num(t.Bedrag); t.Aandeel_Mats = num(t.Aandeel_Mats); t.Aandeel_Sofie = num(t.Aandeel_Sofie);
    if (isNaN(t.Bedrag) || isNaN(t.Aandeel_Mats) || isNaN(t.Aandeel_Sofie)) fail('Rij ' + (i + 2) + ' in Transacties heeft een Bedrag of Aandeel dat geen getal is.');
    t.Eenmalig = +num(t.Eenmalig) ? 1 : 0; t.Datum = String(t.Datum).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.Datum)) fail('Rij ' + (i + 2) + ' in Transacties heeft geen geldige datum (' + t.Datum + '). Gebruik de datumnotatie van het blad.');
  });
  d.saldi = (Array.isArray(d.saldi) ? d.saldi : []).filter(function (s) { return s && s.Rekening_ID; });
  d.saldi.forEach(function (s) { s.Saldo = num(s.Saldo); s.Datum = String(s.Datum).slice(0, 10); });
  return d;
}
function setData(d, src) {
  S.data = validate(d); S.src = src;
  if (src !== 'live') ['pockets', 'instellingen'].forEach(function (k) { var v = lsGet('hb_local_' + k); if (v) try { S.data[k] = JSON.parse(v); } catch (e) {} });
  S.data.pockets = Array.isArray(S.data.pockets) ? S.data.pockets : []; S.data.instellingen = Array.isArray(S.data.instellingen) ? S.data.instellingen : [];
  if (d.indeling && !lsGet('hb_layout_dirty')) { S.layouts = L.fromShared(d.indeling); Object.keys(S.layouts).forEach(function (k) { lsSet('hb_l4_' + k, L.serialize(S.layouts[k])); }); } S.ctx = C.makeCtx(S.data); S.dq = C.dataQuality(S.ctx);
  var L0 = S.dq.lastComplete, ms = S.dq.months, first = CFG.EERSTE_VOLLEDIGE_MAAND || ms[0];
  if (!L0) fail('Er zijn nog geen volledige maanden in het blad.');
  if (first > L0 || first < ms[0]) first = ms[0] > L0 ? L0 : ms[0];
  /* Met verschoven loon heeft de eerste maand geen loon van de maand ervoor in het blad: begin een maand later */
  if (S.ctx.loonVerschuiven && first === ms[0] && C.addM(first, 1) <= L0) first = C.addM(first, 1);
  S.V = C.range(first, L0);
  S.Months = C.range(first, ms[ms.length - 1] > L0 ? ms[ms.length - 1] : L0);
  if (!S.month || S.Months.indexOf(S.month) < 0) S.month = L0;
}
function showLock(msg) { $('#lock').hidden = false; $('#lockerr').textContent = msg || ''; setTimeout(function () { $('#pw').focus(); }, 30); }
function fetchJson(u) { return fetch(u, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('Bestand niet gevonden (' + r.status + ').'); return r.json(); }); }
function load() {
  var q = new URLSearchParams(location.search);
  S.alert = '';
  if (q.get('src') === 'fixture') return fetchJson('data/fixture.json').then(function (d) { setData(d, 'fixture'); render(); }).catch(fatal);
  if (q.get('src') === 'demo' || !CFG.API_URL) return fetchJson('data/demo.json').then(function (d) { setData(d, 'demo'); render(); }).catch(fatal);
  var pw = lsGet('hb_pw');
  if (!pw) { showLock(); return Promise.resolve(); }
  return fetch(CFG.API_URL + '?p=' + encodeURIComponent(pw), { redirect: 'follow', cache: 'no-store' })
    .catch(function () { var e = new Error('Geen verbinding met het blad.'); e.net = true; throw e; })
    .then(function (r) { return r.json().catch(function () { throw new Error('Onverwacht antwoord van het Apps Script. Controleer of de web-app geïmplementeerd is met toegang "Iedereen".'); }); })
    .then(function (d) {
      if (d && d.error === 'unauthorized') { lsDel('hb_pw'); showLock('Wachtwoord klopt niet.'); return; }
      if (d && d.error === 'locked') { showLock('Te veel foute pogingen. Probeer over een kwartier opnieuw.'); return; }
      if (d && d.error) throw new Error('Het blad gaf een fout: ' + d.error);
      setData(d, 'live'); lsSet('hb_cache', JSON.stringify(d)); lsSet('hb_cache_at', new Date().toISOString());
      $('#lock').hidden = true; render(); pushLayout();
    }).catch(function (e) {
      var c = lsGet('hb_cache');
      if (c) {
        try {
          setData(JSON.parse(c), 'cache');
          var at = lsGet('hb_cache_at');
          S.alert = (e.net ? 'Offline. ' : 'Nieuwe gegevens konden niet geladen worden: ' + e.message + ' ') + 'Je ziet de versie van ' + (at ? F.dNice(at.slice(0, 10)) : 'eerder') + '.';
          render(); return;
        } catch (x) {}
      }
      fatal(e);
    });
}
function fatal(e) {
  $('#lock').hidden = true;
  $('#view').innerHTML = '<div class="alert" role="alert"><b>' + (e.data ? 'De gegevens in het blad kloppen niet' : 'Geen gegevens') + '</b><p>' + esc(e.message || e) + '</p><button class="btn" data-act="reload">Opnieuw proberen</button></div>';
  $('#controls').innerHTML = ''; $('#status').innerHTML = '';
}
$('#lockform').addEventListener('submit', function (e) { e.preventDefault(); var v = $('#pw').value; if (!v) return; lsSet('hb_pw', v); $('#pw').value = ''; $('#lock').hidden = true; load(); });

/* ---------- periode ---------- */
/* Maand, kwartaal en jaar volgen de kalender rond S.month; alles = vanaf de eerste volledige maand. */
function period() {
  var ms = S.Months, first = ms[0], last = ms[ms.length - 1], m = S.month, y = m.slice(0, 4), from, to, label;
  if (S.per === 'maand') { from = to = m; label = F.mShort(m) + ' ' + y; }
  else if (S.per === 'kwartaal') { var q = Math.floor((+m.slice(5) - 1) / 3); from = y + '-' + ('0' + (q * 3 + 1)).slice(-2); to = C.addM(from, 2); label = 'Q' + (q + 1) + ' ' + y; }
  else if (S.per === 'jaar') { from = y + '-01'; to = y + '-12'; label = y; }
  else { from = first; to = last; label = F.mShort(first) + ' tot ' + F.mShort(last); }
  var lo = from < first, hi = to > last;
  if (lo) from = first; if (hi) to = last;
  var partial = S.dq.partialMonths.some(function (x) { return x >= from && x <= to; });
  return { kind: S.per, from: from, to: to, n: C.range(from, to).length, label: label, partial: partial, atStart: from <= first, atEnd: to >= last };
}

/* ---------- indeling ---------- */
/* De indeling staat in het blad (tabblad Indeling) en is dus op elk toestel dezelfde.
   Lokaal bewaren we een kopie voor offline; hb_layout_dirty = nog niet naar het blad gestuurd. */
function page() {
  var ps = L.pages(S.view), id = S.pg[S.view] || lsGet('hb_page_' + S.view);
  return ps.filter(function (p) { return p.id === id; })[0] || ps[0];
}
function curKey() { return L.key(S.view, page().id); }
function layout(k) {
  if (!S.layouts[k]) { var q = k.split(':'); S.layouts[k] = L.parseSaved(lsGet('hb_l4_' + k), q[0]) || L.defaults(q[0], q[1]); }
  return S.layouts[k];
}
function viewItems(view) { var o = []; L.pages(view).forEach(function (p) { o = o.concat(layout(L.key(view, p.id))); }); return o; }
function saveLayout(k, items) { S.layouts[k] = items; lsSet('hb_l4_' + k, L.serialize(items)); lsSet('hb_layout_dirty', '1'); }
/* Iets naar het blad schrijven (indeling, pockets, instellingen). Enkel live; anders blijft het op dit toestel. */
function post(body) {
  var pw = lsGet('hb_pw');
  if (S.src !== 'live' || !CFG.API_URL || !pw) return Promise.resolve(false);
  body.p = pw;
  return fetch(CFG.API_URL, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
    .then(function (r) { return r.json(); })
    .then(function (d) { if (d && d.ok) return true; throw new Error(d && d.error || 'fout'); });
}
function pushLayout() {
  if (!lsGet('hb_layout_dirty')) return;
  if (S.src !== 'live') { lsDel('hb_layout_dirty'); return; }
  post({ indeling: L.toShared(layout) })
    .then(function (ok) { if (ok) { lsDel('hb_layout_dirty'); S.saveErr = ''; } })
    .catch(function () { S.saveErr = 'Indeling enkel op dit toestel bewaard. Ze gaat naar het blad zodra er verbinding is.'; status(); });
}
/* Pockets en instellingen: meteen tonen, dan naar het blad (of lokaal bewaren in demo en test) */
function saveData(key, body, done) {
  render();
  if (S.src === 'live') {
    lsSet('hb_cache', JSON.stringify(S.data));
    post(body).then(function () { announce('Bewaard in het blad'); }).catch(function (e) { S.saveErr = 'Niet bewaard in het blad (' + e.message + '). Probeer opnieuw met verbinding.'; status(); });
  } else lsSet('hb_local_' + key, JSON.stringify(S.data[key]));
  if (done) done();
}

/* ---------- tekenen ---------- */
var M = null;
function render() {
  $('#lock').hidden = true;
  document.documentElement.style.setProperty('--accent', COL[S.view]);
  document.body.classList.toggle('editing', S.edit);
  $('#persons').innerHTML = C.PERSONS.map(function (p) {
    return '<button role="tab" style="--c:' + COL[p] + '" aria-selected="' + (p === S.view) + '" data-p="' + p + '">' + LBL[p] + '</button>';
  }).join('');
  $('#edit').textContent = S.edit ? 'Klaar' : 'Bewerk';
  $('#edit').classList.toggle('on', S.edit);
  S.P = period();
  S.notes = C.notes(S.ctx, S.dq, S.view, S.P.from, S.P.to);
  M = W.model(S);
  controls(); status(); grid(); dots(); foot(); fit();
}
function controls() {
  if (S.edit) {
    $('#controls').innerHTML = '<button class="chip add" data-act="gallery">+ Widget</button><button class="chip" data-act="reset">Standaard herstellen</button><span class="sp"></span><span class="eh">Sleep, of gebruik de pijlen</span>';
    return;
  }
  var P = S.P, nm = { maand: 'maand', kwartaal: 'kwartaal', jaar: 'jaar' }[S.per];
  var h = '<div class="seg per" role="tablist" aria-label="Periode">' + PERS.map(function (k) { return '<button role="tab" data-per="' + k + '" aria-selected="' + (S.per === k) + '">' + PLBL[k] + '</button>'; }).join('') + '</div>';
  h += '<div class="pgrp">' + (nm ? '<button class="step" data-st="-1" aria-label="Vorige ' + nm + '"' + (P.atStart ? ' disabled' : '') + '>‹</button>' : '') +
    '<span class="mlabel">' + esc(P.label) + (P.partial ? ' <small>lopend</small>' : '') + '</span>' +
    (nm ? '<button class="step" data-st="1" aria-label="Volgende ' + nm + '"' + (P.atEnd ? ' disabled' : '') + '>›</button>' : '') + '</div>';
  $('#controls').innerHTML = h;
}
function status() {
  if (S.edit) { $('#status').innerHTML = ''; return; }
  var ns = S.notes.filter(function (n) { return n.level === 'note'; }), fs = S.notes.filter(function (n) { return n.level === 'foot'; });
  var h = (S.alert ? '<div class="alert slim" role="alert">' + esc(S.alert) + '</div>' : '') +
    (S.saveErr ? '<div class="alert slim" role="status">' + esc(S.saveErr) + '</div>' : '') + '<div class="sline"><span>Cijfers van ' + esc(F.mShort(S.V[0]) + ' tot ' + F.mShort(S.V[S.V.length - 1]) + ' ' + S.V[S.V.length - 1].slice(0, 4)) + '.</span>';
  if (ns.length || fs.length) h += ' <button class="slink" data-act="notes" aria-expanded="' + S.notesOpen + '">' + (ns.length ? ns.length + ' aandachtspunt' + (ns.length > 1 ? 'en' : '') : fs.length + ' voetnoot' + (fs.length > 1 ? 'en' : '')) + ' <span aria-hidden="true">' + (S.notesOpen ? '▴' : '▾') + '</span></button>';
  h += '</div>';
  if (S.notesOpen) h += '<ul class="notes">' + ns.concat(fs).map(function (n) { return '<li' + (n.level === 'foot' ? ' class="ft"' : '') + '>' + esc(n.text) + '</li>'; }).join('') + '</ul>';
  $('#status').innerHTML = h;
}
function tileHtml(it) {
  var r = W.render(it.id, M, it.size), h = L.height(it.id, it.size), meta = L.BY_ID[it.id];
  var ed = S.edit ? '<div class="ed"><button class="eb rm" data-rm="' + it.id + '" aria-label="Verwijder ' + esc(meta.naam) + '">−</button>' +
    '<button class="eb hd" data-hd="' + it.id + '" aria-label="Versleep ' + esc(meta.naam) + '">⠿</button>' +
    '<div class="ectl"><div class="szs" role="group" aria-label="Grootte">' + L.SIZES.map(function (z) { return '<button class="eb sz" data-sz="' + it.id + ':' + z + '" aria-pressed="' + (z === it.size) + '" aria-label="Grootte ' + z + '">' + z + '</button>'; }).join('') + '</div>' +
    '<button class="eb sz1" data-sz="' + it.id + ':' + L.nextSize(it.size) + '" aria-label="Grootte nu ' + it.size + ', wissel">' + it.size + '</button>' +
    '<button class="eb" data-mv="' + it.id + ':-1" aria-label="' + esc(meta.naam) + ' naar voren">↑</button><button class="eb" data-mv="' + it.id + ':1" aria-label="' + esc(meta.naam) + ' naar achter">↓</button></div>' +
    '<span class="en">' + esc(meta.naam) + '</span></div>' : '';
  return '<article class="w ' + (r.cls || '') + '" data-id="' + it.id + '" data-size="' + it.size + '" style="grid-row:span ' + h + '" aria-label="' + esc(meta.naam) + '"><div class="wi"><h3 class="wt">' + esc(r.title) + '</h3><div class="wb">' + r.body + '</div></div>' + ed + '</article>';
}
function grid() {
  var items = layout(curKey());
  $('#ptitle').textContent = page().naam;
  $('#view').innerHTML = '<div class="grid" id="grid">' + (items.length ? items.map(tileHtml).join('') : '') + '</div>' +
    (!items.length ? '<div class="alert slim">Geen widgets op deze pagina. Tik op Bewerk en dan op + Widget.</div>' : '');
  fit();
}
function dots() {
  var ps = L.pages(S.view), cur = page().id;
  $('#dots').innerHTML = ps.map(function (p) { return '<button data-pg="' + p.id + '" aria-label="' + esc(p.naam) + '"' + (p.id === cur ? ' aria-current="page"' : '') + '><i></i></button>'; }).join('');
}
/* iPad liggend: de pagina vult precies het scherm (4 rijen). Smaller of rechtop: vaste rijhoogte en scrollen. */
var wide = function () { return innerWidth >= 1000 && innerWidth > innerHeight && innerHeight >= 600; };
function fit() {
  var g = $('#grid'); if (!g) return;
  document.body.classList.toggle('fit', wide());
  if (wide()) {
    g.style.setProperty('--row', '110px');
    var top = g.getBoundingClientRect().top + scrollY, gap = parseFloat(getComputedStyle(g).rowGap) || 12;
    var avail = innerHeight - top - ($('#dots').offsetHeight || 40) - 6;
    g.style.setProperty('--row', Math.max(110, Math.floor((avail - gap * (L.ROWS - 1)) / L.ROWS)) + 'px');
  } else g.style.removeProperty('--row');
  fitLists();
}
/* Lijsten tonen zoveel rijen als er in de tegel passen; de rest zit achter "Toon alle". */
function fitLists() {
  $$('#grid .list[data-fit]').forEach(function (ul) {
    var lis = $$(':scope > li', ul), more = ul.nextElementSibling && ul.nextElementSibling.classList.contains('more') ? ul.nextElementSibling : null;
    lis.forEach(function (li) { li.hidden = false; }); if (more) more.hidden = true;
    if (ul.scrollHeight <= ul.clientHeight + 1) return;
    if (more) more.hidden = false;
    for (var i = lis.length - 1; i > 0 && ul.scrollHeight > ul.clientHeight + 1; i--) lis[i].hidden = true;
  });
}
function goPage(id, dir) {
  var ps = L.pages(S.view), ids = ps.map(function (p) { return p.id; }), i = ids.indexOf(page().id);
  var n = id ? ids.indexOf(id) : i + dir;
  if (n < 0 || n >= ps.length || n === i) return;
  S.pg[S.view] = ps[n].id; lsSet('hb_page_' + S.view, ps[n].id);
  grid(); dots(); fit();
  var g = $('#grid');
  if (g && !reduce) { g.classList.add(n > i ? 'in-r' : 'in-l'); setTimeout(function () { g.classList.remove('in-r', 'in-l'); }, 300); }
  window.scrollTo(0, 0); announce(ps[n].naam);
}
function foot() {
  var at = lsGet('hb_cache_at');
  var t = S.src === 'demo' ? 'Demo met verzonnen gegevens' : S.src === 'cache' ? 'Laatst opgeslagen versie van ' + (at ? F.dNice(at.slice(0, 10)) : '?') : S.src === 'fixture' ? 'Testgegevens' : 'Live uit het blad';
  $('#foot').textContent = t + ' · laatste boeking ' + F.dNice(S.dq.maxLast);
  var bd = $('#badge');
  if (S.src === 'demo' || S.src === 'fixture') { if (!bd) { bd = document.createElement('div'); bd.id = 'badge'; bd.className = 'badge'; document.body.appendChild(bd); } bd.textContent = S.src === 'demo' ? 'DEMO' : 'TEST'; }
  else if (bd) bd.remove();
}

/* FLIP: tegels glijden naar hun nieuwe plek */
function rects() { var o = {}; $$('#grid .w').forEach(function (el) { o[el.dataset.id] = el.getBoundingClientRect(); }); return o; }
function flip(before, skip) {
  if (reduce || !before) return;
  $$('#grid .w').forEach(function (el) {
    var id = el.dataset.id, b = before[id]; if (!b || id === skip) return;
    var a = el.getBoundingClientRect(), dx = b.left - a.left, dy = b.top - a.top;
    if (!dx && !dy) return;
    el.style.transition = 'none'; el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    el.getBoundingClientRect();
    el.style.transition = 'transform .28s cubic-bezier(.2,.8,.2,1)'; el.style.transform = '';
    setTimeout(function () { el.style.transition = ''; }, 320);
  });
}
function relayout(items, focusSel) {
  var b = rects(); saveLayout(curKey(), items); grid(); flip(b);
  if (focusSel) { var f = $(focusSel); if (f) f.focus(); }
}
function setEdit(on) {
  if (S.edit && !on) pushLayout();
  S.edit = on; S.notesOpen = false; render();
  if (on) announce('Bewerkmodus. Versleep tegels of gebruik de pijlen. Tik op Klaar als je klaar bent.');
}
function announce(t) { var a = $('#sr'); a.textContent = ''; setTimeout(function () { a.textContent = t; }, 50); }

/* ---------- klikken ---------- */
document.addEventListener('click', function (e) {
  if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopPropagation(); return; }
  var t = e.target.closest('button,[data-dd]'); if (!t) return;
  var d = t.dataset, items = S.data ? layout(curKey()) : [];
  if (d.p) { S.view = d.p; lsSet('hb_person', S.view); render(); }
  else if (d.per) { S.per = d.per; lsSet('hb_per', S.per); render(); }
  else if (d.st) {
    var stp = { maand: 1, kwartaal: 3, jaar: 12 }[S.per] * (+d.st), nx = C.addM(S.month, stp), ms = S.Months;
    if (nx < ms[0]) nx = ms[0]; if (nx > ms[ms.length - 1]) nx = ms[ms.length - 1];
    S.month = nx; render();
  }
  else if (d.dd && !S.edit) { var r0 = W.drill(M, d.dd); if (r0) openSheet(r0.title, r0.html); }
  else if (d.month && !S.edit) { S.month = d.month; S.per = 'maand'; lsSet('hb_per', S.per); render(); announce(F.mLong(d.month, true) + ' gekozen'); }
  else if (d.wt && !S.edit) { var p = d.wt.split(':'); S.wstate[p[0]] = p[1]; render(); }
  else if (d.more && !S.edit) showMore(d.more);
  else if (d.rm) { relayout(items.filter(function (x) { return x.id !== d.rm; })); announce(L.BY_ID[d.rm].naam + ' verwijderd'); }
  else if (d.sz) { var q = d.sz.split(':'); relayout(items.map(function (x) { return x.id === q[0] ? { id: x.id, size: q[1] } : x; }), '[data-sz="' + q[0] + ':' + L.nextSize(q[1]) + '"].sz1'); }
  else if (d.mv) { var r = d.mv.split(':'), idx = items.map(function (x) { return x.id; }).indexOf(r[0]); relayout(L.move(items, idx, idx + (+r[1])), '[data-mv="' + d.mv + '"]'); }
  else if (d.add) { relayout(items.concat([{ id: d.add, size: L.BY_ID[d.add].h.M > 1 ? 'M' : 'S' }])); closeSheet(); var el = $('[data-id="' + d.add + '"]'); if (el) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); announce(L.BY_ID[d.add].naam + ' toegevoegd'); }
  else if (t.id === 'edit') setEdit(!S.edit);
  else if (t.id === 'menu') menu();
  else if (d.act === 'notes') { S.notesOpen = !S.notesOpen; status(); }
  else if (d.act === 'gallery') gallery();
  else if (d.act === 'reset') {
    var pq = curKey().split(':'), def = L.defaults(pq[0], pq[1]), on = function (x) { return def.some(function (y) { return y.id === x.id; }); };
    L.pages(S.view).forEach(function (p) { if (p.id !== pq[1]) { var k = L.key(S.view, p.id); saveLayout(k, layout(k).filter(function (x) { return !on(x); })); } });
    relayout(def); announce('Standaardindeling hersteld');
  }
  else if (d.pg) goPage(d.pg);
  else if (d.act === 'data') showMore('dataoverzicht');
  else if (d.act === 'pockets') pocketEditor();
  else if (d.act === 'fire') fireEditor();
  else if (d.pe) pocketAction(d.pe, t);
  else if (d.act === 'reload') { closeSheet(); load(); }
  else if (d.act === 'close') closeSheet();
  else if (d.act === 'theme') { var th = lsGet('hb_theme') || 'auto'; lsSet('hb_theme', th === 'auto' ? 'light' : th === 'light' ? 'dark' : 'auto'); applyTheme(); menu(); }
  else if (d.act === 'forget') { lsDel('hb_pw'); lsDel('hb_cache'); lsDel('hb_cache_at'); closeSheet(); load(); }
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') { if ($('#sheet')) closeSheet(); else if (S.edit) setEdit(false); }
  else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !$('#sheet') && !S.edit && S.data && !/INPUT|TEXTAREA/.test((document.activeElement || {}).tagName)) goPage(null, e.key === 'ArrowRight' ? 1 : -1);
});

/* ---------- pockets bewerken ---------- */
var PE = null;
function expenseCats() { var l = S.data.categorieen.filter(function (c) { return String(c.Type).toLowerCase() === 'uitgave'; }).map(function (c) { return c.Categorie; }); if (S.view !== 'SAMEN') l.push('Bijdrage gezamenlijke rekening'); return l; }
function pocketEditor() {
  var who = { MATS: 'Mats', SOFIE: 'Sofie', SAMEN: 'Samen' }[S.view];
  PE = S.data.pockets.filter(function (p) { var w = String(p.Wie || '').toUpperCase().trim(); return w === S.view || (!w && S.view === 'SAMEN'); })
    .map(function (p) { return { Naam: p.Naam, Bedrag: C.num(p.Bedrag), Periode: /jaar/i.test(String(p.Periode || '')) ? 'Jaar' : 'Maand', cats: String(p.Categorieen || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean) }; });
  if (!PE.length) PE.push({ Naam: '', Bedrag: '', Periode: 'Maand', cats: [] });
  openSheet('Pockets van ' + who, '<div id="pe"></div>');
  drawPE();
}
function drawPE() {
  var cats = expenseCats();
  $('#pe').innerHTML = '<p class="nt">Een pocket is een budget per maand of per jaar (bv. Reizen). Kies de categorieën die erin vallen. Een categorie hoort bij hoogstens één pocket.</p>' +
    PE.map(function (p, i) {
      return '<div class="pec"><div class="per"><input data-pi="' + i + ':Naam" value="' + esc(p.Naam) + '" placeholder="Naam, bv. Boodschappen" aria-label="Naam pocket" maxlength="40">' +
        '<input data-pi="' + i + ':Bedrag" value="' + esc(p.Bedrag) + '" inputmode="decimal" placeholder="€" aria-label="Bedrag" class="amt">' +
        '<button class="eb per" data-pe="per:' + i + '" aria-label="Periode wisselen">per ' + (p.Periode === 'Jaar' ? 'jaar' : 'maand') + '</button>' +
        '<button class="eb rm" data-pe="del:' + i + '" aria-label="Verwijder pocket">−</button></div>' +
        '<div class="pcats">' + cats.map(function (c) { return '<button data-pe="cat:' + i + ':' + esc(c) + '" aria-pressed="' + (p.cats.indexOf(c) >= 0) + '">' + esc(c) + '</button>'; }).join('') + '</div></div>';
    }).join('') + '<p class="err" id="peerr" role="alert"></p><div class="gf"><button class="btn" data-pe="add">+ Pocket</button><button class="btn pri" data-pe="save">Bewaar</button></div>';
}
function readPE() { $$('[data-pi]').forEach(function (el) { var q = el.dataset.pi.split(':'); PE[+q[0]][q[1]] = el.value; }); }
function pocketAction(a, t) {
  readPE();
  var q = a.split(':');
  if (q[0] === 'add') PE.push({ Naam: '', Bedrag: '', Periode: 'Maand', cats: [] });
  else if (q[0] === 'per') PE[+q[1]].Periode = PE[+q[1]].Periode === 'Jaar' ? 'Maand' : 'Jaar';
  else if (q[0] === 'del') PE.splice(+q[1], 1);
  else if (q[0] === 'cat') {
    var p = PE[+q[1]], c = q.slice(2).join(':'), i = p.cats.indexOf(c);
    if (i >= 0) p.cats.splice(i, 1); else { PE.forEach(function (o) { var j = o.cats.indexOf(c); if (j >= 0) o.cats.splice(j, 1); }); p.cats.push(c); }
  } else if (q[0] === 'save') {
    var list = PE.filter(function (p) { return String(p.Naam).trim() || p.cats.length; }), bad = list.filter(function (p) { return !String(p.Naam).trim() || !(C.num(p.Bedrag) > 0) || !p.cats.length; })[0];
    if (bad) { $('#peerr').textContent = 'Elke pocket heeft een naam, een bedrag groter dan 0 en minstens één categorie nodig.'; return; }
    var wie = { MATS: 'Mats', SOFIE: 'Sofie', SAMEN: 'Samen' }[S.view];
    var others = S.data.pockets.filter(function (p) { var w = String(p.Wie || '').toUpperCase().trim(); return !(w === S.view || (!w && S.view === 'SAMEN')); });
    S.data.pockets = others.concat(list.map(function (p) { return { Naam: String(p.Naam).trim(), Categorieen: p.cats.join(', '), Bedrag: Math.round(C.num(p.Bedrag) * 100) / 100, Wie: wie, Periode: p.Periode === 'Jaar' ? 'Jaar' : 'Maand' }; }));
    closeSheet(); saveData('pockets', { pockets: S.data.pockets });
    return;
  }
  drawPE();
}

/* ---------- FIRE-instellingen ---------- */
var FIRE_KEYS = [['GEBOORTEJAAR', 'Geboortejaar (bij Samen: van de oudste)', 'bv. 1995', ''], ['BARISTA_DOEL', 'Totaal vermogen nodig voor Barista FIRE', 'bv. 1370000', '€'], ['FIRE_DOEL', 'Totaal vermogen nodig voor volledige FIRE', 'leeg = 25 × je jaaruitgaven', '€'], ['RENDEMENT', 'Verwacht rendement na inflatie, % per jaar', '5', '%'],
  ['STARTVERMOGEN', 'Vermogen nu (spaarrekening + beleggingen + rekeningen)', 'leeg = ETF\'s + zichtrekening', '€'], ['INLEG', 'Inleg per maand', 'leeg = je gemiddelde spaarbedrag', '€'],
  ['SPAARREKENING', 'Stand spaarrekening nu (voor het maandadvies)', 'bv. 8000', '€'], ['BUFFER_DOEL', 'Buffer op de spaarrekening', 'leeg = 3 maanden uitgaven', '€'], ['ETF_DEEL', 'Deel van het overschot naar ETF\'s, na de buffer', 'bv. 70', '%']];
function fireEditor() {
  var get = function (k) { var r = S.data.instellingen.filter(function (x) { return x.Sleutel === S.view + '.' + k; })[0]; return r ? r.Waarde : ''; };
  openSheet('FIRE en sparen voor ' + { MATS: 'Mats', SOFIE: 'Sofie', SAMEN: 'Samen' }[S.view], '<div class="fe">' + FIRE_KEYS.map(function (k) {
    return '<label>' + k[1] + '<input data-fk="' + k[0] + '" value="' + esc(get(k[0])) + '" placeholder="' + esc(k[2]) + '" inputmode="decimal"></label>';
  }).join('') + '<p class="nt">Alles in euro van vandaag. Rendement na inflatie: 4 tot 5% is een gangbare aanname voor een wereldwijde ETF.</p><p class="err" id="feerr" role="alert"></p><button class="btn pri" data-act="firesave">Bewaar</button></div>');
}
document.addEventListener('click', function (e) {
  var t = e.target.closest('[data-act=firesave]'); if (!t) return;
  var o = {}, err = '';
  $$('[data-fk]').forEach(function (el) { var v = el.value.trim(); if (v && isNaN(C.num(v))) err = 'Gebruik enkel getallen.'; o[S.view + '.' + el.dataset.fk] = v ? String(C.num(v)) : ''; });
  var gj = +o[S.view + '.GEBOORTEJAAR']; if (gj && (gj < 1930 || gj > 2015)) err = 'Dat geboortejaar lijkt niet te kloppen.';
  if (err) { $('#feerr').textContent = err; return; }
  Object.keys(o).forEach(function (k) {
    var r = S.data.instellingen.filter(function (x) { return x.Sleutel === k; })[0];
    if (r) r.Waarde = o[k]; else S.data.instellingen.push({ Sleutel: k, Waarde: o[k] });
  });
  closeSheet(); saveData('instellingen', { instellingen: o });
});

/* ---------- vellen (sheet) ---------- */
var lastFocus = null;
function openSheet(title, html) {
  closeSheet(true); lastFocus = document.activeElement;
  var el = document.createElement('div'); el.id = 'sheet'; el.className = 'sheet';
  el.innerHTML = '<div class="sbg" data-act="close"></div><div class="sp" role="dialog" aria-modal="true" aria-labelledby="sht"><div class="sh"><h2 id="sht">' + esc(title) + '</h2><button class="btn" data-act="close">Sluiten</button></div><div class="sc">' + html + '</div></div>';
  document.body.appendChild(el); document.body.classList.add('noscroll');
  el.addEventListener('click', function (e) { if (e.target.classList.contains('sbg')) closeSheet(); });
  var f = $('.sc button, .sc textarea', el) || $('.sh button', el); if (f) f.focus();
}
function closeSheet(silent) {
  var el = $('#sheet'); if (!el) return;
  el.remove(); document.body.classList.remove('noscroll');
  if (!silent && lastFocus && lastFocus.focus) lastFocus.focus();
}
function showMore(id) {
  var rows = W.full[id] ? W.full[id](M) : [];
  openSheet(id === 'dataoverzicht' ? 'Gegevens en rekeningen' : L.BY_ID[id].naam, (id === 'dataoverzicht' ? W.dataIntro(M) : '') + W.rowsHtml(rows));
}
function gallery() {
  var list = L.gallery(viewItems(S.view), S.view);
  var html = list.length ? '<div class="gal">' + list.map(function (w) {
    var size = w.h.M > 1 ? 'M' : 'S', r = W.render(w.id, M, size);
    return '<div class="gi"><div class="pv" style="height:calc(var(--row) * ' + Math.min(2, L.height(w.id, size)) + ' + var(--gap) * ' + (Math.min(2, L.height(w.id, size)) - 1) + ')" aria-hidden="true"><article class="w ' + (r.cls || '') + '" data-size="' + size + '"><div class="wi"><h3 class="wt">' + esc(r.title) + '</h3><div class="wb">' + r.body + '</div></div></article></div>' +
      '<div class="gf"><b>' + esc(w.naam) + '</b><button class="btn pri" data-add="' + w.id + '">Voeg toe</button></div></div>';
  }).join('') + '</div>' : '<p class="nt">Alle widgets staan al op deze pagina.</p>';
  openSheet('Widget toevoegen', html);
}
function menu() {
  var th = lsGet('hb_theme') || 'auto', lab = { auto: 'automatisch', light: 'licht', dark: 'donker' };
  openSheet('Instellingen', '<div class="mn">' +
    '<button class="btn" data-act="theme">Thema: ' + lab[th] + '</button>' +
    '<button class="btn" data-act="data">Gegevens en rekeningen</button>' +
    '<button class="btn" data-act="reload">Gegevens vernieuwen</button>' +

    (CFG.API_URL ? '<button class="btn" data-act="forget">Wachtwoord vergeten op dit toestel</button>' : '') +
    '<p class="nt">De indeling van de tegels staat in het blad, in het tabblad Indeling. Wat je hier aanpast, zie je op elk toestel.</p></div>');
}
/* ---------- lang drukken en slepen (pointer events, werkt ook op iPad) ---------- */
var press = null, drag = null, suppressClick = false;
function tileOf(el) { return el && el.closest ? el.closest('#grid .w') : null; }
document.addEventListener('pointerdown', function (e) {
  if (e.button > 0 || drag) return;
  var tile = tileOf(e.target); if (!tile) return;
  var hd = e.target.closest('.hd');
  if (S.edit && hd) { e.preventDefault(); startDrag(tile, e); return; }
  if (e.target.closest('button') && !S.edit) return;
  if (S.edit && e.target.closest('.eb')) return;
  press = { x: e.clientX, y: e.clientY, tile: tile, id: e.pointerId, t: setTimeout(function () {
    var p = press; press = null; if (!p) return;
    if (navigator.vibrate) try { navigator.vibrate(10); } catch (x) {}
    if (!S.edit) { suppressClick = true; setEdit(true); }
    else { suppressClick = true; startDrag(p.tile, { clientX: p.x, clientY: p.y, pointerId: p.id }); }
  }, S.edit ? 300 : 550) };
});
document.addEventListener('pointermove', function (e) {
  if (press && (Math.abs(e.clientX - press.x) > 10 || Math.abs(e.clientY - press.y) > 10)) cancelPress();
  if (drag && e.pointerId === drag.pid) { drag.x = e.clientX; drag.y = e.clientY; moveDrag(); }
});
function cancelPress() { if (press) { clearTimeout(press.t); press = null; } }
document.addEventListener('pointerup', function (e) { cancelPress(); if (drag && e.pointerId === drag.pid) endDrag(); if (suppressClick) setTimeout(function () { suppressClick = false; }, 350); });
/* Begint de browser toch te scrollen (pointercancel), dan volgen we de vinger verder via touch-events. */
document.addEventListener('pointercancel', function (e) { cancelPress(); if (drag && e.pointerId === drag.pid) { if (e.pointerType === 'touch') drag.touch = true; else endDrag(); } });
document.addEventListener('touchmove', function (e) {
  if (!drag) return;
  e.preventDefault();
  if (drag.touch && e.touches[0]) { drag.x = e.touches[0].clientX; drag.y = e.touches[0].clientY; moveDrag(); }
}, { passive: false });
document.addEventListener('touchend', function () { if (drag && drag.touch) endDrag(); });
document.addEventListener('touchcancel', function () { if (drag && drag.touch) endDrag(); });
document.addEventListener('contextmenu', function (e) { if (tileOf(e.target)) e.preventDefault(); });

function startDrag(tile, e) {
  cancelPress();
  var r = tile.getBoundingClientRect();
  drag = { tile: tile, id: tile.dataset.id, pid: e.pointerId, x: e.clientX, y: e.clientY, gx: e.clientX - r.left, gy: e.clientY - r.top, tx: 0, ty: 0, raf: 0 };
  tile.classList.add('drag'); document.body.classList.add('dragging');
  announce('Tegel opgenomen. Sleep naar de nieuwe plek.');
  moveDrag(); autoScroll();
}
function place() {
  var t = drag.tile, r = t.getBoundingClientRect(), nx = r.left - drag.tx, ny = r.top - drag.ty;
  drag.tx = drag.x - drag.gx - nx; drag.ty = drag.y - drag.gy - ny;
  t.style.transform = 'translate(' + drag.tx + 'px,' + drag.ty + 'px) scale(1.03)';
}
function moveDrag() {
  if (!drag) return;
  place();
  var t = drag.tile; t.style.pointerEvents = 'none';
  var over = tileOf(document.elementFromPoint(drag.x, drag.y)); t.style.pointerEvents = '';
  if (!over || over === t) return;
  var now = Date.now();
  if (drag.lock && now - drag.lock.t < 260 && Math.abs(drag.x - drag.lock.x) + Math.abs(drag.y - drag.lock.y) < 24) return;
  var g = $('#grid'), tiles = $$('#grid .w'), from = tiles.indexOf(t), to = tiles.indexOf(over);
  if (from < 0 || to < 0 || from === to) return;
  var b = rects();
  if (to > from) g.insertBefore(t, over.nextSibling); else g.insertBefore(t, over);
  flip(b, drag.id);
  drag.lock = { t: now, x: drag.x, y: drag.y };
  place();
}
function autoScroll() {
  if (!drag) return;
  var h = window.innerHeight, edge = 70, v = 0;
  if (drag.y < edge) v = -Math.ceil((edge - drag.y) / 6); else if (drag.y > h - edge) v = Math.ceil((drag.y - (h - edge)) / 6);
  if (v) { window.scrollBy(0, v); moveDrag(); }
  drag.raf = requestAnimationFrame(autoScroll);
}
function endDrag() {
  var d = drag; drag = null; cancelAnimationFrame(d.raf);
  document.body.classList.remove('dragging');
  var t = d.tile; t.classList.remove('drag');
  if (!reduce) { t.style.transition = 'transform .22s cubic-bezier(.2,.8,.2,1)'; setTimeout(function () { t.style.transition = ''; }, 260); }
  t.style.transform = '';
  var order = $$('#grid .w').map(function (el) { return el.dataset.id; }), items = layout(curKey()), byId = {};
  items.forEach(function (x) { byId[x.id] = x; });
  saveLayout(curKey(), order.map(function (id) { return byId[id]; }).filter(Boolean)); fitLists();
  setTimeout(function () { suppressClick = false; }, 0);
  announce('Tegel geplaatst');
}

/* ---------- vegen tussen pagina's ---------- */
function swiped(x0, y0, t0, x1, y1) {
  var dx = x1 - x0, dy = y1 - y0;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - t0 < 800) { suppressClick = true; setTimeout(function () { suppressClick = false; }, 350); goPage(null, dx < 0 ? 1 : -1); return true; }
  return false;
}
var sw = null;
document.addEventListener('pointerdown', function (e) { sw = S.edit || drag || $('#sheet') || !e.target.closest('#view') || e.pointerType === 'touch' ? null : { x: e.clientX, y: e.clientY, t: Date.now() }; }, true);
document.addEventListener('pointerup', function (e) { var s0 = sw; sw = null; if (s0 && !S.edit && !drag) swiped(s0.x, s0.y, s0.t, e.clientX, e.clientY); }, true);
/* aanraken via touch-events: pointercancel kan een veeg onderbreken */
var tsw = null;
document.addEventListener('touchstart', function (e) { tsw = S.edit || drag || $('#sheet') || !e.target.closest('#view') || e.touches.length > 1 ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }; }, { passive: true });
document.addEventListener('touchend', function (e) { var s0 = tsw; tsw = null; if (s0 && !S.edit && !drag && e.changedTouches[0]) swiped(s0.x, s0.y, s0.t, e.changedTouches[0].clientX, e.changedTouches[0].clientY); }, { passive: true });
window.addEventListener('resize', function () { if (S.data) fit(); });

/* ---------- thema en start ---------- */
function applyTheme() { var t = lsGet('hb_theme') || 'auto'; if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); }
applyTheme();
window.addEventListener('online', function () { if (S.src === 'cache') load(); });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {});
load();
window.addEventListener('online', pushLayout);
})();
