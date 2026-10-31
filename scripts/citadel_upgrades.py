"""Draw restrained, editable pixel embellishments for purchased room tiers.

The detailed WebP interiors remain visible. These overlays replace the old
oversized flat polygon furniture and the identical gold frame on every room.
"""
from pathlib import Path

ROOT = Path('src/assets/citadel')
ROOMS = ('throne', 'observatory', 'rest', 'study', 'archive', 'forge',
         'gatehouse', 'refectory', 'cloister', 'vault')


def r(x, y, w, h, c):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{c}"/>'


def p(d, c):
    return f'<path d="{d}" fill="{c}"/>'


def draw(room, grand):
    gold = '#bc9872' if not grand else '#e4bd7c'
    shade = '#493746' if not grand else '#794b70'
    glow = '#b98671' if not grand else '#f4c79b'
    bits = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 200" shape-rendering="crispEdges">']
    # Jointed stone piers sit in the corners and preserve the photographed
    # arches. They are deliberately much narrower than the former full frame.
    for x in (12, 458):
        bits += [r(x, 45, 3, 128, '#584b61'), r(x, 48, 1, 125, gold),
                 r(x-3, 44, 9, 3, shade), r(x-4, 172, 11, 3, shade)]
        for y in range(60, 163, 22):
            bits.append(r(x-2, y, 7, 2, '#827083'))
    for x in range(53, 434, 38):
        bits += [r(x, 181, 14, 2, shade), r(x+3, 184, 8, 1, gold)]
        if grand: bits.append(r(x+4, 20, 5, 2, gold))
    focus = {
        'throne': lambda: [p('M224 100h31v3h-31zM228 104h23v3h-23z', gold),
                           r(234, 88, 9, 4, shade), r(237, 84, 3, 4, glow),
                           p('M191 153h99v2h-99zM205 157h71v2h-71z', shade)],
        'observatory': lambda: [p('M239 92l65-25 1 3-65 26z', gold),
                               r(305, 66, 5, 6, shade), r(270, 105, 3, 22, gold),
                               r(351, 139, 48, 2, shade)],
        'rest': lambda: [r(152, 150, 110, 2, gold), r(151, 162, 115, 3, shade),
                         r(154, 169, 112, 2, gold), r(122, 47, 2, 30, shade),
                         r(282, 47, 2, 30, shade)],
        'study': lambda: [r(207, 125, 110, 2, gold), r(211, 142, 4, 25, shade),
                          r(307, 142, 4, 25, shade), r(240, 119, 31, 2, glow),
                          r(365, 86, 3, 36, gold)],
        'archive': lambda: [r(18, 72, 61, 2, gold), r(403, 72, 61, 2, gold),
                            r(18, 123, 61, 2, shade), r(403, 123, 61, 2, shade),
                            r(221, 146, 35, 2, glow)],
        'forge': lambda: [r(175, 114, 103, 3, shade), r(177, 151, 99, 2, gold),
                          r(310, 149, 38, 2, gold), r(319, 153, 3, 24, shade),
                          r(341, 153, 3, 24, shade)],
        'gatehouse': lambda: [r(164, 45, 4, 108, shade), r(313, 45, 4, 108, shade),
                              r(177, 58, 126, 2, gold), r(222, 145, 36, 2, glow)],
        'refectory': lambda: [r(115, 129, 249, 3, shade), r(115, 134, 249, 2, gold),
                              r(135, 141, 3, 27, shade), r(343, 141, 3, 27, shade),
                              r(215, 80, 45, 3, gold)],
        'cloister': lambda: [r(82, 159, 31, 2, gold), r(303, 159, 55, 2, gold),
                             r(198, 161, 74, 2, shade), r(236, 137, 2, 19, glow),
                             r(115, 176, 248, 2, shade)],
        'vault': lambda: [r(105, 135, 77, 2, gold), r(287, 135, 78, 2, gold),
                          r(110, 154, 67, 2, shade), r(293, 154, 65, 2, shade),
                          r(227, 169, 35, 2, glow)],
    }
    bits.extend(focus[room]())
    if grand:
        # Tier three adds filigree, lit heraldry and inlaid stone, never a
        # universal gold outline that hides the underlying room artwork.
        for x in (43, 87, 392, 436):
            bits += [r(x, 34, 3, 8, gold), r(x-3, 38, 9, 2, shade),
                     r(x+1, 33, 1, 3, glow)]
        for x in range(130, 348, 29):
            bits += [r(x, 176, 10, 2, gold), r(x+4, 174, 2, 2, glow)]
    bits.append('</svg>')
    return ''.join(bits) + '\n'


for room in ROOMS:
    for grand, suffix in ((False, 'upgrade'), (True, 'upgrade3')):
        (ROOT / f'{room}-{suffix}.svg').write_text(draw(room, grand), encoding='utf-8')
