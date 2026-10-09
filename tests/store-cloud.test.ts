import {afterEach,describe,expect,it} from 'vitest';
import {createClient} from '@libsql/client';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openStore} from '../src/server/store.js';
import {newCase} from '../src/server/demo.js';

type Store=Awaited<ReturnType<typeof openStore>>;
const dirs:string[]=[];const stores:Store[]=[];
afterEach(async()=>{for(const s of stores.splice(0))s.db.close();for(const d of dirs.splice(0))await rm(d,{recursive:true,force:true,maxRetries:10,retryDelay:100})});
async function setup(mode:'sqlite'|'libsql'){
 const dir=mkdtempSync(join(tmpdir(),'whyduck-store-'));dirs.push(dir);
 const connect=async()=>{const s=await openStore(dir,mode==='libsql'?{client:createClient({url:pathToFileURL(join(dir,'test.sqlite')).href})}:{});stores.push(s);return s};
 const s=await connect();
 for(const id of ['alice','bob'])await s.db.prepare('INSERT INTO users(id,email,name,password,created) VALUES(?,?,?,?,?)').run(id,id+'@example.test',id,'private-password',new Date().toISOString());
 const c=newCase('alice','退款争议');await s.save(c);return {s,c,connect};
}
// These are local SQL compatibility tests. They do not prove remote Turso availability.
for(const mode of ['sqlite','libsql'] as const)describe(mode+' durable store SQL',()=>{
 it('preserves accounts, cases, sessions and isolation across independent connections',async()=>{if(mode==='libsql'){const dir=mkdtempSync(join(tmpdir(),'whyduck-libsql-'));try {await promisify(execFile)(process.execPath,['--import','tsx',resolve('tests/fixtures/store-compat.mjs'),dir,'0']);}finally{await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:50});}return;}

  const {s,c,connect}=await setup(mode);await s.db.prepare('INSERT INTO sessions(hash,user_id,expires) VALUES(?,?,?)').run('hash','alice',Date.now()+10000);
  const reopened=await connect();expect((await reopened.get('alice',c.id))?.title).toBe('退款争议');expect(await reopened.get('bob',c.id)).toBeNull();expect(await reopened.list('bob')).toEqual([]);
  expect(JSON.stringify(await reopened.user('alice'))).not.toContain('private-password');expect((await reopened.db.prepare('SELECT user_id FROM sessions WHERE hash=?').get('hash'))?.user_id).toBe('alice');
 });
 it('rejects owner reassignment atomically and maintains original data',async()=>{if(mode==='libsql'){const dir=mkdtempSync(join(tmpdir(),'whyduck-libsql-'));try {await promisify(execFile)(process.execPath,['--import','tsx',resolve('tests/fixtures/store-compat.mjs'),dir,'1']);}finally{await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:50});}return;}
const {s,c}=await setup(mode);await expect(s.save({...c,ownerId:'bob',title:'overwritten'})).rejects.toThrow('ownership mismatch');expect((await s.get('alice',c.id))?.title).toBe('退款争议');expect(await s.get('bob',c.id)).toBeNull()});
 it('enforces unique accounts and cascades private children on case deletion',async()=>{if(mode==='libsql'){const dir=mkdtempSync(join(tmpdir(),'whyduck-libsql-'));try {await promisify(execFile)(process.execPath,['--import','tsx',resolve('tests/fixtures/store-compat.mjs'),dir,'2']);}finally{await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:50});}return;}
const {s,c}=await setup(mode);await expect(s.db.prepare('INSERT INTO users(id,email,name,password,created) VALUES(?,?,?,?,?)').run('other','alice@example.test','other','x','now')).rejects.toThrow();await s.db.prepare('INSERT INTO run_context(id,case_id,data) VALUES(?,?,?)').run('run',c.id,'{}');await s.acquireLease(c.id,'token',1000);await s.db.prepare('DELETE FROM cases WHERE id=?').run(c.id);expect(await s.db.prepare('SELECT * FROM run_context').all()).toEqual([]);expect(await s.lease(c.id)).toBeNull()});
 it('allows a single competing lease and prevents stale token renewal/release',async()=>{if(mode==='libsql'){const dir=mkdtempSync(join(tmpdir(),'whyduck-libsql-'));try {await promisify(execFile)(process.execPath,['--import','tsx',resolve('tests/fixtures/store-compat.mjs'),dir,'3']);}finally{await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:50});}return;}
