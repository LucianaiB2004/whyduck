import {afterEach,describe,it,expect} from 'vitest';
import {createServer} from 'node:http';
import {runWorkflow,executeAgentTool,getAiCapabilities,validateOutput} from '../src/server/ai/index.js';
import type {CaseRecord} from '../src/shared/types.js';
const c:CaseRecord={id:'c',ownerId:'u',title:'退款',merchant:'商家',product:'商品',amount:'10',purchaseDate:'',request:'退款',category:'',status:'active',demo:false,factRevision:1,members:['butler'],facts:[],evidence:[{id:'e',code:'E1',filename:'text',mime:'text/plain',size:10,sha256:'x',sourceType:'text',sourceText:'商家承诺退款',confirmed:false,createdAt:''}],messages:[],tasks:[],drafts:[],runs:[],createdAt:'',updatedAt:''};
const output=(agentId='analyst')=>({agentId,message:'待核对材料',facts:[],tasks:[],drafts:[],citations:agentId==='detective'?[{evidenceId:'e',quote:'商家承诺退款'}]:[],missingEvidence:[],suggestedMembers:[]});
afterEach(()=>{delete process.env.DASHSCOPE_API_KEY;delete process.env.QWEN_BASE_URL});
describe('AI safety and business tools',()=>{
 it('normalizes absent nullable optional provider fields without weakening evidence validation',()=>{
  const parsed=validateOutput({...output(),facts:[{label:'诉求',value:'待核对',evidenceId:null,quote:null}]},'analyst',c);
  expect(parsed.facts[0].evidenceId).toBeUndefined();
  expect(()=>validateOutput({...output(),facts:[{label:'诉求',value:'待核对',evidenceId:null,quote:'商家承诺退款'}]},'analyst',c)).toThrow();
  expect(()=>validateOutput({...output(),facts:[{label:'诉求',value:'待核对',evidenceId:'unknown',quote:null}]},'analyst',c)).toThrow();
 });
 it('rejects unconfigured provider without pretend analysis',async()=>{delete process.env.DASHSCOPE_API_KEY;expect(getAiCapabilities().aiConfigured).toBe(false);await expect(runWorkflow(c,{message:'退款',mode:'direct',target:'analyst',runId:'r'},{emit:()=>{},persist:async()=>{}})).rejects.toThrow(/配置/)});
 it('rejects fabricated quotes and unknown evidence',()=>{expect(()=>validateOutput({...output(),citations:[{evidenceId:'e',quote:'保证七天退款'}]},'analyst',c)).toThrow();expect(()=>validateOutput({...output(),citations:[{evidenceId:'unknown',quote:'退款'}]},'analyst',c)).toThrow()});
 it('never upgrades proposal status; tools return actual missing evidence',async()=>{const r:any=await executeAgentTool('analyze_consumer_issue',{},c);expect(r.confirmedFacts).toEqual([]);expect(r.missingEvidence.length).toBeGreaterThan(0);await expect(executeAgentTool('extract_purchase_evidence',{evidenceId:'unknown'},c)).rejects.toThrow()});
 it('strict target routing, tool roundtrip and persistence before result (LOCAL MOCK)',async()=>{
  let calls=0;const bodies:any[]=[];
  const server=createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);bodies.push(body);calls++;res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:calls===1?{role:'assistant',content:null,tool_calls:[{id:'t',type:'function',function:{name:'analyze_consumer_issue',arguments:'{}'}}]}:{content:JSON.stringify(output())}}],usage:{prompt_tokens:10,completion_tokens:3}}))});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const addr=server.address() as any;process.env.DASHSCOPE_API_KEY='local-test';process.env.QWEN_BASE_URL=`http://127.0.0.1:${addr.port}/v1`;
  const order:string[]=[];try{await runWorkflow(c,{message:'退款',mode:'group',target:'analyst',runId:'r'},{emit:e=>order.push(e.type),persist:async(o,r)=>{expect(o.agentId).toBe('analyst');expect(r.tools).toContain('analyze_consumer_issue');order.push('persist')}});expect(calls).toBe(2);expect(order.indexOf('persist')).toBeLessThan(order.indexOf('result'));expect(bodies[1].messages.some((m:any)=>m.role==='tool')).toBe(true)}finally{await new Promise<void>(resolve=>server.close(()=>resolve()))}
 });
});

