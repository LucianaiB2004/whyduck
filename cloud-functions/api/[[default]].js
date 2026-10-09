import {createCloudRuntime} from '../_whyduck/runtime.js';
import {expressWeb} from '../_whyduck/express-web.js';
const app = createCloudRuntime();
export function createRequestHandler(service) {
  return async context => {
    const request = context.request, url = new URL(request.url);
    const response = await expressWeb(service, request, url.pathname + url.search, context.clientIp);
    // Cloud Functions' framework serializer requires a buffered body for binary replies.
    // Long AI streams are served by Agents; keep genuine SSE responses streaming.
    if(response.headers.get('content-type')?.includes('text/event-stream')||!response.body)return response;
    return new Response(await response.arrayBuffer(),{status:response.status,headers:response.headers});
  };
}
export const onRequest = createRequestHandler(app);
// The platform treats catch-all files as framework entries and calls default.fetch.
// Keep the documented handler export and provide the actual deployed catch-all contract.
export default {fetch(request, env, context) { return onRequest({request, env, clientIp:context?.clientIp||request.eo?.clientIp}); }};
