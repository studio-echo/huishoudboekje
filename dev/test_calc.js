/* Tests: node dev/test_calc.js
   Deel 1 (correctheidspoort) heeft data/fixture.json nodig (lokaal, nooit in git).
   Deel 2 gebruikt kleine verzonnen voorbeelden en draait altijd. */
const fs = require('fs'), path = require('path');
const C = require('../calc.js'), L = require('../layout.js');
let fail = 0, n = 0;
function ok(name, cond, info) { n++; if (!cond) fail++; console.log((cond ? 'OK  ' : 'FAIL') + ' ' + name + (info !== undefined ? ' (' + info + ')' : '')); }
function eq(name, a, b, tol = 1e-6) { ok(name, Math.abs(a - b) < tol, 'got ' + a + ' want ' + b); }
const r1 = x => Math.round(x * 1000) / 10;

/* ---------- 1. correctheidspoort op de echte data ---------- */
const fx = path.join(__dirname, '..', 'data', 'fixture_v14.json');
if (!fs.existsSync(fx)) console.log('SKIP correctheidspoort: data/fixture_v14.json ontbreekt');
else {
  const d = JSON.parse(fs.readFileSync(fx, 'utf8'));
  if (d.error) { console.log('FAIL fixture bevat een fout: ' + d.error); process.exit(1); }
  const ctx = C.makeCtx(d), rows = C.rowsFor(ctx, 'MATS');
  const s = C.metrics(C.inPeriod(rows, '2026-09', '2026-09'));
  /* Persoonlijk = enkel eigen rekeningen; onafhankelijk nagerekend op de ruwe rijen */
  const own = {}; d.rekeningen.forEach(a => { own[a.Rekening_ID] = a.Eigenaar; });
  const typ = {}; d.categorieen.forEach(c => { typ[c.Categorie] = String(c.Type).toLowerCase(); });
  let exp = 0; d.transacties.forEach(r => { if (own[r.Rekening_ID] !== 'Mats' || String(r.Datum).slice(0, 7) !== '2026-09') return;
    if (typ[r.Categorie] === 'uitgave' || (r.Categorie === 'Overdracht gezamenlijke rekening' && r.Bedrag < 0)) exp += r.Bedrag; });
  eq('sep uitgaven = eigen rekeningen + bijdrage gezamenlijk', s.uitgaven, exp);
  ok('geen gezamenlijke rekening in persoonlijke rijen', rows.every(x => own[x.r.Rekening_ID] === 'Mats'));
  const dq = C.dataQuality(ctx);
  ok('laatste volledige maand is de laatste maand met gegevens', dq.lastComplete === '2026-10', dq.lastComplete);
  ok('kredietkaart en Revolut nooit "verouderd"', dq.stale.every(x => !/krediet|revolut/i.test(x)), dq.stale.join(','));
  const rec = C.recurring(C.inPeriod(rows, '2026-03', '2026-09'), 3, '2026-09').concat(C.recurring(C.inPeriod(C.rowsFor(ctx, 'SAMEN'), '2026-03', '2026-09'), 3, '2026-09')), key = k => rec.filter(r => r.key === k)[0];
  ok('woonkrediet herkend als lening', key('woonkrediet') && key('woonkrediet').lening);
  ok('lening vader los van de fiets', key('lening vader') && key('lening fiets') && Math.round(key('lening vader').perMaand) === 200 && key('lening fiets').perMaand === 150);
  ok('fietslening is afgelopen in september', key('lening fiets') && key('lening fiets').laatste === '2026-08');
  const f = C.fairness(ctx, '2026-03', '2026-09');
  ok('alle stortingen op de gezamenlijke rekening toegewezen', f.stortingen['?'] === 0, f.stortingen['?']);
  ok('aandelen samen niet meer dan de kosten', f.aandeel.MATS + f.aandeel.SOFIE <= f.kosten + 0.01);
  const notes = C.notes(ctx, dq, 'MATS', '2026-03', '2026-09');
  ok('aandelenverkoop staat als voetnoot', notes.some(x => x.id === 'aandelen' && x.level === 'foot'));
}

