import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';

// Runtime bundles live outside dist/client: no backend code or credentials in static hosting.
for (const root of ['cloud-functions/_whyduck','agents/_whyduck']) {
  await mkdir(root,{recursive:true});
  await build({entryPoints:['src/server/app.ts'],outfile:`${root}/app.js`,bundle:true,platform:'node',target:'node22',format:'esm',packages:'external',sourcemap:false,logLevel:'info',plugins:[{
    name:'disable-local-sqlite-in-cloud',
    setup(builder){
      builder.onResolve({filter:/^node:sqlite$/},()=>({path:'disabled-local-sqlite',namespace:'whyduck-cloud'}));
      builder.onLoad({filter:/.*/,namespace:'whyduck-cloud'},()=>({contents:'export class DatabaseSync { constructor() { throw new Error("Local SQLite is disabled in cloud runtime; configure remote storage"); } }',loader:'js'}));
    }
  }]});
}
await copyFile('cloud-functions/_whyduck/runtime.js','agents/_whyduck/runtime.js');
