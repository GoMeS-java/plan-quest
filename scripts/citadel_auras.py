"""Native pixel aura atlases. Existing rewards and the approved soft aura stay intact."""
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/'src/assets/citadel'
PALETTES={
 'pulse':('#b58a43','#e7bb60','#fff0b0',2.4),
 'warm':('#a95b32','#e99a55','#ffdb9e',3.4),
 'cold':('#46759e','#8ec5e2','#dcf5f6',3.2),
 'violet':('#654277','#ae83cc','#e4c4ed',3.8),
 'green':('#3b714d','#86b881','#d9e5b0',4.2),
 'flame':('#aa4935','#ef9a43','#ffe6a0',1.2),
 'hearth':('#9e5139','#d9a060','#ffe3a4',3.6),
 'nebula':('#55416f','#a38ac7','#e0c9ef',5.6),
 'abyss':('#392e58','#8165af','#d4b4e2',4.4),
 'smoke':('#35313e','#696170','#cf7d80',3.8),
 'focus':('#355c79','#70b1cc','#d9edf0',3.4),
 'orbit':('#625278','#b1a0d1','#e7d4a4',4.8)}


def frame(key,f):
    dark,mid,light,_=PALETTES[key];p=[]
    def rect(x,y,w,h,c,a=1):p.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{c}" opacity="{a}"/>')
    def path(d,c,a=1):p.append(f'<path d="{d}" fill="{c}" opacity="{a}"/>')
    def star(x,y,c):rect(x,y-1,1,3,c);rect(x-1,y,3,1,c)
    # A broken pixel ring sits under the feet, inside the existing profile margins.
    for x,y,w in [(17,64,9),(28,65,9),(40,64,8),(11,62,4),(50,62,4)]:rect(x,y,w,1,mid,.35+f*.08)
    if key=='pulse':
        for side in [0,1]:
            x=7+f if side==0 else 55-f
            path(f'M{x} 25h2v-5h3v-2h-4v5h-1zm0 17h2v5h3v2h-4v-5h-1z',mid)
            rect(x+side,31,2,6,light,.5+f*.15)
        rect(21,64,22,1,light,.35+f*.15)
    elif key=='warm':
        for n,(x,y) in enumerate([(9,25),(53,29),(12,47),(57,51),(6,57),(51,15)]):
            yy=y-(f+n)%4;rect(x,yy,2,2,mid,.65);rect(x,yy,1,1,light)
            rect(x-2,yy+2,5,2,dark,.12)
    elif key=='cold':
        for n,(x,y) in enumerate([(9,25),(55,29),(12,49),(52,53)]):
            yy=y-(f+n)%3;path(f'M{x} {yy-4}l3 4 -3 4 -3 -4z',mid,.8);rect(x,yy-2,1,4,light)
        for x,y in [(5,40),(59,44),(21,7),(44,8)]:star(x,y,light)
    elif key=='violet':
        for n,(x,y) in enumerate([(7,22),(53,20),(10,45),(51,48)]):
            rect(x,y,4,1,mid);rect(x+(f+n)%2,y+1,1,5,light,.7);rect(x+1,y+5,3,1,mid)
        rect(22,65,4,1,light);rect(38,65,4,1,light)
    elif key=='green':
        for n,(x,y) in enumerate([(8,26),(54,24),(11,47),(52,51)]):
            yy=y-(f+n)%4;path(f'M{x} {yy}h3v-2h3v3h-2v2h-3z',mid);rect(x+1,yy,3,1,light,.7)
        for x in [9,53]:rect(x,55,1,6,dark);rect(x-1,56,3,2,mid,.6)
    elif key=='flame':
        for n,x in enumerate([7,12,51,56]):
            y=49-(f+n)%4*2
            path(f'M{x} 61v-7h-1v-4h2v-5h2v-5h1v9h2v6h1v6z',dark,.6)
            path(f'M{x} 60v-5h1v-5h2v-4h1v9h1v5z',mid)
            rect(x+1,56,2,4,light)
            rect(x+1,y-13,1,2,light,.8)
    elif key=='hearth':
        for n,x in enumerate([11,18,27,37,46,51]):
            rect(x,64,3,2,dark);rect(x+1,64,1,1,light,.4+(f+n)%4*.15)
        for n,(x,y) in enumerate([(8,49),(54,45),(12,35),(51,56)]):
            yy=y-(f+n)%4;rect(x,yy,1,2,light);rect(x-1,yy+2,3,2,mid,.2)
    elif key=='nebula':
        for n,(x,y,w) in enumerate([(4,28,9),(51,34,10),(6,49,8),(50,16,9)]):
            yy=y-(f+n)%3;rect(x,yy,w,4,dark,.25);rect(x+2,yy-2,w-4,8,mid,.14);star(x+4,yy+1,light)
        star(31,7,light)
    elif key=='abyss':
        for x,sign in [(9,1),(54,-1)]:
            path(f'M{x} 14h2v10h{sign*2}v8h{-sign*2}v10h{sign*2}v9h-2v-8h{-sign*2}v-12h{sign*2}z',dark)
            rect(x+(f%2),23,1,8,light,.45+f*.1);rect(x,44,2,5,mid)
        for x in [20,28,39,46]:rect(x,64,3,1,light,.6)
    elif key=='smoke':
        for n,(x,y) in enumerate([(3,25),(51,21),(5,43),(52,47)]):
            yy=y-(f+n)%4*2;rect(x,yy,9,5,dark,.35);rect(x+3,yy-3,6,5,mid,.3);rect(x+1,yy-5,5,3,mid,.16)
        rect(12,54-f,1,1,light);rect(54,39-f,1,1,light)
    elif key=='focus':
        for x,sign in [(7,1),(56,-1)]:
            rect(x,22,1,8,mid);rect(x if sign>0 else x-3,22,4,1,light)
            rect(x if sign>0 else x-3,48,4,1,light);rect(x,41,1,8,mid)
            rect(x+sign*2,33,1,2,light,.4+f*.15)
        rect(21,7,6,1,mid);rect(37,7,6,1,mid)
    elif key=='orbit':
        for x,y in [(8,23),(5,37),(10,53),(53,23),(58,37),(52,53)]:rect(x,y,1,1,mid,.5)
        points=[(7,36),(32,7),(56,36),(32,65)]
        for n,c in enumerate([mid,light,'#9dcbd8']):
            x,y=points[(f+n)%4];star(x,y,c)
    return ''.join(p)


