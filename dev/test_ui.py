"""UI-test met Playwright (aanraakscherm-emulatie).
Gebruik: python3 dev/test_ui.py <map met een KOPIE van de site + data/fixture.json> [uitvoermap]
De bestanden worden rechtstreeks uit die map geserveerd onder http://hb.test/ (geen echte server nodig).
Controleert per schermgrootte, thema en weergave (ook bewerkmodus): geen horizontale scroll,
geen consolefouten, geen overlappende tegels, geen tekst die uit een tegel loopt, tikdoelen >= 44px.
"""
import json, sys, os, re
from playwright.sync_api import sync_playwright

import mimetypes
ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
BASE = 'http://hb.test/'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'dev/out'
os.makedirs(OUT, exist_ok=True)
SIZES = [(1180, 820), (820, 1180), (390, 844), (320, 640)]
VIEWS = ['MATS', 'SOFIE', 'SAMEN']
fails, checks = [], 0

CHECK_JS = r"""() => {
  const out = [], vw = innerWidth;
  if (document.scrollingElement.scrollWidth > vw + 1) out.push('horizontale scroll: ' + document.scrollingElement.scrollWidth + ' > ' + vw);
  const tiles = [...document.querySelectorAll('#grid .w')].map(t => ({ id: t.dataset.id, r: t.getBoundingClientRect(), el: t }));
  for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) {
    const a = tiles[i].r, b = tiles[j].r;
    if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.push('overlap ' + tiles[i].id + ' / ' + tiles[j].id);
  }
  for (const t of tiles) {
    if (t.r.right > vw + 0.5 || t.r.left < -0.5) out.push('tegel buiten scherm ' + t.id);
    for (const el of t.el.querySelectorAll('.kv,.big,.wt,.lv,.more,.tg,.hs,.gl,.frh,.mlabel,.dt')) {
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      if (r.right > t.r.right - 2 || r.left < t.r.left + 2) out.push('uit tegel ' + t.id + ' ' + el.className + ' "' + el.textContent.slice(0, 30) + '"');
      if (r.bottom > t.r.bottom - 2 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('.ed')) out.push('onderaan afgesneden ' + t.id + ' ' + el.className + ' "' + el.textContent.slice(0, 30) + '"');
      if (el.matches('.kv,.big') && el.scrollWidth > el.clientWidth + 1) out.push('getal te breed ' + t.id + ' "' + el.textContent + '"');
    }
  }
  const g = document.getElementById('grid');
  if (g && tiles.length && !document.body.classList.contains('editing')) {
    const cols = getComputedStyle(g).gridTemplateColumns.split(' ').length, gr = g.getBoundingClientRect();
    const row = parseFloat(getComputedStyle(g).gridAutoRows), gap = parseFloat(getComputedStyle(g).rowGap);
    const rows = Math.round((gr.height + gap) / (row + gap));
    let used = 0; for (const t of tiles) used += Math.round((t.r.width + gap) / ((gr.width + gap) / cols)) * Math.round((t.r.height + gap) / (row + gap));
    if (used !== cols * rows) out.push('gat in het raster: ' + (cols * rows - used) + ' lege cellen');
  }
  for (const b of document.querySelectorAll('button')) {
    const r = b.getBoundingClientRect(), cs = getComputedStyle(b);
    if (!r.width || cs.visibility === 'hidden' || b.closest('[hidden]')) continue;
    let p = b, hid = false; while ((p = p.parentElement)) if (getComputedStyle(p).display === 'none') { hid = true; break; }
    if (hid) continue;
    const af = getComputedStyle(b, '::after'), ext = k => af.content !== 'none' && af.position === 'absolute' ? Math.max(0, -parseFloat(af[k]) || 0) : 0;
    const w = r.width + ext('left') + ext('right'), h = r.height + ext('top') + ext('bottom');
    if (w < 43.5 || h < 43.5) out.push('tikdoel ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' ' + (b.getAttribute('aria-label') || b.textContent).trim().slice(0, 30));
  }
  return out;
}"""

