#!/usr/bin/env python3
"""Собирает dist/: index.html из game.html, sw.js с хэшем, иконки, манифест."""
import hashlib, json, os, re, shutil, sys
from PIL import Image, ImageDraw

if any(arg != '--test' for arg in sys.argv[1:]):
    raise SystemExit('Usage: python build.py [--test]')
TEST = '--test' in sys.argv
SRC = 'src'; DIST = 'android-test' if TEST else 'docs'
config_source = 'config.test.js' if TEST else 'config.js'
if os.path.exists(DIST): shutil.rmtree(DIST)
os.makedirs(DIST)

# --- index.html
g = open(f'{SRC}/game.html', encoding='utf-8').read()
g = g.replace('__VER__', open(f'{SRC}/version.txt', encoding='utf-8').read().strip())
build_id = hashlib.sha256((g + ''.join(open(f'{SRC}/{name}', encoding='utf-8').read() for name in ['localdb.js', 'citadel-world.js', 'sw.template.js', 'manifest.json', config_source]) + open(__file__, encoding='utf-8').read()).encode()).hexdigest()[:12]
g = g.replace('__BUILD__', build_id)
i = g.index('</style>') + len('</style>')
head_part, body_part = g[:i], g[i:]
head_part = head_part.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
html = ('<!doctype html>\n<html lang="ru"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<meta name="theme-color" content="#1a1511">'
        '<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes">'
        '<link rel="manifest" href="manifest.json"><link rel="icon" href="icon-192.png">'
        '<link rel="apple-touch-icon" href="icon-192.png">'
        '<script>window.APP_VERSION=' + json.dumps(open(f'{SRC}/version.txt', encoding='utf-8').read().strip()) + ';window.APP_BUILD=' + json.dumps(build_id) + ';</script>'
        '<script src="config.js"></script><script src="localdb.js"></script>\n'
        + head_part + '</head><body>' + body_part + '\n</body></html>\n')
open(f'{DIST}/index.html', 'w', encoding='utf-8').write(html)

if TEST:
    page = open(f'{DIST}/index.html', encoding='utf-8').read()
    page = re.sub(r'<title>.*?</title>', '<title>Заклятие Кошмара · ТЕСТ</title>', page, count=1)
    page = page.replace('Они доступны на всех твоих устройствах.', 'В тестовой версии они хранятся отдельно на этом устройстве; сохраняйте резервные копии.')
    page = page.replace('<body>', '<body><div role="status" style="padding:10px;background:#422d0a;color:#fff;text-align:center;font:16px sans-serif">ТЕСТОВАЯ ВЕРСИЯ · Отдельные сохранения</div>', 1)
    open(f'{DIST}/index.html', 'w', encoding='utf-8').write(page)

# --- pixel-иконка
def icon(size, safe):
    img = Image.new('RGB', (size, size), (26, 21, 17))
    d = ImageDraw.Draw(img)
    cells = [
        "................",
        ".......GG.......",
        ".......GG.......",
        "......GYYG......",
        "......GYYG......",
        "..GGGGGYYGGGGG..",
        "..GYYYYYYYYYYG..",
        "...GYYYYYYYYG...",
        "....GYYYYYYG....",
        "....GYYYYYYG....",
        "...GYYYGGYYYG...",
        "...GYYG..GYYG...",
        "..GYYG....GYYG..",
        "..GGG......GGG..",
        "................",
        "................",
    ]
    pal = {'G': (156, 111, 22), 'Y': (232, 177, 60)}
    box = int(size * safe); off = (size - box) // 2; cs = box // 16
    off = (size - cs * 16) // 2
    pad = max(2, size // 40)
    d.rectangle([pad, pad, size - pad - 1, size - pad - 1], outline=(74, 61, 47), width=max(2, size // 64))
    for y, row in enumerate(cells):
        for x, ch in enumerate(row):
            if ch in pal:
                d.rectangle([off + x * cs, off + y * cs, off + (x + 1) * cs - 1, off + (y + 1) * cs - 1], fill=pal[ch])
    return img
icon(192, .82).save(f'{DIST}/icon-192.png')
icon(512, .82).save(f'{DIST}/icon-512.png')
icon(512, .62).save(f'{DIST}/icon-512-maskable.png')

for f in ['manifest.json', 'config.js', 'localdb.js', 'privacy.html', 'citadel-world.js']:
    source_name = config_source if f == 'config.js' else f
    shutil.copy(f'{SRC}/{source_name}', f'{DIST}/{f}')

if TEST:
    manifest = json.load(open(f'{DIST}/manifest.json', encoding='utf-8'))
    manifest.update(name='Заклятие Кошмара · ТЕСТ', short_name='Кошмар ТЕСТ', id='./android-test')
    open(f'{DIST}/manifest.json', 'w', encoding='utf-8').write(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')

# --- Отдельная тестовая Цитадель (не заменяет основную игру)
citadel = open('prototype/citadel.html', encoding='utf-8').read()
for name in ['citadel.js', 'citadel-life.js', 'citadel-weather.js']:
    shutil.copy(f'{SRC}/{name}', f'{DIST}/{name}')
    # Встраиваем код в HTML: тестовая страница работает даже из локального ZIP/файла.
    source = open(f'{SRC}/{name}', encoding='utf-8').read()
    citadel = citadel.replace(f'<script src="../src/{name}"></script>', '<script>\n' + source + '\n</script>')
citadel = citadel.replace('</head>', '<meta name="theme-color" content="#100c18"></head>')
open(f'{DIST}/citadel.html', 'w', encoding='utf-8').write(citadel)

# --- sw.js с версией = хэш содержимого
shell = ['./', 'index.html', 'manifest.json', 'config.js', 'localdb.js', 'citadel-world.js', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'citadel.html', 'citadel.js', 'citadel-life.js', 'citadel-weather.js']
h = hashlib.sha256()
for f in sorted(set(shell) - {'./'}):
    h.update(open(f'{DIST}/{f}', 'rb').read())
# Worker logic changes must also receive a fresh cache identity.
h.update(open(f'{SRC}/sw.template.js', 'rb').read())
ver = h.hexdigest()[:10]
sw = open(f'{SRC}/sw.template.js', encoding='utf-8').read().replace('__VERSION__', ver).replace('__SHELL__', json.dumps(shell)).replace('__APP_BUILD__', build_id)
open(f'{DIST}/sw.js', 'w', encoding='utf-8').write(sw)
print('built', ver, os.listdir(DIST))
