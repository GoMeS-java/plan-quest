#!/usr/bin/env python3
"""Reproducible 480x320 interiors; art only, no unlocks or save mutations."""
from pathlib import Path
from random import Random
from citadel_room_depth import ROOMS, PALETTES, rect, path, item_set, carpet, light, shelf, chest, desk, bed

OUT = Path('src/assets/citadel')


def arch(x, w, top, bottom, fill, edge='#706778'):
    return path(f'M{x} {bottom}V{top+42}Q{x} {top+18} {x+w/2} {top}'
                f'Q{x+w} {top+18} {x+w} {top+42}V{bottom}Z', fill, edge, 4)


def architecture(room, level):
    rng = Random(ROOMS.index(room) + 110)
    tint, gold = PALETTES[room]
    s = rect(0, 0, 480, 320, '#161620', 'none', 0)
    s += '<defs><radialGradient id="glow"><stop stop-color="'+gold+'" stop-opacity=".5"/><stop offset="1" stop-color="'+gold+'" stop-opacity="0"/></radialGradient><linearGradient id="shade" x2="0" y2="1"><stop stop-color="#060711" stop-opacity="0"/><stop offset="1" stop-color="#060711" stop-opacity=".6"/></linearGradient></defs>'
    # Masonry recedes behind the floor seam; columns have visible plinths.
    for row in range(15):
        for col in range(13):
            x, y = col*42 - (21 if row % 2 else 0), row*15
            c = rng.choice(('#30303f', '#343440', '#383642', '#2b2c39'))
            s += rect(x, y, 40, 13, c, 'none', 0)
            s += path(f'M{x+2} {y+1}h35', 'none', '#7b7180', .5)
    s += path('M0 0L44 30V226L0 275ZM480 0L436 30V226L480 275Z', '#252532', '#45404e', 2)
    # Rooms retain purpose-specific architecture, with no new observatory windows.
    if room == 'observatory':
        s += arch(126, 228, 8, 201, '#171e34', '#7c7189')
        for _ in range(65):
            x, y = rng.randrange(145, 335), rng.randrange(52, 188)
            s += rect(x, y, 1, 1, '#bac6d8', 'none', 0)
        s += path('M137 197Q242 38 342 197M145 148H335M240 17V200', 'none', '#4d536c', 2)
        s += path('M25 29Q240 -18 455 29M44 39Q240 -3 436 39', 'none', '#625d73', 7)
    elif room == 'gatehouse':
        s += arch(168, 144, 36, 220, '#0c101a')
        for x in range(177, 310, 14):
            s += path(f'M{x} 83V217', 'none', '#60606c', 4)
        s += path('M173 125H309M173 176H309', 'none', '#7f7476', 5)
    elif room == 'vault':
        s += arch(165, 150, 38, 219, '#393440', '#958173')
        for x in range(179, 306, 18):
            s += rect(x, 86, 13, 125, '#302b36', '#524654', 1)
        s += path('M172 118H308M172 178H308', 'none', gold, 3)
        s += rect(232, 142, 18, 25, '#201c29', gold, 2)
    elif room == 'forge':
        s += rect(55, 0, 74, 180, '#44404a', '#5d5359', 4)
        for y in range(15, 176, 17):
            s += path(f'M59 {y}H125', 'none', '#292632', 2)
        s += arch(338, 66, 46, 173, '#172132')
        s += path('M371 53V174M341 118H401', 'none', '#62596b', 3)
    elif room == 'cloister':
        for x in (65, 185, 305):
            s += arch(x, 104, 24, 215, '#273d40' if level > 1 else '#1d292f')
            s += path(f'M{x+5} 195q36 -45 94 -22v42h-94Z', '#354b43', 'none', 0)
            s += path(f'M{x+14} 211v-48m7 26l-7 -15 -8 8m70 28v-66', 'none', '#59725a', 3)
    else:
        # Tall paired lancets; archive shelves occupy the side aisles.
        for x in (100, 324):
            s += arch(x, 56, 24, 180, '#a99b81' if level > 1 else '#414354')
            s += arch(x+6, 44, 31, 176, '#d5ba87' if level > 1 else '#3a4050', '#514752')
            s += path(f'M{x+28} 32V179M{x+5} 103H{x+51}M{x+5} 143H{x+51}', 'none', '#5f515b', 3)
            if level > 1:
                s += path(f'M{x+6} 113L{x-65} 264H{x+88}L{x+50} 113Z', '#e7bf83', 'none', 0).replace('/>', ' opacity=".075"/>')
        if room == 'throne':
            s += arch(183, 114, 14, 219, '#302a3c', '#8b7884')
    # Ribbed vaults and buttresses frame every scene without hiding doorways.
    for x in (38, 426):
        s += path(f'M{x} 208V65Q{x} 29 240 0', 'none', '#5f586a', 10)
        s += rect(x-5, 64, 12, 153, '#514b5a', '#292633', 2)
        s += rect(x-10, 207, 23, 14, '#6b5f6a', '#302a37', 2)
        s += path(f'M{x-1} 75V205', 'none', '#867786', 2)
    if room in ('throne', 'rest', 'study', 'refectory'):
        for x in (175, 291):
            s += path(f'M{x} 73h18v70l-9 10 -9 -10Z', tint if level > 1 else '#39303f', gold if level == 3 else '#716070', 2)
            if level == 3:
                s += path(f'M{x+9} 92l-4 12 4 12 4 -12Z', gold, 'none', 0)
    # Perspective tiles share a vanishing point. No crisscrossed floor overlay.
    s += path('M0 228L44 213H436L480 228V320H0Z', '#48414a' if level > 1 else '#302e3c', '#1b1925', 2)
    s += '<defs><clipPath id="floor-clip"><path d="M0 228L44 213H436L480 228V320H0Z"/></clipPath></defs><g clip-path="url(#floor-clip)">'
    for y in (223, 239, 259, 285, 317):
        s += path(f'M0 {y}H480', 'none', '#241f2d', 2)
        s += path(f'M0 {y+2}H480', 'none', '#9c8278', .6)
    for x in range(-300, 850, 80):
        s += path(f'M240 115L{x} 320', 'none', '#25222e', 1)
    for _ in range(160):
        x, y = rng.randrange(480), rng.randrange(218, 320)
        s += rect(x, y, rng.randrange(1, 5), 1, rng.choice(('#827078','#282632','#675862')), 'none', 0)
    s += '</g>'
    s += path('M0 225V320H480V225M0 320H480', 'none', '#11131e', 6)
    # Persistent scars remain after repair; loose rubble is cleared in stages.
    for x, y in ((59, 115), (416, 183), (220, 66)):
        s += path(f'M{x} {y}l-4 11 8 7 -3 16m-1 -23l11 4', 'none', '#171622', 2)
    for _ in range(55 if level == 1 else 9 if level == 2 else 0):
        x, y = rng.randrange(63, 421), rng.randrange(232, 279)
        s += path(f'M{x} {y}l7 -3 6 5 -11 2Z', '#70636b', '#292331', 1)
    return s