async function withModel(respond:(body:any,n:number)=>unknown,run:()=>Promise<void>){let n=0;const server=createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;res.setHeader('content-type','application/json');res.end(JSON.stringify(respond(JSON.parse(raw),++n)));});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));process.env.DASHSCOPE_API_KEY='local-test';process.env.QWEN_BASE_URL=`http://127.0.0.1:${(server.address() as any).port}/v1`;try{await run()}finally{await new Promise<void>(resolve=>server.close(()=>resolve()))}}

describe('LOCAL MOCK provider orchestration and failures',()=>{
 it('routes only selected ducks, passes completed handoffs and finishes with butler summary',async()=>{const calls:string[]=[];const persisted:string[]=[];await withModel((body,n)=>{const role=n===1||n===4?'butler':n===2?'detective':'refund';calls.push(role);if(n===3){expect(body.messages[1].content).toContain('completedHandoffs');expect(body.messages[1].content).toContain('detective')}return {choices:[{message:{content:JSON.stringify({...output(role),suggestedMembers:n===1?['refund','detective']:[]})}}]}},async()=>{await runWorkflow(c,{message:'退款核对',mode:'group',runId:'r'},{emit:()=>{},persist:async(o)=>{persisted.push(o.agentId)}})});expect(calls).toEqual(['butler','detective','refund','butler']);expect(persisted).toEqual(calls)});
 it('rejects unauthorized tool before execution and records a failed run',async()=>{const statuses:string[]=[];await withModel(()=>({choices:[{message:{tool_calls:[{id:'t',type:'function',function:{name:'manage_follow_up',arguments:'{}'}}]}}]}),async()=>{await expect(runWorkflow(c,{message:'分析',target:'analyst',mode:'direct',runId:'r'},{emit:()=>{},persist:async(_,r)=>{statuses.push(r.status)}})).rejects.toThrow(/越权/)});expect(statuses).toEqual(['failed'])});
 it('rejects invented confirmed fact fields and wrong role',()=>{expect(()=>validateOutput({...output(),facts:[{label:'退款',value:'成功',status:'confirmed'}]},'analyst',c)).toThrow();expect(()=>validateOutput(output('refund'),'analyst',c)).toThrow()});
 it('all seven tools are read-only proposals, reject unknown params and honour cancellation',async()=>{for(const [name,input] of [['analyze_consumer_issue',{}],['extract_purchase_evidence',{evidenceId:'e'}],['compare_merchant_statements',{}],['generate_after_sales_plan',{}],['manage_follow_up',{}],['prepare_dispute_escalation',{}],['route_to_ducks',{}]] as const){const before=JSON.stringify(c);expect(await executeAgentTool(name,input,c)).toBeTruthy();expect(JSON.stringify(c)).toBe(before)}await expect(executeAgentTool('manage_follow_up',{status:'done'},c)).rejects.toThrow();const ctrl=new AbortController();ctrl.abort();await expect(executeAgentTool('manage_follow_up',{},c,ctrl.signal)).rejects.toThrow()});
});


