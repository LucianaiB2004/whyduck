import {mkdir, readFile, writeFile, unlink, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {createCipheriv, createDecipheriv, randomBytes} from 'node:crypto';
import {getStore} from '@edgeone/pages-blob';

export interface EvidenceFiles {
 write(caseId:string,evidenceId:string,bytes:Buffer):Promise<void>;
 read(caseId:string,evidenceId:string):Promise<Buffer>;
 remove(caseId:string,evidenceId:string):Promise<void>;
 removeCase(caseId:string):Promise<void>;
}
function id(value:string):string {
 if(!/^[a-zA-Z0-9_-]{1,128}$/.test(value))throw new Error('Invalid evidence path identifier');
 return value;
}
function missing():NodeJS.ErrnoException {return Object.assign(new Error('Evidence file not found'),{code:'ENOENT'});}
const magic=Buffer.from('WD01');
export function createEvidenceFiles(dir:string):EvidenceFiles {
 const mode=process.env.EVIDENCE_STORAGE||'local';
 if(mode==='local')return {
  async write(c,e,bytes){const folder=join(dir,id(c));id(e);await mkdir(folder,{recursive:true,mode:0o700});await writeFile(join(folder,e),bytes,{flag:'wx',mode:0o600});},
  async read(c,e){return readFile(join(dir,id(c),id(e)));},
  async remove(c,e){try{await unlink(join(dir,id(c),id(e)));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}},
  async removeCase(c){await rm(join(dir,id(c)),{recursive:true,force:true});},
 };
 if(mode!=='edgeone-blob')throw new Error('Unsupported EVIDENCE_STORAGE');
 const encoded=process.env.EVIDENCE_ENCRYPTION_KEY||'';
 const key=Buffer.from(encoded,'base64');
 if(key.length!==32||key.toString('base64')!==encoded)throw new Error('EVIDENCE_ENCRYPTION_KEY must be canonical base64 of 32 bytes');
 const store=getStore(process.env.EVIDENCE_BLOB_STORE||'whyduck-evidence');
 const path=(c:string,e:string)=>`evidence/${id(c)}/${id(e)}`;
 return {
  async write(c,e,bytes){const name=path(c,e),nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(Buffer.from(name));const encrypted=Buffer.concat([magic,nonce,cipher.update(bytes),cipher.final(),cipher.getAuthTag()]);await store.set(name,new Uint8Array(encrypted).buffer,{cacheControl:'private, no-store'});},
  async read(c,e){const name=path(c,e),raw=await store.get(name,{type:'arrayBuffer',consistency:'strong'});if(raw===null)throw missing();const encrypted=Buffer.from(raw);if(encrypted.length<32||!encrypted.subarray(0,4).equals(magic))throw new Error('Invalid encrypted evidence');const cipher=createDecipheriv('aes-256-gcm',key,encrypted.subarray(4,16));cipher.setAAD(Buffer.from(name));cipher.setAuthTag(encrypted.subarray(-16));return Buffer.concat([cipher.update(encrypted.subarray(16,-16)),cipher.final()]);},
  async remove(c,e){await store.delete(path(c,e));},
  async removeCase(c){const prefix=`evidence/${id(c)}/`;const result=await store.list({prefix,consistency:'strong'});for(const blob of result.blobs){if(!blob.key.startsWith(prefix))throw new Error('Blob listing returned an unrelated evidence object');await store.delete(blob.key);}},
 };
}
