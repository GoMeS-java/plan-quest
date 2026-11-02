#!/usr/bin/env python3
"""Deterministic 1.1 room foregrounds. All furniture shares a 480x320 floor plane.

The existing hand-drawn ruin walls remain underneath; these transparent SVG
layers provide consistent perspective, grounded furnishings and level changes.
No game data, currencies or unlock rules are touched.
"""
from pathlib import Path

OUT = Path("src/assets/citadel")
ROOMS = ("rest", "study", "archive", "forge", "throne", "observatory",
         "gatehouse", "refectory", "cloister", "vault")
PALETTES = {
    "rest": ("#725069", "#dcb58d"), "study": ("#5e526d", "#c8aa78"),
    "archive": ("#65505c", "#b8a77e"), "forge": ("#754b42", "#f8a961"),
    "throne": ("#65445b", "#d7ac75"), "observatory": ("#3b5976", "#a9c9dc"),
    "gatehouse": ("#62525a", "#c0a27f"), "refectory": ("#71554e", "#dfb47e"),
    "cloister": ("#47645b", "#9ccdb0"), "vault": ("#625264", "#d4b37d"),
}


def rect(x, y, w, h, color, stroke="#100f1c", sw=2):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{color}" stroke="{stroke}" stroke-width="{sw}"/>'


def path(d, fill, stroke="#1d1826", sw=2):
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'


def grounded(x, y, w, h, body, top="#96785f"):
    """Upright object with side panel, top face, feet and contact shadow."""
    s = (
        f'<ellipse cx="{x+w/2+7}" cy="{y+h+5}" rx="{w/2+13}" ry="7" fill="#05060e" opacity=".66"/>'
        + rect(x+5, y+h-2, 8, 11, "#302532", "#8e756b", 1)
        + rect(x+w-12, y+h-2, 8, 11, "#302532", "#8e756b", 1)
        + path(f'M{x+w} {y}l11 -8v{h}l-11 8Z', "#392c3a", "#8e756b", 1)
        + rect(x, y, w, h, body, "#b29179")
        + path(f'M{x+4} {y+5}h{w-8}v{h-10}h-{w-8}Z', "none", "#2a2331", 2)
        + path(f'M{x} {y}l{w} 0 11 -8 -{w} 0Z', top, "#bb9b7b", 1)
        + path(f'M{x+1} {y+h-5}h{w-2}', "none", "#997c69", 2)
    )
    if w >= 70 and h >= 40:
        s += path(f'M{x+w/2} {y+5}v{h-10}', 'none', '#231f2a', 2)
        for dx in (w/2-7,w/2+5):
            s += rect(x+dx,y+h/2-3,2,6,'#b69a73','#493944',.5)
        for dx in (5,w-9):
            for dy in (10,h-13):
                s += rect(x+dx,y+dy,4,3,'#85756e','#302a33',.5)
    return s