it('records invalid image as failed after start (LOCAL MOCK key, no network)',async()=>{process.env.DASHSCOPE_API_KEY='local-test';const states:string[]=[];await expect(runWorkflow(c,{message:'识别',mode:'direct',target:'detective',runId:'r',images:[{evidenceId:'missing',dataUrl:'bad'}]},{emit:()=>{},persist:async(_,r)=>{states.push(r.status)}})).rejects.toThrow(/图片/);expect(states).toEqual(['failed'])});
it('repairs malformed format once, persists only valid result and keeps combined usage (LOCAL MOCK)',async()=>{
 let count=0;const statuses:string[]=[];
 await withModel((_body,n)=>{count=n;return {choices:[{message:{content:JSON.stringify(n===1?{...output(),facts:[{label:'缺失',value:''}]}:output())}}],usage:{prompt_tokens:10,completion_tokens:3}}},async()=>{await runWorkflow(c,{message:'测试格式',target:'analyst',mode:'direct',runId:'r'},{emit(){},async persist(o,r){statuses.push(r.status);expect(o.usage).toEqual({inputTokens:20,outputTokens:6})}})});
 expect(count).toBe(2);expect(statuses).toEqual(['completed']);
});
it('stops after one format repair and never accepts invented citations after a bounded grounding correction (LOCAL MOCK)',async()=>{
 let count=0;await withModel((_body,n)=>{count=n;return {choices:[{message:{content:'invalid-json'}}]}},async()=>{await expect(runWorkflow(c,{message:'测试格式',target:'analyst',mode:'direct',runId:'r'},{emit(){},async persist(_,r){expect(r.status).toBe('failed')}})).rejects.toThrow()});expect(count).toBe(2);
 await withModel((_body,n)=>{count=n;return {choices:[{message:{content:JSON.stringify({...output(),citations:[{evidenceId:'unknown',quote:'fake'}]})}}]}},async()=>{await expect(runWorkflow(c,{message:'测试来源',target:'analyst',mode:'direct',runId:'r'},{emit(){},async persist(){}})).rejects.toThrow(/未知证据/)});expect(count).toBe(2);
});

it('executes required business tools even when provider skips function calls; routing covers material/refund duties (LOCAL MOCK)',async()=>{
 const runs:any[]=[];await withModel(body=>{const role=/ID=(\w+)/.exec(body.messages[0].content)![1];const summary=body.messages[0].content.includes('这是接力后的汇总');if(!summary)expect(body.messages.some((m:any)=>typeof m.content==='string'&&m.content.includes('executedBusinessTool'))).toBe(true);return {choices:[{message:{content:JSON.stringify(output(role))}}],usage:{prompt_tokens:12,completion_tokens:4}}},async()=>{await runWorkflow(c,{message:'核对证据，退款草稿及跟进',mode:'group',runId:'r'},{emit(){},async persist(_,run){runs.push(run)}})});
 expect(runs.map(r=>r.agentId)).toEqual(['butler','detective','refund','followup','butler']);
 expect(runs[0].tools).toContain('route_to_ducks');expect(runs[1].tools).toContain('extract_purchase_evidence');expect(runs[2].tools).toContain('generate_after_sales_plan');expect(runs[3].tools).toContain('manage_follow_up');expect(runs.at(-1).dependsOn).toEqual(runs.slice(0,-1).map(r=>r.id));
});

