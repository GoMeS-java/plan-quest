"""Existing reward frames: editable pixel nine-slice borders, no unlock data."""
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1];DEST=ROOT/'src/assets/citadel'
PALETTES={
 'gold':('#362637','#796048','#c69b64','#f3d8a0',8),
 'double':('#282335','#665269','#b79b80','#edcf9f',10),
 'dash':('#282535','#5d5667','#a399a3','#dacac0',8),
 'neon':('#202434','#41465d','#6e95ab','#c4eddf',4.5),
 'wood':('#241f2a','#57413b','#92715a','#c7a078',12),
 'ice':('#263244','#536f89','#9cbdd0','#edf7f4',7),
 'pixel':('#272234','#62516d','#ab8f87','#dec398',9),
 'vine':('#202c2b','#42513d','#7b9670','#b6c498',9),
 'rgb':('#252239','#5a4b73','#a188c2','#e1c7dc',10),
 'vitrage':('#282331','#635064','#a67b89','#e6c3a3',12),
 'abyss':('#1b1b2c','#40344f','#7a6296','#c7afd9',8),
 'shard':('#262635','#52576c','#9a9cb1','#e1dfdf',9),
 'scan':('#202a32','#3f5962','#73a69e','#c7dfb4',5),
 'sunset':('#302333','#714654','#b77c77','#edb98d',11)}


class Border:
    def __init__(self):self.p=['<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 120 120" shape-rendering="crispEdges">']
    def rect(self,x,y,w,h,c,a=1):self.p.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{c}" opacity="{a}"/>')
    def poly(self,points,c,a=1):self.p.append(f'<polygon points="{points}" fill="{c}" opacity="{a}"/>')
    def ring(self,i,w,c):
        self.rect(i,i,120-2*i,w,c);self.rect(i,120-i-w,120-2*i,w,c)
        self.rect(i,i+w,w,120-2*i-2*w,c);self.rect(120-i-w,i+w,w,120-2*i-2*w,c)
    def group(self,transform):self.p.append(f'<g transform="{transform}">')
    def end(self):self.p.append('</g>')
    def save(self,key,suffix=''):(DEST/f'frame-{key}{suffix}.svg').write_text(''.join(self.p)+'</svg>\n',encoding='utf-8')


