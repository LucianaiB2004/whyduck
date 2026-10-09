import {Router} from 'express';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {z} from 'zod';
import type {BusinessServices} from '../../shared/types.js';

export const toolNames = ['analyze_consumer_issue','extract_purchase_evidence','compare_merchant_statements','generate_after_sales_plan','manage_follow_up','prepare_dispute_escalation','route_to_ducks'] as const;
export function createMcpRouter(services:BusinessServices):Router {
 const router=Router();
 router.use((req,res,next)=>{
  if(process.env.MCP_ENABLED==='false'){res.status(503).json({error:{code:'MCP_DISABLED',message:'MCP 未启用'}});return;}
  const token=/^Bearer (\S+)$/i.exec(req.headers.authorization??'')?.[1];
  const user=token?services.authenticateToken(token):null;
  if(!user){res.status(401).json({error:{code:'UNAUTHORIZED',message:'需要有效的账户访问令牌'}});return;}
  res.locals.mcpUser=user;next();
 });
 router.post('/',async(req,res,next)=>{
  const server=new McpServer({name:'whyduck',version:'1.0.0'});
  for(const name of toolNames)server.registerTool(name,{
   description:`凭啥鸭案件业务工具 ${name}。只处理令牌所属账户案件；不会替用户发送消息或投诉。`,
   inputSchema:{caseId:z.string().min(1).max(128),message:z.string().max(12000).optional(),evidenceId:z.string().min(1).max(128).optional(),evidenceIds:z.array(z.string().min(1).max(128)).max(30).optional(),goal:z.string().max(2000).optional(),dueAt:z.string().datetime().optional()},
  },async(input)=>{
   try{
    services.getCase(res.locals.mcpUser.id,input.caseId);
    const {caseId,...arguments_}=input;
    const result=await services.executeTool(name,arguments_,{userId:res.locals.mcpUser.id,caseId});
    return {content:[{type:'text' as const,text:JSON.stringify(result)}]};
   }catch{return {isError:true,content:[{type:'text' as const,text:'工具执行失败。请核对案件权限、材料和模型配置。'}]};}
  });
  const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
  res.on('close',()=>{void transport.close();void server.close();});
  try{await server.connect(transport);await transport.handleRequest(req,res,req.body);}catch(error){next(error);}
 });
 router.all('/',(_req,res)=>res.status(405).json({error:{code:'METHOD_NOT_ALLOWED',message:'使用 Streamable HTTP POST'}}));
 return router;
}
