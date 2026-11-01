"""Opaque first-party ruin backdrops. Purchased WebP interiors stay unchanged."""
from pathlib import Path
from random import Random
ROOMS=('throne','observatory','rest','study','archive','forge','gatehouse','refectory','cloister','vault')
def make(room,seed):
 r=Random(seed);p=[]
 def rect(x,y,w,h,c,op=1):p.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{c}" opacity="{op}"/>')
 def path(d,c,stroke=None,sw=1):p.append(f'<path d="{d}" fill="{c}"'+(f' stroke="{stroke}" stroke-width="{sw}"' if stroke else '')+'/>')
 # Opaque masonry, depth, pixel-sized variation and receding flagstone floor.
 p.append('<defs><linearGradient id="wall" x2="0" y2="1"><stop stop-color="#121321"/><stop offset=".6" stop-color="#303044"/><stop offset="1" stop-color="#151521"/></linearGradient><radialGradient id="light"><stop stop-color="#797191" stop-opacity=".25"/><stop offset="1" stop-color="#090b14" stop-opacity=".6"/></radialGradient></defs>')
 rect(0,0,480,320,'#131420');rect(0,0,480,260,'url(#wall)')
 for row in range(18):
  yy=row*14
  for col in range(14):
   xx=col*38-(19 if row%2 else 0)
   c=r.choice(('#282a3a','#242635','#303144','#292a3b','#202231'))
   rect(xx,yy,36,12,c);rect(xx+2,yy+1,31,1,'#696273',.22)
   if r.random()<.22:path(f'M{xx+18} {yy}l-3 4 7 3-2 5','none','#10121c',1)
 # Repeated tall gothic arches create the same architectural language at all tiers.
 for xx in (18,156,294,432):
  path(f'M{xx-28} 249V93Q{xx-28} 40 {xx+34} 12Q{xx+96} 40 {xx+96} 93V249h-10V94Q{xx+82} 47 {xx+34} 29Q{xx-14} 47 {xx-18} 94V249z','#454153')
  path(f'M{xx-17} 242V96Q{xx-12} 51 {xx+34} 30Q{xx+80} 51 {xx+85} 96V242','none','#151522',5)
  for cx in (xx-22,xx+88):
   rect(cx,91,6,163,'#555064');rect(cx+1,92,2,160,'#797083',.5);rect(cx-3,236,12,16,'#353241');rect(cx-5,246,17,9,'#4b4658')
 # Broken lancet windows: cold sky, lead lines and missing panes, no expensive furnishings.
 for xx in (92,362):
  path(f'M{xx-20} 174V86Q{xx-20} 59 {xx} 46Q{xx+20} 59 {xx+20} 86V174z','#11131e','#787087',3)
  path(f'M{xx-16} 168V88Q{xx-16} 64 {xx} 53Q{xx+16} 64 {xx+16} 88V168z','#343647')
  path(f'M{xx} 54v115m-17-67h34m-34 34h34','none','#161622',3)
  for i in range(17):
   x=xx+r.randrange(-15,15);y=r.randrange(82,167)
   rect(x,y,r.randrange(1,5),r.randrange(2,8),r.choice(('#5b526e','#5c6476','#30273f')), .65)
  path(f'M{xx+4} 80l12 9-7 17 9 11-7 19-7-8 5-14-8-10z','#0b0f1a')
  path(f'M{xx-9} 172L{xx-51} 270h103L{xx+9} 172z','#7a738d') if False else None
 # Ornamental frieze and upper cross-ribs, stained and damaged.
 for x in range(0,480,12):
  path(f'M{x} 21l6 5-6 5-6-5z','#5d5369');rect(x,33,8,2,'#4a4259')
 path('M0 0Q130 12 240 55Q350 12 480 0M240 55v-55','none','#585165',4)
 # Floor depth and deterministic debris/dither. The base fills every pixel.
 rect(0,255,480,65,'#181923')
 for y in (258,265,275,290,310):
  rect(0,y,480,2,'#424052');
  for x in range(-60,550,52):path(f'M{x} {y}l6 14','none','#090c15',2)
 for i in range(220):
  x=r.randrange(480);y=r.randrange(235,320);rect(x,y,r.randrange(1,6),r.randrange(1,3),r.choice(('#535061','#353347','#6c6473','#171724')),r.uniform(.3,.8))
 # Empty, ruined objects distinguish each room without revealing restored decor.
 if room in ('study','archive'):
  for x in (26,390):
   rect(x,123,48,124,'#17131d');rect(x,123,4,124,'#57454a');rect(x+43,123,4,124,'#41323d')
   for y in (150,180,211,244):rect(x,y,47,4,'#5b4649')
   for i in range(24):
    xx=x+5+r.randrange(32);yy=r.choice((135,167,197,228));rect(xx,yy,3,r.randrange(8,17),r.choice(('#4e4050','#5d4c4c','#3b4353')))
  rect(169,218,128,7,'#665155');rect(180,225,6,37,'#3d303c');path('M284 225v19l-8 13 4 6 12-18v-20z','#493642')
 elif room=='rest':
  rect(151,239,156,10,'#51414c');rect(155,212,7,48,'#574652');rect(299,233,7,31,'#372d39');path('M160 229l48-10 34 9 52-3 1 13-135 5z','#4c414e');path('M189 216l27 3-9 8-28-2z','#756672')
 elif room=='throne':
  rect(185,244,115,8,'#514a5b');rect(196,235,94,9,'#605768');path('M226 230v-57l9-19 8 23 16 2-7 47z','#3f394b');path('M218 195h38l4 8-40 2z','#66606d')
 elif room=='observatory':
  path('M196 258l39-65 8 4-30 62zM241 195l32 63h-9l-31-59z','#4d4658');path('M225 191l49-21 4 8-47 21z','#555262');rect(270,169,8,12,'#6f6671');path('M270 168l11-8v7l-8 7z','#292736')
 elif room=='forge':
  path('M170 257V187Q209 136 249 187V257z','#4e404b');path('M184 256v-58q25-37 50 0v58z','#0d0d16');path('M273 241h60l-12 10h-15l4 12h-25l3-12z','#5e5662')
 elif room=='gatehouse':
  for x in range(182,296,13):rect(x,89,5,164,'#353743');rect(x+1,91,1,158,'#6b6276',.45)
  rect(176,138,124,6,'#4e4b5c');rect(176,211,124,6,'#454252');path('M183 87h111v166H183z','none','#615569',5)
 elif room=='refectory':
  path('M105 225l242-4 9 11-249 6z','#5b464a');rect(124,237,6,28,'#46313c');path('M316 235l8 9-10 21h7l16-25-4-5z','#493542');rect(178,214,13,7,'#6b5d60');rect(244,219,7,5,'#60515e')
 elif room=='cloister':
  for x in (110,202,294):
   path(f'M{x} 251V118q25-55 50 0v133','none','#696075',6);rect(x+7,130,36,121,'#141a22')
   for i in range(20):rect(x+r.randrange(46),229+r.randrange(28),2,4,r.choice(('#3c4946','#34413e','#566253')),.7)
 elif room=='vault':
  for x,y in ((130,237),(245,242)):
   rect(x,y-23,72,28,'#3a303c');path(f'M{x} {y-23}q32-31 72 0z','#51404b');rect(x+7,y-29,5,34,'#6a5d65');rect(x+58,y-29,5,34,'#6a5d65');rect(x+31,y-12,7,6,'#1c1c28')
 # Torn hangings, hanging chains, cobwebs and dust soften the hard geometry.
 for x in (34,427):
  path(f'M{x} 62h18v71l-4-6-4 14-5-9-5 9z','#3e2b44');rect(x-2,59,22,3,'#776473')
 for i in range(16):rect(240,61+i*6,2,3,'#665b70')
 path('M204 166h74l-8 4h-59z','#68606c');path('M212 167l28-31 29 31M220 167l20-31 20 31','none','#453c50',2)
 for x in (0,480):
  a=1 if x==0 else -1
  for h in (16,33,49):path(f'M{x} {h}Q{x+a*h*.7} {h*.7} {x+a*h} 0','none','#9b8b9e',.6)
  path(f'M{x} 0l{a*51} 48M{x} 0l{a*26} 64','none','#9b8b9e',.5)
 rect(0,0,480,320,'url(#light)')
 for i in range(100):rect(r.randrange(480),r.randrange(320),1,1,'#a597b0',.12)
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320" preserveAspectRatio="none" shape-rendering="crispEdges">'+''.join(p)+'</svg>\n'
if __name__=='__main__':
 for i,room in enumerate(ROOMS):Path(f'src/assets/citadel/{room}-ruins.svg').write_text(make(room,50+i))