def shelf(x, y, w=55, h=76, rich=False):
    s = grounded(x, y, w, h, "#483443", "#90745f")
    rows = 4 if h >= 95 else 3
    gap = (h-12)/rows
    count = max(3, int((w-13)//8))
    bw = (w-14)/count
    for row in range(rows):
        yy = y+7+(row+1)*gap
        for k in range(count):
            c = ("#aa7772", "#7a8a86", "#b8a17c", "#78617d")[k % 4]
            bh = gap-5-(k % 3)*2
            s += rect(round(x+7+k*bw, 1), round(yy-bh-2, 1), round(bw-2, 1), round(bh, 1), c, "#32283a", 1)
            s += path(f'M{x+8+k*bw:.1f} {yy-bh+1:.1f}h{max(1,bw-5):.1f}', 'none', '#c9ae87', .7)
        s += path(f'M{x+4} {yy:.1f}h{w-8}', "none", "#b48d69", 3)
    if rich:
        s += path(f'M{x-3} {y+8}h{w+6}', "none", "#e4bd85", 3)
    return s


def carpet(level, tint):
    if level == 2:
        return (path("M113 276L224 242 347 262 308 314H59Z", "#554252", "#a48576", 2)
                + path("M126 278L225 251 334 266 299 306H79Z", "none", "#c0a17c", 2))
    return (path("M80 283L236 233 390 263 347 319H12Z", tint, "#ddba8b", 3)
            + path("M104 282L236 244 370 266 334 310H43Z", "none", "#ebc997", 2)
            + path("M143 280L239 254 326 270 301 301H113Z", "none", "#bba487", 2)
            + path("M211 281L243 268 282 281 243 294Z", "#a07b85", "#dfb68a", 2))


def bed(level):
    s = '<ellipse cx="370" cy="290" rx="106" ry="18" fill="#050710" opacity=".75"/>'
    # Headboard, four feet, closed frame and mattress are drawn back to front.
    s += path('M296 237V204L407 191V225Z', '#634553', '#b79775', 3)
    s += path('M304 222V210L399 199V214Z', '#856073', '#a48475', 2)
    for x,y in ((298,255),(403,244),(333,285),(450,270)):
        s += rect(x,y,8,18,'#48313e','#9e7a66',1)
    s += path('M296 237L407 224 459 258 335 278Z', '#96776b', '#c4a18b', 2)
    s += path('M296 237V254L335 286 459 267V258L335 278Z', '#583d4b', '#b79775', 2)
    s += path('M303 232L406 220 452 251 335 269Z', '#d8c5af', '#a58b8d', 2)
    s += path('M305 231L408 220 423 231 320 244Z', '#ede0c5', '#ad9291', 1)
    s += path('M323 241L425 228 452 251 335 269Z', '#76546f' if level == 3 else '#7b6c80', '#c39e8d', 2)
    s += path('M335 269V279L453 261V251M344 256L437 242M344 279L444 264', 'none', '#c3a17f', 2)
    s += path('M332 263V286M457 245V268', 'none', '#aa856d', 5)
    if level == 3:
        s += path("M290 193L404 181 449 199 322 216Z", "#60384e", "#e1b78a", 3)
        s += path("M293 199L322 214V261L301 246ZM416 192L444 199V257L426 242Z", "#6d3a5c", "#d6af89")
    return s


def desk(x=43, y=239, level=2, workshop=False):
    s = f'<ellipse cx="{x+66}" cy="{y+58}" rx="72" ry="10" fill="#080911" opacity=".58"/>'
    # Four mortised legs share the tabletop corners and a complete stretcher.
    for dx,dy,length in ((5,2,36),(88,-11,35),(120,7,38),(34,21,38)):
        s += path(f'M{x+dx} {y+dy}v{length}h6v-{length}Z', '#695044', '#302633', 1)
        s += path(f'M{x+dx+1} {y+dy+8}v{length-10}', 'none', '#ae8767', 1)
    s += path(f'M{x+10} {y+29}l26 18 87 -15M{x+38} {y+46}v6m82 -20v7', 'none', '#795b4a', 4)
    s += path(f'M{x} {y}l33 21 96 -18v8l-96 18 -33 -21Z', '#604738', '#9d795a', 1)
    s += path(f'M{x} {y}l94 -15 35 18 -96 18Z', '#96775f', '#d4ae82', 2)
    s += path(f'M{x+13} {y+1}l77 -12m-61 18l79 -12', 'none', '#b49370', 1)
    if workshop:
        s += path(f'M{x+33} {y+3}l30 -5m-4 -4l5 10', 'none', '#664c3b', 3)
        s += path(f'M{x+56} {y-6}l10 -2 5 8 -10 2Z', '#9e9895', '#47404a', 1)
        s += path(f'M{x+83} {y-5}l-13 10m4 -2l12 1', 'none', '#b1a6a0', 2)
        return s
    # A closed ledger rests entirely on the top, with a visible spine and pages.
    s += path(f'M{x+46} {y}l24 -4 12 6 -25 5Z', '#ded0ae', '#66505a', 1)
    s += path(f'M{x+46} {y}v4l11 5 25 -5v-3l-25 5Z', '#bca984', '#765f5b', 1)
    s += path(f'M{x+46} {y-2}l24 -4 12 6 -25 5Z', '#684a5f', '#bd9972', 1)
    s += rect(x+94, y-7, 6, 7, '#39323f', '#b09274', 1)
    if level == 3:
        s += path(f"M{x+18} {y+4}l24 -4 5 7 -25 5Z", "#69465f", "#e5bc82")
    return s


def chest(x, y, rich=False):
    s = grounded(x, y, 50, 30, "#60444a", "#9c7659")
    s += path(f"M{x+5} {y+27}h40m-19 -10v18", "none", "#dab477" if rich else "#a88c71", 3)
    return s


def bench(x, y, w=80):
    s = f'<ellipse cx="{x+w/2+6}" cy="{y+29}" rx="{w/2+10}" ry="5" fill="#080911" opacity=".55"/>'
    for dx,dy in ((5,0),(w-8,-7),(16,10),(w+4,2)):
        s += rect(x+dx,y+dy,5,24,'#5d4942','#302733',1)
    s += path(f'M{x} {y}l{w} -9 17 10 -{w} 10v5l{w} -10v-5m-{w} 10l-17 -10Z', '#816954', '#b69b79', 2)
    s += path(f'M{x+9} {y+2}l{w-5} -8M{x+20} {y+23}l{w-15} -8', 'none', '#a08160', 2)
    return s


def light(x, y, level, color):
    return (f'<ellipse cx="{x}" cy="{y}" rx="{66 if level==3 else 43}" ry="{76 if level==3 else 55}" fill="url(#glow)" opacity=".72"/>'
            + path(f"M{x-8} {y+12}h16m-11 -8h6v13h-6Z", color, "#8d6c68", 2)
            + path(f"M{x} {y+4}q-7 -8 0 -17q7 9 0 17", "#ffe0a1", "none", 0))


def item_set(room, level):
    rich = level == 3
    if room == "rest":
        return (grounded(32, 230, 71, 47, "#50404b") + shelf(116, 201, 49, 66, rich)
                + desk(174, 251, level) + bed(level) + chest(270, 252, rich))
    if room == "study":
        return (shelf(33, 190, 66, 92, rich) + shelf(379, 189, 59, 90, rich)
                + desk(172, 251, level) + chest(300, 246, rich)
                + rect(197, 165, 94, 52, '#664c4c', '#b39170', 3)
                + rect(203, 171, 82, 40, '#baa47e', '#443745', 1)
                + path('M209 199l12 -12 14 4 10 -10 18 8 15 -6M215 174v33m20 -33v33m20 -33v33m20 -33v33', 'none', '#89765f', 1)
                + path('M238 165v-7h12v7', 'none', '#92785f', 2))
    if room == "archive":
        return (shelf(28, 178, 77, 110, rich) + shelf(375, 177, 74, 111, rich)
                + shelf(135, 195, 45, 77, rich) + desk(205, 256, level))
    if room == "forge":
        return (grounded(27, 188, 112, 98, "#4d3940", "#81706a")
                + path("M40 246L61 219 75 244 90 210 112 252Z", "#ffac55", "#ffdf8c", 3)
                + grounded(318, 230, 99, 49, "#5c5158", "#a49786")
                + path("M193 257h66l-13 20h-45Z", "#70747a", "#c3b2a1", 3)
                + rect(215, 276, 22, 31, "#453e48", "#99897f")
                + path("M148 198l9 64m25 -66l11 64", "none", "#a99ca0", 6))
    if room == "throne":
        return (path("M147 226L286 202 365 238 241 263Z", "#5d4d63", "#d0ad7e", 4)
                + grounded(207, 187, 89, 80, "#65445d", "#ac826a")
                + path("M206 188L248 153 300 188Z", "#87617a", "#d9b588", 4)
                + rect(230, 218, 49, 46, "#946e68", "#e3b47c", 3)
                + chest(51, 251, rich) + chest(362, 247, rich))
    if room == "observatory":
        return (path("M158 255L241 216 328 255 246 293Z", "#425469", "#8baab9", 3)
                + path("M185 206L304 163 317 179 198 221Z", "#668097", "#b5cbd4", 4)
                + path('M185 206l13 15 5 -3 -13 -14Z', '#394557', '#b5cbd4', 1)
                + path('M304 163l13 16 4 -2 -13 -16Z', '#b6a184', '#dec197', 2)
                + path('M309 165l9 12 -4 1 -9 -12Z', '#1d2e41', '#607e95', 1)
                + path('M234 210v13h18v-20', 'none', '#8c786b', 5)
                + path("M243 217L229 279M251 218L282 283M246 219L244 285", "none", "#a28d88", 7)
                + path('M229 279l15 6 38 -2M229 279h-7m22 6h-6m44 -2h7', 'none', '#655564', 4)
                + grounded(28, 238, 99, 44, "#4c485a") + chest(353, 252, rich))
    if room == "gatehouse":
        return (grounded(27, 211, 107, 72, "#4b4047") + chest(361, 245, rich)
                + path('M183 278h76v7h-76ZM190 219h65v6h-65Z', '#685143', '#9c7e66', 2)
                + path("M194 185v94m22 -100v99m22 -96v99", "none", "#a39ca0", 5)
                + path("M182 213l19 -36 17 36 -18 17Z", "#7c7e89", "#c6b3ab", 3)
                + path("M227 215l18 -38 17 38 -18 17Z", "#777985", "#c6b3ab", 3)
                + desk(124, 254, level))
    if room == "refectory":
        s = shelf(20, 190, 54, 82, rich)+bench(111,240,192)
        s += '<ellipse cx="246" cy="304" rx="171" ry="12" fill="#090911" opacity=".55"/>'
        for x,y,h in ((84,249,38),(318,225,37),(156,292,20),(400,261,39)):
            s += rect(x,y,9,h,'#644938','#ac8766',1)
        s += path('M93 278l68 24 239 -32', 'none', '#73513e', 6)
        s += path('M79 248L324 220 412 259V267L156 304 79 256Z', '#614838', '#a07c5f', 2)
        s += path('M79 248L324 220 412 259 156 296Z', '#876756', '#c5a07c', 3)
        s += path('M102 248l219 -24M123 260l222 -26M144 278l231 -28', 'none', '#a38363', 1)
        for x,y in ((197,243),(276,236)):
            s += f'<ellipse cx="{x}" cy="{y}" rx="8" ry="3" fill="#b69a72" stroke="#54404a"/>'
            s += path(f'M{x} {y}v-8m-4 0h8', 'none', '#ac8a61', 2)
            s += rect(x-2,y-25,4,17,'#e3c48d','#97775f',1)
            s += path(f'M{x} {y-25}q-4 -5 0 -10q4 5 0 10', '#ffe0a1', 'none', 0)
        return s
    if room == "cloister":
        return (path("M176 243Q241 210 310 241L330 268Q241 303 158 267Z", "#55746b", "#99baae", 4)
                + path("M221 248Q245 218 267 246Q247 270 221 248Z", "#8ad0c5", "#c6e0ca", 3)
                + grounded(19, 242, 96, 36, "#5c655a") + grounded(358, 242, 93, 36, "#5c655a")
                + path("M240 242v-68m-24 48q24 -40 48 0", "none", "#a2e1d3", 5))
    return (grounded(22, 220, 103, 65, "#52424e") + chest(150, 249, rich)
            + chest(230, 252, rich) + chest(312, 248, rich)
            + path('M183 204v13l13 -9m94 -4v13l-13 -9', 'none', '#92755c', 3)
            + path("M178 193L303 193V201H178Z", "#a58d70", "#dfbd86", 2))


def render(room, level):
    tint, gold = PALETTES[room]
    palette = f"""<defs>
      <radialGradient id="glow"><stop stop-color="{gold}" stop-opacity=".55"/>
      <stop offset="1" stop-color="{gold}" stop-opacity="0"/></radialGradient>
      <linearGradient id="floor" x2="0" y2="1"><stop stop-color="#333040" stop-opacity=".2"/>
      <stop offset="1" stop-color="#0c0d18" stop-opacity=".86"/></linearGradient>
    </defs>"""
    floor = (path("M0 204L240 175 480 204V320H0Z", "url(#floor)", "none", 0)
             + path("M0 230L240 189 480 230M0 268L240 210 480 268M0 310L240 236 480 310"
                    "M72 222L91 320M174 193L164 320M319 192L335 320M413 220L396 320",
                    "none", "#9b8790", 1))
    # The stone wall and existing gothic arches are never replaced or punctured.
    ambient = light(85, 174, level, gold) + light(405, 175, level, gold)
    banners = ""
    if level == 3:
        banners = (path("M177 56h20v89l-10 15 -10 -15ZM284 56h20v89l-10 15 -10 -15Z",
                        tint, gold, 3)
                   + path("M185 89l5 13 -5 11m107 -24 -5 13 5 11",
                          "none", gold, 2))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320" '
            f'preserveAspectRatio="none" shape-rendering="crispEdges">'
            + palette + floor + ambient + banners + carpet(level, tint)
            + item_set(room, level)
            + '</svg>\n')


def main():
    for room in ROOMS:
        for level in (2, 3):
            target = OUT / f"{room}-depth-{level}.svg"
            target.write_text(render(room, level), encoding="utf-8")
    print(f"Generated {len(ROOMS) * 2} perspective-aligned room layers")


if __name__ == "__main__":
    main()
