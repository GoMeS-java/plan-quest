"""Build the original, editable pixel roof scene used by the Citadel cutaway."""
from pathlib import Path

parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 120" shape-rendering="crispEdges">']

def rect(x, y, w, h, fill):
    parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}"/>')

def path(d, fill):
    parts.append(f'<path d="{d}" fill="{fill}"/>')

ink, stone, lit, edge = '#111326', '#333149', '#69617c', '#867891'

# The parapet remains continuous across both rooms and the central stairwell.
rect(0, 99, 800, 21, ink)
rect(0, 99, 800, 3, edge)
rect(0, 106, 800, 3, stone)
for x in range(0, 800, 28):
    rect(x, 81, 17, 19, stone)
    rect(x, 81, 17, 2, edge)
    rect(x + 2, 89, 12, 2, '#4a455e')
    rect(x + 6, 111, 18, 2, '#4c4863')
for x in range(14, 800, 42):
    rect(x, 104, 2, 7, '#6c647f')

def tower(x, w, top, roof, window):
    rect(x, top + 18, w, 83 - top, ink)
    rect(x + 4, top + 22, w - 8, 60 - top, stone)
    path(f'M{x - 7} {top + 22}h{w + 14}l-8 -8h-5l-9 -13h-7l-8 -12h-9l-8 12h-7l-9 13h-5z', roof)
    rect(x - 7, top + 21, w + 14, 3, edge)
    rect(x + 3, top + 27, 3, 53 - top, '#7c708b')
    rect(x + w - 6, top + 27, 3, 53 - top, '#1c1d32')
    for yy in range(top + 29, 77, 12):
        rect(x + 11, yy, max(7, w - 24), 2, '#4b4762')
    wx = x + w // 2 - 5
    rect(wx - 2, window, 14, 24, '#0b0b1a')
    rect(wx, window + 3, 10, 17, '#925789')
    rect(wx + 2, window + 5, 6, 12, '#e1a075')
    rect(wx + 4, window + 3, 2, 17, '#523c60')
    rect(wx - 2, window + 19, 14, 3, edge)
    for xx in range(x + 2, x + w - 1, 13):
        rect(xx, 78, 9, 5, lit)

tower(7, 67, 19, '#191a30', 48)
tower(726, 67, 12, '#1a1b32', 43)
tower(147, 45, 37, '#232239', 58)
tower(607, 45, 34, '#27243d', 55)

# Central sanctuary is asymmetrical and taller than the surrounding turrets.
rect(352, 47, 97, 35, ink)
path('M339 49h15V37h9V28h9V16h9V7h10V0h8v7h10v9h9v12h9v9h10v12h14v31H339z', '#1d1b35')
path('M355 47h8V35h9V25h9V15h9V8h10v7h9v10h9v10h9v12h8v32H355z', stone)
path('M365 43h6V33h8V23h8V13h17v10h8v10h8v10h6', '#716486')
rect(389, 4, 4, 14, '#a168bb')
rect(383, 23, 34, 48, ink)
path('M387 68V40l5 -10h16l5 10v28z', '#5a3b70')
path('M392 64V43l4 -8h9l4 8v21z', '#a466b8')
rect(399, 39, 3, 25, '#dc9cc7')
rect(383, 69, 34, 4, edge)
for x in (348, 435):
    rect(x, 48, 6, 30, '#55506e')
    rect(x - 3, 43, 12, 5, '#857591')

# Bridges, gargoyles, and a warm torch rhythm connect the upper rooms.
for x, w in ((78, 65), (197, 135), (467, 134), (656, 67)):
    rect(x, 75, w, 5, ink)
    rect(x, 75, w, 2, edge)
    for xx in range(x + 4, x + w - 4, 18):
        rect(xx, 72, 7, 4, stone)
for x in (230, 551):
    path(f'M{x} 72h6v-8h5v-9h8v7h7v8h5v5h-7v7h-5l-3 -5h-8l-4 7h-5z', ink)
    rect(x + 12, 66, 3, 2, '#b379a4')
for x in (117, 314, 491, 687):
    rect(x, 65, 5, 15, '#595067')
    rect(x - 3, 62, 11, 4, '#a48674')
    rect(x, 54, 5, 9, '#edac6b')
    rect(x + 1, 50, 3, 5, '#ffe1a2')

parts.append('</svg>')
Path('src/assets/citadel/roof.svg').write_text(''.join(parts) + '\n', encoding='utf-8')
