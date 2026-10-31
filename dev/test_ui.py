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
    if (r.width < 43.5 || r.height < 43.5) out.push('tikdoel ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' ' + (b.getAttribute('aria-label') || b.textContent).trim().slice(0, 30));
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
    page.evaluate("v => { localStorage.setItem('hb_person', v) }", view)
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
                lab = '%dx%d %s %s' % (w, h, scheme, v)
                check(page, lab)
                page.screenshot(path='%s/%s_%dx%d_%s.png' % (OUT, v, w, h, scheme), full_page=True)
                page.click('#edit'); page.wait_for_selector('.ed')
                check(page, lab + ' bewerk')
                if scheme == 'dark': page.screenshot(path='%s/%s_%dx%d_%s_bewerk.png' % (OUT, v, w, h, scheme), full_page=False)
                page.click('#edit')
            for e in errors: fails.append('%dx%d %s console: %s' % (w, h, scheme, e))
            ctx.close()

    # 2. interacties (iPad liggend)
    errors = []
    ctx, page = new_page(b, 1180, 820, 'dark', errors)
    page.goto(BASE + 'index.html?src=fixture'); page.wait_for_selector('#grid .w')
    go(page, 'MATS')
    page.click('[data-per=vol]'); assert page.locator('[data-per=vol]').get_attribute('aria-pressed') == 'true'
    page.locator('.bars .col[data-month="2026-05"]').first.click()
    lab = page.locator('.mlabel').inner_text()
    if 'mei' not in lab: fails.append('tik op staaf kiest maand niet: ' + lab)
    page.click('[data-st="1"]')
    if 'jun' not in page.locator('.mlabel').inner_text(): fails.append('stapper werkt niet')
    page.click('[data-wt="inkomenflow:structureel"]')
    if 'Structureel' not in page.locator('[data-id=inkomenflow]').inner_text() or 'eenmalig' not in page.locator('[data-id=inkomenflow] .wt').inner_text().lower():
        fails.append('toggle structureel werkt niet')
    page.click('[data-wt="opvallend:winkels"]')
    page.click('[data-more=categorieen]')
    if page.locator('#sheet .list li').count() < 6: fails.append('Toon alle toont te weinig')
    page.keyboard.press('Escape')
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
    page.click('[data-rm="buffer"]')
    if any(x.startswith('buffer') for x in order()): fails.append('verwijderen werkt niet')
    page.click('[data-act=gallery]'); page.wait_for_selector('#sheet .gi')
    if not page.locator('[data-add=buffer]').count(): fails.append('verwijderde widget niet in galerij')
    if page.locator('[data-add=eerlijkheid]').count(): fails.append('eerlijkheid in galerij van MATS')
    page.click('[data-add=weekdag]')
    if not any(x.startswith('weekdag') for x in order()): fails.append('toevoegen werkt niet')
    # slepen met de muis via de greep
    page.evaluate('scrollTo(0, 0)'); page.wait_for_timeout(100)
    a = page.locator('[data-hd=gespaard]').bounding_box(); t = page.locator('[data-id=resultaat]').bounding_box()
    page.mouse.move(a['x'] + 22, a['y'] + 22); page.mouse.down()
    for i in range(1, 15): page.mouse.move(a['x'] + 22 + (t['x'] + 60 - a['x'] - 22) * i / 14, a['y'] + 22 + (t['y'] + 60 - a['y'] - 22) * i / 14)
    page.mouse.up(); page.wait_for_timeout(400)
    ids = [x.split(':')[0] for x in order()]
    if ids.index('gespaard') > 1: fails.append('slepen werkt niet: ' + ','.join(ids[:4]))
    # aanraken: lang drukken en slepen (CDP touch)
    page.evaluate('scrollTo(0, 0)'); page.wait_for_timeout(100)
    cdp = ctx.new_cdp_session(page)
    box = page.locator('[data-id=spaarratio] .en').bounding_box(); tgt = page.locator('[data-id=resultaat]').bounding_box()
    x0, y0 = box['x'] + 30, box['y'] + 10
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x0, 'y': y0}]})
    page.wait_for_timeout(450)
    for i in range(1, 12):
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x0 + (tgt['x'] + 40 - x0) * i / 11, 'y': y0 + (tgt['y'] + 40 - y0) * i / 11}]})
        page.wait_for_timeout(30)
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); page.wait_for_timeout(400)
    ids = [x.split(':')[0] for x in order()]
    if ids.index('spaarratio') > 1: fails.append('lang drukken en slepen (touch) werkt niet: ' + ','.join(ids[:4]))
    saved = page.evaluate("() => localStorage.getItem('hb_layout_MATS')")
    if not saved or 'weekdag' not in saved: fails.append('indeling niet bewaard')
    page.reload(); page.wait_for_selector('#grid .w')
    if not any(x.startswith('weekdag') for x in order()): fails.append('indeling niet hersteld na herladen')
    # layoutcode kopieren en plakken
    code = page.evaluate("() => Layout.encode({MATS: Layout.parseSaved(localStorage.getItem('hb_layout_MATS'), 'MATS')})")
    page.click('#edit'); page.click('[data-act=reset]'); page.click('#edit')
    if any(x.startswith('weekdag') for x in order()): fails.append('standaard herstellen werkt niet')
    page.click('#menu'); page.click('[data-act=paste]'); page.fill('#codein', 'onzin'); page.click('[data-act=apply]')
    if 'geen geldige' not in page.locator('#codeerr').inner_text(): fails.append('foute layoutcode geeft geen uitleg')
    page.fill('#codein', code); page.click('[data-act=apply]')
    if not any(x.startswith('weekdag') for x in order()): fails.append('layoutcode plakken werkt niet')
    # lang drukken buiten bewerkmodus opent bewerkmodus
    box = page.locator('[data-id=inkomen] .wt').bounding_box()
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': box['x'] + 20, 'y': box['y'] + 8}]})
    page.wait_for_timeout(700); cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); page.wait_for_timeout(200)
    if not page.locator('body.editing').count(): fails.append('lang drukken opent bewerkmodus niet')
    # kapotte opslag breekt niets
    page.evaluate("() => { localStorage.setItem('hb_layout_SOFIE', '{kapot'); localStorage.setItem('hb_person', 'SOFIE') }")
    page.reload(); page.wait_for_selector('#grid .w')
    if page.locator('#grid .w').count() < 10: fails.append('kapotte opslag geeft geen standaardindeling')
    for e in errors: fails.append('interactie console: ' + e)
    ctx.close()

    # 3. Sofie zonder eigen rekeningen: lege toestand in de tegel
    fx = json.load(open(os.path.join(ROOT, 'data', 'fixture.json')))
    fx2 = dict(fx); fx2['rekeningen'] = [a for a in fx['rekeningen'] if a.get('Eigenaar') != 'Sofie']
    fx2['transacties'] = [t for t in fx['transacties'] if not str(t['Rekening_ID']).startswith('SOFIE')]
    errors = []
    ctx, page = new_page(b, 390, 844, 'light', errors, fx2)
    page.goto(BASE + 'index.html?src=fixture'); page.wait_for_selector('#grid .w'); go(page, 'SOFIE')
    for wid in ['resultaat', 'inkomen', 'spaarratio']:
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
