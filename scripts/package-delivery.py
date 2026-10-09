"""Package explicit deliverables; never include runtime databases or secret env files."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parent.parent
target = root / 'artifacts' / 'WhyDuck-source-1.0.0.zip'
files = []
for name in ['src', 'public', 'miniapp', 'docs', 'submission', 'scripts', 'tests', 'design']:
    files.extend(p for p in (root / name).rglob('*') if p.is_file()
                 and p.suffix not in {'.log', '.pyc'} and '__pycache__' not in p.parts)
for name in ['package.json', 'package-lock.json', 'tsconfig.json', 'tsup.config.ts', 'vite.config.ts',
             'index.html', 'README.md', '.env.example', '.gitignore', 'Dockerfile', '.dockerignore',
             '项目开发任务书.md', 'UI 设计、AI 生图与视觉资产开发要求.md']:
    files.append(root / name)
for name in ['test-results.json', 'dependency-audit.json', 'production-verification.json', 'live-verification.json']:
    files.append(root / 'artifacts' / name)
files.extend(p for p in (root / 'artifacts' / 'ui').glob('*') if p.suffix in {'.json', '.png', '.md'})
files.extend(p for p in (root / 'artifacts' / 'acceptance').rglob('*') if p.is_file() and p.suffix in {'.json', '.png', '.md'})
target.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(set(files)):
        if path.is_file():
            archive.write(path, path.relative_to(root))
manifest = {'filename': target.name, 'bytes': target.stat().st_size,
            'sha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'files': len(files),
            'excluded': ['node_modules', 'data', '.env', 'private runtime files', 'process logs']}
(target.parent / 'delivery-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(manifest, ensure_ascii=False))