/* ---------- 2. verzonnen voorbeelden ---------- */
const T = (Datum, Rekening_ID, Categorie, Bedrag, m, s, extra) => Object.assign({ Datum, Rekening_ID, Categorie, Bedrag, Aandeel_Mats: m, Aandeel_Sofie: s, Eenmalig: 0, Tegenpartij: '', Omschrijving: '', Nota: '', Transactie_ID: 'T' }, extra || {});
const cats = [['Loon', 'inkomen'], ['Woonkost', 'uitgave'], ['Abonnementen', 'uitgave'], ['Boodschappen', 'uitgave'], ['Mobiliteit & parking', 'uitgave'], ['Sparen & investeren', 'sparen'], ['Interne overdracht', 'neutraal'], ['Overdracht gezamenlijke rekening', 'neutraal']].map(c => ({ Categorie: c[0], Type: c[1] }));
const rek = [
  { Rekening_ID: 'M', Naam: 'Zicht M', Eigenaar: 'Mats', Type: 'Zichtrekening', Actief: 'JA' },
  { Rekening_ID: 'S', Naam: 'Zicht S', Eigenaar: 'Sofie', Type: 'Zichtrekening', Actief: 'JA' },
  { Rekening_ID: 'G', Naam: 'Gezamenlijk', Eigenaar: 'Gezamenlijk', Type: 'Zichtrekening', Actief: 'JA' },
  { Rekening_ID: 'K', Naam: 'Kredietkaart', Eigenaar: 'Mats', Type: 'Kredietkaart', Actief: 'JA' },
  { Rekening_ID: 'R', Naam: 'Revolut', Eigenaar: 'Mats', Type: 'Revolut', Actief: 'JA' },
  { Rekening_ID: 'X', Naam: 'Oude zicht', Eigenaar: 'Mats', Type: 'Zichtrekening', Actief: 'JA', Gebruik: 'af en toe' }
];
const tx = [];
['2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].forEach((m, i) => {
  tx.push(T(m + '-25', 'M', 'Loon', 3000, 1, 0), T(m + '-25', 'S', 'Loon', 2500, 0, 1));
  tx.push(T(m + '-02', 'G', 'Woonkost', -1000, .5, .5, { Tegenpartij: i < 3 ? 'Fintro woonkrediet' : 'Intrest krediet Fintro' }));
  tx.push(T(m + '-05', 'M', 'Abonnementen', -10, 1, 0, { Tegenpartij: i % 2 ? 'APPLE.COM/BILL ITUNES' : 'Apple.com bill' }));
  tx.push(T(m + '-06', 'M', 'Mobiliteit & parking', -150, 1, 0, { Tegenpartij: 'Rekening vader (BE00 0000...)', Omschrijving: 'Afbetaling fiets' }));
  tx.push(T(m + '-06', 'M', 'Woonkost', -100, 1, 0, { Tegenpartij: 'Rekening vader', Omschrijving: 'Lening' }));
  tx.push(T(m + '-10', 'G', 'Boodschappen', -300, .5, .5, { Tegenpartij: 'Supermarkt' }));
  tx.push(T(m + '-28', 'M', 'Sparen & investeren', -300, 1, 0));
  // stortingen: M via eigen overschrijving (naam onleesbaar), S op naam
  tx.push(T(m + '-01', 'M', 'Overdracht gezamenlijke rekening', -800, 1, 0), T(m + '-02', 'G', 'Overdracht gezamenlijke rekening', 800, 0, 0, { Tegenpartij: 'XYZ' }));
  tx.push(T(m + '-03', 'G', 'Overdracht gezamenlijke rekening', 500, 0, 0, { Tegenpartij: 'Partner' }));
  tx.push(T(m + '-29', 'S', 'Boodschappen', -20, 0, 1), T(m + '-30', 'G', 'Boodschappen', -5, .5, .5));
});
tx.push(T('2026-07-10', 'K', 'Boodschappen', -50, .5, .5), T('2026-08-03', 'R', 'Boodschappen', -40, 1, 0), T('2026-06-01', 'X', 'Boodschappen', -1, 1, 0));
tx.push(T('2026-09-15', 'M', 'Woonkost', -2000, 1, 0, { Eenmalig: 1, Tegenpartij: 'Aannemer' }));
tx.push(T('2026-10-03', 'M', 'Boodschappen', -12, 1, 0));
// fietslening stopt in augustus
for (let i = tx.length - 1; i >= 0; i--) if (/fiets/i.test(tx[i].Omschrijving) && tx[i].Datum >= '2026-09') tx.splice(i, 1);
const data = { vandaag: '2026-10-20', transacties: tx, rekeningen: rek, categorieen: cats, saldi: [{ Rekening_ID: 'M', Datum: '2026-09-28', Saldo: 3000 }, { Rekening_ID: 'G', Datum: '2026-09-30', Saldo: 1000 }, { Rekening_ID: 'M', Datum: '2026-08-28', Saldo: 9 }] };
const ctx = C.makeCtx(data), dq = C.dataQuality(ctx);

