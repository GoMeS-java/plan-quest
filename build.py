#!/usr/bin/env python3
"""Собирает dist/: index.html из game.html, sw.js с хэшем, иконки, манифест."""
import hashlib, json, os, re, shutil, sys
from pathlib import Path
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
art_assets = sorted(Path(SRC).glob('assets/citadel/*'))
art_hash = hashlib.sha256(b''.join(p.read_bytes() for p in art_assets)).hexdigest()
build_id = hashlib.sha256((g + ''.join(open(f'{SRC}/{name}', encoding='utf-8').read() for name in ['localdb.js', 'citadel-world.js', 'sw.template.js', 'manifest.json', config_source]) + art_hash + open(f'{SRC}/citadel-art.css', encoding='utf-8').read() + open(f'{SRC}/rpg-ui.css', encoding='utf-8').read() + open(__file__, encoding='utf-8').read()).encode()).hexdigest()[:12]
g = g.replace('__BUILD__', build_id)
i = g.index('<link rel="stylesheet" href="rpg-ui.css">') + len('<link rel="stylesheet" href="rpg-ui.css">')
head_part, body_part = g[:i], g[i:]
head_part = head_part.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
html = ('<!doctype html>\n<html lang="ru"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<meta name="theme-color" content="#17121f">'
        '<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes">'
        '<link rel="manifest" href="manifest.json"><link rel="icon" href="icon-192.png">'
        '<link rel="apple-touch-icon" href="icon-192.png">'
        '<script>window.APP_VERSION=' + json.dumps(open(f'{SRC}/version.txt', encoding='utf-8').read().strip()) + ';window.APP_BUILD=' + json.dumps(build_id) + ';</script>'
        '<script src="config.js"></script><script src="localdb.js"></script>\n'
        + head_part + '</head><body>' + body_part + '\n</body></html>\n')
open(f'{DIST}/index.html', 'w', encoding='utf-8').write(html)

if TEST:
    page = open(f'{DIST}/index.html', encoding='utf-8').read()
    page = re.sub(r'<title>.*?</title>', '<title>Вкач · ТЕСТ</title>', page, count=1)
    page = page.replace('Они доступны на всех твоих устройствах.', 'В тестовой версии они хранятся отдельно на этом устройстве; сохраняйте резервные копии.')
    page = page.replace('<body>', '<body><div role="status" style="padding:6px;background:#30213d;color:#e7c7e9;text-align:center;font:12px sans-serif">ТЕСТОВАЯ ВЕРСИЯ · Отдельные сохранения</div>', 1)
    open(f'{DIST}/index.html', 'w', encoding='utf-8').write(page)

# --- pixel-иконка
# Chosen icon #1: gold pixel star above the purple Citadel. The embedded
# compact source keeps the standalone build deterministic and self-contained.
import base64, io
ICON_ART = base64.b64decode("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")
icon_art = Image.open(io.BytesIO(ICON_ART)).convert('RGB')
def icon(size, safe):
    if safe >= .8:
        return icon_art.resize((size, size), Image.Resampling.LANCZOS)
    img = Image.new('RGB', (size, size), (19, 11, 35))
    inner = int(size * .75)
    artwork = icon_art.resize((inner, inner), Image.Resampling.LANCZOS)
    img.paste(artwork, ((size - inner) // 2, (size - inner) // 2))
    return img
icon(192, .82).save(f'{DIST}/icon-192.png')
icon(512, .82).save(f'{DIST}/icon-512.png')
icon(512, .62).save(f'{DIST}/icon-512-maskable.png')

for f in ['manifest.json', 'config.js', 'localdb.js', 'privacy.html', 'citadel-world.js']:
    source_name = config_source if f == 'config.js' else f
    shutil.copy(f'{SRC}/{source_name}', f'{DIST}/{f}')

if TEST:
    manifest = json.load(open(f'{DIST}/manifest.json', encoding='utf-8'))
    manifest.update(name='Вкач · ТЕСТ', short_name='Вкач ТЕСТ', id='./android-test')
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

# Original scenery and sprites are first-party offline shell assets.
shutil.copy(f'{SRC}/citadel-art.css', f'{DIST}/citadel-art.css')
shutil.copy(f'{SRC}/rpg-ui.css', f'{DIST}/rpg-ui.css')
shutil.copytree(f'{SRC}/assets', f'{DIST}/assets')

# --- sw.js с версией = хэш содержимого
shell = ['./', 'index.html', 'manifest.json', 'config.js', 'localdb.js', 'citadel-world.js', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'citadel.html', 'citadel.js', 'citadel-life.js', 'citadel-weather.js']
shell += ['citadel-art.css', 'rpg-ui.css'] + ['assets/citadel/' + name for name in sorted(os.listdir(f'{SRC}/assets/citadel'))]
h = hashlib.sha256()
for f in sorted(set(shell) - {'./'}):
    h.update(open(f'{DIST}/{f}', 'rb').read())
# Worker logic changes must also receive a fresh cache identity.
h.update(open(f'{SRC}/sw.template.js', 'rb').read())
ver = h.hexdigest()[:10]
sw = open(f'{SRC}/sw.template.js', encoding='utf-8').read().replace('__VERSION__', ver).replace('__SHELL__', json.dumps(shell)).replace('__APP_BUILD__', build_id)
open(f'{DIST}/sw.js', 'w', encoding='utf-8').write(sw)
print('built', ver, os.listdir(DIST))
