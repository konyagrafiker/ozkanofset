"""Local release builder. Never includes live records, passwords or API credentials."""
from pathlib import Path
from datetime import datetime
import hashlib,json,zipfile

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'release'
OUT.mkdir(exist_ok=True)
stamp=datetime.now().strftime('%Y%m%d-%H%M%S')
server=['server.js','security.js','runtime.js','users.js','seo.js','admin-route.js','traffic.js','invitation-drafts.js','customers.js','quote-workflow.js','receivables.js','services/ientegreService.js']
seeds=['products.json','settings.json','homepage_config.json','categories_promosyon.json','davetiye_config.json','davetiye_options_config.json']
files={}
for name in ['package.json','app.js','.env.example','.gitignore','client/public/index.html','admin/public/index.html','deployment/check-production.js','deployment/private.htaccess','deployment/YAYIN-KURULUM.md','deployment/build-release.py']:
    files['site/'+name]=ROOT/name
for name in server:files['site/server/'+name]=ROOT/'server'/name
for p in (ROOT/'assets').rglob('*'):
    if p.is_file() and not p.is_symlink():files['site/'+p.relative_to(ROOT).as_posix()]=p
for name in seeds:files['site/deployment/seed/'+name]=ROOT/'database'/name
# Defense-in-depth for Apache if a private application directory is exposed by mistake.
files['site/.htaccess']=ROOT/'deployment/private.htaccess'
files['site/deployment/seed/.htaccess']=ROOT/'deployment/private.htaccess'
files['site/database/.htaccess']=ROOT/'deployment/private.htaccess'
for name in files:
    assert not name.endswith(('admin-password.txt','ientegre_settings.json','users.json','quotes.json','customers.json','invitation-drafts.json','traffic-stats.json','.env')),name
    assert '/_backups/' not in name and '/scratch/' not in name
manifest_file=OUT/'last-manifest.json'
previous=json.loads(manifest_file.read_text('utf-8')) if manifest_file.exists() else None
manifest={}
for name,p in sorted(files.items()):
    if not p.is_file():raise FileNotFoundError(p)
    h=hashlib.sha256()
    with p.open('rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
    manifest[name]={'sha256':h.hexdigest(),'bytes':p.stat().st_size}
def archive(target,entries):
    with zipfile.ZipFile(target,'w',allowZip64=True) as z:
        for name in entries:
            method=zipfile.ZIP_STORED if files[name].suffix.lower() in {'.jpg','.jpeg','.png','.webp','.pdf','.woff','.woff2','.otf','.ttf'} else zipfile.ZIP_DEFLATED
            z.write(files[name],name,compress_type=method)
        z.writestr('RELEASE-MANIFEST.json',json.dumps(manifest,ensure_ascii=False,indent=2))
    with zipfile.ZipFile(target) as z:
        names=z.namelist()
        assert 'site/database/quotes.json' not in names and 'site/.env' not in names
        assert 'site/server/runtime.js' in names or target.name.startswith('ozkanofset-guncelleme-')
full=OUT/('ozkanofset-ilk-kurulum-'+stamp+'.zip')
archive(full,files)
result={'full':str(full),'fileCount':len(files),'bytes':full.stat().st_size}
if previous:
    changed=[name for name in files if manifest[name]!=previous.get(name)]
    if changed:
        update=OUT/('ozkanofset-guncelleme-'+stamp+'.zip');archive(update,changed);result['update']=str(update);result['changedFiles']=len(changed)
    result['removedFilesNotAutomaticallyDeleted']=[n for n in previous if n not in manifest]
manifest_file.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),'utf-8')
(OUT/'release-info.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),'utf-8')
print(json.dumps(result,ensure_ascii=False))
