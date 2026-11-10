#!/usr/bin/env python3
"""Собирает dist/: index.html из game.html, sw.js с хэшем, иконки, манифест."""
import hashlib, json, os, re, shutil, sys
from pathlib import Path
from xml.etree import ElementTree as ET
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
icon_hash = hashlib.sha256(Path(SRC, 'assets/icon-shadow-v1.png').read_bytes()).hexdigest()
build_id = hashlib.sha256((g + ''.join(open(f'{SRC}/{name}', encoding='utf-8').read() for name in ['localdb.js', 'save-history.js', 'cloud-sync.js', 'cloud-firebase.js', 'awakening.js', 'citadel-world.js', 'citadel-space.js', 'legends.js', 'fate.js', 'portrait.js', 'realm-achievements.js', 'ascension.js', 'shelter-items.js', 'forge-awards.js', 'forge-art.js', 'chains.js', 'chains-ui.js', 'chains.css', 'food.js', 'food-ui.js', 'room-workspace.js', 'sw.template.js', 'manifest.json', config_source]) + art_hash + icon_hash + open(f'{SRC}/citadel-art.css', encoding='utf-8').read() + open(f'{SRC}/rpg-ui.css', encoding='utf-8').read() + open(__file__, encoding='utf-8').read()).encode()).hexdigest()[:12]
g = g.replace('__BUILD__', build_id)
i = g.index('<link rel="stylesheet" href="rpg-ui.css">') + len('<link rel="stylesheet" href="rpg-ui.css">')
head_part, body_part = g[:i], g[i:]
html = ('<!doctype html>\n<html lang="ru"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,interactive-widget=resizes-content">'
        '<meta name="theme-color" content="#17121f">'
        '<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes">'
        '<link rel="manifest" href="manifest.json"><link rel="icon" href="icon-192.png">'
        '<link rel="apple-touch-icon" href="icon-192.png">'
        '<script>window.APP_VERSION=' + json.dumps(open(f'{SRC}/version.txt', encoding='utf-8').read().strip()) + ';window.APP_BUILD=' + json.dumps(build_id) + ';</script>'
        '<script src="config.js"></script><script src="save-history.js"></script><script src="cloud-sync.js"></script><script src="cloud-firebase.js"></script><script src="localdb.js"></script><script src="awakening.js"></script>\n'
        + head_part + '</head><body>' + body_part + '\n</body></html>\n')
open(f'{DIST}/index.html', 'w', encoding='utf-8', newline='\n').write(html)

if TEST:
    page = open(f'{DIST}/index.html', encoding='utf-8').read()
    page = re.sub(r'<title>.*?</title>', '<title>Вкач · ТЕСТ</title>', page, count=1)
    page = page.replace('Они доступны на всех твоих устройствах.', 'В тестовой версии они хранятся отдельно на этом устройстве; сохраняйте резервные копии.')
    page = page.replace('<body>', '<body><div role="status" style="padding:6px;background:#30213d;color:#e7c7e9;text-align:center;font:12px sans-serif">ТЕСТОВАЯ ВЕРСИЯ · Отдельные сохранения</div>', 1)
    open(f'{DIST}/index.html', 'w', encoding='utf-8', newline='\n').write(page)

# --- pixel-иконка
# Approved dark-violet pixel hero icon; source is kept with the application.
icon_art = Image.open(Path(SRC, 'assets/icon-shadow-v1.png')).convert('RGB')
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

for f in ['manifest.json', 'config.js', 'localdb.js', 'save-history.js', 'cloud-sync.js', 'cloud-firebase.js', 'awakening.js', 'privacy.html', 'citadel-world.js', 'citadel-space.js', 'legends.js', 'fate.js', 'portrait.js', 'realm-achievements.js', 'ascension.js', 'shelter-items.js', 'forge-awards.js', 'forge-art.js', 'chains.js', 'chains-ui.js', 'chains.css', 'food.js', 'food-ui.js', 'room-workspace.js']:
    source_name = config_source if f == 'config.js' else f
    shutil.copy(f'{SRC}/{source_name}', f'{DIST}/{f}')

