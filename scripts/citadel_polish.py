"""Refine the existing compact actor sheets and stone stairwell, without changing routes."""
from pathlib import Path
import re

ROOT = Path('src/assets/citadel')

def rect(x, y, w, h, color):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{color}"/>'

def actor(name, colors):
    path = ROOT / f'{name}.svg'
    original = path.read_text()
    original = re.sub(r'<g data-polish="1">.*?</g>', '', original)
    trim, glint, accent = colors
    frames = []
    for i in range(6):
        # Six sheets already encode idle, walking and work poses. Small
        # differences in the trim and equipment make those frames readable.
        moving = i in (2, 3)
        work = i in (4, 5)
        bits = [rect(6, 38, 14, 1, '#070912'),
                rect(7, 17, 1, 12, trim), rect(17, 17, 1, 12, '#2b2839'),
                rect(9, 20, 7, 1, glint), rect(9, 29, 8, 2, trim),
                rect(11, 30, 3, 1, accent), rect(6, 33, 3, 2, '#1b1827'),
                rect(16, 33, 3, 2, '#1b1827'),
                rect(10, 11, 3, 1, '#f3d6b2'), rect(15, 11, 2, 1, '#d49c82')]
        if name == 'guardian':
            bits += [rect(4, 19, 2, 11, '#a6a7b5'), rect(5, 17, 3, 2, glint),
                     rect(16, 20, 4, 3, '#515775'), rect(17, 20, 2, 1, glint),
                     rect(19 if work else 20, 18 if work else 17, 2, 14, '#9e907e')]
        elif name == 'archivist':
            bits += [rect(5, 20, 2, 10, accent), rect(4, 28, 4, 2, trim),
                     rect(18, 23 if work else 26, 4, 5, '#c8b28f'),
                     rect(19, 25 if work else 28, 2, 1, '#795f70')]
        elif name == 'smith':
            bits += [rect(8, 22, 9, 7, '#49312e'), rect(9, 23, 2, 4, '#b37a54'),
                     rect(19, 19 if work else 23, 2, 11, '#907f82'),
                     rect(18, 19 if work else 22, 4, 2, '#c4b1a2')]
        else:
            bits += [rect(8, 24, 9, 2, '#c1a05f'), rect(12, 25, 2, 2, '#f5db95'),
                     rect(19, 25 if work else 27, 3, 4, '#b79861'),
                     rect(19, 26 if work else 28, 2, 1, '#f2d990')]
        if moving:
            bits += [rect(4, 37, 5, 1, '#4a4056'), rect(17, 37, 5, 1, '#4a4056')]
        frames.append('<g data-polish="1">'+''.join(bits)+'</g>')
    pos = iter(frames)
    # The input sheets contain exactly six top-level frame groups.
    output = re.sub(r'</g>', lambda _: next(pos), original, count=6)
    # Restore the frame closing tags after each inserted detail group.
    output = output.replace('</g><g transform=', '</g></g><g transform=')
    output = output.replace('</g></svg>', '</g></g></svg>')
    path.write_text(output)

for name, colors in {
    'guardian': ('#797c9b', '#d0c7b4', '#a75975'),
    'archivist': ('#7c638b', '#c4a6ca', '#aa8a6b'),
    'smith': ('#9b604d', '#d2a37c', '#5b5559'),
    'treasurer': ('#608d81', '#b9d3ad', '#e0bf72'),
}.items():
    actor(name, colors)

bits = ['<svg xmlns="http://www.w3.org/2000/svg" width="24" height="128" viewBox="0 0 24 128" shape-rendering="crispEdges">',
        rect(0, 0, 24, 128, '#141725'), rect(0, 0, 3, 128, '#414155'),
        rect(21, 0, 3, 128, '#302c43'), rect(3, 0, 1, 128, '#847885'),
        rect(20, 0, 1, 128, '#655c70')]
for y in range(0, 128, 64):
    for step in range(16):
        rise = step if step < 8 else 15-step
        xx = 3 + rise * 2
        yy = y + step * 4
        if xx > 19: xx = 19
        bits += [rect(4, yy, 16, 4, '#252839'),
                 rect(xx, yy, 19-xx, 2, '#8e8796'),
                 rect(xx+1, yy+2, 18-xx, 1, '#54566b'),
                 rect(xx, yy+3, 19-xx, 1, '#242637')]
        if step % 2 == 0:
            bits.append(rect(5, yy+2, 3, 1, '#5b566a'))
    bits += [rect(4, y+30, 16, 2, '#a69aa0'),
             rect(4, y+32, 16, 2, '#49475c')]
for y in range(4, 128, 16):
    bits += [rect(0, y, 3, 2, '#8d8293'), rect(21, y+6, 3, 2, '#62576d')]
bits.append('</svg>')
(ROOT / 'stairs.svg').write_text(''.join(bits)+'\n')
