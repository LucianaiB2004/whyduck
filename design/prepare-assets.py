"""Resize production copies, preserve alpha, and generate avatar derivatives.

This is export processing, not an illustration generator or background-removal tool.
Run after copying the chosen built-in imagegen output into characters/*.png.
Original imagegen results and v1 masters are retained separately.
"""
from pathlib import Path
from PIL import Image
import hashlib
import json

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'public/assets/whyduck'
records = []
for source in (ASSETS / 'characters').glob('*.png'):
    image = Image.open(source).convert('RGBA')
    alpha = image.getchannel('A')
    bounds = alpha.getbbox()
    if bounds is None or alpha.getextrema()[0] != 0:
        raise RuntimeError(f'Missing transparent alpha: {source}')
    character = image.crop(bounds)
    character.thumbnail((900, 900), Image.Resampling.LANCZOS)
    master = Image.new('RGBA', (1024, 1024))
    master.alpha_composite(character, ((1024-character.width)//2, (1024-character.height)//2))
    master.save(source, optimize=True)
    webp = source.with_suffix('.webp')
    master.resize((640, 640), Image.Resampling.LANCZOS).save(webp, quality=88, method=6)
    # Full role silhouette including the badge, for consistent scaled avatars.
    master.resize((160, 160), Image.Resampling.LANCZOS).save(ASSETS/'avatars'/f'{source.stem}.webp', quality=90, method=6)
    records.append({'name':source.stem,'master':[1024,1024],'web':[640,640],'avatar':[160,160],
                    'transparent':True,'webp_bytes':webp.stat().st_size,
                    'sha256':hashlib.sha256(source.read_bytes()).hexdigest()})
(ROOT/'design/asset-validation.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(records, ensure_ascii=False, indent=2))