if __name__=='__main__':
    rules=['/* BEGIN generated pixel auras */',':root{--aura-pixels:none;--aura-period:3s}']
    for key,(_,_,light,period) in PALETTES.items():
        svg=['<svg xmlns="http://www.w3.org/2000/svg" width="768" height="216" viewBox="0 0 256 72" preserveAspectRatio="none" shape-rendering="crispEdges"><defs><clipPath id="outside-hero"><path d="M0 0H64V72H0ZM16 9V63H48V9Z" clip-rule="evenodd"/></clipPath></defs>']
        for f in range(4):svg.append(f'<g transform="translate({f*64} 0)"><g clip-path="url(#outside-hero)">'+frame(key,f)+'</g></g>')
        (DEST/f'aura-{key}.svg').write_text(''.join(svg)+'</svg>\n',encoding='utf-8')
        rules.append(':root[data-aura="'+key+'"],[data-aura-preview="'+key+'"]{--aura-pixels:url(\'assets/citadel/aura-'+key+'.svg\');--aura-period:'+str(period)+'s;--aura-preview-glow:'+light+'88}')
    rules.append('[data-aura-preview="soft"]{--aura-pixels:none;--aura-preview-glow:#fff0c888}')
    rules.append('/* END generated pixel auras */')
    css=ROOT/'src/rpg-ui.css';content=css.read_text(encoding='utf-8')
    content=re.sub(r'/\* BEGIN generated pixel auras \*/[\s\S]*?/\* END generated pixel auras \*/\n?','',content)
    css.write_bytes((content.rstrip()+'\n'+'\n'.join(rules)+'\n').encode('utf-8'))
    print('Built pixel atlases for existing unapproved aura variants; soft glow preserved')
