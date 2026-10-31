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
        pieces += [path('M158 114h128v8H158zM165 122h113v42H165z', shadow, '.9'),
                   rect(188, 142, 68, 13, '#7d382f' if tier else '#452b31'),
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
        pieces += [rect(98, 133, 280, 8, '#674a3d' if tier == 0 else '#aa7950'),
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
        pieces += [path('M207 156h66v5h-66zM219 161h42v17h-42z', metal),
                   rect(237, 137, 5, 21, '#6d93a3' if tier else '#595e71')]
        for i in range(15):
            xx = 57 + (i*47)%366
            yy = 155 + (i*7)%19
            pieces.append(rect(xx, yy, 4+(i%3)*2, 3, '#4d8065' if tier else '#485650'))
    elif room == 'vault':
        for xx, yy, ww in ((105, 137, 76), (285, 133, 77)):
            pieces += [rect(xx, yy, ww, 33, '#624b42' if tier else shadow),
                       rect(xx, yy, ww, 5, metal), rect(xx+4, yy+8, ww-8, 2, metal),
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
        ruins = {
            'throne': (rect(212, 84, 55, 54, INK, '.83') + path('M218 138V96h8v-13h6v26h11V91h7v47z', STONE)
                       + path('M165 20h18v63h-8V51h-10zM333 18h16v69h-8V50h-8z', '#261c31')
                       + rect(223, 138, 72, 6, DUST)),
            'observatory': (path('M223 95h95v12h-95zM229 107h82v5h-82z', INK)
                            + path('M240 86h34v8h-34zM283 80h23v6h-23zM277 89h6v22h-6z', STONE)
                            + rect(199, 140, 54, 5, DUST)),
            'rest': (path('M118 76h24v64h-12v-42h-12zM146 142h132v27H146z', '#251a29')
                     + path('M160 153h50v8h-50zM235 153h30v8h-30zM122 31h20v43h-7V51h-13z', DUST)
                     + rect(153, 170, 111, 5, INK)),
            'study': (path('M193 118h126v28H193zM202 146h24v25h-24zM301 146h12v25h-12z', '#191825')
                      + path('M215 120h50v8h-50zM278 126h34v5h-34zM344 89h42v55h-42z', STONE)
                      + rect(222, 147, 41, 5, DUST)),
            'archive': (path('M10 37h65v125H10zM400 25h67v139h-67z', '#171a29')
                        + path('M18 81h48v4H18zM414 64h42v5h-42zM415 122h35v7h-35z', DUST)
                        + rect(194, 161, 64, 7, STONE)),
            'forge': (path('M154 95h147v75H154z', '#19161d', '.89')
                      + path('M170 117h116v43H170z', '#25202a')
                      + path('M294 151h53v10h-53zM307 161h7v24h-7zM338 161h7v24h-7z', STONE)
                      + rect(180, 161, 82, 4, DUST)),
            'gatehouse': (path('M164 44h12v112h-12zM201 40h10v118h-10zM238 40h11v118h-11zM277 44h12v112h-12z', '#353041')
                          + path('M148 157h58v15h-58zM273 155h67v17h-67z', STONE)
                          + rect(220, 165, 32, 7, DUST)),
            'refectory': (path('M98 129h281v27H98zM117 157h16v28h-16zM348 157h16v28h-16z', '#201c28')
                           + path('M100 136h75v7h-75zM256 132h95v6h-95z', DUST)
                           + rect(177, 158, 56, 5, STONE)),
            'cloister': (path('M68 149h48v34H68zM296 156h75v28h-75z', '#242333')
                         + path('M54 36h10v61h-10zM74 40h8v48h-8zM347 42h10v57h-10z', '#3e3544')
                         + path('M120 169h46v4h-46zM194 177h63v5h-63z', DUST)),
            'vault': (path('M97 131h96v45H97zM274 129h91v48h-91z', '#171724')
                      + path('M103 137h72v7h-72zM291 140h65v7h-65z', STONE)
                      + rect(209, 163, 76, 10, DUST)),
        }
        art.append(ruins[room])
        for x, y in ((84, 87), (389, 105), (277, 69)):
            art.append(path(f'M{x} {y}h3v7h7v3h-7v7h-3z', '#777082', '.65'))
        art.append('</g>')
    elif tier == 1:
        # Repaired floors, practical objects and a restrained color accent for each profession.
        art.extend((rect(68, 180, 342, 4, '#74677c', '.8'),
                    rect(120, 184, 230, 3, '#966f6b', '.7')))
        restored = {
            'throne': rect(200, 149, 80, 12, '#6d3a5e') + rect(227, 143, 27, 5, GOLD) + torch(180, 112),
            'observatory': path('M286 120h36v5h-36zM294 125h4v40h-4zM316 125h4v40h-4z', GOLD) + rect(338, 145, 44, 5, '#667794'),
            'rest': rect(149, 151, 118, 12, '#77506c') + rect(153, 145, 35, 8, '#e3d3ba') + rect(109, 167, 28, 5, GOLD),
            'study': rect(210, 122, 103, 5, '#aa8867') + rect(238, 116, 31, 7, '#ddd1b2') + rect(292, 106, 5, 16, '#b99964'),
            'archive': rect(121, 99, 42, 5, GOLD) + rect(132, 84, 4, 15, '#c48570') + rect(141, 86, 6, 13, '#7f86a3') + rect(250, 158, 78, 5, '#795d53'),
            'forge': rect(176, 126, 95, 36, '#803e2c', '.6') + rect(214, 140, 45, 16, '#ce7441') + rect(315, 150, 41, 6, '#8b8a91'),
            'gatehouse': rect(162, 48, 5, 102, '#8d8298') + rect(308, 48, 5, 102, '#8d8298') + path('M357 108h5v46h-5zM347 127h25v5h-25z', GOLD),
            'refectory': rect(118, 132, 242, 8, '#895c46') + rect(196, 125, 30, 7, '#c1a06c') + rect(297, 125, 24, 7, '#e8d3a9'),
            'cloister': path('M78 149h31v29H78zM303 154h57v27h-57z', '#31534b') + rect(169, 167, 137, 4, '#6e8a66') + rect(228, 151, 6, 16, '#7e9e72'),
            'vault': rect(130, 137, 52, 27, '#73523d') + rect(137, 140, 38, 5, GOLD) + rect(301, 139, 50, 22, '#6c5360'),
        }
        art.append(restored[room])
        for x in (35, 435):
            art.append(torch(x, 110))
    else:
        # Purchased grandeur adds a room-specific focal piece and stronger architecture.
        art.extend((path('M42 25h23v4H42zM415 25h23v4h-23z', GOLD),
                    rect(110, 179, 260, 4, '#b08267'),
                    rect(180, 185, 120, 4, '#6b326a')))
        grand = {
            'throne': emblem(230, 83, GOLD) + rect(185, 151, 110, 15, '#8c396e') + rect(230, 148, 25, 3, '#f3d9a0'),
            'observatory': path('M194 47h65v4h-65zM225 37h4v23h-4zM293 110h43v4h-43z', GOLD) + emblem(352, 71, PURPLE),
            'rest': path('M103 44h177v5H103zM103 49h5v54h-5zM275 49h5v54h-5z', GOLD) + rect(157, 155, 105, 9, '#b34d79') + emblem(300, 39, GOLD),
            'study': path('M207 114h107v4H207zM207 117h4v42h-4zM310 117h4v42h-4z', GOLD) + emblem(367, 39, PURPLE),
            'archive': path('M21 54h58v4H21zM401 55h58v4h-58z', GOLD) + rect(219, 141, 49, 5, '#b48758') + emblem(230, 54, PURPLE),
            'forge': path('M169 105h112v5H169zM166 110h6v61h-6zM278 110h6v61h-6z', GOLD) + rect(209, 130, 51, 23, '#b55b41') + emblem(366, 58, PURPLE),
            'gatehouse': path('M146 53h7v101h-7zM326 53h7v101h-7zM146 53h187v5H146z', GOLD) + emblem(244, 77, PURPLE),
            'refectory': path('M111 125h256v5H111zM129 129h5v44h-5zM343 129h5v44h-5z', GOLD) + emblem(231, 40, GOLD),
            'cloister': path('M86 155h24v24H86zM306 154h50v26h-50z', '#56947b') + rect(174, 163, 128, 4, GOLD) + emblem(230, 52, PURPLE),
            'vault': path('M126 131h61v4h-61zM126 135h5v39h-5zM182 135h5v39h-5z', GOLD) + emblem(241, 50, PURPLE) + rect(301, 152, 52, 6, '#b68c57'),
        }
        art.append(grand[room])
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