const {s,c,connect}=await setup(mode);const other=await connect();const attempts=await Promise.all([s.acquireLease(c.id,'a',10000),other.acquireLease(c.id,'b',10000)]);expect(attempts.filter(Boolean)).toHaveLength(1);const winner=attempts[0]?'a':'b',loser=attempts[0]?'b':'a';expect(await s.renewLease(c.id,loser,1000)).toBe(false);await s.releaseLease(c.id,loser);expect((await s.lease(c.id))?.token).toBe(winner);expect(await other.requestCancel(c.id)).toBe(true);expect((await s.lease(c.id))?.cancelled).toBe(true);expect(await s.renewLease(c.id,winner,10000)).toBe(true);await s.releaseLease(c.id,winner);expect(await other.acquireLease(c.id,'next',10000)).toBe(true)});
 it('recovers expired leases and resets cancellation',async()=>{if(mode==='libsql'){const dir=mkdtempSync(join(tmpdir(),'whyduck-libsql-'));try {await promisify(execFile)(process.execPath,['--import','tsx',resolve('tests/fixtures/store-compat.mjs'),dir,'4']);}finally{await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:50});}return;}
const {s,c}=await setup(mode);await s.acquireLease(c.id,'old',10000);await s.requestCancel(c.id);await s.db.prepare('UPDATE case_leases SET expires=? WHERE case_id=?').run(Date.now()-1,c.id);expect(await s.renewLease(c.id,'old',10000)).toBe(false);expect(await s.acquireLease(c.id,'new',10000)).toBe(true);expect((await s.lease(c.id))?.cancelled).toBe(false)});
});
it('fails clearly for missing remote credentials without falling back to ephemeral storage',async()=>{await expect(openStore('unused',{url:'libsql://database.example',authToken:''})).rejects.toThrow('TURSO_AUTH_TOKEN')});

it('rejects unleased updates and atomically commits case, run context and audit',async()=>{
 const {s,c}=await setup('sqlite');await s.acquireLease(c.id,'winner',10000);
 await expect(s.save({...c,title:'lost update'})).rejects.toThrow();
 await expect(s.persistRun({...c,title:'stale'},'run',{},'test','stale')).rejects.toThrow();
 await expect(s.persistRun({...c,ownerId:'bob'},'run',{},'test','winner')).rejects.toThrow();
 expect(await s.db.prepare('SELECT * FROM run_context').all()).toEqual([]);expect(await s.db.prepare('SELECT * FROM audit').all()).toEqual([]);
 await s.persistRun({...c,title:'committed'},'run',{message:'original task'},'test','winner');
 expect((await s.get('alice',c.id))?.title).toBe('committed');expect(await s.db.prepare('SELECT * FROM run_context').all()).toHaveLength(1);expect(await s.db.prepare('SELECT * FROM audit').all()).toHaveLength(1);
 await expect(s.persistRun({...c,title:'duplicate'},'run',{},'test','winner')).rejects.toThrow();expect((await s.get('alice',c.id))?.title).toBe('committed');
});
it('cannot cancel a later workflow with a stale token',async()=>{
 const {s,c}=await setup('sqlite');await s.acquireLease(c.id,'current',10000);
 expect(await s.requestCancel(c.id,'stale')).toBe(false);expect((await s.lease(c.id))?.cancelled).toBe(false);
 expect(await s.requestCancel(c.id,'current')).toBe(true);expect((await s.lease(c.id))?.cancelled).toBe(true);
});
