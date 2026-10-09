import {IncomingMessage,ServerResponse} from 'node:http';
import {Socket} from 'node:net';

// Adapt the platform's Web Request/Response contract without opening a listening socket.
export async function expressWeb(app, request, path, clientIp) {
  const socket=new Socket();
  Object.defineProperty(socket,'remoteAddress',{value:clientIp||'0.0.0.0'});
  const req=new IncomingMessage(socket);
  req.method=request.method;req.url=path;req.originalUrl=path;
  req.headers=Object.fromEntries(request.headers.entries());req.httpVersion='1.1';
  // The bridge supplies the platform IP directly; do not trust caller forwarding headers.
  delete req.headers['x-forwarded-for'];
  // Web Request bodies have no transfer-encoding header; Express body parsers need framing.
  if(request.body&&!req.headers['content-length'])req.headers['transfer-encoding']='chunked';
  req.rawHeaders=[...request.headers.entries()].flat();
  const res=new ServerResponse(req);
  return new Promise((resolve,reject)=>{
    let started=false,finished=false,aborted=false,controller;
    function abort(){if(aborted||finished)return;aborted=true;res.emit('close');req.destroy();}
    const body=new ReadableStream({start(value){controller=value;},cancel:abort});
    function start(){
      if(started)return;started=true;
      const headers=new Headers();
      for(const [key,value] of Object.entries(res.getHeaders()))for(const item of Array.isArray(value)?value:[value])if(item!==undefined)headers.append(key,String(item));
      const empty=request.method==='HEAD'||[204,304].includes(res.statusCode);
      resolve(new Response(empty?null:body,{status:res.statusCode,headers}));
    }
    res.writeHead=function(status,reasonOrHeaders,headers){res.statusCode=status;const fields=typeof reasonOrHeaders==='string'?headers:reasonOrHeaders;if(fields)for(const [key,value]of Object.entries(fields))res.setHeader(key,value);start();return res;};
    res.flushHeaders=start;
    res.write=function(chunk,encoding,callback){start();if(!finished&&!aborted)controller.enqueue(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk,typeof encoding==='string'?encoding:undefined));(typeof encoding==='function'?encoding:callback)?.();return !aborted;};
    res.end=function(chunk,encoding,callback){if(chunk!==undefined&&chunk!==null)res.write(chunk,encoding);start();if(!finished){finished=true;if(!aborted)controller.close();request.signal.removeEventListener('abort',abort);res.emit('finish');}(typeof encoding==='function'?encoding:callback)?.();return res;};
    Object.defineProperty(res,'headersSent',{get:()=>started});
    Object.defineProperty(res,'writableEnded',{get:()=>finished});
    Object.defineProperty(res,'finished',{get:()=>finished,set:()=>{}});
    Object.defineProperty(res,'destroyed',{get:()=>aborted});
    request.signal.addEventListener('abort',abort,{once:true});
    app(req,res,error=>{if(error){if(!started)reject(error);else controller.error(error);}else if(!finished){res.statusCode=404;res.end();}});
    (async()=>{try{if(request.body){for await(const chunk of request.body)req.push(Buffer.from(chunk));}req.complete=true;req.push(null);}catch(error){req.destroy(error);if(!started)reject(error);else controller.error(error);}})();
  });
}
