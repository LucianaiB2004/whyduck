import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import sharp from 'sharp';
const base='http://127.0.0.1:3001';
let cookie='';
async function call(path:string,method='GET',body?:unknown){const r=await fetch(base+path,{method,headers:{'X-WhyDuck-Client':'web',Cookie:cookie,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(360000)});if(!r.ok)throw Error(path+': HTTP '+r.status);return r;}
const password=randomBytes(24).toString('base64url'),email='acceptance-'+randomUUID()+'@example.test';
const registration=await call('/api/auth/register','POST',{email,password,name:'部署验收测试'});cookie=registration.headers.get('set-cookie')!.split(';')[0];
await call('/api/profile','PATCH',{aiConsent:true});
const record=(await (await call('/api/cases','POST',{title:'合成退款流程验收',description:'合成测试：耳机199元，商家收到退货七天，退款还未到账。请核查材料、准备沟通方案和后续任务。'})).json()).case;
for(const [filename,sourceText] of [['合成商家承诺.txt','合成测试商家回复：收到退货后三天内退款199元。'],['合成跟进回复.txt','合成测试商家最新回复：这次退款不处理，请自行处理。']])await call(`/api/cases/${record.id}/evidence`,'POST',{filename,sourceText});
const image=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="500"><rect width="100%" height="100%" fill="white"/><g font-family="sans-serif" font-size="40" fill="black"><text x="50" y="70">SYNTHETIC TEST ORDER</text><text x="50" y="180">Product: Earbuds</text><text x="50" y="270">Amount: CNY 199.00</text><text x="50" y="360">Order: TEST-001</text></g></svg>')).png().toBuffer();
const form=new FormData();form.set('file',new Blob([new Uint8Array(image)],{type:'image/png'}),'synthetic-order.png');const upload=await fetch(base+`/api/cases/${record.id}/evidence`,{method:'POST',headers:{Cookie:cookie,'X-WhyDuck-Client':'web'},body:form});if(upload.status!==201)throw Error('upload failed');const ev=(await upload.json()).evidence;
const response=await call(`/api/cases/${record.id}/messages`,'POST',{message:'这是合成测试。请管家组织证据鸭核对订单截图与商家前后矛盾的承诺，请退款鸭生成沟通方案，后手鸭创建待确认跟进任务，最后管家汇总办事单。缺少法律事实时不得编造。',mode:'group',requestId:randomUUID()});
const wire=await response.text();const events=wire.split('\n').filter(x=>x.startsWith('data: ')).map(x=>JSON.parse(x.slice(6)));const final=(await (await call('/api/cases/'+record.id)).json()).case;
const errors=events.filter(e=>e.type==='error');if(errors.length)throw Error('workflow errors: '+errors.map(e=>e.message).join(';'));
const roles=new Set(final.runs.filter((r:any)=>r.status==='completed').map((r:any)=>r.agentId));for(const role of ['butler','detective','refund','followup'])if(!roles.has(role))throw Error('Missing real role '+role);
for(const message of final.messages)for(const cite of message.citations){const evidence=final.evidence.find((e:any)=>e.id===cite.evidenceId);if(!evidence?.sourceText?.includes(cite.quote)&&!evidence?.confirmed)throw Error('Unverified citation');}
if(!final.tasks.length||!final.drafts.length)throw Error('Missing persisted business outputs');
const file=Buffer.from(await (await call(`/api/cases/${record.id}/evidence/${ev.id}/file`)).arrayBuffer());if(createHash('sha256').update(file).digest('hex')!==ev.sha256)throw Error('Evidence hash mismatch');
const nextCookie=cookie;cookie='';const login=await call('/api/auth/login','POST',{email,password});cookie=login.headers.get('set-cookie')!.split(';')[0];const restored=(await (await call('/api/cases/'+record.id)).json()).case;if(restored.messages.length!==final.messages.length)throw Error('Recovery mismatch');
await call(`/api/cases/${record.id}/tasks/${final.tasks[0].id}`,'PATCH',{status:'pending'});
const report=await (await call(`/api/cases/${record.id}/report?format=markdown`)).text();if(!report.includes('SHA-256'))throw Error('Missing evidence provenance in report');
mkdirSync('artifacts/private',{recursive:true});mkdirSync('artifacts/acceptance',{recursive:true});writeFileSync('artifacts/private/smoke-account.json',JSON.stringify({email,password,caseId:record.id}));
const proof={checkedAt:new Date().toISOString(),scope:'local HTTP with real Qwen; not cloud acceptance',caseId:record.id,roles:[...roles],runs:final.runs.map((r:any)=>({agentId:r.agentId,status:r.status,tools:r.tools,inputTokens:r.inputTokens,outputTokens:r.outputTokens})),tasks:final.tasks.length,drafts:final.drafts.length,citations:final.messages.reduce((n:number,m:any)=>n+m.citations.length,0),imageHashVerified:true,loginRecovery:true,reportVerified:true};writeFileSync('artifacts/acceptance/cloud-migration-local-live.json',JSON.stringify(proof,null,2));console.log(JSON.stringify({status:'REAL_QWEN_HTTP_FLOW_PASSED',roles:[...roles],tasks:proof.tasks,drafts:proof.drafts}));
