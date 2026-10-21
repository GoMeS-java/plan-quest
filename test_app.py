import json, re, time, subprocess
from playwright.sync_api import sync_playwright

URL = 'http://localhost:8765/'
seed = json.load(open('seed.json'))
errors = []

GSI = """window.google={accounts:{oauth2:{initTokenClient:function(o){return {requestAccessToken:function(){setTimeout(function(){o.callback({access_token:'tok',expires_in:3600})},10)}}},revoke:function(t,cb){cb&&cb()}}}};"""
drive = {'file': None, 'id': 'FILE1'}

sheet = {'rows': None}
def handle(route):
    req = route.request; u = req.url
    if u.endswith('/config.js'):
        return route.fulfill(status=200, content_type='text/javascript', body="window.PLAN_CONFIG={clientId:'test',fileName:'plan-data'};")
    if 'accounts.google.com/gsi/client' in u:
        return route.fulfill(status=200, content_type='text/javascript', body=GSI)
    if 'fonts.g' in u:
        return route.fulfill(status=200, content_type='text/css', body='')
    if 'googleapis.com/drive/v3/files?q=' in u:
        files = [{'id': 'SHEET1', 'name': 'plan-data'}] if sheet['rows'] else []
        return route.fulfill(status=200, content_type='application/json', body=json.dumps({'files': files}))
    if u == 'https://sheets.googleapis.com/v4/spreadsheets' and req.method == 'POST':
        sheet['rows'] = []
        return route.fulfill(status=200, content_type='application/json', body=json.dumps({'spreadsheetId': 'SHEET1'}))
    if 'sheets.googleapis.com/v4/spreadsheets/SHEET1/values/data!A:C' in u:
        return route.fulfill(status=200, content_type='application/json', body=json.dumps({'values': sheet['rows']}))
    if 'sheets.googleapis.com/v4/spreadsheets/SHEET1/values/data!A1' in u and req.method == 'PUT':
        sheet['rows'] = json.loads(req.post_data)['values']
        return route.fulfill(status=200, content_type='application/json', body='{}')
    route.continue_()

def remote_docs():
    out = {}
    for i, r in enumerate(sheet['rows']):
        if i == 0: continue
        out[r[0]] = {'d': json.loads(r[1]) if r[1] != '' else None, 'u': r[2]}
    return out

def set_row(path, d, u):
    for r in sheet['rows']:
        if r[0] == path:
            r[1] = json.dumps(d, ensure_ascii=False) if d is not None else ''; r[2] = u; return
    sheet['rows'].append([path, json.dumps(d, ensure_ascii=False) if d is not None else '', u])

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
    print('5 created sheet rows:', len(sheet['rows']) - 1, '| header', sheet['rows'][0], '| chip', page.inner_text('.pl-chip'))
    # «я» правлю файл на Диске: новая запись и правка существующей (u новее)
    now = int(time.time() * 1000)
    set_row('goals/new_from_chat', {'name': 'Тест от Claude', 'done': False, 'ts': 1}, now)
    d21 = remote_docs()['days/2026-10-21']['d']; d21['steps'] = 7777
    set_row('days/2026-10-21', d21, now + 5)
    # на телефоне тем временем локальная правка старее чужой и новая запись
    page.evaluate("claude.use('db').then(db=>db.doc('jar/phone1').set({t:'с телефона',a:5,date:'2026-10-21',ts:2}))")
    page.wait_for_timeout(100)
    page.evaluate("PlanSync.sync(false)"); page.wait_for_timeout(1000)
    f2 = {'docs': remote_docs()}
    loc = page.evaluate("JSON.stringify([PlanSync._docs()['goals/new_from_chat'], PlanSync._docs()['days/2026-10-21'].d.steps])")
    print('6 merge: local got chat edits:', loc[:80], '| drive got phone doc:', 'jar/phone1' in f2['docs'])
    page.screenshot(path='/tmp/app3.png')
    # удаление синхронизируется
    page.evaluate("claude.use('db').then(db=>db.doc('jar/phone1').delete())"); page.wait_for_timeout(100)
    page.evaluate("PlanSync.sync(false)"); page.wait_for_timeout(800)
    print('7 tombstone on sheet:', repr(remote_docs()['jar/phone1']['d']), [r for r in sheet['rows'] if r[0]=='jar/phone1'][0][1:])
    # обновление SW
    subprocess.run(['sed', '-i', 's/Сохранение недоступно/Сохранение недоступно!/', 'src/game.html'])
    subprocess.run(['python3', 'build.py'], capture_output=True)
    page.evaluate("navigator.serviceWorker.getRegistration().then(r=>r.update())"); page.wait_for_timeout(2000)
    print('8 update chip:', page.inner_text('.pl-chip'))
    subprocess.run(['sed', '-i', 's/Сохранение недоступно!/Сохранение недоступно/', 'src/game.html'])
    subprocess.run(['python3', 'build.py'], capture_output=True)
print('errors:', errors)
