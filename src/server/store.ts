import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import type {Client, InValue} from '@libsql/client';
import type {CaseRecord,User} from '../shared/types.js';
const schema=`PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,consent INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL,alipay TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS users_alipay_unique ON users(alipay) WHERE alipay IS NOT NULL;
CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS tokens(id TEXT PRIMARY KEY,hash TEXT UNIQUE NOT NULL,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,label TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cases(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS run_context(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,user_id TEXT,case_id TEXT,action TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS case_leases(case_id TEXT PRIMARY KEY REFERENCES cases(id) ON DELETE CASCADE,token TEXT NOT NULL,expires INTEGER NOT NULL,cancelled INTEGER NOT NULL DEFAULT 0);`;
type SqlRow=Record<string,unknown>;
export interface AsyncDatabase {
 prepare(sql:string):{get(...args:InValue[]):Promise<SqlRow|undefined>;all(...args:InValue[]):Promise<SqlRow[]>;run(...args:InValue[]):Promise<{changes:number|bigint;lastInsertRowid?:number|bigint}>};
 exec(sql:string):Promise<void>;
 batch(statements:{sql:string;args:InValue[]}[]):Promise<{changes:number|bigint}[]>;
 close():void;
}
export type StoreOptions={url?:string;authToken?:string;/** Injected client is for SQL compatibility tests, not remote acceptance. */client?:Client};
export async function openStore(dir:string,options:StoreOptions={}){
 const url=options.url??process.env.TURSO_DATABASE_URL;
 const authToken=options.authToken??process.env.TURSO_AUTH_TOKEN;
 if(url&&!options.client&&!authToken)throw new Error('TURSO_AUTH_TOKEN is required for remote database storage');
 let db:AsyncDatabase;
 if(url||options.client){
  if(url&&!/^(libsql|https):\/\//.test(url))throw new Error('TURSO_DATABASE_URL must use libsql:// or https://');
  const client=options.client??(await import('@libsql/client/web')).createClient({url:url!,authToken});
  db={prepare:sql=>({get:async(...args)=>(await client.execute({sql,args})).rows[0] as SqlRow|undefined,all:async(...args)=>(await client.execute({sql,args})).rows as SqlRow[],run:async(...args)=>{const r=await client.execute({sql,args});return {changes:r.rowsAffected,lastInsertRowid:r.lastInsertRowid}}}),exec:async sql=>{await client.executeMultiple(sql)},batch:async statements=>(await client.batch(statements,'write')).map(r=>({changes:r.rowsAffected})),close:()=>client.close()};
 }else{
  mkdirSync(dir,{recursive:true});
  const {DatabaseSync}=await import('node:sqlite');
  const local=new DatabaseSync(join(dir,'whyduck.sqlite'));
  local.exec('PRAGMA journal_mode=WAL');
  db={prepare:sql=>{const stmt=local.prepare(sql);return {get:async(...args)=>stmt.get(...args as any[]) as SqlRow|undefined,all:async(...args)=>stmt.all(...args as any[]) as SqlRow[],run:async(...args)=>stmt.run(...args as any[])}},exec:async sql=>{local.exec(sql)},batch:async statements=>{local.exec('BEGIN IMMEDIATE');try{const results=statements.map(({sql,args})=>local.prepare(sql).run(...args as any[]));local.exec('COMMIT');return results;}catch(error){local.exec('ROLLBACK');throw error}},close:()=>local.close()};
 }
 try{await db.exec(schema)}catch(error){db.close();throw error}
 const publicUser=(row:SqlRow|undefined|null):User|null=>row?{id:String(row.id),email:String(row.email),name:String(row.name),aiConsent:!!row.consent,createdAt:String(row.created)}:null;
 return {db,publicUser,backend:url?'turso':'sqlite',
  user:async(id:string)=>publicUser(await db.prepare('SELECT * FROM users WHERE id=?').get(id)),
  list:async(owner:string):Promise<CaseRecord[]>=> (await db.prepare('SELECT data FROM cases WHERE owner_id=?').all(owner)).map(row=>JSON.parse(String(row.data))),
  get:async(owner:string,id:string):Promise<CaseRecord|null>=>{const row=await db.prepare('SELECT data FROM cases WHERE id=? AND owner_id=?').get(id,owner);return row?JSON.parse(String(row.data)):null},
  save:async(c:CaseRecord,leaseToken?:string)=>{const updatedAt=new Date().toISOString();const data=JSON.stringify({...c,updatedAt});const r=leaseToken?await db.prepare('UPDATE cases SET data=? WHERE id=? AND owner_id=? AND EXISTS(SELECT 1 FROM case_leases WHERE case_id=? AND token=? AND expires>?)').run(data,c.id,c.ownerId,c.id,leaseToken,Date.now()):await db.prepare('INSERT INTO cases(id,owner_id,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE cases.owner_id=excluded.owner_id AND NOT EXISTS(SELECT 1 FROM case_leases WHERE case_id=excluded.id AND expires>?)').run(c.id,c.ownerId,data,Date.now());if(Number(r.changes)!==1)throw new Error('Case ownership mismatch or expired lease: existing case cannot be reassigned');c.updatedAt=updatedAt},
  persistRun:async(c:CaseRecord,runId:string,context:unknown,action:string,leaseToken:string)=>{
   const updatedAt=new Date().toISOString(),clock=Date.now();
   const guard='EXISTS(SELECT 1 FROM case_leases JOIN cases ON cases.id=case_leases.case_id WHERE case_id=? AND token=? AND expires>? AND cases.owner_id=?)';
   const result=await db.batch([
    {sql:'UPDATE cases SET data=? WHERE id=? AND owner_id=? AND '+guard,args:[JSON.stringify({...c,updatedAt}),c.id,c.ownerId,c.id,leaseToken,clock,c.ownerId]},
    {sql:'INSERT INTO run_context(id,case_id,data) SELECT ?,?,? WHERE '+guard,args:[runId,c.id,JSON.stringify(context),c.id,leaseToken,clock,c.ownerId]},
    {sql:'INSERT INTO audit(user_id,case_id,action,created) SELECT ?,?,?,? WHERE '+guard,args:[c.ownerId,c.id,action,updatedAt,c.id,leaseToken,clock,c.ownerId]}
   ]);
   if(Number(result[0].changes)!==1)throw new Error('Case lease expired before agent persistence');
   c.updatedAt=updatedAt;
  },
  audit:async(user:string,c:string,action:string)=>db.prepare('INSERT INTO audit(user_id,case_id,action,created) VALUES(?,?,?,?)').run(user,c,action,new Date().toISOString()),
  acquireLease:async(caseId:string,token:string,ttlMs:number):Promise<boolean>=>{const now=Date.now();const r=await db.prepare('INSERT INTO case_leases(case_id,token,expires,cancelled) VALUES(?,?,?,0) ON CONFLICT(case_id) DO UPDATE SET token=excluded.token,expires=excluded.expires,cancelled=0 WHERE case_leases.expires<=? RETURNING token').get(caseId,token,now+ttlMs,now);return r?.token===token},
  releaseLease:async(caseId:string,token:string)=>{await db.prepare('DELETE FROM case_leases WHERE case_id=? AND token=?').run(caseId,token)},
  renewLease:async(caseId:string,token:string,ttlMs:number):Promise<boolean>=>{const r=await db.prepare('UPDATE case_leases SET expires=? WHERE case_id=? AND token=? AND expires>?').run(Date.now()+ttlMs,caseId,token,Date.now());return Number(r.changes)===1},
  requestCancel:async(caseId:string,expectedToken?:string):Promise<boolean>=>{const r=await db.prepare('UPDATE case_leases SET cancelled=1 WHERE case_id=? AND expires>? AND (? IS NULL OR token=?)').run(caseId,Date.now(),expectedToken??null,expectedToken??null);return Number(r.changes)===1},
  lease:async(caseId:string):Promise<{token:string;expires:number;cancelled:boolean}|null>=>{const r=await db.prepare('SELECT token,expires,cancelled FROM case_leases WHERE case_id=? AND expires>?').get(caseId,Date.now());return r?{token:String(r.token),expires:Number(r.expires),cancelled:!!r.cancelled}:null}
 };
}
