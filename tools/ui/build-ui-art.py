"""Rebuild runtime art from the two authored masters. Requires Pillow."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
import json

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'assets-src/ui'
OUT = ROOT / 'public/assets/ui/art'
OUT.mkdir(parents=True, exist_ok=True)
jade = Image.open(SRC / 'jade-master.png').convert('RGB')
paper = Image.open(SRC / 'paper-master.png').convert('RGB')
jade.save(OUT / 'jade-landscape.webp', quality=88, method=6)
paper.save(OUT / 'paper-landscape.webp', quality=86, method=6)
# One pale, neutral rounded material; runtime tint handles all control families.
material = Image.new('RGBA', (192, 192), (255, 255, 255, 255))
md = ImageDraw.Draw(material)
for y in range(192):
    v = round(255 - y / 192 * 6)
    md.line((0, y, 191, y), fill=(v, v, v, 255))
mask = Image.new('L', material.size)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, 191, 191), 12, fill=255)
material.putalpha(mask)
material.save(OUT / 'material.webp', lossless=True, method=6)
fibers = ImageOps.grayscale(paper.crop((600, 100, 856, 356))).point(lambda p: 195 + p * 60 // 255)
fibers.save(OUT / 'paper-grain.webp', quality=85, method=6)
# Quiet tile, mirrored on both axes so the repeat has no seam.
quiet = ImageOps.grayscale(jade.crop((850, 180, 1106, 436))).point(lambda p: min(255, 205 + p // 4)).convert('RGB')
tile = Image.new('RGB', (512, 512))
tile.paste(quiet, (0, 0)); tile.paste(ImageOps.mirror(quiet), (256, 0))
tile.paste(ImageOps.flip(tile.crop((0, 0, 512, 256))), (0, 256))
tile.save(OUT / 'table-grain.webp', quality=85, method=6)
manifest = {p.name: {'bytes': p.stat().st_size, 'size': list(Image.open(p).size)} for p in OUT.glob('*.webp')}
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(manifest, indent=2))
