import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=dirname(fileURLToPath(import.meta.url));const app=JSON.parse(readFileSync(resolve(root,'app.json'),'utf8'));
for(const page of app.pages)for(const ext of ['.js','.axml'])if(!existsSync(resolve(root,page+ext)))throw Error('Missing page '+page+ext);
for(const item of app.tabBar.items)if(!app.pages.includes(item.pagePath))throw Error('Unknown tab '+item.pagePath);
const visit=dir=>readdirSync(dir,{withFileTypes:true}).forEach(e=>{const p=resolve(dir,e.name);if(e.isDirectory())visit(p);else if(e.name.endsWith('.js')){const result=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});if(result.status!==0)throw Error(result.stderr);}});visit(root);console.log('MINIAPP_SOURCE_CHECK_OK: 6 pages; configuration and JavaScript syntax. IDE and device not verified.');