it('routes using existing refund context and executes extraction for each material (LOCAL MOCK)',async()=>{
 const routed:any=await executeAgentTool('route_to_ducks',{message:'请核对材料'},c);expect(routed.recommendedMembers).toContain('refund');
 const multiple={...structuredClone(c),evidence:[...c.evidence,{...c.evidence[0],id:'second',code:'E2'}]};
 await withModel(body=>{const tools=body.messages.filter((m:any)=>m.role==='user'&&typeof m.content==='string'&&m.content.includes('executedBusinessTool')).map((m:any)=>JSON.parse(m.content));expect(tools.filter((t:any)=>t.executedBusinessTool==='extract_purchase_evidence').map((t:any)=>t.result.evidenceId)).toEqual(['e','second']);return {choices:[{message:{content:JSON.stringify(output('detective'))}}]}},async()=>{await runWorkflow(multiple,{message:'识别第二份',mode:'direct',target:'detective',runId:'r'},{emit(){},async persist(){}})});
});
it('repairs wrong-role artifacts once without accepting or storing them (LOCAL MOCK)',async()=>{
 let persisted=0;await withModel((_body,n)=>({choices:[{message:{content:JSON.stringify({...output('butler'),drafts:n===1?[{tone:'gentle',text:'不应由管家写入'}]:[]})}}]}),async()=>{await runWorkflow(c,{message:'汇总',mode:'direct',target:'butler',runId:'r'},{emit(){},async persist(o){expect(o.drafts).toEqual([]);persisted++}})});expect(persisted).toBe(1);
});
it('requires verifiable structured citations for text evidence analysis',()=>{
 expect(()=>validateOutput({...output('detective'),citations:[]},'detective',c)).toThrow(/原文引用/);
 expect(()=>validateOutput({...output('detective'),citations:[{evidenceId:'e',quote:'伪造原文'}]},'detective',c)).toThrow(/原文/);
 expect(validateOutput(output('detective'),'detective',c).citations[0].quote).toBe('商家承诺退款');
});
it('summary rejects duplicate artifacts and repairs once (LOCAL MOCK)',async()=>{
 let summaryCalls=0;const outputs:any[]=[];await withModel(body=>{const role=/ID=(\w+)/.exec(body.messages[0].content)![1];const summary=body.messages[0].content.includes('这是接力后的汇总');const o=output(role);if(summary&&++summaryCalls===1)(o.tasks as any[]).push({title:'重复任务',agentId:'followup',priority:'normal'});return {choices:[{message:{content:JSON.stringify(o)}}]}},async()=>{await runWorkflow(c,{message:'证据退款跟进',mode:'group',runId:'r'},{emit(){},async persist(o){outputs.push(o)}})});expect(summaryCalls).toBe(2);expect(outputs.at(-1).tasks).toEqual([]);
});
it('accepts minimal read-only summary protocol without producing duplicate artifacts (LOCAL MOCK)',async()=>{
 let last:any;await withModel(body=>{const role=/ID=(\w+)/.exec(body.messages[0].content)![1];const summary=body.messages[0].content.includes('这是接力后的汇总');return {choices:[{message:{content:JSON.stringify(summary?{agentId:'butler',message:'最终办事单：核对材料，使用既有草稿，确认待办',citations:[],missingEvidence:[]}:output(role))}}]}},async()=>{await runWorkflow(c,{message:'证据退款跟进',mode:'group',runId:'r'},{emit(){},async persist(o){last=o}})});expect(last.agentId).toBe('butler');expect(last.tasks).toEqual([]);expect(last.drafts).toEqual([]);
});
it('minimal summary with concealed nonempty artifacts is rejected, not silently normalized (LOCAL MOCK)',async()=>{
 let summaryCalls=0;await withModel(body=>{const role=/ID=(\w+)/.exec(body.messages[0].content)![1];const summary=body.messages[0].content.includes('这是接力后的汇总');if(summary)summaryCalls++;return {choices:[{message:{content:JSON.stringify(summary?{agentId:'butler',message:'不合格汇总',citations:[],missingEvidence:[],tasks:[{title:'隐藏新任务',agentId:'followup',priority:'normal'}]}:output(role))}}]}},async()=>{await expect(runWorkflow(c,{message:'证据退款跟进',mode:'group',runId:'r'},{emit(){},async persist(o,r){if(r.agentId==='butler'&&r.dependsOn.length)expect(r.status).toBe('failed')}})).rejects.toThrow()});expect(summaryCalls).toBe(2);
});
it('bounded grounding correction only persists the newly validated real quote and records correction count (LOCAL MOCK)',async()=>{
 let persisted=0;await withModel((body,n)=>{if(n===2)expect(body.messages.at(-1).content).toContain('商家承诺退款');return {choices:[{message:{content:JSON.stringify({...output('detective'),citations:[{evidenceId:'e',quote:n===1?'不存在的承诺':'商家承诺退款'}]})}}]}},async()=>{await runWorkflow(c,{message:'证据',mode:'direct',target:'detective',runId:'r'},{emit(){},async persist(o,r){expect(o.citations[0].quote).toBe('商家承诺退款');expect(r.validationCorrections).toBe(1);persisted++}})});expect(persisted).toBe(1);
});
it('vision request remains final multimodal message and missing extraction cannot complete (LOCAL MOCK)',async()=>{
 let calls=0;const imageCase={...structuredClone(c),evidence:[...c.evidence,{...c.evidence[0],id:'image',sourceType:'image' as const,mime:'image/png',sourceText:undefined}]};await withModel(body=>{calls++;if(calls===1)expect(body.messages.at(-1).content.some((part:any)=>part.type==='image_url')).toBe(true);else expect(body.messages.some((m:any)=>Array.isArray(m.content)&&m.content.some((part:any)=>part.type==='image_url'))).toBe(true);return {choices:[{message:{content:JSON.stringify({extractions:[]})}}]}},async()=>{await expect(runWorkflow(imageCase,{message:'提取图片',mode:'direct',target:'detective',runId:'r',images:[{evidenceId:'image',dataUrl:'data:image/png;base64,AA=='}]},{emit(){},async persist(_,run){expect(run.status).toBe('failed')}})).rejects.toThrow(/图像提取/)});expect(calls).toBe(2);
});
it('rejects empty extraction while allowing explicit unreadable uncertainty',()=>{
 expect(()=>validateOutput({...output('detective'),extractions:[{evidenceId:'e',data:{}}]},'detective',c)).toThrow(/无法识别原因/);
 expect(validateOutput({...output('detective'),extractions:[{evidenceId:'e',data:{uncertainties:['文字模糊，需重新上传']}}]},'detective',c).extractions).toHaveLength(1);
});
it('minimal butler routing cannot create specialist artifacts (LOCAL MOCK)',async()=>{
 let routed=false;await withModel(body=>{const role=/ID=(\w+)/.exec(body.messages[0].content)![1];const summary=body.messages[0].content.includes('这是接力后的汇总');const value=role==='butler'?(summary?{agentId:role,message:'办事单',citations:[],missingEvidence:[]}:{agentId:role,message:'调度',citations:[],missingEvidence:[],suggestedMembers:['refund']}):output(role);return {choices:[{message:{content:JSON.stringify(value)}}]}},async()=>{await runWorkflow(c,{message:'证据退款跟进',mode:'group',runId:'r'},{emit(e){if(e.type==='route')routed=true},async persist(o){if(o.agentId==='butler'){expect(o.facts).toEqual([]);expect(o.tasks).toEqual([]);expect(o.drafts).toEqual([])}}})});expect(routed).toBe(true);
});
it('rejects OCR for a case image not actually sent in the vision request (LOCAL MOCK)',async()=>{
 const imagesCase={...structuredClone(c),evidence:['first','second'].map(image=>({...c.evidence[0],id:image,sourceType:'image' as const,mime:'image/png',sourceText:undefined}))};let calls=0;
 await withModel(()=>{calls++;return {choices:[{message:{content:JSON.stringify({extractions:[{evidenceId:'second',data:{amount:'199'}},{evidenceId:'first',data:{amount:'fabricated unseen'}}]})}}]}},async()=>{await expect(runWorkflow(imagesCase,{message:'仅第二图',mode:'direct',target:'detective',runId:'r',images:[{evidenceId:'second',dataUrl:'data:image/png;base64,AA=='}]},{emit(){},async persist(_,run){expect(run.status).toBe('failed')}})).rejects.toThrow(/未知证据/)});expect(calls).toBe(2);
});
it('text-only detective cannot fabricate OCR of an image omitted from input (LOCAL MOCK)',async()=>{
 const imageCase={...structuredClone(c),evidence:[{...c.evidence[0],id:'image',sourceType:'image' as const,sourceText:undefined}]};await withModel(()=>({choices:[{message:{content:JSON.stringify({...output('detective'),citations:[],extractions:[{evidenceId:'image',data:{amount:'fake'}}]})}}]}),async()=>{await expect(runWorkflow(imageCase,{message:'只分析已有信息',mode:'direct',target:'detective',runId:'r'},{emit(){},async persist(_,run){expect(run.status).toBe('failed')}})).rejects.toThrow(/未输入图像/)});
});
it('uploaded materials cannot be mislabeled missing; lack of human confirmation is distinct',()=>{
 expect(()=>validateOutput({...output(),missingEvidence:['e']},'analyst',c)).toThrow(/已经上传/);
 expect(()=>validateOutput({...output(),missingEvidence:['E1']},'analyst',c)).toThrow(/已经上传/);
 expect(validateOutput({...output(),missingEvidence:['人工核对已上传材料','退货物流签收凭证']},'analyst',c).missingEvidence).toHaveLength(2);
});