def draw(key):
    ink,dark,mid,light,_=PALETTES[key];s=Border();s.ring(0,3,ink);s.ring(3,2,light);s.ring(5,10,dark);s.ring(15,2,mid);s.ring(17,2,ink);s.ring(19,1,light)
    for turn in [0,90,180,270]:
        s.group(f'rotate({turn} 60 60)')
        for x in [25,44,63,82]:
            if key=='gold':s.rect(x,7,13,1,mid);s.rect(x+4,9,5,2,mid);s.rect(x+6,9,1,1,light)
            elif key=='double':s.rect(x,7,14,2,mid);s.rect(x+3,11,8,1,light);s.rect(x+7,9,1,2,ink)
            elif key=='dash':s.rect(x,6,12,8,mid);s.rect(x+1,7,10,1,light);s.rect(x+2,12,8,1,dark)
            elif key=='neon':s.rect(x,8,15,2,'#91b9c8');s.rect(x+2,11,11,1,'#b99bc6');s.rect(x,7,2,6,mid)
            elif key=='wood':s.rect(x,7,16,1,mid);s.rect(x+4,10,12,1,mid);s.rect(x+1,12,9,1,'#3d3032')
            elif key=='ice':s.poly(f'{x},13 {x+4},6 {x+10},9 {x+14},6 {x+17},12 {x+10},14',mid);s.rect(x+5,8,6,1,light)
            elif key=='pixel':
                for dx,c in [(0,mid),(4,light),(8,dark),(12,mid)]:s.rect(x+dx,7+(dx%8)//2,3,3,c)
            elif key=='vine':s.rect(x,10,17,1,mid);s.poly(f'{x+3},9 {x+5},6 {x+9},6 {x+9},9 {x+6},11',mid);s.rect(x+5,7,2,1,light)
            elif key=='rgb':
                for dx,c in [(0,'#b38ba9'),(4,'#979aca'),(8,'#87b7ba'),(12,'#d1b88f')]:s.rect(x+dx,8,3,4,c)
            elif key=='vitrage':
                for dx,c in [(0,'#9a667c'),(5,'#6f98a1'),(10,'#c2a075')]:s.poly(f'{x+dx},7 {x+dx+4},10 {x+dx},13 {x+dx-3},10',c)
            elif key=='abyss':s.rect(x+2,7,1,6,mid);s.rect(x+3,7,5,1,mid);s.rect(x+3,10,3,1,light);s.rect(x+7,11,1,3,mid)
            elif key=='shard':s.poly(f'{x},12 {x+4},6 {x+13},7 {x+8},10 {x+15},13',mid);s.rect(x+5,7,6,1,light)
            elif key=='scan':s.rect(x,7,12,1,mid);s.rect(x+3,9,1,4,light);s.rect(x+6,10,6,1,mid);s.rect(x+14,8,2,4,mid)
            elif key=='sunset':s.rect(x,7,15,2,'#c48b7b');s.rect(x+2,10,11,1,mid);s.rect(x+5,12,5,1,light)
        # Corner joints have their own geometry and fastening material.
        s.poly('3,3 19,3 19,7 10,7 7,10 7,19 3,19',mid);s.rect(5,5,9,1,light);s.rect(5,6,1,8,light)
        if key=='wood':
            s.poly('3,3 18,3 18,6 9,6 6,9 6,18 3,18','#5e5b61');s.rect(7,7,3,3,ink);s.rect(8,7,1,1,light)
        elif key=='ice':s.poly('5,5 12,5 9,10 14,14 10,16 6,11',light);s.rect(9,5,1,6,mid)
        elif key=='vine':s.poly('7,7 13,6 15,9 11,12 7,12',mid);s.rect(8,9,5,1,light);s.poly('9,12 13,13 12,18 8,16',mid)
        elif key=='shard':s.poly('4,4 15,4 11,8 15,14 8,12',light);s.poly('5,6 9,8 6,14',dark)
        elif key=='vitrage':s.poly('7,7 15,7 15,12 11,15 7,12','#b184a9');s.rect(10,8,1,5,light)
        else:s.rect(8,8,6,6,ink);s.rect(9,9,4,4,mid);s.rect(10,9,2,1,light)
        s.end()
    s.save(key)
    glow=Border()
    for turn in [0,90,180,270]:
        glow.group(f'rotate({turn} 60 60)');glow.rect(8,7,3,1,light);glow.rect(7,8,1,3,light)
        for x in [31,69,90]:glow.rect(x,8,3,1,light,.85)
        glow.end()
    glow.save(key,'-light')


if __name__=='__main__':
    rules=['/* BEGIN generated reward frames */',':root{--reward-frame-art:none;--reward-frame-light:none;--reward-frame-period:8s}']
    for key,(_,_,_,_,period) in PALETTES.items():
        draw(key)
        rules.append(':root[data-reward-frame="'+key+'"],[data-frame-preview="'+key+'"]{--reward-frame-art:url(\'assets/citadel/frame-'+key+'.svg\');--reward-frame-light:url(\'assets/citadel/frame-'+key+'-light.svg\');--reward-frame-period:'+str(period)+'s}')
    rules.append('/* END generated reward frames */')
    css=ROOT/'src/rpg-ui.css';content=css.read_text(encoding='utf-8')
    content=re.sub(r'/\* BEGIN generated reward frames \*/[\s\S]*?/\* END generated reward frames \*/\n?','',content)
    css.write_bytes((content.rstrip()+'\n'+'\n'.join(rules)+'\n').encode('utf-8'))
    print('Built native borders and subtle light layers for existing reward frames')