ok('aliassen: Apple-varianten zijn dezelfde partij', C.counterparty({ Tegenpartij: 'APPLE.COM/BILL ITUNES' }) === C.counterparty({ Tegenpartij: 'Apple.com bill' }));
ok('aliassen: woonkrediet onder twee namen', C.counterparty({ Tegenpartij: 'Fintro woonkrediet' }) === 'woonkrediet' && C.counterparty({ Tegenpartij: 'Intrest krediet Fintro' }) === 'woonkrediet');
ok('aliassen: fiets en lening vader gescheiden', C.counterparty({ Tegenpartij: 'Rekening vader', Omschrijving: 'Afbetaling fiets' }) === 'lening fiets' && C.counterparty({ Tegenpartij: 'Rekening vader', Omschrijving: 'Lening' }) === 'lening vader');
ok('aliassen: Crelan "Fiets" is de fietslening', C.counterparty({ Tegenpartij: 'Mats (Crelan)', Omschrijving: 'Fiets' }) === 'lening fiets');
ok('aliassen: fietsverzekering is geen fietslening', C.counterparty({ Tegenpartij: 'Laka', Omschrijving: 'fietsverzekering' }) === 'laka');
ok('aliassen: hoofdletters, accenten en plaatsnamen', C.counterparty({ Tegenpartij: 'FRANK ENERGIE BELGIË BV' }) === C.counterparty({ Tegenpartij: 'Frank Energie' }));
ok('naam zonder rekeningnummer', C.cleanName('Rekening vader (BE00 1234...)') === 'Rekening vader' && !/\d{3}/.test(C.cleanName('Provisie krediet 001-2345678-90')));

ok('laatste volledige maand', dq.lastComplete === '2026-10', dq.lastComplete);
ok('geen lopende maand', dq.partialMonths.length === 0);
ok('kredietkaart/Revolut/af en toe nooit verouderd', dq.stale.length === 0, dq.stale.join());
ok('Gebruik kolom: maandelijks wint van type', C.usage({ Type: 'Kredietkaart', Gebruik: 'Maandelijks' }) === 'maandelijks' && C.usage({ Type: 'Kredietkaart' }) === 'af en toe' && C.usage({ Type: 'Zichtrekening', Gebruik: 'Af en toe' }) === 'af en toe');
const dq2 = C.dataQuality(C.makeCtx(Object.assign({}, data, { rekeningen: rek.map(a => a.Rekening_ID === 'K' ? Object.assign({}, a, { Gebruik: 'maandelijks' }) : a) })));
ok('kredietkaart met Gebruik=maandelijks wordt wel gemeld', dq2.stale.length === 1 && /krediet/i.test(dq2.stale[0]), dq2.stale.join());

const rm = C.rowsFor(ctx, 'MATS'), sep = C.metrics(C.inPeriod(rm, '2026-09', '2026-09'));
eq('metrics inkomen', sep.inkomen, 3000); eq('metrics uitgaven: eigen rekening + bijdrage gezamenlijk', sep.uitgaven, -(10 + 100 + 800 + 2000));
eq('metrics gespaard', sep.gespaard, 300); eq('structureel zonder eenmalig', sep.structureel, sep.resultaat + 2000);
eq('inkomen structureel', sep.inkomenStructureel, 3000);
const rec = C.recurring(C.inPeriod(rm, '2026-05', '2026-09'), 3, '2026-09').concat(C.recurring(C.inPeriod(C.rowsFor(ctx, 'SAMEN'), '2026-05', '2026-09'), 3, '2026-09')), k = x => rec.filter(r => r.key === x)[0];
ok('woonkrediet terugkerend bij Samen, lening', k('woonkrediet') && k('woonkrediet').lening && k('woonkrediet').perMaand === 1000);
ok('apple abonnement over twee namen', k('apple') && k('apple').abonnement && k('apple').maanden === 5);
ok('boodschappen nooit vaste last', !rec.some(r => r.cat === 'Boodschappen'));
ok('fiets afgelopen maar nog in lijst (actief tot vorige maand)', k('lening fiets') && k('lening fiets').laatste === '2026-08' && k('lening fiets').actief);
ok('eenmalige uitgave niet terugkerend', !k('aannemer'));

