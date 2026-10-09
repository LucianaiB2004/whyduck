import express from 'express';
const createApp=async options=>(await import('./app.js')).createApp(options);

export function configurationErrors(env = process.env) {
  const missing = ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'EVIDENCE_ENCRYPTION_KEY', 'PUBLIC_ORIGIN'].filter(key => !env[key]);
  if (!/^(libsql|https):\/\//.test(env.TURSO_DATABASE_URL || '')) missing.push('TURSO_DATABASE_URL(remote)');
  if (env.EVIDENCE_STORAGE !== 'edgeone-blob') missing.push('EVIDENCE_STORAGE(edgeone-blob)');
  const key = Buffer.from(env.EVIDENCE_ENCRYPTION_KEY || '', 'base64');
  if (key.length !== 32 || key.toString('base64') !== env.EVIDENCE_ENCRYPTION_KEY) missing.push('EVIDENCE_ENCRYPTION_KEY(32-byte-base64)');
  try { if (new URL(env.PUBLIC_ORIGIN).protocol !== 'https:') missing.push('PUBLIC_ORIGIN(https)'); } catch { missing.push('PUBLIC_ORIGIN(https)'); }
  return [...new Set(missing)];
}
export function createCloudRuntime(factory = createApp) {
  const app = express();
  let initialized;
  app.use(async (req, res, next) => {
    if (configurationErrors().length) {
      res.status(503).set('Cache-Control', 'no-store').json({error:{code:'CLOUD_UNCONFIGURED',message:'云端数据库、证据存储或正式域名尚未配置，未启用临时数据库。'}});
      return;
    }
    try {
      initialized ??= Promise.resolve().then(()=>factory({publicOrigin:process.env.PUBLIC_ORIGIN,secureCookies:true})).catch(error => { initialized=undefined;throw error; });
      const service = await initialized;
      // Some framework adapters strip the filesystem prefix; restore it once.
      if (!req.url.startsWith('/api/')) req.url = `/api${req.url.startsWith('/')?'':'/'}${req.url}`;
      service(req, res, next);
    } catch {
      if (!res.headersSent) res.status(503).set('Cache-Control','no-store').json({error:{code:'CLOUD_INITIALIZATION_FAILED',message:'云端服务初始化失败，请检查数据库与存储配置。'}});
      else res.end();
    }
  });
  return app;
}
