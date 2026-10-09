import {Router} from 'express';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {AlipaySdk} from 'alipay-sdk';
import type {BusinessServices,User} from '../../shared/types.js';
export function createAlipayRouter(services:BusinessServices):Router {
 const router=Router();
 const pending=new Map<string,{userId:string,expires:number}>();
 const origin=process.env.PUBLIC_ORIGIN;
 const configured=process.env.ALIPAY_ENABLED==='true'&&!!process.env.ALIPAY_APP_ID&&!!process.env.ALIPAY_PRIVATE_KEY&&!!process.env.ALIPAY_PUBLIC_KEY&&!!origin;
 const sdk=configured?new AlipaySdk({appId:process.env.ALIPAY_APP_ID!,privateKey:process.env.ALIPAY_PRIVATE_KEY!.replace(/\\n/g,'\n'),alipayPublicKey:process.env.ALIPAY_PUBLIC_KEY!.replace(/\\n/g,'\n'),signType:'RSA2',camelcase:false}):null;
 router.get('/status',(_req,res)=>res.json({configured,linked:Boolean(res.locals.alipayLinked),status:configured?'configured-awaiting-platform-verification':'unconfigured',note:'仅关联身份；不会读取支付宝订单、账单或自动执行退款。真实平台尚需准入和联调。'}));
 router.post('/authorize',(_req,res)=>{
  const user=res.locals.user as User|undefined;
  if(!user){res.status(401).json({error:{code:'UNAUTHORIZED',message:'请先登录凭啥鸭账户'}});return;}
  if(!sdk){res.status(503).json({error:{code:'ALIPAY_UNCONFIGURED',message:'尚未配置支付宝应用凭证及正式回调域名'}});return;}
  for(const [key,value] of pending)if(value.expires<Date.now())pending.delete(key);
  const state=randomBytes(32).toString('hex');pending.set(state,{userId:user.id,expires:Date.now()+300000});
  res.cookie('whyduck_alipay_state',state,{httpOnly:true,sameSite:'lax',secure:origin!.startsWith('https:'),maxAge:300000,path:'/api/alipay'});
  const url=new URL('https://openauth.alipay.com/oauth2/publicAppAuthorize.htm');
  url.searchParams.set('app_id',process.env.ALIPAY_APP_ID!);url.searchParams.set('scope','auth_base');url.searchParams.set('redirect_uri',`${origin}/api/alipay/callback`);url.searchParams.set('state',state);
  res.json({url:url.href,expiresIn:300});
 });
 router.get('/callback',async(req,res)=>{
  const user=res.locals.user as User|undefined;
  const state=typeof req.query.state==='string'?req.query.state:'';
  const cookie=(req.headers.cookie??'').split(';').map(s=>s.trim()).find(s=>s.startsWith('whyduck_alipay_state='))?.slice(21)??'';
  const saved=pending.get(state);pending.delete(state);
  res.clearCookie('whyduck_alipay_state',{path:'/api/alipay'});
  if(!user||!saved||saved.userId!==user.id||saved.expires<Date.now()||!state||cookie.length!==state.length||!timingSafeEqual(Buffer.from(cookie),Buffer.from(state))){res.status(400).json({error:{code:'INVALID_AUTH_STATE',message:'授权状态无效或已过期，请重新开始'}});return;}
  const code=typeof req.query.auth_code==='string'?req.query.auth_code:'';
  if(!sdk||!code||code.length>1024){res.status(400).json({error:{code:'INVALID_AUTH_CODE',message:'授权码缺失或平台未配置'}});return;}
  try{
   const result=await sdk.exec('alipay.system.oauth.token',{grantType:'authorization_code',code},{validateSign:true});
   if(typeof result.user_id!=='string'||!result.user_id||result.error_response)throw new Error('invalid identity');
   services.linkAlipay(user.id,result.user_id);
   res.json({ok:true,note:'已关联经过支付宝签名验证的身份，未获得交易数据读取权限'});
   }catch(error){
    if(error&&typeof error==='object'&&'code' in error&&error.code==='ALIPAY_ALREADY_LINKED'){
     res.status(409).json({error:{code:'ALIPAY_ALREADY_LINKED',message:'此支付宝身份已有关联，请核对当前账户；未更改现有关联'}});return;
    }
    res.status(502).json({error:{code:'ALIPAY_AUTH_FAILED',message:'支付宝授权交换或验签失败，未关联账户'}});
   }
 });
 router.delete('/link',(_req,res)=>{const user=res.locals.user as User|undefined;if(!user){res.status(401).json({error:{code:'UNAUTHORIZED',message:'请先登录'}});return;}services.unlinkAlipay(user.id);res.json({ok:true});});
 return router;
}
