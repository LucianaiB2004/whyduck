import {createCloudRuntime} from '../_whyduck/runtime.js';
import {expressWeb} from '../_whyduck/express-web.js';
const app = createCloudRuntime();
export function onRequest(context) {
  const request = context.request;
  return expressWeb(app, request, new URL(request.url).pathname, context.clientIp);
}
// The platform treats catch-all files as framework entries and calls default.fetch.
// Keep the documented handler export and provide the actual deployed catch-all contract.
export default {fetch(request, env) { return onRequest({request, env}); }};
