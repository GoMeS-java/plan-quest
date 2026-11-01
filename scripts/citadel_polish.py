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
                rect(10, 11, 3, 1, '#f3d6b2'), rect(15, 11, 2, 1, '#d49c82'),
                rect(9, 9, 2, 1, '#302838'), rect(15, 9, 2, 1, '#302838'),
                rect(13, 13, 2, 1, '#a97372'), rect(10, 15, 6, 1, '#b88679'),
                rect(7, 6, 2, 3, '#443744'), rect(17, 5, 2, 4, '#292335'),
                rect(8, 18, 2, 2, glint), rect(15, 18, 2, 2, trim),
                rect(7, 26, 2, 2, '#252236'), rect(16, 26, 2, 2, '#252236'),
                rect(8, 34, 2, 2, trim), rect(16, 34, 2, 2, trim)]
        if name == 'guardian':
            bits += [rect(4, 19, 2, 11, '#a6a7b5'), rect(5, 17, 3, 2, glint),
                     rect(16, 20, 4, 3, '#515775'), rect(17, 20, 2, 1, glint),
                     rect(19 if work else 20, 18 if work else 17, 2, 14, '#9e907e'),
                     rect(5, 15, 3, 3, '#4a496c'), rect(18, 16, 2, 3, '#b7b1b7'),
                     rect(11, 23, 2, 4, '#a8a8b6'), rect(14, 23, 1, 4, '#3a3954'),
                     rect(7, 2, 9, 1, '#48425d'), rect(11, 3, 3, 1, '#777087')]
            if work: bits += [rect(20, 15 if i == 4 else 13, 2, 3, '#d1c3a8'),rect(19, 20, 2, 2, '#ecd2a1')]
        elif name == 'archivist':
            bits += [rect(5, 20, 2, 10, accent), rect(4, 28, 4, 2, trim),
                     rect(18, 23 if work else 26, 4, 5, '#c8b28f'),
                     rect(19, 25 if work else 28, 2, 1, '#795f70'),
                     rect(4, 4, 3, 13, '#6c4b5f'), rect(6, 3, 7, 1, '#a77f7c'),
                     rect(6, 18, 2, 11, '#a1849e'), rect(17, 18, 2, 9, '#4a3155'),
                     rect(10, 23, 4, 1, '#c7a982'), rect(11, 24, 2, 2, '#f0d0a1')]
            if work: bits += [rect(16, 23 if i == 4 else 21, 6, 2, '#e4cd9e'),rect(17, 22 if i == 4 else 20, 1, 2, '#795071')]
        elif name == 'smith':
            bits += [rect(8, 22, 9, 7, '#49312e'), rect(9, 23, 2, 4, '#b37a54'),
                     rect(19, 19 if work else 23, 2, 11, '#907f82'),
                     rect(18, 19 if work else 22, 4, 2, '#c4b1a2'),
                     rect(6, 16, 2, 10, '#765047'), rect(17, 18, 2, 9, '#9e6652'),
                     rect(11, 19, 2, 8, '#b9876b'), rect(15, 19, 2, 8, '#5a382f'),
                     rect(8, 28, 9, 2, '#aa7450'), rect(8, 3, 7, 1, '#644b47')]
            if work: bits += [rect(18, 16 if i == 4 else 12, 4, 2, '#dac4a8'),rect(20, 15 if i == 4 else 11, 2, 2, '#e9aa60')]
        else:
            bits += [rect(8, 24, 9, 2, '#c1a05f'), rect(12, 25, 2, 2, '#f5db95'),
                     rect(19, 25 if work else 27, 3, 4, '#b79861'),
                     rect(19, 26 if work else 28, 2, 1, '#f2d990'),
                     rect(8, 1, 10, 2, '#35615d'), rect(10, 2, 5, 1, '#d1bb83'),
                     rect(5, 18, 2, 10, '#386661'), rect(18, 18, 2, 9, '#9db5a0'),
                     rect(10, 20, 2, 4, '#9da48a'), rect(15, 20, 2, 4, '#395c59'),
                     rect(9, 28, 7, 2, '#dac380')]
            if work: bits += [rect(19, 22 if i == 4 else 20, 3, 2, '#f5d990'),rect(18, 24 if i == 4 else 22, 2, 1, '#6d875f')]
        if moving:
            bits += [rect(4, 37, 5, 1, '#4a4056'), rect(17, 37, 5, 1, '#4a4056'),
                     rect(3 if i == 2 else 5, 24, 2, 6, trim),
                     rect(18 if i == 2 else 20, 27, 2, 5, accent),
                     rect(5 if i == 2 else 15, 36, 5, 2, '#141522')]
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
        bits += [rect(xx, yy, 20-xx, 4, '#292b3c'),
                 rect(xx, yy, 20-xx, 2, '#8e8796'),
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
