"""Original code-drawn pixel actors and transparent renovation layers; no third-party art."""
from pathlib import Path
out=Path('src/assets/citadel')

def svg(body,w=480,h=200):
 return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" shape-rendering="crispEdges">{body}</svg>\n'
def rect(x,y,w,h,c):return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{c}"/>'
def path(d,c,stroke=None):return f'<path d="{d}" fill="{c}"'+(f' stroke="{stroke}" stroke-width="2"' if stroke else '')+'/>'
gold='#c5a36a';light='#f6d69c';wood='#4c3137';dark='#191626';stone='#5c596c'
# One six-frame 24x40 sheet per resident. Frames: idle, blink, stride, work A/B, rest.
for key,coat,hair,skin in [('guardian','#555a8b','#211e32','#d6aa93'),('archivist','#6d416e','#92705c','#e2b99a'),('smith','#65504a','#4a3431','#b5826b'),('treasurer','#466a65','#b1a0a1','#d4aa94')]:
 body=''
 for frame in range(6):
  q='';off=1 if frame in (1,3) else 0
  q+=rect(5,37,15,2,'#090c18')
  # boots and walking legs
  q+=rect(7,27,4,10,'#28263b')+rect(14,27,4,10,'#303047')
  q+=rect(5 if frame==2 else 6,35,7,3,'#11131f')+rect(15 if frame==2 else 14,35,6,3,'#131622')
  q+=path('M7 15h11l3 17H3z',dark)+rect(7,15+off,11,16,coat)
  q+=rect(7,27+off,11,2,'#baa078')+rect(11,27+off,3,2,light)
  q+=rect(12,17+off,2,10,'#b5a5a0')+rect(8,18+off,2,6,'#ffffff15')
  # arms, held tool or book
  q+=rect(4,17+off,3,11,coat)+rect(4,27+off,3,3,skin)
  q+=rect(18,17+off,3,8 if frame==3 else 11,coat)+rect(18,24+off if frame==3 else 27+off,3,3,skin)
  if key=='guardian':q+=rect(3,20+off,5,11,'#767887')+rect(4,21+off,3,7,'#424860')+rect(21,14,1,20,gold)
  if key=='archivist':q+=rect(15,22+off,8,7,'#d0ad7a')+rect(19,23+off,1,5,'#654a46')
  if key=='smith':q+=rect(9,20+off,8,10,'#372e33')+rect(21,15 if frame==3 else 23,2,10,'#aa7b52')+rect(19,14 if frame==3 else 22,6,4,'#9398a2')
  if key=='treasurer':q+=rect(17,25+off,6,5,'#9c744b')+rect(19,24+off,2,2,gold)
  # neck, face, asymmetric hair, eyes, small highlights
  q+=rect(10,12+off,5,5,skin)+rect(7,3+off,11,11,skin)+rect(6,4+off,2,7,hair)
  q+=path(f'M6 {7+off}V3h2V1h9v2h2v6h-3V5h-2v3h-3V5H9v4H6z',hair)
  q+=rect(8,4+off,3,2,'#a797b04a')+rect(9,9+off,2,1 if frame in (1,5) else 2,'#171927')+rect(15,9+off,2,1 if frame in (1,5) else 2,'#171927')+rect(13,13+off,2,1,'#805a61')
  if key=='guardian':q+=rect(6,14+off,4,5,'#7b779d')+rect(15,14+off,4,5,'#777395')
  if key=='archivist':q+=rect(5,8+off,2,12,hair)+rect(17,9+off,2,10,hair)+rect(8,9+off,4,4,'#bd9d73')+rect(14,9+off,4,4,'#bd9d73')
  if key=='smith':q+=path(f'M8 {12+off}h9v3h-2v2h-5v-2H8z',hair)
  if key=='treasurer':q+=rect(6,3+off,13,2,'#2d4d50')+rect(8,1+off,9,2,'#2d4d50')+rect(13,2+off,2,2,gold)
  body+=f'<g transform="translate({frame*24} 0)">{q}</g>'
 (out/f'{key}.svg').write_text(svg(body,144,40))
