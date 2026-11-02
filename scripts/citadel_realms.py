"""Existing earned environments: deterministic pixel landscapes, no unlock data."""
from pathlib import Path
import random

DEST = Path(__file__).resolve().parents[1] / 'src/assets/citadel'


class Scene:
    def __init__(self):
        self.parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="960" height="384" viewBox="0 0 320 128" shape-rendering="crispEdges">']

    def rect(self, x, y, w, h, c, opacity=1):
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{c}" opacity="{opacity}"/>')

    def poly(self, points, c):
        self.parts.append(f'<polygon points="{points}" fill="{c}"/>')

    def layer(self, name):
        self.parts.append(f'<g id="{name}">')

    def end(self):
        self.parts.append('</g>')

    def sky(self, colors):
        self.layer('sky')
        for i, c in enumerate(colors):
            self.rect(0, i * 16, 320, 16, c)
        self.end()

    def save(self, name):
        (DEST / f'realm-{name}.svg').write_text(''.join(self.parts) + '</svg>\n', encoding='utf-8')


def pine(s, x, y, h, color, light):
    s.rect(x-1, y-h+8, 3, h-7, color)
    for n in range(4):
        top=y-h+n*h//6
        w=4+n*3
        s.poly(f'{x},{top} {x+2},{top} {x+2},{top+3} {x+w},{top+h//4} {x-w},{top+h//4} {x},{top+3}', color)
        s.rect(x-w+2, top+h//4-2, max(2,w//2), 1, light)


def forest():
    s=Scene(); r=random.Random(404)
    s.sky(['#101c2b','#182f3a','#264b4b','#426b60','#658879','#779b82','#50786b','#35564e'])
    s.layer('far-ridges')
    s.poly('0,70 0,58 26,58 26,52 48,52 48,44 74,44 74,48 93,48 93,54 114,54 114,62 145,62 145,128 0,128', '#355956')
    s.poly('130,78 130,62 160,62 160,54 188,54 188,44 214,44 214,38 230,38 230,46 254,46 254,53 285,53 285,62 320,62 320,128 130,128', '#2c4b4c')
    for x in range(3,320,12): pine(s,x,89,r.randrange(14,26),'#244747','#38605a')
    s.end(); s.layer('middle-woodland')
    for x in list(range(0,115,19))+list(range(214,330,18)): pine(s,x,114,r.randrange(40,68),'#193a39','#31564a')
    s.poly('94,128 112,104 134,104 134,96 156,96 156,91 182,91 182,99 208,99 224,128', '#4e7767')
    s.poly('137,128 148,116 164,116 164,104 180,104 180,97 187,97 178,109 172,109 172,119 162,119 156,128', '#8da491')
    s.rect(0,78,320,2,'#89a18a',.18); s.rect(55,88,211,3,'#a6ba95',.12)
    s.end(); s.layer('near-canopy')
    for x,h in [(-1,107),(29,83),(289,92),(317,116)]: pine(s,x,132,h,'#0e292b','#23433a')
    for _ in range(55):
        x,y=r.randrange(320),r.randrange(112,128); s.rect(x,y,r.randrange(2,5),1,r.choice(['#315746','#41634b','#72866a']))
    for x,y in [(72,86),(105,101),(215,91),(251,111)]: s.rect(x,y,1,1,'#d3d69b')
    s.end(); s.save('forest')


def beach():
    s=Scene(); r=random.Random(505)
    s.sky(['#182239','#293749','#425567','#6e7f84','#b5ac98','#b39e82','#67696c','#383f4d'])
    s.layer('distant-coast')
    s.rect(0,73,320,55,'#4c6c78'); s.rect(0,73,320,2,'#b9b5a0')
    s.poly('203,72 213,68 225,68 225,65 238,65 238,57 247,57 247,63 257,63 257,70 279,70 279,73', '#535a65')
    s.rect(238,48,4,18,'#575d67'); s.rect(236,47,8,2,'#c8b58a'); s.rect(238,44,4,3,'#293642')
    for x,y,w in [(15,33,48),(33,37,67),(174,24,70),(199,28,74)]: s.rect(x,y,w,2,'#b1b0a1',.18)
    s.end(); s.layer('water-and-cliffs')
    for _ in range(80):
        y=r.randrange(77,124); s.rect(r.randrange(320),y,r.randrange(2,17),1,r.choice(['#557e87','#8ca0a0','#3b5a69']))
    s.poly('0,128 0,63 14,63 14,69 29,69 29,78 45,78 45,86 66,86 66,101 88,101 88,110 112,110 112,128', '#3c4248')
    s.poly('0,66 14,66 14,73 29,73 29,82 45,82 45,91 63,91 63,95 46,95 46,87 26,87 26,77 12,77 12,72 0,72', '#677065')
    s.poly('113,128 149,112 179,112 179,106 216,106 216,100 253,100 253,94 287,94 287,85 320,85 320,128', '#928574')
    s.poly('120,128 154,116 184,116 184,110 219,110 219,104 255,104 255,98 291,98 291,89 320,89 320,92 295,92 295,101 260,101 260,107 223,107 223,113 188,113 188,119 159,119 136,128', '#c9c3aa')
    s.end(); s.layer('near-shore')
    for x,y,w in [(201,122,26),(271,113,17),(305,106,20)]:
        s.rect(x,y,w,6,'#454b50'); s.rect(x+3,y-2,w-6,2,'#68716d')
    s.poly('0,128 0,110 17,110 17,116 37,116 37,122 57,122 57,128', '#242d36')
    s.rect(20,102,3,22,'#3d3737'); s.rect(13,108,20,3,'#675549')
    s.end(); s.save('beach')


def cave():
    s=Scene(); r=random.Random(606)
    s.sky(['#100f21','#15162b','#1c2337','#293448','#34515b','#2d434b','#1e2c38','#121b29'])
    s.layer('far-grotto')
    for x,y,w in [(92,46,17),(124,37,13),(165,48,22),(203,32,13)]:
        s.poly(f'{x},{y} {x+w},{y} {x+w},{y+34} {x+w//2},{y+51} {x},{y+29}', '#273945')
    s.rect(0,93,320,35,'#1d3945'); s.rect(105,95,101,2,'#547d80')
    for _ in range(55): s.rect(r.randrange(67,258),r.randrange(98,128),r.randrange(2,11),1,r.choice(['#274957','#3a626c','#192d3c']))
    s.end(); s.layer('middle-rock')
    s.poly('0,0 103,0 103,12 91,12 91,27 79,27 79,42 60,42 60,64 45,64 45,88 25,88 25,107 0,107', '#242330')
    s.poly('217,0 320,0 320,112 296,112 296,91 280,91 280,71 266,71 266,48 249,48 249,26 231,26 231,13 217,13', '#23232f')
    for x,y,w in [(4,24,57),(9,56,32),(274,28,41),(290,65,25)]: s.rect(x,y,w,2,'#393744')
    s.end(); s.layer('near-crystals')
    s.poly('0,0 320,0 320,13 288,13 288,8 245,8 245,12 225,12 225,21 213,21 213,8 180,8 180,16 171,16 171,7 137,7 137,12 100,12 100,7 65,7 65,15 52,15 52,8 0,8', '#11141f')
    s.poly('0,128 0,104 34,104 34,113 72,113 72,121 101,121 101,128', '#131b29')
    s.poly('230,128 230,120 261,120 261,111 289,111 289,99 320,99 320,128', '#111a26')
    for x,y,h,w,c,lit in [(33,112,38,10,'#358490','#9bcad0'),(48,116,22,8,'#3a5b78','#8facc6'),(273,112,43,11,'#655587','#b4a3ce'),(290,105,24,8,'#375f78','#8bb3c2')]:
        s.poly(f'{x},{y} {x-w//2},{y-5} {x-w//2},{y-h+9} {x},{y-h} {x+w//2},{y-h+9} {x+w//2},{y-5}', c)
        s.rect(x-2,y-h+10,2,h-12,lit); s.rect(x-3,y-h+8,5,2,lit)
        s.rect(x-9,y+3,18,1,c,.6)
    for x,y in [(101,69),(138,56),(210,76),(243,85)]: s.rect(x,y,1,1,'#7bafbb')
    s.end(); s.save('cave')


if __name__ == '__main__':
    forest(); beach(); cave()
    print('Built three existing environment landscapes')