def ruined(room):
    if room == 'rest':
        return path('M290 235L414 218 448 242 323 266Z', '#55434d', '#83707a', 3)+path('M298 226v29m140 -19v36M321 262v15', 'none', '#62505c', 5)+path('M307 239l47 -9 15 10 34 -8 25 12 -97 14Z', '#73616b', '#3c3544', 2)
    if room in ('study', 'archive'):
        return shelf(70, 172, 54, 84)+path('M174 243l112 -8 30 17 -110 13Z', '#5f4d53', '#8a7371', 2)+path('M191 260v18m100 -25l-13 26', 'none', '#59424c', 5)
    if room == 'throne':
        return path('M185 244l111 -8 21 21 -132 10ZM222 243v-66l17 -20 16 39 19 -7v50Z', '#504557', '#776576', 3)
    if room == 'forge':
        return arch(65, 98, 130, 264, '#3b333e')+arch(83, 62, 169, 264, '#11121b')+path('M220 243h60l-12 16h-18v20h-20v-19Z', '#5c5862', '#7a707a', 2)
    if room == 'observatory':
        return path('M186 208l92 -36 9 14 -92 35ZM232 211l-31 67m36 -66l35 65', '#4d5469', '#7b7e8c', 4)
    if room == 'cloister':
        return path('M183 245Q242 215 300 247L308 265Q243 291 175 263Z', '#475454', '#78837d', 3)+path('M219 257l19 -11 23 9 -10 9Z', '#283d42', 'none', 0)
    if room == 'refectory':
        return path('M94 241l235 -18 52 29 -235 24Z', '#624c4e', '#8b6d64', 3)+path('M135 273v10m211 -24l-13 21', 'none', '#523c46', 6)
    if room == 'vault':
        return chest(106, 235)+chest(289, 235)
    return path('M150 201v73m23 -81v66m27 -50v63M140 225h72', 'none', '#655e69', 6)+chest(320, 239)


