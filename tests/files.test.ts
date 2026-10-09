import {afterEach,expect,it,vi} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
const mock=vi.hoisted(()=>({values:new Map<string,ArrayBuffer>(),getStore:vi.fn()}));
vi.mock('@edgeone/pages-blob',()=>({getStore:mock.getStore}));
import {createEvidenceFiles} from '../src/server/files.js';
afterEach(()=>{vi.unstubAllEnvs();mock.values.clear();mock.getStore.mockReset();});
it('local files roundtrip, reject traversal and preserve existing files',async()=>{
 vi.stubEnv('EVIDENCE_STORAGE','local');const dir=await mkdtemp(join(tmpdir(),'wd-files-'));const files=createEvidenceFiles(dir);
 try{await files.write('case-1','ev-1',Buffer.from('真实凭证'));expect((await files.read('case-1','ev-1')).toString()).toBe('真实凭证');await expect(files.write('case-1','ev-1',Buffer.from('overwrite'))).rejects.toMatchObject({code:'EEXIST'});await expect(files.write('../escape','ev',Buffer.from('x'))).rejects.toThrow('Invalid evidence path');await files.remove('case-1','ev-1');await files.remove('case-1','ev-1');await expect(files.read('case-1','ev-1')).rejects.toMatchObject({code:'ENOENT'});await files.write('case-1','ev-2',Buffer.from('x'));await files.removeCase('case-1');await expect(files.read('case-1','ev-2')).rejects.toMatchObject({code:'ENOENT'});}finally{await rm(dir,{recursive:true,force:true});}
});
function remote(){vi.stubEnv('EVIDENCE_STORAGE','edgeone-blob');vi.stubEnv('EVIDENCE_ENCRYPTION_KEY',randomBytes(32).toString('base64'));mock.getStore.mockReturnValue({set:async(k:string,v:ArrayBuffer)=>{mock.values.set(k,v);},get:async(k:string)=>mock.values.get(k)??null,delete:async(k:string)=>{mock.values.delete(k);},list:async({prefix}:{prefix:string})=>({blobs:[...mock.values.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))})});return createEvidenceFiles('unused');}
it('MOCK Blob: ciphertext hides plaintext, authenticates bytes and binds case/evidence path',async()=>{
 const files=remote(),plain=Buffer.from('private receipt account number 123456');await files.write('case-1','ev-1',plain);const cipher=Buffer.from(mock.values.get('evidence/case-1/ev-1')!);expect(cipher.includes(plain)).toBe(false);expect(await files.read('case-1','ev-1')).toEqual(plain);
 mock.values.set('evidence/case-2/ev-1',new Uint8Array(cipher).buffer);await expect(files.read('case-2','ev-1')).rejects.toThrow();cipher[17]^=1;mock.values.set('evidence/case-1/ev-1',new Uint8Array(cipher).buffer);await expect(files.read('case-1','ev-1')).rejects.toThrow();
 await files.removeCase('case-1');expect(mock.values.has('evidence/case-2/ev-1')).toBe(true);await expect(files.read('case-1','ev-1')).rejects.toMatchObject({code:'ENOENT'});
});
it('remote storage fails closed on missing encryption configuration and propagates provider failures',async()=>{
 vi.stubEnv('EVIDENCE_STORAGE','edgeone-blob');vi.stubEnv('EVIDENCE_ENCRYPTION_KEY','');expect(()=>createEvidenceFiles('unused')).toThrow('EVIDENCE_ENCRYPTION_KEY');const files=remote();mock.getStore.mock.results[0].value.delete=async()=>{throw new Error('permission denied');};await expect(files.remove('case','ev')).rejects.toThrow('permission denied');
});
