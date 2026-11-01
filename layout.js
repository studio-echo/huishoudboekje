/* Widgetcatalogus, pagina's en indeling. Geen DOM, werkt in browser en Node (tests). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Layout = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var VERSION = 4, SIZES = ['S', 'M', 'L'], ROWS = 4;
  var ALL = ['MATS', 'SOFIE', 'SAMEN'];

  /* Pagina's om tussen te vegen. Elke standaardpagina vult precies 4 rijen van 4 kolommen (een iPad liggend). */
  var PAGES = [
    { id: 'overzicht', naam: 'Overzicht', views: ALL },
    { id: 'uitgaven', naam: 'Uitgaven', views: ALL },
    { id: 'pockets', naam: 'Pockets', views: ALL },
    { id: 'vast', naam: 'Vaste kosten', views: ALL },
    { id: 'sparen', naam: 'Sparen', views: ALL },
    { id: 'fire', naam: 'FIRE', views: ALL },
    { id: 'samen', naam: 'Samen', views: ['SAMEN'] }
  ];

  /* h = hoogte in rijen per grootte. Breedte: S = kwart, M = half, L = volledig (op een gsm: S = half). */
  var h = function (s, m, l) { return { S: s, M: m, L: l }; };
  var CATALOG = [
    { id: 'verloop', naam: 'Inkomen en uitgaven', h: h(1, 2, 2), views: ALL },
    { id: 'inkomen', naam: 'Inkomen', h: h(1, 1, 1), views: ALL },
    { id: 'uitgaven', naam: 'Uitgaven', h: h(1, 1, 1), views: ALL },
    { id: 'gespaard', naam: 'Gespaard', h: h(1, 1, 1), views: ALL },
    { id: 'spaarratio', naam: 'Spaarratio', h: h(1, 1, 1), views: ALL },
    { id: 'prognose', naam: 'Jaarprognose', h: h(1, 1, 1), views: ALL },
    { id: 'veranderingen', naam: 'Wat veranderde', h: h(1, 1, 2), views: ALL },
    { id: 'donut', naam: 'Uitgaven per categorie', h: h(2, 2, 2), views: ALL },
    { id: 'categorieen', naam: 'Categorieën tegenover gewoonlijk', h: h(2, 4, 4), views: ALL },
    { id: 'winkels', naam: 'Waar je het meest uitgaf', h: h(2, 2, 2), views: ALL },
    { id: 'eenmalig', naam: 'Grootste losse uitgaven', h: h(2, 2, 2), views: ALL },
    { id: 'pockets', naam: 'Pockets', h: h(2, 3, 3), views: ALL },
    { id: 'regel', naam: '50/30/20-regel', h: h(1, 1, 1), views: ALL },
    { id: 'vastsoort', naam: 'Vaste kosten per soort', h: h(2, 2, 2), views: ALL },
    { id: 'vastelasten', naam: 'Vaste kosten en abonnementen', h: h(2, 4, 4), views: ALL },
    { id: 'komend', naam: 'Wat eraan komt', h: h(2, 2, 2), views: ALL },
    { id: 'auto', naam: 'Wat kost de auto', h: h(2, 2, 2), views: ALL },
    { id: 'vastvrij', naam: 'Vast versus vrij', h: h(2, 2, 2), views: ALL },
    { id: 'spaarverloop', naam: 'Gespaard per maand', h: h(2, 2, 2), views: ALL },
    { id: 'beleggingen', naam: 'Beleggingen (ETF)', h: h(1, 2, 2), views: ALL },
    { id: 'buffer', naam: 'Buffer', h: h(1, 1, 1), views: ALL },
    { id: 'spaardoel', naam: 'Spaardoel', h: h(1, 1, 1), views: ALL },
    { id: 'opzij', naam: 'Totaal opzij gezet', h: h(1, 1, 1), views: ALL },
    { id: 'fire', naam: 'FIRE', h: h(2, 3, 3), views: ALL },
    { id: 'fireinst', naam: 'FIRE-instellingen', h: h(1, 1, 1), views: ALL },
    { id: 'gemiddelde', naam: 'Gemiddelde per maand', h: h(1, 1, 1), views: ALL },
    { id: 'inkomenflow', naam: 'Waar ging het inkomen heen', h: h(2, 2, 2), views: ALL },
    { id: 'eerlijkheid', naam: 'Wie betaalde wat', h: h(2, 2, 2), views: ['SAMEN'] },
    { id: 'gedeeld', naam: 'Gedeeld versus persoonlijk', h: h(2, 2, 2), views: ['SAMEN'] }
  ];
  var BY_ID = {};
  CATALOG.forEach(function (w) { BY_ID[w.id] = w; });

  var D = {
    overzicht: [['verloop', 'L'], ['inkomen', 'S'], ['uitgaven', 'S'], ['gespaard', 'S'], ['spaarratio', 'S'], ['prognose', 'M'], ['veranderingen', 'M']],
    uitgaven: [['donut', 'M'], ['categorieen', 'M'], ['winkels', 'S'], ['eenmalig', 'S']],
    pockets: [['pockets', 'L'], ['regel', 'L']],
    vast: [['vastsoort', 'M'], ['vastelasten', 'M'], ['komend', 'S'], ['auto', 'S']],
    sparen: [['spaarverloop', 'L'], ['beleggingen', 'M'], ['buffer', 'S'], ['spaardoel', 'S'], ['opzij', 'M']],
    fire: [['fire', 'L'], ['fireinst', 'L']],
    samen: [['eerlijkheid', 'M'], ['gedeeld', 'M'], ['inkomenflow', 'L']]
  };

  function pages(view) { return PAGES.filter(function (p) { return p.views.indexOf(view) >= 0; }); }
  function key(view, page) { return view + ':' + page; }
  function allowed(id, view) { var w = BY_ID[id]; return !!w && w.views.indexOf(view) >= 0; }
  function defaults(view, page) { return (D[page] || []).filter(function (x) { return allowed(x[0], view); }).map(function (x) { return { id: x[0], size: x[1] }; }); }
  /* Opschonen: onbekende of dubbele widgets eruit, foute grootte terug naar M. */
  function clean(items, view, taken) {
    var seen = taken || {}, out = [];
    (Array.isArray(items) ? items : []).forEach(function (it) {
      var id = it && (it.id || it[0]), size = it && (it.size || it[1]);
      if (!allowed(id, view) || seen[id]) return;
      seen[id] = 1; out.push({ id: id, size: SIZES.indexOf(size) >= 0 ? size : 'M' });
    });
    return out;
  }
  /* Gedeelde indeling uit het blad: { v: 3, 'MATS:overzicht': [{id,size}], ... }. Een oudere vorm wordt genegeerd. */
  function fromShared(o) {
    var out = {};
    if (!o || typeof o !== 'object' || o.v !== VERSION) return out;
    ALL.forEach(function (v) {
      var taken = {};
      pages(v).forEach(function (p) { var k = key(v, p.id); if (Array.isArray(o[k])) out[k] = clean(o[k], v, taken); });
    });
    return out;
  }
  function toShared(get) {
    var o = { v: VERSION };
    ALL.forEach(function (v) { pages(v).forEach(function (p) { var k = key(v, p.id); o[k] = get(k).map(function (x) { return { id: x.id, size: x.size }; }); }); });
    return o;
  }
  function parseSaved(json, view) {
    try {
      var o = typeof json === 'string' ? JSON.parse(json) : json;
      if (!o || o.v !== VERSION || !Array.isArray(o.items)) return null;
      return clean(o.items, view);
    } catch (e) { return null; }
  }
  function serialize(items) { return JSON.stringify({ v: VERSION, items: items.map(function (x) { return { id: x.id, size: x.size }; }) }); }
  /* Galerij: alles van deze weergave dat op geen enkele pagina staat */
  function gallery(onView, view) {
    var on = {};
    onView.forEach(function (x) { on[x.id] = 1; });
    return CATALOG.filter(function (w) { return w.views.indexOf(view) >= 0 && !on[w.id]; });
  }
  function move(items, from, to) {
    var a = items.slice();
    if (from < 0 || from >= a.length) return a;
    to = Math.max(0, Math.min(a.length - 1, to));
    var x = a.splice(from, 1)[0]; a.splice(to, 0, x);
    return a;
  }
  function nextSize(s) { return SIZES[(SIZES.indexOf(s) + 1) % SIZES.length]; }
  function height(id, size) { var w = BY_ID[id]; return w ? w.h[size] || 1 : 1; }

  return {
    VERSION: VERSION, SIZES: SIZES, ROWS: ROWS, ALL: ALL, PAGES: PAGES, CATALOG: CATALOG, BY_ID: BY_ID,
    pages: pages, key: key, allowed: allowed, defaults: defaults, clean: clean, fromShared: fromShared, toShared: toShared,
    parseSaved: parseSaved, serialize: serialize, gallery: gallery, move: move, nextSize: nextSize, height: height
  };
});
