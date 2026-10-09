import assert from 'node:assert/strict';
import {createClient} from '@libsql/client';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {openStore} from '../../src/server/store.js';
import {newCase} from '../../src/server/demo.js';
const dir=process.argv[2],scenario=Number(process.argv[3]),mode='libsql';
const stores=[];
async function setup(){const connect=async()=>{const s=await openStore(dir,{client:createClient({url:pathToFileURL(join(dir,'test.sqlite')).href})});stores.push(s);return s};const s=await connect();for(const id of ['alice','bob'])await s.db.prepare('INSERT INTO users(id,email,name,password,created) VALUES(?,?,?,?,?)').run(id,id+'@example.test',id,'private-password',new Date().toISOString());const c=newCase('alice','退款争议');await s.save(c);return {s,c,connect};}
function expect(actual){return {toBe(expected){assert.equal(actual,expected)},toBeNull(){assert.equal(actual,null)},toEqual(expected){assert.deepEqual(actual,expected)},toHaveLength(expected){assert.equal(actual.length,expected)},not:{toContain(value){assert.equal(actual.includes(value),false)}},rejects:{async toThrow(value){await assert.rejects(actual,value?new RegExp(value):undefined)}}};}
try { await ([
async()=>{
  const {s,c,connect}=await setup(mode);await s.db.prepare('INSERT INTO sessions(hash,user_id,expires) VALUES(?,?,?)').run('hash','alice',Date.now()+10000);
  const reopened=await connect();expect((await reopened.get('alice',c.id))?.title).toBe('退款争议');expect(await reopened.get('bob',c.id)).toBeNull();expect(await reopened.list('bob')).toEqual([]);
  expect(JSON.stringify(await reopened.user('alice'))).not.toContain('private-password');expect((await reopened.db.prepare('SELECT user_id FROM sessions WHERE hash=?').get('hash'))?.user_id).toBe('alice');
 },
async()=>{const {s,c}=await setup(mode);await expect(s.save({...c,ownerId:'bob',title:'overwritten'})).rejects.toThrow('ownership mismatch');expect((await s.get('alice',c.id))?.title).toBe('退款争议');expect(await s.get('bob',c.id)).toBeNull()},
async()=>{const {s,c}=await setup(mode);await expect(s.db.prepare('INSERT INTO users(id,email,name,password,created) VALUES(?,?,?,?,?)').run('other','alice@example.test','other','x','now')).rejects.toThrow();await s.db.prepare('INSERT INTO run_context(id,case_id,data) VALUES(?,?,?)').run('run',c.id,'{}');await s.acquireLease(c.id,'token',1000);await s.db.prepare('DELETE FROM cases WHERE id=?').run(c.id);expect(await s.db.prepare('SELECT * FROM run_context').all()).toEqual([]);expect(await s.lease(c.id)).toBeNull()},
async()=>{const {s,c,connect}=await setup(mode);const other=await connect();const attempts=await Promise.all([s.acquireLease(c.id,'a',10000),other.acquireLease(c.id,'b',10000)]);expect(attempts.filter(Boolean)).toHaveLength(1);const winner=attempts[0]?'a':'b',loser=attempts[0]?'b':'a';expect(await s.renewLease(c.id,loser,1000)).toBe(false);await s.releaseLease(c.id,loser);expect((await s.lease(c.id))?.token).toBe(winner);expect(await other.requestCancel(c.id)).toBe(true);expect((await s.lease(c.id))?.cancelled).toBe(true);expect(await s.renewLease(c.id,winner,10000)).toBe(true);await s.releaseLease(c.id,winner);expect(await other.acquireLease(c.id,'next',10000)).toBe(true)},
async()=>{const {s,c}=await setup(mode);await s.acquireLease(c.id,'old',10000);await s.requestCancel(c.id);await s.db.prepare('UPDATE case_leases SET expires=? WHERE case_id=?').run(Date.now()-1,c.id);expect(await s.renewLease(c.id,'old',10000)).toBe(false);expect(await s.acquireLease(c.id,'new',10000)).toBe(true);expect((await s.lease(c.id))?.cancelled).toBe(false)}
])[scenario](); } finally {for(const s of stores)s.db.close();}