if TEST:
    manifest = json.load(open(f'{DIST}/manifest.json', encoding='utf-8'))
    manifest.update(name='Вкач · ТЕСТ', short_name='Вкач ТЕСТ', id='./android-test')
    open(f'{DIST}/manifest.json', 'w', encoding='utf-8', newline='\n').write(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')

# --- Отдельная тестовая Цитадель (не заменяет основную игру)
citadel = open('prototype/citadel.html', encoding='utf-8').read()
for name in ['citadel.js', 'citadel-life.js', 'citadel-weather.js']:
    shutil.copy(f'{SRC}/{name}', f'{DIST}/{name}')
    # Встраиваем код в HTML: тестовая страница работает даже из локального ZIP/файла.
    source = open(f'{SRC}/{name}', encoding='utf-8').read()
    citadel = citadel.replace(f'<script src="../src/{name}"></script>', '<script>\n' + source + '\n</script>')
citadel = citadel.replace('</head>', '<meta name="theme-color" content="#100c18"></head>')
open(f'{DIST}/citadel.html', 'w', encoding='utf-8', newline='\n').write(citadel)

# Original scenery and sprites are first-party offline shell assets.
shutil.copy(f'{SRC}/citadel-art.css', f'{DIST}/citadel-art.css')
shutil.copy(f'{SRC}/rpg-ui.css', f'{DIST}/rpg-ui.css')
shutil.copytree(f'{SRC}/assets', f'{DIST}/assets')

# Export one painted pose per SVG. The original sheets remain the art source.
svg = '{http://www.w3.org/2000/svg}'
ET.register_namespace('', svg[1:-1])
poses = ('idle', 'talk', 'walk-1', 'walk-2', 'work', 'rest')
for actor in ('guardian', 'archivist', 'smith', 'treasurer'):
    art = Path(DIST, 'assets/citadel')
    sheet = ET.parse(art / f'{actor}.svg').getroot()
    frames = list(sheet)
    if sheet.get('viewBox') != '0 0 144 40' or len(frames) != len(poses):
        raise ValueError(f'Unexpected resident sprite sheet: {actor}')
    for i, (pose, frame) in enumerate(zip(poses, frames)):
        if frame.tag != svg + 'g' or frame.attrib.pop('transform', None) != f'translate({24 * i} 0)':
            raise ValueError(f'Unexpected resident frame: {actor}-{pose}')
        image = ET.Element(svg + 'svg', {**sheet.attrib, 'width': '24', 'viewBox': '0 0 24 40'})
        image.append(frame)
        ET.ElementTree(image).write(art / f'{actor}-{pose}.svg', encoding='utf-8')

# --- sw.js с версией = хэш содержимого
shell = ['index.html', 'manifest.json', 'config.js', 'localdb.js', 'save-history.js', 'cloud-sync.js', 'cloud-firebase.js', 'awakening.js', 'citadel-world.js', 'citadel-space.js', 'legends.js', 'fate.js', 'portrait.js', 'realm-achievements.js', 'ascension.js', 'shelter-items.js', 'forge-awards.js', 'forge-art.js', 'chains.js', 'chains-ui.js', 'chains.css', 'food.js', 'food-ui.js', 'room-workspace.js', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'citadel.html', 'citadel.js', 'citadel-life.js', 'citadel-weather.js']
shell += ['citadel-art.css', 'rpg-ui.css'] + ['assets/citadel/' + name for name in sorted(os.listdir(f'{DIST}/assets/citadel'))]
h = hashlib.sha256()
for f in sorted(set(shell) - {'./'}):
    h.update(open(f'{DIST}/{f}', 'rb').read())
# Worker logic changes must also receive a fresh cache identity.
h.update(open(f'{SRC}/sw.template.js', 'rb').read())
ver = h.hexdigest()[:10]
sw = open(f'{SRC}/sw.template.js', encoding='utf-8').read().replace('__VERSION__', ver).replace('__SHELL__', json.dumps(shell)).replace('__APP_BUILD__', build_id)
open(f'{DIST}/sw.js', 'w', encoding='utf-8', newline='\n').write(sw)
print('built', ver, os.listdir(DIST))
