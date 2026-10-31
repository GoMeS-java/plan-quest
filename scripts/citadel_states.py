"""Generate editable, room-specific pixel layers for the 30 existing room states."""
from pathlib import Path

ROOT = Path('src/assets/citadel')
ROOMS = ('throne', 'observatory', 'rest', 'study', 'archive', 'forge',
         'gatehouse', 'refectory', 'cloister', 'vault')
INK, STONE, DUST, GOLD, PURPLE = '#11121d', '#454459', '#7a7180', '#c7a46f', '#a66bc0'


def rect(x, y, w, h, c, opacity=None):
    alpha = f' opacity="{opacity}"' if opacity else ''
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{c}"{alpha}/>'


def path(d, c, opacity=None):
    alpha = f' opacity="{opacity}"' if opacity else ''
    return f'<path d="{d}" fill="{c}"{alpha}/>'


def emblem(x, y, color):
    return (rect(x + 6, y, 4, 18, color) + rect(x, y + 6, 16, 4, color)
            + rect(x + 4, y + 18, 8, 3, color))


def torch(x, y):
    return (rect(x, y + 8, 4, 27, STONE) + rect(x - 5, y + 8, 14, 4, GOLD)
            + rect(x, y, 4, 10, '#e9945b') + rect(x + 1, y - 5, 2, 7, '#ffe0a0'))


def chair(x, y, c):
    return (rect(x, y, 12, 35, c) + rect(x + 2, y + 22, 20, 5, GOLD)
            + rect(x + 3, y + 27, 3, 16, c) + rect(x + 18, y + 27, 3, 16, c))