def details(room, level):
    if level < 2:
        return ''
    tint, gold = PALETTES[room]
    s = ''
    # Small functional objects are visible on furniture, never invented loot.
    if room == 'rest':
        s += arch(52, 68, 165, 273, '#5c4b51', '#aa8b78')
        s += arch(62, 48, 196, 270, '#241c28', '#80605b')
        s += path('M69 260l9 -20 7 12 9 -29 12 38Z', '#ee9953', '#ffd18a', 2)
        s += rect(48, 210, 77, 6, '#ae8a73', '#3c303c', 2)
        s += path('M69 263l30 -4 10 5 -30 4ZM78 264l22 -3', '#614235', '#9b7055', 3)
        for x in (57, 116):
            s += path(f'M{x} 217v49m-3 -36h6', 'none', '#987c6d', 2)
    if room == 'study':
        s += path('M201 251l19 -3 10 5 -19 4Z', '#d5c29e', '#807076', 1)
        s += path('M206 251l12 -2m-9 4l11 -2', 'none', '#8b7762', 1)
    if room == 'archive':
        s += shelf(306, 180, 38, 72, level == 3)
        s += path('M247 244l25 -5 12 8 -25 5Z', '#d3c09c', '#8e7772', 1)
    if room == 'forge':
        for x in (336, 357, 378, 400):
            s += path(f'M{x} 194v6q-4 4 0 6v18', 'none', '#827576', 2)
        s += path('M329 204h13v5h-13ZM351 206h12v6h-12ZM374 205v8h8v-8M395 207h10v5h-10', '#a49c99', '#3b323e', 1)
        for x,y in ((79,221),(96,215),(112,227)):
            s += rect(x, y, 2, 3, '#ffd79a', 'none', 0)
    if room == 'refectory':
        for x,y in ((166,239),(218,233),(282,236),(326,247)):
            s += f'<ellipse cx="{x}" cy="{y}" rx="11" ry="4" fill="#c9b7a5" stroke="#87757c"/>'
            s += rect(x+13, y-8, 5, 8, '#afa2a0', '#6d606a', 1)
    if room == 'gatehouse':
        for x in (70, 105):
            s += path(f'M{x} 193l12 -5 12 5 -3 22 -9 8 -9 -8Z', '#6a6a79', gold, 2)
    if level == 3:
        # Each final renovation gains functional detail as well as richer trim.
        if room == 'throne':
            s += path('M210 188l8 -19 13 9 17 -29 18 29 13 -9 16 20Z', '#997553', gold, 2)
            s += path('M235 206l12 -9 14 9 -14 12Z', '#bea078', '#463140', 2)
        if room == 'forge':
            for x in (359, 375):
                s += path(f'M{x} 236l14 -2 6 3 -14 3v4l-6 -3Z', '#a6a0a0', '#55505e', 1)
        if room == 'gatehouse':
            s += path('M278 255v25h5v-25m45 -7v25h5v-25', '#655046', '#342b37', 1)
            s += path('M276 256l57 -8 16 10 -56 11v5l56 -11v-5m-56 11l-17 -8Z', '#746052', '#ba9874', 2)
        if room == 'vault':
            for x,y in ((154,260),(234,263),(316,259)):
                s += rect(x, y, 8, 10, '#c1a47b', '#544356', 1)
                s += rect(x+3, y+4, 2, 4, '#372b3a', 'none', 0)
        if room == 'rest':
            # Four continuous posts connect the canopy to the bed frame.
            s += path('M294 249V153M405 226V141M332 287V170M449 267V156', 'none', '#89664f', 5)
            s += path('M294 247V155M332 284V173M449 264V159', 'none', '#d1af80', 1)
            s += path('M287 149L403 138 449 155 323 170Z', '#543349', '#c8a078', 3)
            s += path('M291 153L322 168V237L302 224ZM416 151L443 157V221L428 210Z', '#64415c', '#ac8e7b', 2)
            s += path('M298 167l2 40m9 -33v44m126 -52v37', 'none', '#8d607a', 2)
        if room == 'cloister':
            for x in (74, 391):
                s += path(f'M{x-13} 254l4 25h18l4 -25Z', '#65504f', '#ad8d71', 2)
                s += f'<ellipse cx="{x}" cy="254" rx="14" ry="5" fill="#342c32" stroke="#ad8d71" stroke-width="2"/>'
                s += path(f'M{x} 256v-47m0 29q-21 -21 -22 -29 20 0 22 19m0 -5q22 -27 22 -37 -21 6 -22 29', 'none', '#6b9873', 4)
        if room == 'observatory':
            s += path('M58 228l45 -5 12 9 -45 7Z', '#b0b6bc', '#665d73', 2)
            s += '<circle cx="83" cy="227" r="11" fill="none" stroke="#d8bc8b" stroke-width="2"/>'
    return s


