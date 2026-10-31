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
const fx = path.join(__dirname, '..', 'data', 'fixture.json');
if (!fs.existsSync(fx)) console.log('SKIP correctheidspoort: data/fixture.json ontbreekt');
else {
  const d = JSON.parse(fs.readFileSync(fx, 'utf8'));
  if (d.error) { console.log('FAIL fixture bevat een fout: ' + d.error); process.exit(1); }
  const ctx = C.makeCtx(d), rows = C.rowsFor(ctx, 'MATS');
  const s = C.metrics(C.inPeriod(rows, '2026-09', '2026-09'));
  eq('sep inkomen', s.inkomen, 3540.37); eq('sep uitgaven', s.uitgaven, -2820.725); eq('sep resultaat', s.resultaat, 319.645);
  eq('sep gespaard', s.gespaard, 400); eq('sep spaarratio', r1(s.spaarratio), 11.3);
  /* De YTD-referentie werd berekend op de migratie uit v14 (Transactie_ID MIG-...). Sindsdien voegde de agent
     januari en februari aan. Op diezelfde rijen moet de berekening exact blijven kloppen. */
  const mig = C.rowsFor(ctx, 'MATS', r => String(r.Transactie_ID).indexOf('MIG-') === 0);
  const y = C.metrics(C.inPeriod(mig, '2026-01', '2026-12'));
  eq('ytd inkomen (v14-rijen)', y.inkomen, 23310.12); eq('ytd uitgaven', y.uitgaven, -22675.73); eq('ytd resultaat', y.resultaat, -561.61);
  eq('ytd structureel', y.structureel, 1046.775); eq('ytd gespaard', y.gespaard, 1196);
  eq('ytd spaarratio', r1(y.spaarratio), 5.1); eq('ytd overschotratio', r1(y.overschot), 2.7);
  const dq = C.dataQuality(ctx);
  ok('laatste volledige maand is september', dq.lastComplete === '2026-09', dq.lastComplete);
  ok('kredietkaart en Revolut nooit "verouderd"', dq.stale.every(x => !/krediet|revolut/i.test(x)), dq.stale.join(','));
  const rec = C.recurring(C.inPeriod(rows, '2026-03', '2026-09'), 3, '2026-09'), key = k => rec.filter(r => r.key === k)[0];
  ok('woonkrediet herkend als lening', key('woonkrediet') && key('woonkrediet').lening);
  ok('lening vader los van de fiets', key('lening vader') && key('lening fiets') && Math.round(key('lening vader').perMaand) === 100 && key('lening fiets').perMaand === 150);
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
const data = { transacties: tx, rekeningen: rek, categorieen: cats, saldi: [{ Rekening_ID: 'M', Datum: '2026-09-28', Saldo: 3000 }, { Rekening_ID: 'G', Datum: '2026-09-30', Saldo: 1000 }, { Rekening_ID: 'M', Datum: '2026-08-28', Saldo: 9 }] };
const ctx = C.makeCtx(data), dq = C.dataQuality(ctx);

ok('aliassen: Apple-varianten zijn dezelfde partij', C.counterparty({ Tegenpartij: 'APPLE.COM/BILL ITUNES' }) === C.counterparty({ Tegenpartij: 'Apple.com bill' }));
ok('aliassen: woonkrediet onder twee namen', C.counterparty({ Tegenpartij: 'Fintro woonkrediet' }) === 'woonkrediet' && C.counterparty({ Tegenpartij: 'Intrest krediet Fintro' }) === 'woonkrediet');
ok('aliassen: fiets en lening vader gescheiden', C.counterparty({ Tegenpartij: 'Rekening vader', Omschrijving: 'Afbetaling fiets' }) === 'lening fiets' && C.counterparty({ Tegenpartij: 'Rekening vader', Omschrijving: 'Lening' }) === 'lening vader');
ok('aliassen: Crelan "Fiets" is de fietslening', C.counterparty({ Tegenpartij: 'Mats (Crelan)', Omschrijving: 'Fiets' }) === 'lening fiets');
ok('aliassen: fietsverzekering is geen fietslening', C.counterparty({ Tegenpartij: 'Laka', Omschrijving: 'fietsverzekering' }) === 'laka');
ok('aliassen: hoofdletters, accenten en plaatsnamen', C.counterparty({ Tegenpartij: 'FRANK ENERGIE BELGIË BV' }) === C.counterparty({ Tegenpartij: 'Frank Energie' }));
ok('naam zonder rekeningnummer', C.cleanName('Rekening vader (BE00 1234...)') === 'Rekening vader' && !/\d{3}/.test(C.cleanName('Provisie krediet 001-2345678-90')));

ok('laatste volledige maand', dq.lastComplete === '2026-09', dq.lastComplete);
ok('lopende maand is oktober', dq.partialMonths.join() === '2026-10');
ok('kredietkaart/Revolut/af en toe nooit verouderd', dq.stale.length === 0, dq.stale.join());
ok('Gebruik kolom: maandelijks wint van type', C.usage({ Type: 'Kredietkaart', Gebruik: 'Maandelijks' }) === 'maandelijks' && C.usage({ Type: 'Kredietkaart' }) === 'af en toe' && C.usage({ Type: 'Zichtrekening', Gebruik: 'Af en toe' }) === 'af en toe');
const dq2 = C.dataQuality(C.makeCtx(Object.assign({}, data, { rekeningen: rek.map(a => a.Rekening_ID === 'K' ? Object.assign({}, a, { Gebruik: 'maandelijks' }) : a) })));
ok('kredietkaart met Gebruik=maandelijks wordt wel gemeld', dq2.stale.length === 1 && /krediet/i.test(dq2.stale[0]), dq2.stale.join());

const rm = C.rowsFor(ctx, 'MATS'), sep = C.metrics(C.inPeriod(rm, '2026-09', '2026-09'));
eq('metrics inkomen', sep.inkomen, 3000); eq('metrics uitgaven', sep.uitgaven, -(500 + 10 + 100 + 150 + 2.5 + 2000));
eq('metrics gespaard', sep.gespaard, 300); eq('structureel zonder eenmalig', sep.structureel, sep.resultaat + 2000);
eq('inkomen structureel', sep.inkomenStructureel, 3000);
const rec = C.recurring(C.inPeriod(rm, '2026-05', '2026-09'), 3, '2026-09'), k = x => rec.filter(r => r.key === x)[0];
ok('woonkrediet terugkerend, lening', k('woonkrediet') && k('woonkrediet').lening && k('woonkrediet').perMaand === 500);
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
eq('buffer: laatste saldo + helft gezamenlijk', b.saldo, 3500);
ok('buffer: snapshotdatum is de oudste van de laatste standen', b.datum === '2026-09-28' && b.tot === '2026-09-30');
eq('buffer: maanden = saldo / gemiddelde uitgaven zonder eenmalig', b.maanden, 3500 / b.perMaand);
ok('buffer: Sofie zonder eigen saldo gebruikt enkel de helft van gezamenlijk', C.buffer(ctx, 'SOFIE', '2026-09').saldo === 500);

const wd = C.byWeekday(C.inPeriod(rm, '2026-09', '2026-09'));
ok('weekdag: 7 dagen, maandag eerst', wd.length === 7 && wd[0].dag === 0);
eq('weekdag: som = uitgaven zonder eenmalig', wd.reduce((a, x) => a + x.bedrag, 0), -C.metrics(C.inPeriod(rm, '2026-09', '2026-09'), true).uitgaven);

const hs = C.householdSplit(ctx, '2026-09', '2026-09');
eq('gedeeld vs persoonlijk: gedeeld', hs.gedeeld, 1305); eq('gedeeld vs persoonlijk: Sofie persoonlijk', hs.sofie, 20);

ok('Sofie zonder eigen rekeningen herkend', !C.hasOwnAccounts(C.makeCtx(Object.assign({}, data, { rekeningen: rek.filter(a => a.Eigenaar !== 'Sofie') })), 'SOFIE'));
const unk = C.dataQuality(C.makeCtx(Object.assign({}, data, { transacties: tx.concat([T('2026-09-01', 'M', 'Nieuwe categorie', -5, 1, 0)]) })));
ok('onbekende categorie gemeld', unk.unknownCategories['Nieuwe categorie'] === 1);

/* ---------- 3. indeling ---------- */
['MATS', 'SOFIE', 'SAMEN'].forEach(v => ok('standaard ' + v + ' geldig', L.clean(L.defaults(v), v).length === L.defaults(v).length));
ok('MATS en SOFIE zelfde standaard, met auto', JSON.stringify(L.defaults('MATS')) === JSON.stringify(L.defaults('SOFIE')) && L.defaults('SOFIE').some(x => x.id === 'auto'));
ok('gedeelde indeling opgeschoond', JSON.stringify(L.fromShared({ MATS: [{ id: 'auto', size: 'L' }, { id: 'eerlijkheid', size: 'M' }], X: [] })) === '{"MATS":[{"id":"auto","size":"L"}]}');
ok('eerlijkheid enkel bij SAMEN', !L.allowed('eerlijkheid', 'MATS') && L.allowed('eerlijkheid', 'SAMEN'));
ok('ongeveer 20 widgets', L.CATALOG.length >= 19, L.CATALOG.length);
const saved = L.parseSaved(JSON.stringify({ v: 1, items: [{ id: 'inkomen', size: 'L' }, { id: 'bestaatniet', size: 'S' }, { id: 'inkomen', size: 'S' }, { id: 'buffer', size: 'XL' }] }), 'MATS');
ok('bewaarde indeling opgeschoond', saved.length === 2 && saved[1].size === 'M', JSON.stringify(saved));
ok('kapotte opslag geeft null', L.parseSaved('{kapot', 'MATS') === null && L.parseSaved(null, 'MATS') === null);
ok('galerij toont wat niet op de pagina staat', L.gallery(saved, 'MATS').every(w => w.id !== 'inkomen') && L.gallery(saved, 'MATS').some(w => w.id === 'weekdag') && !L.gallery(saved, 'MATS').some(w => w.id === 'eerlijkheid'));
ok('verplaatsen', L.move([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 0, 2).map(x => x.id).join('') === 'bca');
ok('volgende grootte', L.nextSize('S') === 'M' && L.nextSize('L') === 'S');
const code = L.encode({ MATS: saved, SAMEN: L.defaults('SAMEN') }), back = L.decode(code);
ok('layoutcode heen en terug', JSON.stringify(back.MATS) === JSON.stringify(saved) && back.SAMEN.length === L.defaults('SAMEN').length && !back.SOFIE);
let err = ''; try { L.decode('onzin'); } catch (e) { err = e.message; } ok('foute layoutcode geeft Nederlandse uitleg', /geen geldige layoutcode/.test(err));
err = ''; try { L.decode('HB2.!!!'); } catch (e) { err = e.message; } ok('beschadigde layoutcode', /beschadigd|geen herkende/.test(err), err);

/* ---------- nieuwe berekeningen, verzonnen voorbeeld ---------- */
{
  const tx = (Datum, Categorie, Bedrag, Tegenpartij, s = 1) => ({ Datum, Rekening_ID: 'X', Categorie, Bedrag, Aandeel_Mats: 0, Aandeel_Sofie: s, Eenmalig: 0, Tegenpartij, Omschrijving: '' });
  const d = { categorieen: [{ Categorie: 'Loon', Type: 'inkomen' }, { Categorie: 'Woonkost', Type: 'uitgave' }, { Categorie: 'Boodschappen', Type: 'uitgave' }, { Categorie: 'Reizen', Type: 'uitgave', Soort: 'nodig' }, { Categorie: 'Mobiliteit & parking', Type: 'uitgave' }, { Categorie: 'Sparen & investeren', Type: 'sparen' }],
    rekeningen: [{ Rekening_ID: 'X', Eigenaar: 'Sofie', Type: 'Zichtrekening' }], transacties: [], saldi: [],
    potjes: [{ Naam: 'Eten', Categorieen: 'Boodschappen', Bedrag: 100, Wie: 'Sofie' }, { Naam: 'Weg', Categorieen: 'Reizen', Procent: '10%' }, { Naam: 'Mats', Categorieen: 'Reizen', Bedrag: 5, Wie: 'Mats' }],
    beleggingen: [{ Datum: '2026-01-05', ETF: 'A', Soort: 'aankoop', Bedrag: 100, Aantal: 1, Wie: 'Sofie' }, { Datum: '2026-02-05', ETF: 'A', Soort: 'aankoop', Bedrag: 100, Aantal: 1, Wie: 'Sofie' }, { Datum: '2026-02-28', ETF: 'A', Soort: 'waarde', Bedrag: 230, Wie: 'Sofie' }] };
  ['2026-01', '2026-02', '2026-03', '2026-04'].forEach((m, i) => {
    d.transacties.push(tx(m + '-25', 'Loon', 1000, 'Werkgever'), tx(m + '-03', 'Woonkost', -500, 'Huisbaas'), tx(m + '-10', 'Boodschappen', -80 - i * 20, 'Winkel'));
  });
  d.transacties.push(tx('2026-01-15', 'Woonkost', -60, 'Water'), tx('2026-04-15', 'Woonkost', -60, 'Water'), tx('2026-02-01', 'Woonkost', -300, 'Brandverzekering'),
    tx('2026-03-02', 'Mobiliteit & parking', -50, 'TOTAL 123 Gent'), tx('2026-03-09', 'Mobiliteit & parking', -6, 'Q-Park Centrum'), tx('2026-03-12', 'Reizen', -200, 'Hotel'));
  const cx = C.makeCtx(d), rows = C.rowsFor(cx, 'SOFIE'), rec = {};
  C.recurring(rows, 3, '2026-04').forEach(r => { rec[r.key] = 1; });
  const fq = C.frequency(rows, rec);
  ok('ritme: huur elke maand', fq.keys[C.counterparty(d.transacties[1])] === 'maandelijks' && Math.round(fq.maandelijks) === 2000, fq.maandelijks);
  ok('ritme: water per kwartaal', Math.round(fq.kwartaal) === 120, fq.kwartaal);
  ok('ritme: verzekering per jaar', Math.round(fq.jaarlijks) === 300, fq.jaarlijks);
  ok('ritme: boodschappen los', fq.keys['winkel'] === 'los');
  const ff = C.fixedFree(rows, fq.keys, ['2026-03']);
  ok('vast en vrij in maart', Math.round(ff[0].vast) === 500 && Math.round(ff[0].vrij) === 120 + 56 + 200, JSON.stringify(ff));
  const r5 = C.rule503020(cx, C.inPeriod(rows, '2026-03', '2026-03'));
  ok('50/30/20: Soort-kolom wint (reizen = nodig)', Math.round(r5.nodig) === 876 && Math.round(r5.wens) === 0 && Math.round(r5.sparen) === 124, JSON.stringify(r5));
  const car = C.carCosts(rows);
  ok('auto: tanken en parking herkend', Math.round(car.perSoort['Brandstof en laden']) === 50 && Math.round(car.perSoort['Parkeren en tol']) === 6 && Math.round(car.totaal) === 56, JSON.stringify(car.perSoort));
  const pj = C.pockets(cx, 'SOFIE', C.inPeriod(rows, '2026-03', '2026-03'), 1, rows, 4);
  ok('potjes: eigen tabblad, niet die van Mats', !pj.voorstel && pj.list.length === 2, JSON.stringify(pj));
  ok('potjes: bedrag en procent van inkomen', pj.list[0].budget === 100 && Math.round(pj.list[0].uitgegeven) === 120 && Math.round(pj.list[1].budget) === 100);
  const iv = C.investments(cx, 'SOFIE');
  ok('ETF: ingelegd, waarde, rendement', iv.ingelegd === 200 && iv.waarde === 230 && Math.abs(iv.rendement - 0.15) < 1e-9 && iv.list[0].aantal === 2, JSON.stringify(iv));
  ok('ETF: niets voor Mats', C.investments(cx, 'MATS') === null);
}

console.log('\n' + (n - fail) + '/' + n + ' geslaagd');
process.exit(fail ? 1 : 0);
