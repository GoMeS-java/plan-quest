"""Existing earned environments: deterministic pixel landscapes, no unlock data."""
from pathlib import Path
import random
import re
import xml.etree.ElementTree as ET

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


def stars(s, seed, color='#c8c8dd'):
    r=random.Random(seed)
    for _ in range(85):
        x,y=r.randrange(320),r.randrange(4,85)
        s.rect(x,y,1,1,color,r.choice([.3,.5,.8,1]))
    for x,y in [(49,24),(188,38),(277,17)]:
        s.rect(x,y,1,5,color);s.rect(x-2,y+2,5,1,color)


def ridges(s, colors):
    for n,c in enumerate(colors):
        y=64+n*17
        s.poly(f'0,128 0,{y+15} 21,{y+15} 21,{y+9} 43,{y+9} 43,{y-2} 62,{y-2} 62,{y-12} 77,{y-12} 77,{y-5} 99,{y-5} 99,{y+6} 122,{y+6} 122,{y+12} 156,{y+12} 156,{y+4} 183,{y+4} 183,{y-7} 211,{y-7} 211,{y-15} 226,{y-15} 226,{y-4} 243,{y-4} 243,{y+6} 278,{y+6} 278,{y+12} 320,{y+12} 320,128',c)


def clouds(s, color, offset=0):
    for x,y,w in [(12,19,65),(27,24,87),(177,11,72),(199,16,96),(112,48,71)]:
        s.rect(x,y+offset,w,2,color,.24);s.rect(x+9,y+offset-2,w-21,2,color,.12)


def winter():
    s=Scene();r=random.Random(710)
    s.sky(['#273447','#3a4c62','#536b80','#7891a1','#a5b8c0','#ced8d9','#b1c5cb','#7c9cae'])
    s.layer('far-snow-ridges');ridges(s,['#748f9f','#668593','#4e6e81']);clouds(s,'#e4edef');s.end()
    s.layer('taiga')
    for x in range(-3,327,11):
        h=r.randrange(19,38);pine(s,x,101,h,'#345367','#6b8998')
    for x in list(range(-4,110,18))+list(range(213,333,17)):
        h=r.randrange(36,69);pine(s,x,120,h,'#233f54','#4f6c80')
        for n in range(4):
            yy=120-h+n*h//6+h//4-3;w=4+n*3
            s.rect(x-w+1,yy,w*2-1,2,'#bfd0d7');s.rect(x-w+3,yy-1,max(3,w),1,'#e0e9e9')
    s.poly('0,128 0,119 43,119 43,115 81,115 81,118 106,118 106,112 138,112 138,107 165,107 165,103 193,103 193,109 225,109 225,113 261,113 261,117 320,117 320,128','#aec4d0')
    s.poly('83,128 111,119 141,119 141,114 166,114 166,108 179,108 179,106 193,106 179,111 173,111 173,118 150,118 150,123 131,123 117,128','#e1e9e9')
    s.end();s.layer('near-drifts')
    for x,y,w in [(0,122,68),(204,122,70),(265,118,55)]:
        s.rect(x,y,w,6,'#e8eff0');s.rect(x+5,y-2,w-12,2,'#d1dfe4');s.rect(x+15,y-3,max(1,w-32),1,'#f3f5ef')
    for x,y in [(140,122),(151,119),(159,116)]:s.rect(x,y,2,1,'#7c9cad')
    pine(s,11,128,82,'#1c354b','#456176');pine(s,308,132,91,'#1c354b','#456176')
    for x,base,h in [(11,128,82),(308,132,91)]:
        for n in range(4):
            yy=base-h+n*h//6+h//4-3;w=4+n*3
            s.rect(x-w,yy,w*2,3,'#c4d6de');s.rect(x-w+2,yy-1,w*2-5,1,'#f0f4f2')
    s.end();s.save('winter')