const flow = C.incomeFlow(C.inPeriod(rm, '2026-09', '2026-09'), { woonkrediet: 1, apple: 1, 'lening vader': 1 });
eq('inkomensstroom sluit', flow.vast + flow.variabel + flow.eenmalig + flow.gespaard + flow.over, flow.inkomen);
eq('inkomensstroom eenmalig', flow.eenmalig, 2000);

const fr = C.fairness(ctx, '2026-05', '2026-09');
eq('eerlijkheid: storting Mats via eigen overschrijving', fr.stortingen.MATS, 4000);
eq('eerlijkheid: storting Sofie op naam', fr.stortingen.SOFIE, 2500);
ok('eerlijkheid: niets onbekend', fr.stortingen['?'] === 0);
eq('eerlijkheid: aandeel volgens Bedrag x Aandeel', fr.aandeel.MATS, 5 * (500 + 150 + 2.5));
eq('eerlijkheid: saldo Mats', fr.saldo.MATS, 4000 - 5 * 652.5);
ok('eerlijkheid: kredietkaart telt niet mee', fr.kosten === 5 * 1305);

const b = C.buffer(ctx, 'MATS', '2026-09', 3);
eq('buffer: enkel eigen rekening', b.saldo, 3000);
ok('buffer: snapshotdatum', b.datum === '2026-09-28');
eq('buffer: maanden = saldo / gemiddelde uitgaven zonder eenmalig', b.maanden, 3000 / b.perMaand);
ok('buffer: Sofie zonder eigen saldo heeft geen buffer', C.buffer(ctx, 'SOFIE', '2026-09') === null);
ok('loon na de 15de telt voor de volgende maand', C.rowsFor(ctx, 'MATS').filter(x => x.t === 'inkomen' && x.r.Datum === '2026-05-25')[0].m === '2026-06');

const wd = C.byWeekday(C.inPeriod(rm, '2026-09', '2026-09'));
ok('weekdag: 7 dagen, maandag eerst', wd.length === 7 && wd[0].dag === 0);
eq('weekdag: som = uitgaven zonder eenmalig', wd.reduce((a, x) => a + x.bedrag, 0), -C.metrics(C.inPeriod(rm, '2026-09', '2026-09'), true).uitgaven);

const hs = C.householdSplit(ctx, '2026-09', '2026-09');
eq('gedeeld vs persoonlijk: gedeeld', hs.gedeeld, 1305); eq('gedeeld vs persoonlijk: Sofie persoonlijk', hs.sofie, 20);

ok('Sofie zonder eigen rekeningen herkend', !C.hasOwnAccounts(C.makeCtx(Object.assign({}, data, { rekeningen: rek.filter(a => a.Eigenaar !== 'Sofie') })), 'SOFIE'));
const unk = C.dataQuality(C.makeCtx(Object.assign({}, data, { transacties: tx.concat([T('2026-09-01', 'M', 'Nieuwe categorie', -5, 1, 0)]) })));
ok('onbekende categorie gemeld', unk.unknownCategories['Nieuwe categorie'] === 1);

