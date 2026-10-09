import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';

// Runtime bundles live outside dist/client: no backend code or credentials in static hosting.
for (const root of ['cloud-functions/_whyduck','agents/_whyduck']) {
  await mkdir(root,{recursive:true});
  await build({entryPoints:['src/server/app.ts'],outfile:`${root}/app.js`,bundle:true,platform:'node',target:'node22',format:'esm',packages:'external',sourcemap:false,logLevel:'info'});
}
await copyFile('cloud-functions/_whyduck/runtime.js','agents/_whyduck/runtime.js');
