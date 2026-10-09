import {describe,it,expect,vi} from 'vitest';
import express from 'express';
import request from 'supertest';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {createMcpRouter} from '../src/server/mcp/index.js';
import {createAlipayRouter} from '../src/server/integrations/alipay.js';
import type {BusinessServices} from '../src/shared/types.js';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {generateKeyPairSync} from 'node:crypto';
import {AlipaySdk} from 'alipay-sdk';
const user={id:'u1',email:'test@example.com',name:'测试',aiConsent:true,createdAt:'2026-10-08'};
function fixture(){return {authenticateToken:(token:string)=>token==='valid'?user:null,getCase:(userId:string,caseId:string)=>{if(userId!=='u1'||caseId!=='own')throw Error('not found');return {id:caseId};},executeTool:vi.fn(async()=>({summary:'实际调用业务服务'})),getCapabilities:()=>({}),getUser:()=>user,listCases:()=>[],linkAlipay:vi.fn(),unlinkAlipay:vi.fn()} as unknown as BusinessServices;}
describe('平台适配真实协议',()=>{
 it('SDK initialize/listTools/callTool及案件隔离',async()=>{
  const services=fixture(),app=express();app.use(express.json());app.use('/mcp',createMcpRouter(services));
  const http=app.listen(0,'127.0.0.1');await new Promise<void>(r=>http.once('listening',r));
  const address=http.address() as {port:number};const client=new Client({name:'integration-test',version:'1'});
  try{
   await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${address.port}/mcp`),{requestInit:{headers:{Authorization:'Bearer valid'}}}));
   const tools=await client.listTools();expect(tools.tools).toHaveLength(7);
   const result=await client.callTool({name:'analyze_consumer_issue',arguments:{caseId:'own'}});expect(result.isError).not.toBe(true);expect(services.executeTool).toHaveBeenCalledOnce();expect(services.executeTool).toHaveBeenCalledWith('analyze_consumer_issue',{}, {userId:'u1',caseId:'own'});
   expect((await client.callTool({name:'analyze_consumer_issue',arguments:{caseId:'other'}})).isError).toBe(true);expect(services.executeTool).toHaveBeenCalledOnce();
  }finally{await client.close();await new Promise<void>((r,e)=>http.close(err=>err?e(err):r()));}
 });
 it('每次请求鉴权且缺失/伪造token拒绝',async()=>{const app=express();app.use(express.json());app.use('/mcp',createMcpRouter(fixture()));await request(app).post('/mcp').send({}).expect(401);await request(app).post('/mcp').set('Authorization','Bearer fake').send({}).expect(401);});
 it('未配置支付宝保持明确状态，不能伪造关联',async()=>{const services=fixture(),app=express();app.use(express.json());app.use('/api/alipay',createAlipayRouter(services));const status=await request(app).get('/api/alipay/status').expect(200);expect(status.body.configured).toBe(false);await request(app).post('/api/alipay/authorize').expect(401);await request(app).get('/api/alipay/callback?state=forged&auth_code=forged').expect(400);expect(services.linkAlipay).not.toHaveBeenCalled();});
 it('已登录关联绑定state，验签失败不写身份且state单次使用（本地SDK stub）',async()=>{
  const keys=generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs1',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
  vi.stubEnv('ALIPAY_ENABLED','true');vi.stubEnv('ALIPAY_APP_ID','local-test-app');vi.stubEnv('ALIPAY_PRIVATE_KEY',keys.privateKey);vi.stubEnv('ALIPAY_PUBLIC_KEY',keys.publicKey);vi.stubEnv('PUBLIC_ORIGIN','https://example.test');
  const exchange=vi.spyOn(AlipaySdk.prototype,'exec').mockRejectedValue(Error('signature invalid'));
  try{
   const services=fixture(),app=express();app.use(express.json());app.use((_req,res,next)=>{res.locals.user=user;next();});app.use('/api/alipay',createAlipayRouter(services));
   const begin=await request(app).post('/api/alipay/authorize').expect(200);const url=new URL(begin.body.url);expect(url.searchParams.get('scope')).toBe('auth_base');const state=url.searchParams.get('state')!;const cookie=String(begin.headers['set-cookie'][0]).split(';')[0];
   await request(app).get('/api/alipay/callback').query({state,auth_code:'synthetic-code'}).set('Cookie',cookie).expect(502);
   expect(exchange).toHaveBeenCalledWith('alipay.system.oauth.token',{grantType:'authorization_code',code:'synthetic-code'},{validateSign:true});expect(services.linkAlipay).not.toHaveBeenCalled();
   await request(app).get('/api/alipay/callback').query({state,auth_code:'synthetic-code'}).set('Cookie',cookie).expect(400);expect(exchange).toHaveBeenCalledOnce();
  }finally{vi.restoreAllMocks();vi.unstubAllEnvs();}
 });
});

describe('小程序交互合约（本地模拟运行环境，不代表真机）',()=>{
 function loadPage(name:string,mocks:Record<string,unknown>){let definition:any;runInNewContext(readFileSync(`miniapp/pages/${name}/index.js`,'utf8').replace(/^import[^;]+;/,''),{Page:(p:unknown)=>definition=p,...mocks});definition.setData=(data:unknown)=>Object.assign(definition.data,data);return definition;}
 it('API实际请求带账户令牌，缺少配置不发网络请求',async()=>{
  const app={globalData:{apiBase:'https://example.test',token:'private-test-token',caseId:''}},network=vi.fn((options:any)=>options.success({status:200,data:{user}}));
  const context:any={getApp:()=>app,my:{request:network},Promise,Error,JSON};
  runInNewContext(readFileSync('miniapp/utils/api.js','utf8').replace(/export /g,''),context);
  await context.api('/api/cases','POST',{title:'测试'});
  const options=network.mock.calls[0][0];expect(options.headers.Authorization).toBe('Bearer private-test-token');expect(JSON.parse(options.data)).toEqual({title:'测试'});
  app.globalData.token='';await expect(context.api('/api/cases')).rejects.toThrow('账户访问令牌');expect(network).toHaveBeenCalledOnce();
 });
 it('上传使用官方name/header字段，并且HTTP失败不会刷新为成功',()=>{
  const upload=vi.fn((o:any)=>{expect(o.name).toBe('file');expect(o.fileName).toBeUndefined();expect(o.header.Authorization).toBe('Bearer test');o.success({statusCode:413});o.complete();});
  const page=loadPage('evidence',{api:vi.fn(),getApp:()=>({globalData:{apiBase:'https://example.test',token:'test'}}),my:{chooseImage:(o:any)=>o.success({apFilePaths:['temp://image']}),uploadFile:upload}});page.id='case';page.refresh=vi.fn();page.upload();expect(page.data.error).toContain('上传失败');expect(page.refresh).not.toHaveBeenCalled();expect(page.data.busy).toBe(false);
 });
 it('群聊指定鸭与SSE错误保留，不把模型错误展示为成功',async()=>{
  const api=vi.fn(async(path:string)=>path.endsWith('/messages')?'data: {"type":"error","message":"模型未配置"}\n\n':{case:{id:'case'}});
  const page=loadPage('chat',{api,ducks:[],getApp:()=>({globalData:{}}),my:{}});page.id='case';page.data.message='新的售后情况';page.data.target='detective';await page.send();expect(api.mock.calls[0]).toEqual(['/api/cases/case/messages','POST',{message:'新的售后情况',mode:'direct',target:'detective'}]);expect(page.data.error).toBe('模型未配置');expect(page.data.busy).toBe(false);
 });
 it('分享需人工确认且分享参数不含案件标识和敏感信息',()=>{
  const share=vi.fn();const page=loadPage('chat',{api:vi.fn(),ducks:[],getApp:()=>({globalData:{}}),my:{confirm:(o:any)=>o.success({confirm:false}),showSharePanel:share}});page.id='sensitive-case';page.share();expect(share).not.toHaveBeenCalled();expect(page.onShareAppMessage()).toEqual({title:'凭啥鸭 · 售后鸭鸭局',path:'pages/home/index'});
 });
});
