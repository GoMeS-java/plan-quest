"""Optimize the three original ImageGen atlases. Never downloads external art.

Usage: python tools/prepare_citadel_art.py --rooms atlas.png --lower lower.png --sky sky.png
The full generation prompts and provenance are in ART-CITADEL.md.
"""
import argparse
from pathlib import Path
from PIL import Image
p=argparse.ArgumentParser()
for name in ('rooms','lower','sky'):p.add_argument('--'+name,required=True,type=Path)
a=p.parse_args();out=Path('src/assets/citadel');out.mkdir(parents=True,exist_ok=True)
for source,rows,names,height in [(a.rooms,5,['throne','observatory','rest','study','archive','forge'],200),(a.lower,2,['gatehouse','refectory','cloister','vault'],240)]:
 im=Image.open(source).convert('RGB');w,h=im.size
 for i,name in enumerate(names):
  x,y=i%2,i//2
  im.crop((round(x*w/2),round(y*h/rows),round((x+1)*w/2),round((y+1)*h/rows))).resize((480,height),Image.Resampling.LANCZOS).save(out/(name+'.webp'),quality=88,method=6)
Image.open(a.sky).convert('RGB').resize((960,384),Image.Resampling.LANCZOS).save(out/'sky.webp',quality=86,method=6)