def celestial(key):
    palettes={
        'space':['#100d29','#181333','#241c43','#35264d','#4b3659','#5d4865','#2a304a','#111c32'],
        'aurora':['#081922','#0c2230','#12303e','#1c414b','#2f555c','#45666c','#1b394b','#102637'],
        'watch':['#0b1326','#121d31','#1b2a40','#293b51','#45556b','#657183','#2c4052','#192e42'],
        'abyss':['#100c21','#1c132d','#2a1d3e','#3a2a50','#4a3963','#5c4b74','#2f2c4c','#161b32']}
    s=Scene();s.sky(palettes[key]);s.layer('celestial-sky');stars(s,720)
    if key=='aurora':
        for x in range(36,279,3):
            y=12+int(9*__import__('math').sin(x/36));h=12+int(10*__import__('math').sin(x/28)**2)
            s.rect(x,y,3,h,'#65bfa5',.18);s.rect(x,y+h,3,5,'#afafd0',.18)
    elif key=='space':
        for x in range(53,258,5):s.rect(x,64-(x//5)%17,5,3,'#9b7ea9',.13)
        s.poly('219,26 224,26 224,23 237,23 237,26 242,26 242,31 245,31 245,43 242,43 242,48 237,48 237,51 224,51 224,48 219,48 219,43 216,43 216,31 219,31','#ae867e')
        s.rect(222,32,17,3,'#cfaa91');s.rect(217,39,25,2,'#875f75');s.rect(204,40,48,2,'#c5b3b3',.7)
    elif key=='watch':
        s.rect(249,20,15,15,'#d3d9cf');s.rect(247,24,19,7,'#d3d9cf');s.rect(252,20,12,12,'#99adb9');s.rect(251,24,4,3,'#dce4d6')
    else:
        s.poly('157,8 164,8 164,30 170,30 170,55 165,55 165,77 158,77 158,53 153,53 153,29 157,29','#ae85b1')
        s.rect(159,12,2,59,'#e5c3d6');s.rect(151,32,2,19,'#705182')
    s.end();s.layer('distant-ridges');ridges(s,['#344052' if key!='abyss' else '#463854','#202e43']);s.end()
    s.layer('foreground')
    if key in ['watch','aurora']:
        for x in list(range(-5,76,15))+list(range(253,330,15)):pine(s,x,130,random.Random(x).randrange(34,66),'#122734','#294151')
    else:
        for x,y,h in [(13,101,43),(57,120,34),(266,112,41),(308,104,59)]:
            s.poly(f'{x-12},128 {x-12},{y} {x-5},{y} {x-5},{y-h+8} {x},{y-h} {x+6},{y-h+8} {x+6},{y} {x+13},{y} {x+13},128','#141d31')
            s.rect(x-4,y-h+12,2,h-11,'#55516a')
    s.end();s.save(key)


def dawn(key):
    palettes={
        'dawn':['#34364e','#55506a','#796579','#a17e87','#c3998e','#d1b09a','#8b8f89','#525f68'],
        'sunrise':['#333b59','#555574','#87718a','#bb8b91','#d6a68f','#e6c49a','#b3ab91','#6d8583'],
        'sunset':['#312b4b','#523556','#7a465f','#a45d6b','#c78075','#d5a180','#947879','#4e5368']}
    s=Scene();s.sky(palettes[key]);s.layer('sunlit-distance');clouds(s,'#edd0bb',9)
    y=64 if key=='dawn' else 51 if key=='sunrise' else 68
    s.rect(216,y,22,18,'#ead1a6');s.rect(219,y-3,16,24,'#ead1a6');s.rect(213,y+4,28,10,'#ead1a6')
    ridges(s,['#8a7c88','#5c6273','#344957']);s.end();s.layer('near-ruins')
    s.rect(21,72,9,56,'#243342');s.rect(20,70,11,3,'#45505c');s.rect(24,64,3,6,'#243342')
    s.rect(35,86,7,42,'#243342');s.rect(20,97,31,4,'#243342')
    for x in [8,63,273,313]:pine(s,x,133,43,'#223442','#4f585e')
    s.rect(80,113,155,1,'#a0a19a',.32);s.rect(106,119,111,1,'#c5b596',.32)
    s.end();s.save(key)


def city():
    s=Scene();s.sky(['#191c34','#2d2a48','#493a58','#68516d','#896a7e','#9b8190','#5d5a73','#34384f'])
    s.layer('far-city');clouds(s,'#b89aa6')
    for x in range(-9,330,17):
        h=random.Random(x).randrange(12,32);s.rect(x,90-h,14,h+38,'#4b4a63');s.poly(f'{x-2},{90-h} {x+7},{80-h} {x+16},{90-h}','#4b4a63')
    s.end();s.layer('middle-city')
    for x,h,w in [(13,42,23),(51,31,29),(95,62,27),(143,38,32),(191,74,29),(238,47,31),(287,37,26)]:
        y=118-h;s.rect(x,y,w,h+10,'#2d344b');s.poly(f'{x-3},{y} {x+w//2},{y-15} {x+w+3},{y}','#252b43');s.rect(x+w//2,y-22,2,8,'#252b43')
        for yy in range(y+8,117,9):
            for xx in range(x+5,x+w-3,7):s.rect(xx,yy,2,3,'#b99c84' if (xx+yy)%3 else '#576079')
    s.end();s.layer('near-bridge');s.rect(0,119,320,9,'#17273a')
    for x in range(0,320,22):s.rect(x,114,4,5,'#203043');s.rect(x+1,112,3,2,'#727283')
    s.rect(0,119,320,2,'#596071');s.end();s.save('city')


def weather(key):
    s=Scene();s.sky(['#141c2c','#202b3a','#2c3949','#3b4859','#506071','#647789','#3d5363','#253b4e'])
    s.layer('storm-clouds');clouds(s,'#8893a3',5)
    for x,y,w in [(0,22,84),(65,13,99),(174,19,110),(247,32,73)]:
        s.rect(x,y,w,9,'#1a2737');s.rect(x+8,y+9,w-18,3,'#263446')
    if key=='storm':s.poly('226,27 235,27 225,46 231,46 212,68 221,47 215,47','#c2d0d9')
    s.end();s.layer('distant-rain');ridges(s,['#526270','#354c5e','#243b4c'])
    for x in range(0,320,7):s.rect(x,57+(x%17),1,11,'#a4b4bd',.13)
    s.end();s.layer('wet-foreground')
    for x in [8,38,73,277,310]:pine(s,x,134,58,'#152e3e','#355160')
    for x,w in [(88,39),(142,55),(213,26)]:s.rect(x,119,w,1,'#91a6b0',.4)
    s.end();s.save(key)


def peaks():
    s=Scene();s.sky(['#19293e','#2b3f58','#435974','#657c94','#8ca2b5','#b1c0cc','#748c9f','#3d586c']);s.layer('far-peaks');clouds(s,'#d4dce1')
    ridges(s,['#788fa5','#567189']);s.end();s.layer('snow-mountains')
    for x,y,w,h,c in [(70,23,110,105,'#3a526b'),(216,13,123,115,'#30485f')]:
        s.poly(f'{x-w//2},128 {x-15},{y+19} {x-8},{y+19} {x-8},{y+9} {x},{y} {x+9},{y+10} {x+9},{y+18} {x+17},{y+18} {x+w//2},128',c)
        s.poly(f'{x-27},{y+41} {x-15},{y+19} {x-8},{y+19} {x-8},{y+9} {x},{y} {x+9},{y+10} {x+9},{y+18} {x+17},{y+18} {x+30},{y+43} {x+15},{y+35} {x+5},{y+42} {x-4},{y+31} {x-14},{y+37}','#ced8dd')
        s.poly(f'{x},{y+3} {x+9},{y+10} {x+9},{y+18} {x+17},{y+18} {x+30},{y+43} {x+15},{y+35} {x+5},{y+42}','#91aabd')
    s.end();s.layer('near-ridge');ridges(s,['#1a3349']);s.rect(91,112,35,2,'#92a7b6');s.rect(180,118,44,2,'#92a7b6');s.end();s.save('peaks')


def heritage(key):
    s=Scene();r=random.Random(840)
    palette=['#171b30','#272a41','#3a354e','#514258','#70586c','#8b6f7d','#4b4c61','#2a354a']
    if key=='chamber':palette=['#140f22','#21162c','#321f37','#46283e','#603445','#70414b','#342a3c','#1d2538']
    s.sky(palette);s.layer('distant-sky');stars(s,842,'#b6a8be');clouds(s,'#b29ca9');ridges(s,['#4f455d','#34374e']);s.end()
    s.layer('heritage-buildings')
    if key=='attic':
        for x,y,w in [(-9,87,63),(61,99,54),(142,92,66),(229,82,63),(288,101,45)]:
            s.rect(x,y,w,39,'#443840');s.poly(f'{x-7},{y} {x+8},{y-16} {x+w//2},{y-31} {x+w-9},{y-16} {x+w+7},{y}','#302b3a')
            s.rect(x+10,y-26,5,16,'#64505a');s.rect(x+8,y-27,9,2,'#88706d')
            for yy in range(y-12,y,4):s.rect(x+6,yy,w-10,1,'#5f4853')
            for xx in range(x+10,x+w-6,15):s.rect(xx,y+7,5,9,'#b49a7b');s.rect(xx+2,y+7,1,9,'#4d3e46')
    elif key=='library':
        for x,y,w in [(-10,58,82),(85,74,60),(181,67,48),(244,46,81)]:
            s.rect(x,y,w,128-y,'#38354b');s.rect(x,y,w,3,'#7f6974');s.poly(f'{x-5},{y} {x+w//2},{y-18} {x+w+5},{y}','#292a40')
            for xx in range(x+7,x+w-5,15):
                s.rect(xx,y+8,8,32,'#242639');s.rect(xx+2,y+11,4,26,'#b89b83');s.rect(xx+3,y+15,2,15,'#dbbc92')
                s.rect(xx-1,y+43,10,2,'#756071')
            for yy in range(y+52,122,12):s.rect(x+4,yy,w-8,1,'#554558')
            s.rect(x+3,y+4,3,124-y,'#6c5668');s.rect(x+w-6,y+4,3,124-y,'#292a3c')
    else:
        for x,y,w in [(27,65,33),(70,88,45),(207,76,37),(266,49,34)]:
            s.rect(x,y,w,128-y,'#292439');s.poly(f'{x-5},{y} {x+w//2},{y-25} {x+w+5},{y}','#1a1c30');s.rect(x+w//2,y-32,2,7,'#1a1c30')
            for yy in range(y+9,121,13):
                for xx in range(x+7,x+w-4,11):s.rect(xx,yy,3,5,'#b77b80' if r.randrange(3)==0 else '#534257')
        s.rect(152,29,18,16,'#aa7a82');s.rect(149,33,24,8,'#aa7a82');s.rect(157,29,13,13,'#6b465d')
    s.end();s.layer('near-garden')
    s.poly('0,128 0,118 58,118 58,113 107,113 107,121 173,121 173,116 226,116 226,119 320,119 320,128','#1b2839')
    for x in [9,158,312]:pine(s,x,132,27,'#172638','#3b4252')
    s.end();s.save(key)


def snow_roof():
    p=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 120" shape-rendering="crispEdges">']
    def rect(x,y,w,h,c):p.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{c}"/>')
    def drift(x,y,w,h):
        rect(x,y+2,w,h,'#7897b6');rect(x,y,w,h,'#bdcfdf');rect(x+2,y-2,w-4,h,'#e3edf2');rect(x+5,y-3,max(2,w-11),2,'#f6f7f3')
        rect(x+w-5,y+h,2,3,'#afcada')
    for x in range(0,800,28):drift(x-1,79,20,4)
    for x,w in [(78,65),(197,135),(467,134),(656,67)]:
        drift(x,73,w,4)
        for xx in range(x+4,x+w-4,18):drift(xx,69,9,4)
    # Follow each existing tower's stepped roof slopes, leaving its lit window clear.
    for x,w,top in [(7,67,19),(726,67,12),(147,45,37),(607,45,34)]:
        right=x+w+7;y=top+22
        points=[(right-8,y-8),(right-13,y-8),(right-22,y-21),(right-29,y-21),(right-37,y-33),(right-46,y-33),(right-54,y-21),(right-61,y-21),(right-70,y-8),(x-7,y)]
        for a,b in zip(points,points[1:]):
            if a[1]==b[1]:drift(min(a[0],b[0])-1,a[1]-1,abs(a[0]-b[0])+4,3)
            else:
                steps=max(abs(a[0]-b[0]),abs(a[1]-b[1]))//3+1
                for n in range(steps):
                    xx=round(a[0]+(b[0]-a[0])*n/steps);yy=round(a[1]+(b[1]-a[1])*n/steps)
                    rect(xx-2,yy-2,6,4,'#c9dce6');rect(xx-1,yy-3,4,2,'#f2f5f1')
        drift(x-6,top+20,w+12,5)
    # Central stepped gable and deep windswept drifts between turrets.
    for x,y,w in [(339,46,17),(354,34,11),(363,25,10),(372,13,10),(381,4,10),(391,-1,9),(399,4,11),(409,13,10),(418,25,11),(427,34,11),(437,46,16)]:drift(x,y,w,4)
    for x,y,w,h in [(84,92,57,7),(199,89,91,10),(463,90,83,9),(655,91,63,8)]:
        drift(x,y,w,h);rect(x+9,y-4,w//3,2,'#f7f8f5');rect(x+5,y+h-1,w-10,2,'#adc7d9')
    for x in [82,210,286,473,539,677]:rect(x,102,2,5,'#b6cfdf');rect(x+3,102,1,3,'#e1edf3')
    p.append('</svg>');(DEST/'snow-roof.svg').write_text(''.join(p)+'\n',encoding='utf-8')


def frost_masks():
    # Use the actual apertures, including their mullions: ice cannot invent a window.
    for source in list(DEST.glob('*-apertures.svg'))+list(DEST.glob('*-windows-*.svg')):
        content=source.read_text(encoding='utf-8');inner=content[content.index('>')+1:content.rindex('</svg>')]
        defs='<defs><filter id="ice" x="-5%" y="-5%" width="110%" height="110%"><feColorMatrix type="luminanceToAlpha" result="glass"/><feMorphology in="glass" operator="erode" radius="2.2" result="core"/><feComposite in="glass" in2="core" operator="out" result="edge"/><feFlood flood-color="#d5e9f4"/><feComposite in2="edge" operator="in"/></filter></defs>'
        branches=[]
        for d in re.findall(r'<path d="([^"]+)" fill="#fff"',inner):
            ns=[float(n) for n in re.findall(r'\d+(?:\.\d+)?',d)];left,bottom,right=ns[0],ns[1],ns[7]
            for x,sign in [(left+3,1),(right-3,-1)]:
                for step in range(6):
                    y=bottom-4-step*4;xx=x+sign*step
                    branches.append(f'<path d="M{xx-sign*3} {y+4}L{xx} {y}l{sign*2} -5m{-sign*2} 5l{sign*5} -1" fill="none" stroke="#dceff5" stroke-width="1" opacity=".75"/>')
        svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320">'+defs+'<defs><mask id="glass-mask">'+inner+'</mask></defs><g filter="url(#ice)">'+inner+'</g><g mask="url(#glass-mask)">'+''.join(branches)+'</g></svg>\n'
        target=source.name.replace('-apertures','-frost').replace('-windows-','-frost-')
        (DEST/target).write_text(svg,encoding='utf-8')


def visible_windows():
    from citadel_interiors import arch, furnishings, details, ruined
    from citadel_room_depth import ROOMS, path
    def black(svg):
        return re.sub(r'(fill|stroke)="(?!none")[^"]+"',lambda m:m[1]+'="#000"',svg)
    for room in ROOMS:
        if room=='vault':continue
        geometry=''
        if room=='observatory':
            geometry=arch(126,228,8,201,'#fff','#000')+path('M137 197Q242 38 342 197M145 148H335M240 17V200','none','#000',2)
        elif room=='gatehouse':
            geometry=arch(168,144,36,220,'#fff','#000')
            for x in range(177,310,14):geometry+=path(f'M{x} 83V217','none','#000',4)
            geometry+=path('M173 125H309M173 176H309','none','#000',5)
        elif room=='forge':
            geometry=arch(338,66,46,173,'#fff','#000')+path('M371 53V174M341 118H401','none','#000',3)
        elif room=='cloister':
            for x in [65,185,305]:
                geometry+=arch(x,104,24,215,'#fff','#000')
                geometry+=path(f'M{x+5} 195q36 -45 94 -22v42h-94Z','#000','none',0)
                geometry+=path(f'M{x+14} 211v-48m7 26l-7 -15 -8 8m70 28v-66','none','#000',3)
        else:
            for x in [100,324]:
                geometry+=arch(x+6,44,31,176,'#fff','#000')
                geometry+=path(f'M{x+28} 32V179M{x+5} 103H{x+51}M{x+5} 143H{x+51}','none','#000',3)
        # Subtract the same foreground artwork at its actual stage transform.
        # This fills the whole pane without painting over a bed, shelf or telescope.
        for level in [1,2,3]:
            foreground=black(ruined(room)) if level==1 else '<g transform="translate(0,-10) scale(1,.94)">'+black(furnishings(room,level)+details(room,level))+'</g>'
            svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320">'+geometry+foreground+'</svg>\n'
            (DEST/f'{room}-windows-{level}.svg').write_text(svg,encoding='utf-8')


def ambient_details():
    ns='{http://www.w3.org/2000/svg}'
    for key in ['forest','beach','cave','space','aurora','watch','abyss','dawn','sunrise','sunset','city','rain','storm','peaks','library','attic','chamber']:
        groups=[Scene(),Scene()]
        colors={
            'city':['#b99c84'],'library':['#b89b83','#dbbc92'],'attic':['#b49a7b'],
            'chamber':['#b77b80'],'space':['#c8c8dd'],'watch':['#c8c8dd'],
            'cave':['#9bcad0','#8facc6','#b4a3ce','#8bb3c2'],
            'abyss':['#e5c3d6','#ae85b1'],'aurora':['#65bfa5','#afafd0']}
        if key in colors:
            source=ET.fromstring((DEST/f'realm-{key}.svg').read_text(encoding='utf-8'))
            n=0
            for node in source.iter():
                if node.get('fill') in colors[key]:
                    node.tag=node.tag.replace(ns,'');node.attrib.pop('opacity',None)
                    highlights={'city':'#ffe6af','library':'#ffe6af','attic':'#ffe6af','chamber':'#eeacba','space':'#fff6e8','watch':'#fff6e8','abyss':'#f3d4ff'}
                    if key in highlights:node.set('fill',highlights[key])
                    elif key=='cave':node.set('fill','#ecd9ff' if node.get('fill')=='#b4a3ce' else '#c5f4ff')
                    elif key=='aurora':node.set('fill','#9ce8ce' if node.get('fill')=='#65bfa5' else '#d6c2ed')
                    groups[1 if key=='watch' else n%2].parts.append(ET.tostring(node,encoding='unicode'));n+=1
            if key=='watch':
                groups[0].rect(232,26,43,2,'#b1c3d4',.25);groups[0].rect(246,29,41,2,'#b1c3d4',.18)
        elif key=='forest':
            for n,(x,y) in enumerate([(72,86),(105,101),(215,91),(251,111),(147,98),(183,88)]):
                groups[n%2].rect(x-1,y-1,3,3,'#c7d79a',.15);groups[n%2].rect(x,y,1,1,'#e3e3ad')
        elif key=='beach':
            for n,(x,y,w) in enumerate([(101,83,27),(173,79,41),(226,89,28),(141,98,31),(188,94,23)]):
                groups[n%2].rect(x,y,w,1,'#bcd0cc');groups[n%2].rect(x+7,y+2,w-12,1,'#7f9eaa')
        elif key in ['rain','storm']:
            for n,(x,y,w) in enumerate([(94,117,21),(145,120,29),(209,116,19)]):
                groups[n%2].rect(x,y,w,1,'#93aab7');groups[n%2].rect(x+3,y-2,w-6,1,'#93aab7',.5)
            if key=='storm':groups[1].poly('226,27 235,27 225,46 231,46 212,68 221,47 215,47','#e0eaf3')
        elif key=='peaks':
            for n,(x,y,w) in enumerate([(51,42,29),(189,34,39),(94,88,46),(239,81,51)]):
                groups[n%2].rect(x,y,w,1,'#c5dae5',.65);groups[n%2].rect(x+4,y+2,w-11,1,'#c5dae5',.35)
        elif key=='dawn':
            for n,(x,y,w) in enumerate([(16,92,94),(116,102,119),(209,88,102)]):
                groups[n%2].rect(x,y,w,2,'#d0b6b0',.26);groups[n%2].rect(x+9,y+3,w-27,1,'#e6c5b6',.17)
        elif key=='sunrise':
            for n,(x,y,w,h) in enumerate([(207,46,4,31),(243,44,3,34),(216,38,18,2),(215,78,19,2)]):groups[n%2].rect(x,y,w,h,'#f0d9ad',.4)
        elif key=='sunset':
            for n,(x,y) in enumerate([(106,36),(137,43),(174,30),(193,44)]):groups[n%2].poly(f'{x-3},{y} {x},{y+1} {x+3},{y} {x+2},{y+2} {x},{y+3} {x-2},{y+2}','#272c43')
        for n,scene in enumerate(groups):scene.save(key+f'-life-{n+1}')


def environment_styles():
    from citadel_room_depth import ROOMS
    rules=['/* BEGIN generated realm alignment */']
    for room in ROOMS:
        if room=='vault':continue
        for level in [1,2,3]:
            rules.append('body.citadel-shell-active #citadel-home :is([data-croom="'+room+'"][data-room-level="'+str(level)+'"],[data-room="'+room+'"][data-level="'+str(level)+'"]){--window-mask:url(\'assets/citadel/'+room+'-windows-'+str(level)+'.svg\');--frost-art:url(\'assets/citadel/'+room+'-frost-'+str(level)+'.svg\')}')
    motions={
        'city':('realmCityLights',3.7,'realmCityLights',6.1),
        'library':('realmRays',7,'realmCityLights',11),
        'attic':('realmRays',9,'realmCityLights',6),
        'chamber':('realmTwinkle',6,'realmRays',8),
        'forest':('realmFireflies',7,'realmFireflies',11),
        'beach':('realmSurf',6,'realmSurf',8),
        'cave':('realmRays',6,'realmTwinkle',9),
        'space':('realmTwinkle',5,'realmTwinkle',8),
        'watch':('realmMist',16,'realmTwinkle',8.5),
        'abyss':('realmRays',4,'realmTwinkle',9),
        'aurora':('realmRays',8,'realmMist',12),
        'dawn':('realmMist',15,'realmMist',22),
        'sunrise':('realmRays',12,'realmRays',16),
        'sunset':('realmBirds',22,'realmBirds',27),
        'rain':('realmSurf',2.8,'realmSurf',4),
        'storm':('realmSurf',3,'realmStorm',11),
        'peaks':('realmMist',14,'realmMist',19)}
    for key,(a,da,b,db) in motions.items():
        rules.append(':root[data-citadel-bg="'+key+'"],[data-realm-preview="'+key+'"]{--realm-life-a:url(\'assets/citadel/realm-'+key+'-life-1.svg\');--realm-life-b:url(\'assets/citadel/realm-'+key+'-life-2.svg\');--realm-motion-a:'+a+';--realm-speed-a:'+str(da)+'s;--realm-motion-b:'+b+';--realm-speed-b:'+str(db)+'s}')
    rules.append('/* END generated realm alignment */')
    css=DEST.parents[1]/'rpg-ui.css';content=css.read_text(encoding='utf-8')
    content=re.sub(r'/\* BEGIN generated realm alignment \*/[\s\S]*?/\* END generated realm alignment \*/\n?','',content)
    css.write_bytes((content.rstrip()+'\n'+'\n'.join(rules)+'\n').encode('utf-8'))


if __name__ == '__main__':
    forest();beach();cave();winter();city();peaks()
    for key in ['space','aurora','watch','abyss']:celestial(key)
    for key in ['dawn','sunrise','sunset']:dawn(key)
    for key in ['rain','storm']:weather(key)
    for key in ['library','attic','chamber']:heritage(key)
    snow_roof();visible_windows();frost_masks();ambient_details();environment_styles()
    print('Built existing environment landscapes, fitted roof snow and aperture frost')