def check(page, label):
    global checks
    checks += 1
    for p in page.evaluate(CHECK_JS):
        fails.append(label + ': ' + p)

def new_page(b, w, h, scheme, errors, fixture=None):
    ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=True, is_mobile=w < 700, color_scheme=scheme, device_scale_factor=1)
    def serve(route):
        path = route.request.url.split('hb.test/', 1)[1].split('?')[0] or 'index.html'
        f = os.path.join(ROOT, path)
        if not os.path.isfile(f): return route.fulfill(status=404, body='niet gevonden')
        route.fulfill(status=200, body=open(f, 'rb').read(), content_type=mimetypes.guess_type(f)[0] or 'application/octet-stream')
    ctx.route('http://hb.test/**', serve)
    page = ctx.new_page()
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(str(e)))
    if fixture is not None:
        page.route('**/data/fixture.json', lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(fixture)))
    return ctx, page

def go(page, view):
    page.evaluate("v => { localStorage.setItem('hb_person', v); localStorage.removeItem('hb_page_' + v) }", view)
    page.reload(); page.wait_for_selector('#grid .w')

with sync_playwright() as pw:
    b = pw.chromium.launch(channel=os.environ.get('PW_CHANNEL') or None)
    # 1. alle schermen, thema's, weergaven, ook bewerkmodus
    for (w, h) in SIZES:
        for scheme in ['dark', 'light']:
            errors = []
            ctx, page = new_page(b, w, h, scheme, errors)
            page.goto(BASE + 'index.html?src=fixture'); page.wait_for_selector('#grid .w')
            for v in VIEWS:
                go(page, v)
                for i in range(page.locator('#dots button').count()):
                    page.locator('#dots button').nth(i).click(); page.wait_for_timeout(320)
                    pg = page.locator('#ptitle').inner_text()
                    lab = '%dx%d %s %s %s' % (w, h, scheme, v, pg)
                    check(page, lab)
                    # iPad liggend: elke pagina past op het scherm, zonder scrollen
                    if w == 1180 and page.evaluate('document.scrollingElement.scrollHeight') > h + 1: fails.append(lab + ': pagina past niet op het scherm')
                    page.screenshot(path='%s/%s_%d_%dx%d_%s.png' % (OUT, v, i, w, h, scheme), full_page=True)
                    if i == 0:
                        page.click('#edit'); page.wait_for_selector('.ed')
                        check(page, lab + ' bewerk')
                        page.click('#edit')
                page.locator('#dots button').first.click()
            for e in errors: fails.append('%dx%d %s console: %s' % (w, h, scheme, e))
            ctx.close()

    # 2. interacties (iPad liggend)
    errors = []
    ctx, page = new_page(b, 1180, 820, 'dark', errors)
    page.goto(BASE + 'index.html?src=fixture'); page.wait_for_selector('#grid .w')
    go(page, 'MATS')
    for k in ['kwartaal', 'jaar', 'alles']:
        page.click('[data-per=%s]' % k)
        if page.locator('[data-per=%s]' % k).get_attribute('aria-selected') != 'true': fails.append('periode %s werkt niet' % k)
    if 'feb tot' not in page.locator('.mlabel').inner_text(): fails.append('label alles: ' + page.locator('.mlabel').inner_text())
    page.click('[data-per=kwartaal]')
    if not page.locator('.mlabel').inner_text().startswith('Q'): fails.append('label kwartaal: ' + page.locator('.mlabel').inner_text())
    page.click('[data-st="-1"]')
    if not page.locator('.mlabel').inner_text().startswith('Q3'): fails.append('kwartaal terug: ' + page.locator('.mlabel').inner_text())
    page.click('[data-per=maand]')
    # vegen en pagina's: pijltjestoets, veeg met de muis, bolletjes
    page.keyboard.press('ArrowRight')
    if page.locator('#ptitle').inner_text() != 'Inzichten': fails.append('pijltje rechts gaat niet naar volgende pagina')
    g = page.locator('#grid').bounding_box()
    page.mouse.move(g['x'] + g['width'] * .8, g['y'] + 200); page.mouse.down(); page.mouse.move(g['x'] + g['width'] * .3, g['y'] + 210, steps=6); page.mouse.up(); page.wait_for_timeout(350)
    if page.locator('#ptitle').inner_text() != 'Pockets': fails.append('vegen gaat niet naar volgende pagina: ' + page.locator('#ptitle').inner_text())
    # doorklikken opent een vel met betalingen
    for pg, sel in [(3, '[data-id=categorieen] [data-dd]'), (3, '[data-id=donut] .sl[data-dd]'), (3, '[data-id=donut] .lrow[data-dd]'), (0, '[data-id=regel] [data-dd]'), (4, '[data-id=vastsoort] .lrow[data-dd]'), (4, '[data-id=vastelasten] [data-dd]')]:
        page.locator('#dots button').nth(pg).click(); page.wait_for_timeout(320)
        if not page.locator(sel).count(): fails.append('geen doorklik in ' + sel); continue
        (page.locator(sel).first.dispatch_event('click') if '.sl' in sel else page.locator(sel).first.click()); page.wait_for_selector('#sheet')
        if page.locator('#sheet .list li').count() < 1: fails.append('doorklik toont geen betalingen ' + sel)
        page.keyboard.press('Escape')
    page.click('[data-pg=uitgaven]'); page.wait_for_timeout(320)
    page.click('[data-more=eenmalig]')
    if page.locator('#sheet .list li').count() < 6: fails.append('Toon alle toont te weinig')
    page.keyboard.press('Escape')
    page.click('[data-pg=overzicht]'); page.wait_for_timeout(320)
    page.locator('[data-id=verloop] [data-month="2026-05"]').first.click()
    lab = page.locator('.mlabel').inner_text()
    if 'mei' not in lab: fails.append('tik op staaf kiest maand niet: ' + lab)
    page.click('[data-st="1"]')
    if 'jun' not in page.locator('.mlabel').inner_text(): fails.append('stapper werkt niet')
    if page.locator('#sheet').count(): fails.append('Escape sluit vel niet')
    # bewerkmodus: grootte, pijl, verwijderen, toevoegen, standaard
    page.click('#edit')
    order = lambda: page.evaluate("() => [...document.querySelectorAll('#grid .w')].map(t => t.dataset.id + ':' + t.dataset.size)")
    o0 = order()
    page.click('[data-sz="inkomen:L"]')
    if 'inkomen:L' not in order(): fails.append('grootte wisselen werkt niet')
    page.click('[data-mv="uitgaven:-1"]')
    o1 = [x.split(':')[0] for x in order()]
    if o1.index('uitgaven') > o1.index('inkomen'): fails.append('pijl omhoog werkt niet')
    page.click('[data-rm="prognose"]')
    if any(x.startswith('prognose') for x in order()): fails.append('verwijderen werkt niet')
    page.click('[data-act=gallery]'); page.wait_for_selector('#sheet .gi')
    if not page.locator('[data-add=prognose]').count(): fails.append('verwijderde widget niet in galerij')
    if page.locator('[data-add=eerlijkheid]').count(): fails.append('eerlijkheid in galerij van MATS')
    if page.locator('[data-add=spaarverloop]').count(): fails.append('widget van een andere pagina staat in de galerij')
    page.click('[data-add=gemiddelde]')
    if not any(x.startswith('gemiddelde') for x in order()): fails.append('toevoegen werkt niet')
    # slepen met de muis via de greep
    page.evaluate('scrollTo(0, 0)'); page.wait_for_timeout(100)
    a = page.locator('[data-hd=gespaard]').bounding_box(); t = page.locator('[data-id=verloop]').bounding_box()
    page.mouse.move(a['x'] + 22, a['y'] + 22); page.mouse.down()
    for i in range(1, 15): page.mouse.move(a['x'] + 22 + (t['x'] + 60 - a['x'] - 22) * i / 14, a['y'] + 22 + (t['y'] + 60 - a['y'] - 22) * i / 14)
    page.mouse.up(); page.wait_for_timeout(400)
    ids = [x.split(':')[0] for x in order()]
    if ids.index('gespaard') > 1: fails.append('slepen werkt niet: ' + ','.join(ids[:4]))
    # aanraken: lang drukken en slepen (CDP touch)
    page.evaluate('scrollTo(0, 0)'); page.wait_for_timeout(100)
    cdp = ctx.new_cdp_session(page)
    box = page.locator('[data-id=spaarratio] .en').bounding_box(); tgt = page.locator('[data-id=vermogen]').bounding_box()
    x0, y0 = box['x'] + 30, box['y'] + 10
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x0, 'y': y0}]})
    page.wait_for_timeout(450)
    for i in range(1, 12):
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x0 + (tgt['x'] + 40 - x0) * i / 11, 'y': y0 + (tgt['y'] + 40 - y0) * i / 11}]})
        page.wait_for_timeout(30)
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); page.wait_for_timeout(400)
    ids = [x.split(':')[0] for x in order()]
    if ids.index('spaarratio') > 1: fails.append('lang drukken en slepen (touch) werkt niet: ' + ','.join(ids[:4]))
    saved = page.evaluate("() => localStorage.getItem('hb_l4_MATS:overzicht')")
    if not saved or 'gemiddelde' not in saved: fails.append('indeling niet bewaard')
    page.reload(); page.wait_for_selector('#grid .w')
    if not any(x.startswith('gemiddelde') for x in order()): fails.append('indeling niet hersteld na herladen')
    page.click('#edit'); page.click('[data-act=reset]'); page.click('#edit')
    if any(x.startswith('gemiddelde') for x in order()): fails.append('standaard herstellen werkt niet')
    # lang drukken buiten bewerkmodus opent bewerkmodus
    box = page.locator('[data-id=inkomen] .wt').bounding_box()
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': box['x'] + 20, 'y': box['y'] + 8}]})
    page.wait_for_timeout(700); cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); page.wait_for_timeout(200)
    if not page.locator('body.editing').count(): fails.append('lang drukken opent bewerkmodus niet')
    # kapotte opslag breekt niets
    page.evaluate("() => { localStorage.setItem('hb_l4_SOFIE:overzicht', '{kapot'); localStorage.setItem('hb_person', 'SOFIE'); localStorage.setItem('hb_page_SOFIE', 'overzicht') }")
    page.reload(); page.wait_for_selector('#grid .w')
    if page.locator('#grid .w').count() < 7: fails.append('kapotte opslag geeft geen standaardindeling')
    # pockets instellen in het dashboard (lokaal in testmodus)
    page.evaluate("() => { localStorage.setItem('hb_person', 'SOFIE'); localStorage.setItem('hb_local_pockets', '[]') }"); page.reload(); page.wait_for_selector('#grid .w')
    page.click('[data-pg=pockets]'); page.wait_for_timeout(320)
    page.click('[data-act=pockets]'); page.wait_for_selector('#pe')
    page.fill('[data-pi="0:Naam"]', 'Boodschappen'); page.fill('[data-pi="0:Bedrag"]', '250')
    page.click('[data-pe="save"]')
    if 'minstens' not in page.locator('#peerr').inner_text(): fails.append('pocket zonder categorie wordt niet geweigerd')
    page.locator('[data-pe^="cat:0:Boodschappen"]').click(); page.click('[data-pe="save"]'); page.wait_for_timeout(200)
    if page.locator('.pk').count() != 1: fails.append('pocket bewaren werkt niet')
    else:
        page.locator('.pk').first.click(); page.wait_for_selector('#sheet')
        if page.locator('#sheet .list li').count() < 1: fails.append('pocket toont geen betalingen')
        page.keyboard.press('Escape')
    page.reload(); page.wait_for_selector('#grid .w')
    if page.locator('.pk').count() != 1: fails.append('pocket niet bewaard na herladen')
    # FIRE-instellingen
    page.click('[data-pg=fire]'); page.wait_for_timeout(320)
    page.click('[data-act=fire]'); page.fill('[data-fk=GEBOORTEJAAR]', '1995'); page.fill('[data-fk=FIRE_DOEL]', '600000'); page.fill('[data-fk=BARISTA_DOEL]', '400000'); page.click('[data-act=firesave]'); page.wait_for_timeout(200)
    if '€600k' not in page.locator('[data-id=fireinst]').inner_text() or 'Barista FIRE' not in page.locator('[data-id=fire]').inner_text(): fails.append('FIRE-doelen niet overgenomen: ' + page.locator('[data-id=fireinst]').inner_text())
    if ' op je ' not in page.locator('[data-id=fire] .wt').inner_text() and 'niet binnen' not in page.locator('[data-id=fire] .wt').inner_text(): fails.append('FIRE-titel zonder leeftijd: ' + page.locator('[data-id=fire] .wt').inner_text())
    # gegevens en rekeningen zitten in het menu
    page.click('#menu'); page.click('[data-act=data]')
    if page.locator('#sheet .list li').count() < 3: fails.append('gegevens en rekeningen leeg')
    page.keyboard.press('Escape')
    for e in errors: fails.append('interactie console: ' + e)
    ctx.close()

    # 2b. gedeelde indeling uit het blad wint van wat op het toestel staat
    fx = json.load(open(os.path.join(ROOT, 'data', 'fixture.json')))
    fx3 = dict(fx); fx3['indeling'] = {'v': 10, 'MATS:overzicht': [{'id': 'gemiddelde', 'size': 'L'}, {'id': 'inkomenflow', 'size': 'L'}]}
    errors = []
    ctx, page = new_page(b, 820, 1180, 'light', errors, fx3)
    page.goto(BASE + 'index.html?src=fixture'); page.wait_for_selector('#grid .w')
    page.evaluate("() => { localStorage.setItem('hb_l4_MATS:overzicht', JSON.stringify({v:10,items:[{id:'inkomen',size:'S'}]})); localStorage.setItem('hb_person','MATS'); localStorage.removeItem('hb_page_MATS') }")
    page.reload(); page.wait_for_selector('#grid .w')
    ids = page.evaluate("() => [...document.querySelectorAll('#grid .w')].map(t => t.dataset.id)")
    if ids != ['gemiddelde', 'inkomenflow']: fails.append('gedeelde indeling niet gebruikt: ' + ','.join(ids))
    check(page, 'gedeelde indeling')
    for e in errors: fails.append('gedeelde indeling console: ' + e)
    ctx.close()

    # 3. Sofie zonder eigen rekeningen: lege toestand in de tegel
    fx = json.load(open(os.path.join(ROOT, 'data', 'fixture.json')))
    fx2 = dict(fx); fx2['rekeningen'] = [a for a in fx['rekeningen'] if a.get('Eigenaar') != 'Sofie']
    fx2['transacties'] = [t for t in fx['transacties'] if not str(t['Rekening_ID']).startswith('SOFIE')]
    errors = []
    ctx, page = new_page(b, 390, 844, 'light', errors, fx2)
    page.goto(BASE + 'index.html?src=fixture'); page.wait_for_selector('#grid .w'); go(page, 'SOFIE')
    for wid in ['verloop', 'inkomen', 'spaarratio']:
        if 'Nog geen eigen rekening' not in page.locator('[data-id=%s]' % wid).inner_text(): fails.append('lege toestand ontbreekt in ' + wid)
    if page.locator('[data-id=uitgaven] .kv').count() == 0: fails.append('uitgaven Sofie ontbreekt zonder rekeningen')
    if 'aandachtspunt' not in page.locator('#status').inner_text(): fails.append('aandachtspunt Sofie ontbreekt')
    check(page, 'Sofie zonder rekeningen')
    page.screenshot(path=OUT + '/SOFIE_zonder_rekeningen_390.png', full_page=True)
    for e in errors: fails.append('lege toestand console: ' + e)
    ctx.close()
    b.close()

print('%d schermcontroles, %d problemen' % (checks, len(fails)))
seen = set()
for f in fails:
    k = re.sub(r'^\d+x\d+ \w+ ', '', f)
    if k in seen: continue
    seen.add(k); print('FAIL', f)
sys.exit(1 if fails else 0)
