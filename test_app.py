import json, re, time, subprocess
from playwright.sync_api import sync_playwright

URL = 'http://localhost:8765/'
seed = json.load(open('seed.json'))
errors = []

GSI = """window.google={accounts:{oauth2:{initTokenClient:function(o){return {requestAccessToken:function(){setTimeout(function(){o.callback({access_token:'tok',expires_in:3600})},10)}}},revoke:function(t,cb){cb&&cb()}}}};"""
drive = {'file': None, 'id': 'FILE1'}

def handle(route):
    req = route.request; u = req.url
    if u.endswith('/config.js'):
        return route.fulfill(status=200, content_type='text/javascript', body="window.PLAN_CONFIG={clientId:'test',fileName:'plan-data.json'};")
    if 'accounts.google.com/gsi/client' in u:
        return route.fulfill(status=200, content_type='text/javascript', body=GSI)
    if 'fonts.g' in u:
        return route.fulfill(status=200, content_type='text/css', body='')
    if 'googleapis.com/drive/v3/files?q=' in u:
        files = [{'id': drive['id'], 'name': 'plan-data.json'}] if drive['file'] else []
        return route.fulfill(status=200, content_type='application/json', body=json.dumps({'files': files}))
    if 'alt=media' in u:
        return route.fulfill(status=200, content_type='application/json', body=drive['file'])
    if 'upload/drive/v3/files' in u and req.method == 'POST':
        body = req.post_data
        m = re.search(r'Content-Type: application/json\r\n\r\n(\{"v".*?\})\r\n--plan', body, re.S)
        drive['file'] = m.group(1)
        return route.fulfill(status=200, content_type='application/json', body=json.dumps({'id': drive['id']}))
    if 'upload/drive/v3/files/' in u and req.method == 'PATCH':
        drive['file'] = req.post_data
        return route.fulfill(status=200, content_type='application/json', body='{}')
    route.continue_()

def cfg(route):
    route.fulfill(status=200, content_type='text/javascript', body="window.PLAN_CONFIG={clientId:'test',fileName:'plan-data.json'};")

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx = b.new_context(viewport={'width': 430, 'height': 900}, service_workers='allow')
    ctx.route('**/*', handle)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.on('console', lambda m: errors.append('console: ' + m.text) if m.type == 'error' else None)
    page.goto(URL); page.wait_for_timeout(1500)
    print('1 chip:', page.inner_text('.pl-chip'), '| sw controlled:', page.evaluate('!!navigator.serviceWorker.controller'))
    n = page.evaluate('s => PlanSync.importObj(s)', seed)
    page.wait_for_timeout(500)
    print('2 imported', n, '| pts', page.inner_text('#pts')[:30].replace('\n', ' '), '| goal', page.inner_text('#goal')[:30].replace('\n', ' '))
    page.screenshot(path='/tmp/app1.png')
    # офлайн
    page.reload(); page.wait_for_timeout(1500)
    ctx.set_offline(True)
    page.reload(); page.wait_for_timeout(1500)
    print('3 offline reload ok, title:', page.title(), '| chip:', page.inner_text('.pl-chip'), '| pts', page.inner_text('#pts')[:20].replace('\n', ' '))
    page.screenshot(path='/tmp/app2_offline.png')
    # запись офлайн
    page.evaluate("claude.use('db').then(db=>db.doc('weeks/2026-10-19').set({meet:true}))")
    page.wait_for_timeout(300)
    page.reload(); page.wait_for_timeout(1200)
    print('4 offline write persisted:', page.evaluate("JSON.stringify(PlanSync._docs()['weeks/2026-10-19'])"))
    ctx.set_offline(False)
    # синхронизация: файла на Диске нет → создаётся
    page.evaluate("PLAN_CONFIG.clientId='test'")
    page.evaluate("PlanSync.sync(true)"); page.wait_for_timeout(1200)
    f = json.loads(drive['file'])
    print('5 created drive file docs:', len(f['docs']), '| chip', page.inner_text('.pl-chip'))
    # «я» правлю файл на Диске: новая запись и правка существующей (u новее)
    f['docs']['goals/new_from_chat'] = {'d': {'name': 'Тест от Claude', 'done': False, 'ts': 1}, 'u': int(time.time() * 1000)}
    f['docs']['days/2026-10-21']['d']['steps'] = 7777; f['docs']['days/2026-10-21']['u'] = int(time.time() * 1000) + 5
    drive['file'] = json.dumps(f, ensure_ascii=False)
    # на телефоне тем временем локальная правка старее чужой и новая запись
    page.evaluate("claude.use('db').then(db=>db.doc('jar/phone1').set({t:'с телефона',a:5,date:'2026-10-21',ts:2}))")
    page.wait_for_timeout(100)
    page.evaluate("PlanSync.sync(false)"); page.wait_for_timeout(1000)
    f2 = json.loads(drive['file'])
    loc = page.evaluate("JSON.stringify([PlanSync._docs()['goals/new_from_chat'], PlanSync._docs()['days/2026-10-21'].d.steps])")
    print('6 merge: local got chat edits:', loc[:80], '| drive got phone doc:', 'jar/phone1' in f2['docs'])
    page.screenshot(path='/tmp/app3.png')
    # удаление синхронизируется
    page.evaluate("claude.use('db').then(db=>db.doc('jar/phone1').delete())"); page.wait_for_timeout(100)
    page.evaluate("PlanSync.sync(false)"); page.wait_for_timeout(800)
    print('7 tombstone on drive:', json.loads(drive['file'])['docs']['jar/phone1']['d'])
    # обновление SW
    subprocess.run(['sed', '-i', 's/Сохранение недоступно/Сохранение недоступно!/', 'src/game.html'])
    subprocess.run(['python3', 'build.py'], capture_output=True)
    page.evaluate("navigator.serviceWorker.getRegistration().then(r=>r.update())"); page.wait_for_timeout(2000)
    print('8 update chip:', page.inner_text('.pl-chip'))
    subprocess.run(['sed', '-i', 's/Сохранение недоступно!/Сохранение недоступно/', 'src/game.html'])
    subprocess.run(['python3', 'build.py'], capture_output=True)
print('errors:', errors)
