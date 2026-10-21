#!/usr/bin/env python3
"""Собирает dist/: index.html из game.html, sw.js с хэшем, иконки, манифест."""
import hashlib, json, os, re, shutil, sys
from PIL import Image, ImageDraw

SRC = 'src'; DIST = 'docs'
if os.path.exists(DIST): shutil.rmtree(DIST)
os.makedirs(DIST)

# --- index.html
g = open(f'{SRC}/game.html', encoding='utf-8').read()
i = g.index('</style>') + len('</style>')
head_part, body_part = g[:i], g[i:]
head_part = head_part.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
html = ('<!doctype html>\n<html lang="ru"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<meta name="theme-color" content="#1a1511">'
        '<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes">'
        '<link rel="manifest" href="manifest.json"><link rel="icon" href="icon-192.png">'
        '<link rel="apple-touch-icon" href="icon-192.png">'
        '<script src="config.js"></script><script src="localdb.js"></script>\n'
        + head_part + '</head><body>' + body_part + '\n</body></html>\n')
open(f'{DIST}/index.html', 'w', encoding='utf-8').write(html)

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

for f in ['manifest.json', 'config.js', 'localdb.js']:
    shutil.copy(f'{SRC}/{f}', f'{DIST}/{f}')

# --- sw.js с версией = хэш содержимого
shell = ['./', 'index.html', 'manifest.json', 'config.js', 'localdb.js', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png']
h = hashlib.sha256()
for f in sorted(set(shell) - {'./'}):
    h.update(open(f'{DIST}/{f}', 'rb').read())
ver = h.hexdigest()[:10]
sw = open(f'{SRC}/sw.template.js', encoding='utf-8').read().replace('__VERSION__', ver).replace('__SHELL__', json.dumps(shell))
open(f'{DIST}/sw.js', 'w', encoding='utf-8').write(sw)
print('built', ver, os.listdir(DIST))