def furnishings(room, level):
    rich = level == 3
    gold = PALETTES[room][1]
    if room == 'rest':
        return shelf(128, 187, 52, 80, rich)+chest(267, 222, rich)+bed(2).replace('#7b6c80', '#76546f' if rich else '#7b6c80')+desk(172, 247, level)
    if room == 'forge':
        s = '<ellipse cx="90" cy="294" rx="76" ry="10" fill="#080911" opacity=".7"/>'
        s += path('M28 190L124 183 143 199V286L28 296Z', '#51444b', '#9b8277', 2)
        s += path('M124 185L143 199V286L124 292Z', '#322b38', '#6e5a60', 2)
        s += arch(40, 77, 195, 277, '#17121d', '#a18877')
        s += path('M45 274l12 -11 45 -2 12 10 -42 8Z', '#6b392f', '#a9633d', 2)
        s += path('M51 268l6 -15 5 6 6 -28 8 19 7 -28 10 35 6 -12 9 24Z', '#e48c46', '#bd673d', 1)
        s += path('M62 267l6 -13 5 7 8 -17 6 17 7 -6 4 13Z', '#ffce74', 'none', 0)
        for y in (198, 216, 234, 253, 281):
            s += path(f'M29 {y}h10m79 -7h19', 'none', '#ac8b76', 1)
        s += path('M18 188L124 178 149 191 33 204Z', '#786360', '#aa8c77', 2)
        s += path('M187 256l28 -7 58 3 -15 15 -28 1 7 24 -34 5 2 -27Z', '#555761', '#aaa2a0', 2)
        s += path('M191 255l25 -10 57 5 -19 11 -45 2Z', '#929398', '#bdb0a3', 1)
        s += path('M208 276l23 -2m-23 7l24 -2', 'none', '#2c2936', 2)
        s += desk(317, 239, level, workshop=True)
        s += rect(321, 190, 94, 8, '#694e43', '#ac8766', 1)
        s += path('M326 195v30m84 -30v30', 'none', '#70574d', 4)
        return s
    if room == 'throne':
        s = path('M157 239L278 219 342 245 224 272Z', '#60505d', '#a8917d', 2)
        s += path('M157 239V248L224 283 342 256V245L224 272Z', '#3e3446', '#766273', 2)
        s += '<ellipse cx="253" cy="268" rx="61" ry="9" fill="#0a0912" opacity=".6"/>'
        s += path('M216 234V178L249 150 286 178V235Z', '#4e344a', gold, 3)
        s += path('M225 225V184L250 164 277 184V223Z', '#785269', '#aa7e7e', 2)
        s += path('M219 226L278 219 299 235 238 248Z', '#9b7173', gold, 2)
        s += path('M237 248V264M291 237V254M217 225V244', 'none', '#71505b', 6)
        s += path('M213 212L229 214 238 231M278 207L295 212V234', 'none', gold, 5)
        s += chest(51, 251, rich)+chest(362, 247, rich)
        return s
    if room == 'cloister':
        s = '<ellipse cx="244" cy="282" rx="94" ry="14" fill="#090f19" opacity=".6"/>'
        s += path('M159 254Q241 218 328 254V272Q244 310 159 272Z', '#4d6261', '#91aaa0', 3)
        s += '<ellipse cx="243" cy="254" rx="83" ry="23" fill="#718983" stroke="#a0b5a4" stroke-width="3"/>'
        s += '<ellipse cx="243" cy="251" rx="68" ry="16" fill="#385c62" stroke="#aac0af" stroke-width="2"/>'
        s += path('M234 249V212H252V249Z', '#7b9890', '#a9bdab', 2)
        s += '<ellipse cx="243" cy="215" rx="33" ry="9" fill="#587f7b" stroke="#b0c8b5" stroke-width="2"/>'
        s += path('M243 213V184M218 217l-4 22m54 -22l5 22', 'none', '#83b9b3', 2)
        s += path('M198 253l22 4m42 -4l24 -4m-70 13l33 2', 'none', '#87aaa7', 1)
        for x in (24, 360):
            s += f'<ellipse cx="{x+48}" cy="282" rx="49" ry="6" fill="#0c151b" opacity=".6"/>'
            for dx,dy in ((10,261),(76,253)):
                s += path(f'M{x+dx} {dy}h10v21l-10 2Z', '#657365', '#394b48', 1)
                s += path(f'M{x+dx+10} {dy}l5 -2v21l-5 2Z', '#3f5350', '#394b48', 1)
            s += path(f'M{x} 253l77 -9 18 10v6l-79 12 -16 -12Z', '#59695e', '#8e9b80', 2)
            s += path(f'M{x} 253l77 -9 18 10 -79 12Z', '#7a8274', '#acae91', 2)
        return s
    s = item_set(room, level)
    if room == 'observatory':
        s += path('M200 200l6 15m20 -23l6 15m57 -39l6 15', 'none', '#d2b48a', 4)
        s += '<circle cx="246" cy="218" r="7" fill="#b6a48a" stroke="#4a4657" stroke-width="2"/>'
    return s


