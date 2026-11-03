"""Additional native pixel rewards for 1.1. Existing approved assets are never rewritten."""
from pathlib import Path
import re,colorsys
root=Path(__file__).resolve().parents[1];dest=root/'src/assets/citadel'
def tint(s,shift,light=1):
 def f(m):
  v=m[0];r,g,b=[int(v[i:i+2],16)/255 for i in (1,3,5)];h,l,sat=colorsys.rgb_to_hls(r,g,b);r,g,b=colorsys.hls_to_rgb((h+shift)%1,min(.94,l*light),min(.85,sat*.9));return '#'+''.join(f'{round(c*255):02x}' for c in (r,g,b))
 return re.sub(r'#[0-9a-fA-F]{6}',f,s)
for old,new,shift,light in [('peaks','rebuilt',.06,1.15),('city','stillnight',.09,.85)]:
 for suffix in ['', '-life-1','-life-2']:
  s=tint((dest/f'realm-{old}{suffix}.svg').read_text(encoding='utf-8'),shift,light).replace(old,new)
  if not suffix and new=='rebuilt':
   castle='<g id="rebuilt-terraces" fill="#302b48"><path d="M184 112V89h8V78h5V84h5V78h5V89h9V66h5V61h5V66h6V90h13V77h5V72h5V77h5V112z"/><path fill="#b4aaa4" d="M183 112h79v3h-79zM191 89h16v3h-16zM215 66h18v3h-18zM243 77h18v3h-18z"/><path fill="#e0c17b" d="M198 96h3v8h-3zM222 77h3v9h-3zM251 89h3v8h-3z"/></g>'
   s=s.replace('</svg>',castle+'</svg>')
  if not suffix and new=='stillnight':
   s=s.replace('</svg>','<g id="stillnight-stars" fill="#d7d1ef"><path d="M38 17h2v2h-2zM75 29h1v1h-1zM144 11h2v2h-2zM258 19h2v2h-2zM291 39h1v1h-1z"/></g></svg>')
  (dest/f'realm-{new}{suffix}.svg').write_text(s,encoding='utf-8')
for old,new,shift in [('gold','rebuilt',.16),('vitrage','constellation',.08)]:
 for suffix in ['', '-light']:
  (dest/f'frame-{new}{suffix}.svg').write_text(tint((dest/f'frame-{old}{suffix}.svg').read_text(encoding='utf-8'),shift,1.05),encoding='utf-8')
for old,new,shift in [('orbit','rebuilt',.26),('focus','memory',.13)]:
 (dest/f'aura-{new}.svg').write_text(tint((dest/f'aura-{old}.svg').read_text(encoding='utf-8'),shift,1.04),encoding='utf-8')
css=root/'src/rpg-ui.css';s=css.read_text(encoding='utf-8');s=re.sub(r'/\* BEGIN rebuild reward skins \*/.*?/\* END rebuild reward skins \*/\s*','',s,flags=re.S);base=s;s+='\n/* BEGIN rebuild reward skins */\n'
for old,new in [('peaks','rebuilt'),('city','stillnight')]:
 for line in base.splitlines():
  if line.startswith(':root[data-citadel-bg="'+old+'"]') and ('--realm-landscape:' in line or '--realm-life-a:' in line):s+='\n'+line.replace(old,new)
 for line in base.splitlines():
  if line.startswith('[data-realm-preview="'+old+'"]') and '--realm-landscape:' in line:s+='\n'+line.replace(old,new)
for old,new in [('gold','rebuilt'),('vitrage','constellation')]:
 for line in base.splitlines():
  if line.startswith(':root[data-reward-frame="'+old+'"]'):s+='\n'+line.replace(old,new)
for old,new in [('orbit','rebuilt'),('focus','memory')]:
 for line in base.splitlines():
  if line.startswith(':root[data-aura="'+old+'"]') or line.startswith('[data-aura-preview="'+old+'"]'):s+='\n'+line.replace(old,new)
css.write_bytes((s+'\n/* END rebuild reward skins */\n').encode())
