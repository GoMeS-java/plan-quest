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
    return (
        f'<ellipse cx="{x+w/2+7}" cy="{y+h+5}" rx="{w/2+13}" ry="7" fill="#05060e" opacity=".66"/>'
        + path(f'M{x} {y}l{w} -9 11 8 -{w} 10Z', top, "#bb9b7b")
        + path(f'M{x+w} {y-9}l11 8v{h}l-11 9Z', "#392c3a")
        + rect(x, y+9, w, h, body, "#b29179")
        + rect(x+5, y+h+8, 8, 8, "#302532", "#8e756b", 1)
        + rect(x+w-12, y+h+8, 8, 8, "#302532", "#8e756b", 1)
    )


def shelf(x, y, w=55, h=76, rich=False):
    s = grounded(x, y, w, h, "#483443", "#90745f")
    for yy in (y+27, y+49, y+69):
        s += path(f'M{x+5} {yy}h{w-10}', "none", "#c69e73", 3)
        for k in range(5):
            c = ("#aa7772", "#7a8a86", "#b8a17c", "#78617d")[k % 4]
            s += rect(x+7+k*9, yy-16, 6, 15, c, "#32283a", 1)
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
    s += path("M296 216L407 206 451 239 327 251Z", "#9a796f", "#c4a18b")
    s += path("M304 232L410 218 459 259 336 278Z", "#d8c5af", "#a58b8d", 3)
    s += path("M306 246L415 234 453 261 336 270Z", "#76546f" if level == 3 else "#7b6c80", "#c39e8d")
    s += path("M335 278L459 259V278L335 300Z", "#583d4b", "#b79775", 3)
    s += rect(340, 295, 10, 13, "#46303b", "#a78879")
    s += rect(446, 278, 10, 18, "#46303b", "#a78879")
    s += path("M296 211V244M449 237V267", "none", "#b79676", 5)
    if level == 3:
        s += path("M290 193L404 181 449 199 322 216Z", "#60384e", "#e1b78a", 3)
        s += path("M293 199L322 214V261L301 246ZM416 192L444 199V257L426 242Z", "#6d3a5c", "#d6af89")
    return s


def desk(x=43, y=239, level=2):
    s = path(f"M{x} {y}l94 -15 35 18 -96 18Z", "#96775f", "#d4ae82", 2)
    s += path(f"M{x+33} {y+21}v42m77 -55v43", "none", "#997760", 8)
    s += path(f"M{x+46} {y-12}l14 -11 19 9", "#dfca9c", "#a9927b")
    s += rect(x+87, y-18, 7, 14, "#514454", "#a88c78", 1)
    if level == 3:
        s += path(f"M{x+18} {y+4}l24 -4 5 7 -25 5Z", "#69465f", "#e5bc82")
    return s


def chest(x, y, rich=False):
    s = grounded(x, y, 50, 30, "#60444a", "#9c7659")
    s += path(f"M{x+5} {y+27}h40m-19 -10v18", "none", "#dab477" if rich else "#a88c71", 3)
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
                + path("M196 174L286 164 295 211 191 222Z", "#5d4b60", "#d2ad83", 3)
                + path("M209 187l66 -10 -20 25 -40 8Z", "#b9a781", "#736c73"))
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
                + path("M243 217L229 279M251 218L282 283M246 219L244 285", "none", "#a28d88", 7)
                + grounded(28, 238, 99, 44, "#4c485a") + chest(353, 252, rich))
    if room == "gatehouse":
        return (grounded(27, 211, 107, 72, "#4b4047") + chest(361, 245, rich)
                + path("M194 185v94m22 -100v99m22 -96v99", "none", "#a39ca0", 8)
                + path("M182 213l19 -36 17 36 -18 17Z", "#7c7e89", "#c6b3ab", 3)
                + path("M227 215l18 -38 17 38 -18 17Z", "#777985", "#c6b3ab", 3)
                + desk(124, 254, level))
    if room == "refectory":
        return (path("M79 248L324 220 412 259 156 296Z", "#876756", "#c5a07c", 3)
                + path("M148 291v17m258 -50v29M79 248v25", "none", "#76524d", 9)
                + path("M81 278L150 299M335 287L414 272", "none", "#a57e67", 10)
                + shelf(20, 190, 54, 82, rich)
                + path("M197 229v-23m79 17v-23", "none", "#e3c48d", 4))
    if room == "cloister":
        return (path("M176 243Q241 210 310 241L330 268Q241 303 158 267Z", "#55746b", "#99baae", 4)
                + path("M221 248Q245 218 267 246Q247 270 221 248Z", "#8ad0c5", "#c6e0ca", 3)
                + grounded(19, 242, 96, 36, "#5c655a") + grounded(358, 242, 93, 36, "#5c655a")
                + path("M240 242v-68m-24 48q24 -40 48 0", "none", "#a2e1d3", 5))
    return (grounded(22, 220, 103, 65, "#52424e") + chest(150, 249, rich)
            + chest(230, 252, rich) + chest(312, 248, rich)
            + path("M178 193L303 193V210H178Z", "#a58d70", "#dfbd86", 3))


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