def render(room, level):
    tint, gold = PALETTES[room]
    s = architecture(room, level)
    if level > 1:
        # Footprints stop before the shared foreground walking aisle.
        if room not in ('forge', 'cloister', 'gatehouse', 'vault'):
            s += '<g transform="translate(0,-6) scale(1,.94)">'+carpet(level, tint)+'</g>'
        s += light(58, 170, level, gold)+light(422, 170, level, gold)
        furniture = furnishings(room, level)
        s += '<g transform="translate(0,-10) scale(1,.94)">'+furniture+details(room, level)+'</g>'
    else:
        s += ruined(room)
        s += path('M28 38l19 3 -6 19 -17 4ZM436 74l23 -5 -3 27 -18 12Z', '#161520', '#514759', 2)
    s += rect(0, 0, 480, 320, 'url(#shade)', 'none', 0)
    s += path('M0 0V320M480 0V320', 'none', '#10111b', 13)
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320" shape-rendering="crispEdges">'+s+'</svg>\n'


def light_masks(room):
    """Only existing apertures admit daylight or exterior weather."""
    windows, beams = '', ''
    if room == 'vault':
        return windows, beams
    if room == 'observatory':
        windows = arch(133, 214, 16, 155, '#fff', 'none')
        windows += path('M240 20V156M140 148H340', 'none', '#000', 4)
        beams = path('M135 143L345 143 387 290 77 290Z', '#fff', 'none', 0)
    elif room == 'gatehouse':
        windows = arch(173, 134, 44, 216, '#fff', 'none')
        for x in range(177,310,14):
            windows += path(f'M{x} 83V217', 'none', '#000', 5)
        windows += path('M173 125H309M173 176H309', 'none', '#000', 6)
        beams = path('M174 188H307L360 306H116Z', '#fff', 'none', 0)
    elif room == 'forge':
        windows = arch(344,54,54,160,'#fff','none')
        windows += path('M371 54V163M344 118H398','none','#000',4)
        beams = path('M344 119L398 119 297 278 190 278Z','#fff','none',0)
    elif room == 'cloister':
        for x in (65,185,305):
            windows += arch(x+6,92,32,174,'#fff','none')
            beams += path(f'M{x+6} 155H{x+98}L{x+120} 280H{x-35}Z','#fff','none',0)
    else:
        for x in (100,324):
            windows += arch(x+9,38,39,137,'#fff','none')
            windows += path(f'M{x+28} 40V139M{x+7} 103H{x+49}','none','#000',4)
            beams += path(f'M{x+9} 104H{x+47}L{x+75} 278H{x-65}Z','#fff','none',0)
    svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320">{}</svg>\n'
    return svg.format(windows), svg.format(beams)


if __name__ == '__main__':
    for room in ROOMS:
        for level in (1, 2, 3):
            (OUT / f'{room}-interior-{level}.svg').write_text(render(room, level), encoding='utf-8')
        windows, beams = light_masks(room)
        if windows:
            (OUT / f'{room}-apertures.svg').write_text(windows, encoding='utf-8')
            (OUT / f'{room}-daylight.svg').write_text(beams, encoding='utf-8')
    print('Generated 30 distinct room interiors')
