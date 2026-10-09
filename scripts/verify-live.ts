import 'dotenv/config';
import {randomUUID} from 'node:crypto';
import {runWorkflow} from '../src/server/ai/index.js';
import sharp from 'sharp';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ZodError} from 'zod';
import type {CaseRecord,AgentOutput} from '../src/shared/types.js';

// Synthetic material only. No account, payment screenshot, or production case is sent.
if(!process.env.DASHSCOPE_API_KEY?.trim()){
 console.log('LIVE_QWEN_SKIPPED: DASHSCOPE_API_KEY is missing. No network call or successful integration claimed.');
 process.exitCode=2;
}else{
 const now=new Date().toISOString();
 const record:CaseRecord={id:'synthetic-live-verification',ownerId:'synthetic-test',title:'模型连接核查',merchant:'',product:'测试商品',amount:'',purchaseDate:'',request:'这是合成测试，核查售后分析结构。缺少订单和商家回复，不作确定法律判断。',category:'other',status:'active',demo:false,factRevision:0,members:['analyst'],facts:[],evidence:[],messages:[],tasks:[],drafts:[],runs:[],createdAt:now,updatedAt:now};
 const results:AgentOutput[]=[];
 const checks:Record<string,unknown>[]=[];
 try{
  await runWorkflow(record,{message:record.request,target:'analyst',mode:'direct',runId:randomUUID(),signal:AbortSignal.timeout(180000)},{emit(){},async persist(output,run){if(run.status==='completed')results.push(output);}});
  if(results.length!==1||results[0].agentId!=='analyst'||!results[0].message)throw Error('Invalid verified result');
  checks.push({name:'text',status:'passed',roles:results.map(o=>o.agentId),usage:results[0].usage});
  console.log(JSON.stringify({status:'LIVE_QWEN_TEXT_VERIFIED',usage:results[0].usage}));
  if(process.argv.includes('--all')){
   const image=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="650"><rect width="100%" height="100%" fill="white"/><g font-family="sans-serif" font-size="44" fill="black"><text x="50" y="80">SYNTHETIC TEST ORDER</text><text x="50" y="180">Merchant: Test Shop</text><text x="50" y="270">Product: Test Earbuds</text><text x="50" y="360">Amount: CNY 199.00</text><text x="50" y="450">Date: 2026-10-08</text><text x="50" y="540">Order: TEST-001</text></g></svg>')).png().toBuffer();
   const visionCase:CaseRecord={...structuredClone(record),id:'synthetic-vision-verification',evidence:[{id:'vision-test-evidence',code:'E1',filename:'synthetic-order.png',mime:'image/png',sourceType:'image',size:image.length,sha256:createHash('sha256').update(image).digest('hex'),confirmed:false,createdAt:now}]};
   const vision:AgentOutput[]=[];
   await runWorkflow(visionCase,{message:'提取这张合成测试订单，仅在extractions中返回截图字段。未人工确认，不要返回截图citations或有引文的facts。',target:'detective',mode:'direct',runId:randomUUID(),images:[{evidenceId:'vision-test-evidence',dataUrl:'data:image/png;base64,'+image.toString('base64')}],signal:AbortSignal.timeout(180000)},{emit(){},async persist(o,r){if(r.status==='completed')vision.push(o)}});
   const extracted=vision[0]?.extractions?.find(e=>e.evidenceId==='vision-test-evidence');
   if(!extracted||!extracted.data.amount?.includes('199'))throw Error('Vision fixture amount not correctly extracted');
   checks.push({name:'vision',status:'passed',roles:['detective'],amountVerified:true,remainsProposed:true,usage:vision[0].usage});console.log('LIVE_QWEN_VISION_VERIFIED');
   const groupCase=structuredClone(record);groupCase.id='synthetic-group-verification';groupCase.members=['butler'];groupCase.evidence=[{id:'statement-a',code:'E1',filename:'synthetic-merchant-a.txt',mime:'text/plain',size:0,sha256:'synthetic',sourceType:'text',sourceText:'商家第一条回复：收到退货后三天内处理退款。',confirmed:false,createdAt:now},{id:'statement-b',code:'E2',filename:'synthetic-merchant-b.txt',mime:'text/plain',size:0,sha256:'synthetic',sourceType:'text',sourceText:'商家第二条回复：不接受这次退款，请自行处理。',confirmed:false,createdAt:now}];
   const group:AgentOutput[]=[];
   await runWorkflow(groupCase,{message:'这是合成测试。请管家按需组织专业鸭核对商家前后承诺、分析退款诉求、生成协商草稿和跟进建议，不编造未提供事实。',mode:'group',runId:randomUUID(),signal:AbortSignal.timeout(240000)},{emit(){},async persist(o,r){if(r.status==='completed')group.push(o)}});
   if(group.length<3||group[0].agentId!=='butler'||group.at(-1)?.agentId!=='butler')throw Error('Group routing and summary not completed');
   checks.push({name:'group',status:'passed',roles:group.map(o=>o.agentId),independentCalls:true,usage:group.map(o=>o.usage)});console.log('LIVE_QWEN_GROUP_VERIFIED');
  }
  mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/live-verification.json',JSON.stringify({status:'verified',checkedAt:new Date().toISOString(),checks,syntheticDataOnly:true,alipayVerified:false},null,2));
 }catch(error){
  // Provider errors can contain transport detail. Do not print raw errors, response bodies or keys.
  const reason=error instanceof ZodError?error.issues.map(issue=>({path:issue.path,code:issue.code})):error instanceof Error?error.message.replaceAll(process.env.DASHSCOPE_API_KEY||'unused-secret','[redacted]').replace(/sk-[A-Za-z0-9._-]+/g,'[redacted]').slice(0,300):'Verification failed';
  mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/live-verification.json',JSON.stringify({status:'incomplete',checkedAt:new Date().toISOString(),checks,reason,syntheticDataOnly:true,alipayVerified:false},null,2));
  console.error(JSON.stringify({status:'LIVE_QWEN_FAILED',reason}));
  process.exitCode=1;
 }
}