/* ---------- 3. indeling ---------- */
const V3 = (v, p) => L.defaults(v, p);
['MATS', 'SOFIE', 'SAMEN'].forEach(v => L.pages(v).forEach(p => {
  const d = V3(v, p.id), cells = d.reduce((a, x) => a + ({ S: 1, M: 2, L: 4 })[x.size] * L.height(x.id, x.size), 0);
  ok('standaard ' + v + ' ' + p.id + ' vult 4x4', cells === 16 && L.clean(d, v).length === d.length, cells);
}));
ok('MATS en SOFIE zelfde pagina\'s, auto enkel bij Sofie', JSON.stringify(L.pages('MATS').map(p => p.id)) === JSON.stringify(L.pages('SOFIE').map(p => p.id)) && !L.defaults('MATS', 'vast').some(x => x.id === 'auto') && L.defaults('SOFIE', 'vast').some(x => x.id === 'auto'));
ok('pagina Samen enkel bij SAMEN, FIRE overal', L.pages('MATS').length === 8 && L.pages('SAMEN').length === 9 && L.pages('SAMEN').some(p => p.id === 'fire'));
ok('gedeelde indeling opgeschoond, geen dubbels over pagina\'s', JSON.stringify(L.fromShared({ v: 10, 'MATS:overzicht': [{ id: 'inkomenflow', size: 'L' }, { id: 'eerlijkheid', size: 'M' }], 'MATS:vast': [{ id: 'inkomenflow', size: 'S' }, { id: 'buffer', size: 'S' }] })) === '{"MATS:overzicht":[{"id":"inkomenflow","size":"L"}],"MATS:vast":[{"id":"buffer","size":"S"}]}');
ok('oude gedeelde indeling genegeerd', JSON.stringify(L.fromShared({ MATS: [{ id: 'auto', size: 'L' }] })) === '{}');
ok('eerlijkheid enkel bij SAMEN', !L.allowed('eerlijkheid', 'MATS') && L.allowed('eerlijkheid', 'SAMEN'));
ok('ongeveer 20 widgets', L.CATALOG.length >= 19, L.CATALOG.length);
const saved = L.parseSaved(JSON.stringify({ v: 10, items: [{ id: 'inkomen', size: 'L' }, { id: 'bestaatniet', size: 'S' }, { id: 'inkomen', size: 'S' }, { id: 'buffer', size: 'XL' }] }), 'MATS');
ok('opgeslagen indeling opgeschoond', JSON.stringify(saved) === '[{"id":"inkomen","size":"L"},{"id":"buffer","size":"M"}]', JSON.stringify(saved));
ok('kapotte of oude opslag geeft null', L.parseSaved('{kapot', 'MATS') === null && L.parseSaved(null, 'MATS') === null && L.parseSaved('{"v":2,"items":[]}', 'MATS') === null);
ok('galerij toont wat op geen pagina staat', L.gallery(saved, 'MATS').every(w => w.id !== 'inkomen' && w.id !== 'buffer') && L.gallery(saved, 'MATS').some(w => w.id === 'inkomenflow') && !L.gallery(saved, 'MATS').some(w => w.id === 'eerlijkheid'));
ok('verplaatsen', L.move([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 0, 2).map(x => x.id).join('') === 'bca');
ok('volgende grootte', L.nextSize('S') === 'M' && L.nextSize('L') === 'S');
const sh = L.toShared(k => L.defaults(...k.split(':')));
ok('toShared heen en terug', JSON.stringify(L.fromShared(sh)['SAMEN:samen']) === JSON.stringify(L.defaults('SAMEN', 'samen')) && sh.v === 10);

/* ---------- nieuwe berekeningen, verzonnen voorbeeld ---------- */
{
  const tx = (Datum, Categorie, Bedrag, Tegenpartij, s = 1) => ({ Datum, Rekening_ID: 'X', Categorie, Bedrag, Aandeel_Mats: 0, Aandeel_Sofie: s, Eenmalig: 0, Tegenpartij, Omschrijving: '' });
  const d = { categorieen: [{ Categorie: 'Loon', Type: 'inkomen' }, { Categorie: 'Woonkost', Type: 'uitgave' }, { Categorie: 'Boodschappen', Type: 'uitgave' }, { Categorie: 'Reizen', Type: 'uitgave', Soort: 'nodig' }, { Categorie: 'Mobiliteit & parking', Type: 'uitgave' }, { Categorie: 'Sparen & investeren', Type: 'sparen' }],
    rekeningen: [{ Rekening_ID: 'X', Eigenaar: 'Sofie', Type: 'Zichtrekening' }], transacties: [], saldi: [],
    pockets: [{ Naam: 'Eten', Categorieen: 'Boodschappen', Bedrag: 100, Wie: 'Sofie' }, { Naam: 'Weg', Categorieen: 'Reizen', Bedrag: '87,5', Wie: 'Sofie' }, { Naam: 'Mats', Categorieen: 'Reizen', Bedrag: 5, Wie: 'Mats' }],
    beleggingen: [{ Datum: '2026-01-31', Rekening_ID: 'SOFIE-EFFECTEN', Naam: 'A', ISIN: 'X1', Hoeveelheid: 1, Belegde_Waarde: 100, Huidige_Waarde: 101 },
      { Datum: '2026-02-28', Rekening_ID: 'SOFIE-EFFECTEN', Naam: 'A', ISIN: 'X1', Hoeveelheid: 2, Belegde_Waarde: 200, Huidige_Waarde: 230 }] };
  ['2026-01', '2026-02', '2026-03', '2026-04'].forEach((m, i) => {
    d.transacties.push(tx(m + '-25', 'Loon', 1000, 'Werkgever'), tx(m + '-03', 'Woonkost', -500, 'Huisbaas'), tx(m + '-10', 'Boodschappen', -80 - i * 20, 'Winkel'));
  });
  d.transacties.push(tx('2026-01-15', 'Woonkost', -60, 'Water'), tx('2026-04-15', 'Woonkost', -60, 'Water'), tx('2025-10-15', 'Woonkost', -60, 'Water'), tx('2026-02-01', 'Woonkost', -300, 'Brandverzekering'),
    tx('2026-03-02', 'Mobiliteit & parking', -50, 'TOTAL 123 Gent'), tx('2026-03-09', 'Mobiliteit & parking', -6, 'Q-Park Centrum'), tx('2026-03-12', 'Reizen', -200, 'Hotel'));
  const cx = C.makeCtx(d), rows = C.rowsFor(cx, 'SOFIE'), rec = {};
  C.recurring(rows, 3, '2026-04').forEach(r => { rec[r.key] = 1; });
  const fq = C.frequency(rows, rec);
  ok('ritme: huur elke maand', fq.keys[C.counterparty(d.transacties[1])] === 'maandelijks' && Math.round(fq.maandelijks) === 2000, fq.maandelijks);
  ok('ritme: water per kwartaal', Math.round(fq.kwartaal) === 180, fq.kwartaal);
  ok('ritme: verzekering per jaar', Math.round(fq.jaarlijks) === 300, fq.jaarlijks);
  ok('ritme: boodschappen los', fq.keys['winkel'] === 'los');
  const ff = C.fixedFree(rows, fq.keys, ['2026-03']);
  ok('vast en vrij in maart', Math.round(ff[0].vast) === 500 && Math.round(ff[0].vrij) === 120 + 56 + 200, JSON.stringify(ff));
  const r5 = C.rule503020(cx, C.inPeriod(rows, '2026-03', '2026-03'));
  ok('50/30/20: Soort-kolom wint (reizen = nodig)', Math.round(r5.nodig) === 876 && Math.round(r5.wens) === 0 && Math.round(r5.sparen) === 124, JSON.stringify(r5));
  const car = C.carCosts(rows);
  ok('auto: tanken en parking herkend', Math.round(car.perSoort['Brandstof en laden']) === 50 && Math.round(car.perSoort['Parkeren en tol']) === 6 && Math.round(car.totaal) === 56, JSON.stringify(car.perSoort));
  const pj = C.pockets(cx, 'SOFIE', C.inPeriod(rows, '2026-03', '2026-03'), 1);
  ok('pockets: enkel die van Sofie', pj.length === 2, JSON.stringify(pj));
  ok('pockets: bedrag (ook met komma) en uitgegeven', pj[0].budget === 100 && Math.round(pj[0].uitgegeven) === 120 && pj[1].budget === 87.5 && Math.round(pj[1].uitgegeven) === 200);
  const iv = C.investments(cx, 'SOFIE');
  ok('ETF: laatste momentopname, rendement, verloop', iv.ingelegd === 200 && iv.waarde === 230 && Math.abs(iv.rendement - 0.15) < 1e-9 && iv.list[0].aantal === 2 && iv.hist.length === 2 && iv.hist[0].v === 101, JSON.stringify(iv));
  const fr = C.fire(10000, 500, 0.05, 100000, 60);
  ok('FIRE: jaren tot doel', fr.jaren === 11 && fr.reeks[1].v === 10000 * 1.05 + 6000, fr.jaren);
  ok('ETF: niets voor Mats', C.investments(cx, 'MATS') === null);
}

/* v6: bijdragen, spreiden, reizen, CHECK, vermogen */
{
  const d = {
    rekeningen: [{ Rekening_ID: 'G', Eigenaar: 'Gezamenlijk', Type: 'Zichtrekening' }, { Rekening_ID: 'K', Eigenaar: 'Gezamenlijk', Type: 'Kredietkaart' }, { Rekening_ID: 'M', Eigenaar: 'Mats', Type: 'Zichtrekening' }],
    categorieen: [{ Categorie: 'Overdracht gezamenlijke rekening', Type: 'neutraal' }, { Categorie: 'Interne overdracht', Type: 'neutraal' }, { Categorie: 'Woonkost', Type: 'uitgave' }, { Categorie: 'Reizen', Type: 'uitgave' }, { Categorie: 'Loon', Type: 'inkomen' }],
    transacties: [
      T('2026-01-02', 'G', 'Overdracht gezamenlijke rekening', 1000, 1, 0), T('2026-01-03', 'G', 'Overdracht gezamenlijke rekening', 800, 0, 1),
      T('2026-01-04', 'G', 'Overdracht gezamenlijke rekening', 50, 0, 0), T('2026-01-10', 'G', 'Woonkost', -1200, 0.5, 0.5),
      T('2026-01-11', 'K', 'Woonkost', -200, 0.5, 0.5), T('2026-01-20', 'G', 'Interne overdracht', -200, 0.5, 0.5),
      T('2026-01-05', 'M', 'Reizen', -1200, 1, 0, { Nota: 'Reis: Barcelona maart 2026' }), T('2026-01-06', 'M', 'Woonkost', -60, 1, 0, { Nota: 'CHECK: wat is dit?' }),
      T('2026-01-07', 'M', 'Woonkost', -300, 1, 0, { Nota: 'Kwartaalvoorschot VME' })
    ],
    saldi: [{ Rekening_ID: 'M', Datum: '2026-01-31', Saldo: 1000 }, { Rekening_ID: 'M', Datum: '2026-02-28', Saldo: '1.250,50' }, { Rekening_ID: 'G', Datum: '2026-02-28', Saldo: 400 }]
  };
  const cx = C.makeCtx(d), j = C.jointContrib(cx, '2026-01', '2026-01');
  ok('bijdrage: stortingen per persoon, 0/0 apart', j.dep.MATS === 1000 && j.dep.SOFIE === 800 && j.los === 1 && j.losBedrag === 50, JSON.stringify(j.dep));
  ok('bijdrage: aandeel incl. kaart, zonder interne overdracht', j.share.MATS === 700 && j.share.SOFIE === 700 && j.kosten === 1400);
  ok('bijdrage: dekking', Math.abs(j.dekking.MATS - 1000 / 700) < 1e-9);
  ok('samen: interne overdracht telt niet, kaart wel', C.metrics(C.rowsFor(cx, 'SAMEN')).uitgaven === -1400);
  const sp = C.rowsFor(cx, 'MATS', null, { spread: true }).filter(x => x.r.Categorie === 'Reizen');
  ok('reizen gespreid over 12 maanden enkel met spread', sp.length === 12 && sp[0].a === -100 && C.rowsFor(cx, 'MATS').filter(x => x.r.Categorie === 'Reizen').length === 1);
  ok('VME-voorschot over 3 maanden', C.spreadMonths(d.transacties[8]) === 3);
  ok('reis uit Nota', JSON.stringify(C.trips(C.rowsFor(cx, 'MATS'))) === '[{"naam":"Barcelona maart 2026","bedrag":1200,"aantal":1}]');
  ok('CHECK geteld', C.checkRows(C.rowsFor(cx, 'MATS')).length === 1);
  const w = C.wealth(cx, 'MATS');
  ok('vermogen: enkel eigen rekening, verschil met vorige maand', w.totaal === 1250.5 && w.verschil === 250.5, JSON.stringify(w));
}

console.log('\n' + (n - fail) + '/' + n + ' geslaagd');
process.exit(fail ? 1 : 0);
