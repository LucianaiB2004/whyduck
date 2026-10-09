import {createCloudRuntime} from '../_whyduck/runtime.js';
import {expressWeb} from '../_whyduck/express-web.js';
const app=createCloudRuntime();
export async function onRequest(context){
  const incoming=context.request;
  // AgentContextRequest is a parsed plain object, unlike Cloud Functions' Web Request.
  const headers=new Headers(incoming.headers);
  headers.delete('content-length');
  headers.delete('transfer-encoding');
  const request=incoming instanceof Request?incoming:new Request(incoming.url,{method:incoming.method,headers,body:incoming.method==='GET'||incoming.method==='HEAD'?undefined:JSON.stringify(incoming.body??{}),signal:incoming.signal});
  const url=new URL(request.url),path=url.searchParams.get('path')||'';
  const match=/^\/api\/cases\/([a-f0-9-]{36})\/(messages|retry|runs\/[a-f0-9-]{36}\/cancel)$/.exec(path);
  if(request.method!=='POST'||!match)return Response.json({error:{code:'INVALID_AGENT_ROUTE',message:'不支持的智能体请求'}},{status:400});
  if(request.headers.get('Makers-Conversation-Id')!==match[1])return Response.json({error:{code:'CONVERSATION_MISMATCH',message:'会话标识与案件不匹配'}},{status:400});
  return expressWeb(app,request,path,context.eo?.clientIp||incoming.eo?.clientIp||context.clientIp);
}