def room_detail(room, tier):
    """Small, readable pixel props anchored to the same furniture in all three states."""
    pieces = []
    shadow = '#24202d'
    metal = '#8d8195' if tier == 0 else ('#b4a08c' if tier == 1 else '#e1b976')
    fabric = '#49344c' if tier == 0 else ('#795171' if tier == 1 else '#a6558a')
    light = '#665b66' if tier == 0 else ('#d99b61' if tier == 1 else '#ffe0a0')

    # Broken joints remain visible in ruins; repaired masonry gains alternating
    # mortar and highlights instead of an unrelated full-screen color wash.
    for row, yy in enumerate((31, 55, 80, 108, 138)):
        for col in range(9):
            xx = 11 + col * 54 + (26 if row % 2 else 0)
            if xx < 468 and ((col * 7 + row * 3) % 4 != 0 or tier > 0):
                pieces.append(rect(xx, yy, 15 + (col % 3) * 5, 2,
                                   '#8b7583' if tier else '#575262', '.34'))
                if tier == 0 and (col + row) % 3 == 0:
                    pieces.append(path(f'M{xx+7} {yy+2}v6h4v5', shadow, '.7'))
    for xx in range(36, 454, 38):
        pieces.append(rect(xx, 188, 18, 2, metal, '.6'))
        if tier > 0:
            pieces.append(rect(xx+3, 191, 8, 2, '#372c39'))

    if room == 'throne':
        for xx in (139, 324):
            pieces += [path(f'M{xx} 30h25v48l-12 13-13-13z', fabric, '.9'),
                       rect(xx+3, 35, 19, 3, metal), rect(xx+11, 47, 3, 23, metal)]
            if tier == 0:
                pieces.append(path(f'M{xx+3} 71l6 7 5-5 4 8 5-10', shadow))
            else:
                pieces.append(emblem(xx+5, 48, light))
        pieces += [rect(224, 119, 34, 4, metal), rect(209, 157, 64, 3, light),
                   rect(228, 133, 26, 4, fabric)]
    elif room == 'observatory':
        # Telescope tube, brass eyepiece, compass and the chart pinned behind it.
        pieces += [path('M223 96l78-31 4 8-78 32z', shadow),
                   path('M229 96l72-29 2 3-73 30z', metal),
                   rect(301, 64, 8, 10, metal), rect(270, 91, 5, 40, metal),
                   rect(254, 130, 38, 3, metal), rect(355, 132, 49, 3, fabric)]
        for i in range(9):
            pieces.append(rect(353+(i*17)%52, 39+(i*23)%60, 2, 2, light, '.8'))
        if tier > 0:
            pieces += [path('M360 105h45v2h-45zM381 85h2v43h-2z', metal),
                       rect(384, 91, 5, 5, light)]
    elif room == 'rest':
        pieces += [rect(151, 153, 111, 5, fabric), rect(155, 147, 36, 7, '#b1a2a1' if tier == 0 else '#e2d0b6'),
                   rect(149, 165, 118, 3, metal), rect(112, 148, 24, 4, metal),
                   rect(115, 152, 4, 19, shadow), rect(131, 152, 4, 19, shadow)]
        for xx in (134, 260):
            pieces += [rect(xx, 43, 4, 91, metal, '.8'), rect(xx-5, 39, 14, 4, fabric)]
        for xx in range(163, 258, 17):
            pieces.append(rect(xx, 158, 7, 2, light, '.7'))
    elif room == 'study':
        pieces += [rect(200, 128, 120, 6, metal), rect(211, 134, 5, 34, shadow),
                   rect(303, 134, 5, 34, shadow), rect(234, 120, 41, 4, '#d0bea5'),
                   path('M244 111l3 8 2-8 4-6z', light), rect(272, 112, 3, 13, metal)]
        for i in range(13):
            xx = 344 + (i*11)%53
            yy = 91 + (i//5)*16
            pieces.append(rect(xx, yy, 3+(i%3), 12, (fabric, metal, light)[i%3]))
    elif room == 'archive':
        for shelf in (56, 95, 133):
            for i in range(17):
                xx = 22 + i*25
                if 180 < xx < 296: continue
                pieces.append(rect(xx, shelf, 3+(i%3), 11+(i%2)*3,
                                   (fabric, metal, '#6e8794', light)[(i+shelf)%4]))
                if i%4 == 0: pieces.append(rect(xx, shelf+4, 4, 2, light))
        pieces += [rect(176, 146, 31, 4, metal), rect(180, 151, 3, 28, metal),
                   rect(201, 151, 3, 28, metal)]
    elif room == 'forge':
        pieces += [path('M158 114h128v2H158zM165 122h113v2H165z', metal, '.8'),
                   rect(188, 142, 68, 3, '#a95c39' if tier else '#59404a'),
                   rect(202, 135, 41, 5, light, '.8'),
                   path('M307 146h38v6h-12v8h-16v-8h-10z', metal),
                   rect(319, 160, 5, 25, shadow)]
        for i in range(13):
            xx = 187 + (i*19)%70
            yy = 133 + (i*13)%26
            pieces.append(rect(xx, yy, 2+(i%2), 2, light, '.8'))
        for xx in (366, 380, 394):
            pieces.append(path(f'M{xx} 67v35h3V67z', metal))
    elif room == 'gatehouse':
        for xx in range(166, 321, 18):
            pieces += [rect(xx, 49, 4, 108, metal, '.8'), rect(xx-3, 95, 10, 3, shadow)]
        pieces += [path('M149 47h180v8H149zM149 151h180v5H149z', shadow),
                   rect(225, 76, 31, 34, fabric), emblem(232, 81, light)]
        if tier > 0:
            for xx in (124, 342): pieces += [rect(xx, 143, 24, 4, metal), rect(xx+5, 148, 4, 22, metal)]
    elif room == 'refectory':
        pieces += [rect(98, 133, 280, 3, '#674a3d' if tier == 0 else '#aa7950'),
                   rect(111, 141, 8, 29, shadow), rect(358, 141, 8, 29, shadow)]
        for xx in (128, 190, 250, 311):
            pieces += [rect(xx, 129, 20, 3, metal), rect(xx+8, 122, 3, 7, light)]
            if tier > 0: pieces.append(rect(xx+4, 125, 12, 3, '#d8c7a5'))
        pieces += [rect(233, 36, 4, 48, metal), rect(208, 83, 54, 4, metal)]
        for xx in (210, 234, 258): pieces.append(rect(xx, 76, 3, 8, light))
    elif room == 'cloister':
        for xx in (65, 139, 324, 395):
            pieces += [rect(xx, 47, 6, 113, metal, '.7'), rect(xx-7, 44, 20, 5, metal),
                       rect(xx-9, 159, 24, 5, shadow)]
        pieces += [path('M207 156h66v2h-66zM219 161h42v2h-42z', metal),
                   rect(237, 137, 5, 21, '#6d93a3' if tier else '#595e71')]
        for i in range(15):
            xx = 57 + (i*47)%366
            yy = 155 + (i*7)%19
            pieces.append(rect(xx, yy, 4+(i%3)*2, 3, '#4d8065' if tier else '#485650'))
    elif room == 'vault':
        for xx, yy, ww in ((105, 137, 76), (285, 133, 77)):
            pieces += [rect(xx, yy, ww, 3, metal), rect(xx+2, yy+17, ww-4, 2, shadow),
                       rect(xx+4, yy+25, ww-8, 2, metal), rect(xx, yy, ww, 5, metal), rect(xx+4, yy+8, ww-8, 2, metal),
                       rect(xx+ww//2-3, yy+12, 6, 11, light)]
        for i in range(20 if tier == 2 else 7):
            xx = 188+(i*31)%92
            yy = 166-(i*7)%12
            pieces.append(rect(xx, yy, 7, 3, metal))
    if tier == 2:
        # A restrained inlaid frieze and lit floor replace the old universal gold bars.
        for xx in range(75, 423, 22):
            pieces += [rect(xx, 22, 8, 2, metal, '.8'), rect(xx+4, 25, 2, 3, fabric),
                       rect(xx, 177, 11, 2, light, '.7')]
    return ''.join(pieces)


def stage(room, tier):
    art = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 200" shape-rendering="crispEdges">']
    if tier == 0:
        # Damage stays on the same architecture: debris, broken silhouettes and darkened fixtures.
        art.append('<g opacity=".35">')
        art.extend((rect(0, 185, 480, 15, INK, '.38'),
                    path('M13 184h23v-8h13v8h20v5H13zM367 187h28v-9h19v9h18v5h-65z', STONE),
                    path('M24 11h15v3H24zM39 14h3v14h-3zM42 27h20v3H42zM435 18h25v3h-25zM435 21h3v15h-3z', DUST),
                    rect(58, 151, 39, 4, DUST, '.7'), rect(351, 161, 42, 3, DUST, '.7')))
        for x, y in ((84, 87), (389, 105), (277, 69)):
            art.append(path(f'M{x} {y}h3v7h7v3h-7v7h-3z', '#777082', '.65'))
        art.append('</g>')
    elif tier == 1:
        # Repaired floors, practical objects and a restrained color accent for each profession.
        # The room-specific furniture is drawn by room_detail below; the
        # legacy block silhouettes would conceal the detailed base artwork.
        for x in (35, 435):
            art.append(torch(x, 110))
    else:
        # Purchased grandeur adds a room-specific focal piece and stronger architecture.
        # Grand accents are in room_detail and the restrained upgrade3 layer.
        for x in (43, 427):
            art.append(torch(x, 99))
    art.append(room_detail(room, tier))
    art.append('</svg>')
    return ''.join(art) + '\n'


for room in ROOMS:
    for tier in range(3):
        (ROOT / f'{room}-scene{tier}.svg').write_text(stage(room, tier), encoding='utf-8')

style = Path('src/citadel-art.css')
marker = '\n/* Generated room-specific pixel layers: scripts/citadel_states.py */\n'
original = style.read_text(encoding='utf-8').split(marker)[0]
rules = [
    '.citadel-room[data-room-level="1"]:after{background:var(--scene-art) center/100% 100%,url("assets/citadel/abandoned.svg") center/100% 100%!important}',
    '.citadel-room[data-room-level="2"]:after,.citadel-room[data-room-level="3"]:after{background:var(--scene-art) center/100% 100%,var(--renovation) center/100% 100%!important}',
    '.citadel-interior-stage[data-level="1"]:after{background:var(--scene-art) center/100% 100%,url("assets/citadel/abandoned.svg") center/100% 100%,linear-gradient(transparent 55%,#090b17a8)}',
    '.citadel-interior-stage[data-level="2"] .citadel-interior-renovation,.citadel-interior-stage[data-level="3"] .citadel-interior-renovation{background:var(--scene-art) center/100% 100%,var(--renovation) center/100% 100%!important}',
]
for room in ROOMS:
    for tier in range(3):
        level = tier + 1
        rules.append(f'[data-croom="{room}"][data-room-level="{level}"],.citadel-interior-stage[data-room="{room}"][data-level="{level}"]{{--scene-art:url("assets/citadel/{room}-scene{tier}.svg")}}')
style.write_text(original + marker + '\n'.join(rules) + '\n', encoding='utf-8')
