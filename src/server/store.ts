import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import type {CaseRecord,User} from '../shared/types.js';
export function openStore(dir:string){mkdirSync(dir,{recursive:true});const db=new DatabaseSync(join(dir,'whyduck.sqlite'));db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,consent INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL,alipay TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS users_alipay_unique ON users(alipay) WHERE alipay IS NOT NULL;
CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS tokens(id TEXT PRIMARY KEY,hash TEXT UNIQUE NOT NULL,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,label TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cases(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS run_context(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,user_id TEXT,case_id TEXT,action TEXT NOT NULL,created TEXT NOT NULL);`);
 const publicUser=(row:any):User|null=>row?{id:row.id,email:row.email,name:row.name,aiConsent:!!row.consent,createdAt:row.created}:null;
 return {db,user:(id:string)=>publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id)),publicUser,list:(owner:string):CaseRecord[]=>db.prepare('SELECT data FROM cases WHERE owner_id=?').all(owner).map((r:any)=>JSON.parse(r.data)),get:(owner:string,id:string):CaseRecord|null=>{const row=db.prepare('SELECT data FROM cases WHERE id=? AND owner_id=?').get(id,owner) as any;return row?JSON.parse(row.data):null},save:(c:CaseRecord)=>{c.updatedAt=new Date().toISOString();db.prepare('INSERT INTO cases(id,owner_id,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(c.id,c.ownerId,JSON.stringify(c))},audit:(user:string,c:string,action:string)=>db.prepare('INSERT INTO audit(user_id,case_id,action,created) VALUES(?,?,?,?)').run(user,c,action,new Date().toISOString())};
}
