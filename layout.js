/* Widgetcatalogus en indeling. Geen DOM, werkt in browser en Node (tests). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Layout = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var VERSION = 2, SIZES = ['S', 'M', 'L'];
  var ALL = ['MATS', 'SOFIE', 'SAMEN'];

  /* h = hoogte in rij-eenheden per grootte. Breedte: S = kwart, M = half, L = volledig (op een gsm: S = half). */
  var H1 = { S: 1, M: 1, L: 1 }, H2 = { S: 2, M: 2, L: 2 }, H3 = { S: 2, M: 3, L: 3 }, HERO = { S: 1, M: 2, L: 2 };
  var CATALOG = [
    { id: 'resultaat', naam: 'Resultaat', h: HERO, views: ALL },
    { id: 'inkomen', naam: 'Inkomen', h: H1, views: ALL },
    { id: 'uitgaven', naam: 'Uitgaven', h: H1, views: ALL },
    { id: 'gespaard', naam: 'Gespaard', h: H1, views: ALL },
    { id: 'spaarratio', naam: 'Spaarratio', h: H1, views: ALL },
    { id: 'maandverloop', naam: 'Maandverloop', h: H2, views: ALL },
    { id: 'opgebouwd', naam: 'Opgebouwd resultaat', h: H2, views: ALL },
    { id: 'categorieen', naam: 'Categorieën', h: H3, views: ALL },
    { id: 'donut', naam: 'Donut per categorie', h: H2, views: ALL },
    { id: 'inkomenflow', naam: 'Waar ging je inkomen heen', h: H3, views: ALL },
    { id: 'vastelasten', naam: 'Vaste lasten en leningen', h: H3, views: ALL },
    { id: 'abonnementen', naam: 'Abonnementen', h: H3, views: ALL },
    { id: 'opvallend', naam: 'Opvallend', h: H3, views: ALL },
    { id: 'weekdag', naam: 'Uitgaven per weekdag', h: H2, views: ALL },
    { id: 'gemiddelde', naam: 'Gemiddelde per maand', h: H1, views: ALL },
    { id: 'vergelijking', naam: 'Vergelijking met vorige maand', h: H2, views: ALL },
    { id: 'buffer', naam: 'Buffer', h: H1, views: ALL },
    { id: 'spaardoel', naam: 'Spaardoel-voortgang', h: H1, views: ALL },
    { id: 'dataoverzicht', naam: 'Dataoverzicht', h: H2, views: ALL },
    { id: 'vastvrij', naam: 'Vast versus vrij', h: H2, views: ALL },
    { id: 'ritme', naam: 'Hoe vaak komt het terug', h: H2, views: ALL },
    { id: 'regel', naam: '50/30/20-regel', h: H2, views: ALL },
    { id: 'potjes', naam: 'Potjes', h: H3, views: ALL },
    { id: 'auto', naam: 'Wat kost de auto', h: H2, views: ALL },
    { id: 'beleggingen', naam: 'Beleggingen (ETF)', h: { S: 1, M: 1, L: 2 }, views: ALL },
    { id: 'eerlijkheid', naam: 'Eerlijkheidsmeter', h: H2, views: ['SAMEN'] },
    { id: 'gedeeld', naam: 'Gedeeld versus persoonlijk', h: H2, views: ['SAMEN'] }
  ];
  var BY_ID = {};
  CATALOG.forEach(function (w) { BY_ID[w.id] = w; });

  var PERSON_DEFAULT = [
    ['resultaat', 'L'], ['inkomen', 'S'], ['uitgaven', 'S'], ['gespaard', 'S'], ['spaarratio', 'S'], ['maandverloop', 'L'],
    ['categorieen', 'M'], ['inkomenflow', 'M'], ['spaardoel', 'S'], ['buffer', 'S'], ['beleggingen', 'M'], ['regel', 'M'],
    ['vastvrij', 'M'], ['vastelasten', 'M'], ['ritme', 'M'], ['auto', 'M'], ['gemiddelde', 'M'], ['opvallend', 'M'], ['potjes', 'M'],
    ['dataoverzicht', 'L']
  ];
  var DEFAULTS = {
    MATS: PERSON_DEFAULT,
    SOFIE: PERSON_DEFAULT,
    SAMEN: [
      ['resultaat', 'L'], ['inkomen', 'S'], ['uitgaven', 'S'], ['gespaard', 'S'], ['spaarratio', 'S'],
      ['eerlijkheid', 'M'], ['gedeeld', 'M'], ['maandverloop', 'L'], ['inkomenflow', 'M'], ['vastelasten', 'M'],
      ['buffer', 'S'], ['spaardoel', 'S'], ['donut', 'M'], ['vastvrij', 'M'], ['regel', 'M'], ['potjes', 'M'], ['ritme', 'M'],
      ['auto', 'M'], ['beleggingen', 'M'], ['gemiddelde', 'M'], ['opvallend', 'L'], ['dataoverzicht', 'L']
    ]
  };

  function allowed(id, view) { var w = BY_ID[id]; return !!w && w.views.indexOf(view) >= 0; }
  function defaults(view) { return (DEFAULTS[view] || DEFAULTS.MATS).map(function (x) { return { id: x[0], size: x[1] }; }); }
  /* Bewaarde indeling opschonen: onbekende of dubbele widgets eruit, foute grootte terug naar M.
     Nieuwe widgets uit een latere versie worden niet opgedrongen: ze staan in de galerij. */
  function clean(items, view) {
    var seen = {}, out = [];
    (Array.isArray(items) ? items : []).forEach(function (it) {
      var id = it && (it.id || it[0]), size = it && (it.size || it[1]);
      if (!allowed(id, view) || seen[id]) return;
      seen[id] = 1; out.push({ id: id, size: SIZES.indexOf(size) >= 0 ? size : 'M' });
    });
    return out;
  }
  function parseSaved(json, view) {
    try {
      var o = typeof json === 'string' ? JSON.parse(json) : json;
      if (!o || typeof o.v !== 'number' || !Array.isArray(o.items)) return null;
      var items = clean(o.items, view);
      return items.length ? items : null;
    } catch (e) { return null; }
  }
  /* Gedeelde indeling uit het blad: { MATS: [{id,size}], SOFIE: [...], SAMEN: [...] } */
  function fromShared(o) {
    var out = {};
    if (!o || typeof o !== 'object') return out;
    ALL.forEach(function (v) { var it = clean(o[v], v); if (it.length) out[v] = it; });
    return out;
  }
  function serialize(items) { return JSON.stringify({ v: VERSION, items: items.map(function (x) { return { id: x.id, size: x.size }; }) }); }
  function gallery(items, view) {
    var on = {};
    items.forEach(function (x) { on[x.id] = 1; });
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

  /* Layoutcode om een indeling naar een ander toestel te brengen: HB2. + base64url(JSON) */
  function b64e(s) {
    var b = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, 'utf8').toString('base64');
    return b.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64d(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    return typeof atob === 'function' ? decodeURIComponent(escape(atob(s))) : Buffer.from(s, 'base64').toString('utf8');
  }
  function encode(layouts) {
    var o = { v: VERSION };
    Object.keys(layouts).forEach(function (view) {
      if (ALL.indexOf(view) < 0 || !layouts[view]) return;
      o[view] = layouts[view].map(function (x) { return x.id + ':' + x.size; }).join(',');
    });
    return 'HB2.' + b64e(JSON.stringify(o));
  }
  /* Geeft { MATS: [...], ... } terug of gooit een Error met een Nederlandse uitleg. */
  function decode(code) {
    var s = String(code || '').trim().replace(/\s+/g, '');
    if (s.indexOf('HB2.') !== 0) throw new Error('Dit is geen geldige layoutcode. Een code begint met HB2.');
    var o;
    try { o = JSON.parse(b64d(s.slice(4))); } catch (e) { throw new Error('De layoutcode is beschadigd. Kopieer hem opnieuw, volledig.'); }
    if (!o || typeof o !== 'object') throw new Error('De layoutcode is leeg.');
    var out = {}, n = 0;
    ALL.forEach(function (view) {
      var raw = o[view];
      if (typeof raw !== 'string') return;
      var items = clean(raw.split(',').map(function (p) { var q = p.split(':'); return { id: q[0], size: q[1] }; }), view);
      if (items.length) { out[view] = items; n++; }
    });
    if (!n) throw new Error('De layoutcode bevat geen herkende widgets.');
    return out;
  }

  return {
    VERSION: VERSION, SIZES: SIZES, CATALOG: CATALOG, BY_ID: BY_ID, DEFAULTS: DEFAULTS,
    allowed: allowed, defaults: defaults, clean: clean, parseSaved: parseSaved, serialize: serialize,
    gallery: gallery, fromShared: fromShared, ALL: ALL, move: move, nextSize: nextSize, height: height, encode: encode, decode: decode
  };
});
