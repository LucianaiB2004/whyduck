import {createCloudRuntime} from '../_whyduck/runtime.js';
import {expressWeb} from '../_whyduck/express-web.js';
const app = createCloudRuntime();
export function onRequest(context) {
  const request = context.request;
  return expressWeb(app, request, new URL(request.url).pathname, context.clientIp);
}
