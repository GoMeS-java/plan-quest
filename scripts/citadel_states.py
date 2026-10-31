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


def stage(room, tier):
    art = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 200" shape-rendering="crispEdges">']
    if tier == 0:
        # Damage stays on the same architecture: debris, broken silhouettes and darkened fixtures.
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
