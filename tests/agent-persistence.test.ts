import {it,expect} from 'vitest';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import request from 'supertest';
import {createApp} from '../src/server/app.js';

it('LOCAL MOCK: repeated shared facts preserve current drafts; only followup creates deduplicated tasks',async()=>{
 const task={title:'核对退款回复',agentId:'followup',priority:'normal'};
 const model=createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);const role=/ID=(\w+)/.exec(body.messages[0].content)![1];res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({agentId:role,message:'明确标注的模拟协议结果',facts:[{label:'退款诉求',value:'待核对199元'},{label:'退款诉求',value:'待核对199元'}],tasks:[task,task],drafts:role==='refund'?[{tone:'gentle',text:'模拟待核对沟通草稿'}]:[],citations:[],missingEvidence:[],suggestedMembers:[]})}}]}))});await new Promise<void>(resolve=>model.listen(0,'127.0.0.1',resolve));
 process.env.DASHSCOPE_API_KEY='local-test';process.env.QWEN_BASE_URL=`http://127.0.0.1:${(model.address() as any).port}/v1`;const dir=mkdtempSync(join(tmpdir(),'wd-agent-dedupe-'));const app=createApp({dataDir:dir,disableRateLimit:true,publicOrigin:'http://localhost'}),client=request.agent(app),headers={'X-WhyDuck-Client':'web'};
 try{
  await client.post('/api/auth/register').set(headers).send({email:'dedupe@example.test',password:'Safe-test-password-123'});await client.patch('/api/profile').set(headers).send({aiConsent:true});const id=(await client.post('/api/cases').set(headers).send({title:'角色持久化回归'})).body.case.id;
  const run=(target:string)=>client.post(`/api/cases/${id}/messages`).set(headers).send({message:'合成测试',mode:'direct',target});const current=async()=>(await client.get(`/api/cases/${id}`)).body.case;
  await run('analyst');expect((await current()).tasks).toHaveLength(0);await run('refund');const before=await current();expect(before.drafts[0].stale).toBe(false);await run('followup');await run('followup');const after=await current();expect(after.facts).toHaveLength(1);expect(after.tasks).toHaveLength(1);expect(after.tasks[0].status).toBe('proposed');expect(after.factRevision).toBe(before.factRevision);expect(after.drafts[0].stale).toBe(false);
  await client.patch(`/api/cases/${id}/facts/${after.facts[0].id}`).set(headers).send({value:'人工修改后的199元'});expect((await current()).drafts[0].stale).toBe(true);
 }finally{app.locals.db.close();rmSync(dir,{recursive:true,force:true});delete process.env.DASHSCOPE_API_KEY;delete process.env.QWEN_BASE_URL;await new Promise<void>(resolve=>model.close(()=>resolve()))}
});
