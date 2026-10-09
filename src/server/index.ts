import 'dotenv/config';
import {createApp} from './app.js';
const port=Number(process.env.PORT||3001);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT配置无效');
const app=(await createApp({secureCookies:process.env.SECURE_COOKIES===undefined?undefined:process.env.SECURE_COOKIES==='true'}));
const server=app.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`凭啥鸭服务已启动，端口 ${port}`));
let closing=false;function close(){if(closing)return;closing=true;server.close(()=>{app.locals.db.close();process.exit(0)});setTimeout(()=>process.exit(1),10000).unref();}process.on('SIGINT',close);process.on('SIGTERM',close);