# Furniture additions follow the existing room's actual paid upgrades.
for room in ['throne','observatory','rest','study','archive','forge','gatehouse','refectory','cloister','vault']:
 q=''
 if room=='throne':
  for x in [34,420]:q+=rect(x,32,24,80,'#5a244d')+rect(x,30,24,3,gold)+path(f'M{x} 112l12 15 12-15z','#5a244d')+rect(x+10,47,4,43,gold)+rect(x+3,60,18,4,gold)
 if room=='rest':q+=path('M49 155V61l24-17h82l24 17v94h-5V66H54v89z',gold)+path('M55 62h24l-9 64H55zm96 0h23v64h-14z','#672b4f')+rect(58,61,111,4,light)
 if room=='study':q+=rect(294,137,113,7,gold)+rect(299,144,7,34,wood)+rect(394,144,7,34,wood)+rect(319,124,29,12,'#d5b681')+rect(331,124,2,12,wood)+rect(366,128,9,9,'#8666b0')
 if room=='observatory':
  q+='<g fill="none" stroke="#d2a660" stroke-width="3"><ellipse cx="373" cy="108" rx="34" ry="20"/><ellipse cx="373" cy="108" rx="16" ry="38"/><circle cx="373" cy="108" r="29"/></g>'+rect(370,133,6,36,gold)+rect(345,168,57,5,gold)+rect(366,102,14,14,'#9274bd')
 if room=='archive':
  q+=rect(366,66,67,107,wood)
  for y in [69,97,125]:
   for x in range(371,426,7):q+=rect(x,y,5,23,['#87775c','#5f677b','#885865'][x%3])
  for y in [93,121,150,170]:q+=rect(365,y,70,4,gold)
 if room=='forge':q+=path('M325 138h88l-13 17h-22v13l12 9h-48l12-9v-13h-18z','#a2a2ac')+rect(325,137,88,5,'#d4c8c4')+rect(345,178,48,7,'#665159')
 if room=='gatehouse':
  q+=rect(339,57,6,118,stone)+rect(407,57,6,118,stone)
  for y in range(62,169,17):q+=rect(341,y,71,4,gold)
  q+=rect(359,42,9,14,light)+rect(386,42,9,14,light)
 if room=='refectory':
  for x in [310,351,391]:q+=rect(x,130,3,22,light)+rect(x-3,151,9,3,gold)+rect(x,125,3,5,'#ffd694')
  q+=rect(298,155,119,4,gold)
 if room=='cloister':
  q+='<path d="M332 173V78Q370 2 410 78V173M334 83H409" stroke="#a6a29b" stroke-width="6" fill="none"/>'
  for x,y in [(337,100),(344,91),(333,117),(398,101),(400,119),(388,86)]:q+=path(f'M{x} {y}l9-4-3 11-6-1z','#628364')
 if room=='vault':
  q+=rect(338,144,69,32,wood)+path('M338 144v-10h6v-6h57v6h6v10z','#86613f')+rect(338,144,69,4,gold)+rect(344,130,4,44,gold)+rect(397,130,4,44,gold)+rect(369,144,9,13,light)
 for level in [2,3]:
  body=q
  if level==3:
   body+=path('M7 183V37L40 8H440l33 29v146h-7V42L437 16H43L14 42v141z','#80738c')+path('M18 43L46 20H434l27 23','none','#b19970')
   body+=path('M124 183h232l17 11H107z','#733854')+rect(121,188,239,2,gold)
   for x in [28,443]:
    body+=rect(x,125,3,52,gold)+rect(x-6,176,15,3,gold)
    for dx in [-5,0,5]:body+=rect(x+dx,113,2,14,light)+rect(x+dx,109,2,4,'#ffd18a')
  (out/f'{room}-upgrade{3 if level==3 else ""}.svg').write_text(svg(body))
print('created original resident sheets and 20 renovation overlays')

# Structural masonry and a switchback stairwell, retained as small vector tiles.
body='<svg xmlns="http://www.w3.org/2000/svg" width="96" height="24" shape-rendering="crispEdges"><rect width="96" height="24" fill="#15182a"/>'
for row in range(3):
 for col in range(7):
  x=col*16-(8 if row%2 else 0);y=row*8
  body+=f'<path d="M{x+1} {y+1}h14v6h-14z" fill="{["#393d53","#43465d","#30374e"][(row+col)%3]}"/><path d="M{x+2} {y+1}h12v1h-12z" fill="#67647a"/><path d="M{x+2} {y+6}h12v1h-12z" fill="#202437"/>'
body+='</svg>';(out/'stone.svg').write_text(body)
body='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="128" shape-rendering="crispEdges"><rect width="24" height="128" fill="#121727"/><path d="M0 0h3v128H0zm21 0h3v128h-3z" fill="#717087"/>'
for y in range(0,128,32):
 for i in range(8):
  x=3+i*2 if y%64==0 else 17-i*2
  body+=f'<path d="M{x} {y+i*4}h6v2h-6z" fill="#aaa0a1"/><path d="M{x} {y+i*4+2}h6v2h-6z" fill="#4c4b64"/>'
body+='</svg>';(out/'stairs.svg').write_text(body)
