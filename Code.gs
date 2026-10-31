/**
 * Huishoudboekje: Apps Script web-app. Geeft de bladen terug als JSON, enkel met het juiste wachtwoord.
 * Instelling (eenmalig): Projectinstellingen > Script-eigenschappen > PASSWORD = jouw lange wachtwoordzin.
 * Implementeren: Web-app, uitvoeren als "Ik", toegang "Iedereen".
 */
var SHEET_ID = ''; // leeg laten als dit script in het blad zelf is aangemaakt (Extensies > Apps Script)
var TABS = { transacties: 'Transacties', rekeningen: 'Rekeningen', categorieen: 'Categorieen', saldi: 'Saldi' };
/* Optionele tabbladen: ontbreken mag. Indeling bewaart de tegels van het dashboard (wordt door de site zelf geschreven). */
var OPTIONAL = { potjes: 'Potjes', beleggingen: 'Beleggingen' };
var LAYOUT_TAB = 'Indeling';
var MAX_FAILS = 8, LOCK_SECONDS = 900;

function doGet(e) { return handle_(e, null); }
/* POST met een tekst-body {"indeling": {...}} bewaart de indeling. Zelfde wachtwoordcontrole. */
function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { return out_({ error: 'bad request' }); }
  return handle_(e, body);
}
function handle_(e, body) {
  var cache = CacheService.getScriptCache();
  var fails = parseInt(cache.get('fails') || '0', 10);
  if (fails >= MAX_FAILS) return out_({ error: 'locked' });
  var pw = PropertiesService.getScriptProperties().getProperty('PASSWORD');
  var given = (body && body.p) || (e && e.parameter && e.parameter.p) || '';
  if (!pw || !safeEq_(given, pw)) {
    cache.put('fails', String(fails + 1), LOCK_SECONDS);
    Utilities.sleep(1000);
    return out_({ error: 'unauthorized' });
  }
  cache.remove('fails');
  try {
    var ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
    var res = {};
    if (body) {
      var txt = JSON.stringify(body.indeling || null);
      if (txt.length > 20000) return out_({ error: 'indeling te groot' });
      var lt = ss.getSheetByName(LAYOUT_TAB) || ss.insertSheet(LAYOUT_TAB);
      lt.getRange('A1').setValue('Niet aanpassen: indeling van het dashboard');
      lt.getRange('A2').setValue(txt);
      return out_({ ok: true });
    }
    Object.keys(TABS).forEach(function (k) { res[k] = rows_(ss.getSheetByName(TABS[k]), TABS[k]); });
    Object.keys(OPTIONAL).forEach(function (k) { var sh = ss.getSheetByName(OPTIONAL[k]); res[k] = sh ? rows_(sh, OPTIONAL[k]) : []; });
    var ls = ss.getSheetByName(LAYOUT_TAB);
    if (ls) { try { res.indeling = JSON.parse(String(ls.getRange('A2').getValue() || 'null')); } catch (x) { res.indeling = null; } }
    res.bijgewerkt = new Date().toISOString();
    return out_(res);
  } catch (err) {
    return out_({ error: String(err.message || err) });
  }
}
function rows_(sh, name) {
  if (!sh) throw new Error('Tabblad "' + name + '" bestaat niet.');
  var v = sh.getDataRange().getValues();
  if (v.length < 1) return [];
  var head = v[0].map(String), tz = sh.getParent().getSpreadsheetTimeZone(), o = [];
  for (var i = 1; i < v.length; i++) {
    if (v[i].every(function (c) { return c === '' || c === null; })) continue;
    var r = {};
    for (var j = 0; j < head.length; j++) {
      var c = v[i][j];
      if (c instanceof Date) c = Utilities.formatDate(c, tz, 'yyyy-MM-dd');
      r[head[j]] = c;
    }
    o.push(r);
  }
  return o;
}
function safeEq_(a, b) {
  if (a.length !== b.length) return false;
  var d = 0; for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
