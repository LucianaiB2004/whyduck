import {createCloudRuntime} from '../_whyduck/runtime.js';
import {expressWeb} from '../_whyduck/express-web.js';
const app = createCloudRuntime();
export function createRequestHandler(service) {
  return context => {
    const request = context.request, url = new URL(request.url);
    return expressWeb(service, request, url.pathname + url.search, context.clientIp);
  };
}
export const onRequest = createRequestHandler(app);
// The platform treats catch-all files as framework entries and calls default.fetch.
// Keep the documented handler export and provide the actual deployed catch-all contract.
export default {fetch(request, env, context) { return onRequest({request, env, clientIp:context?.clientIp||request.eo?.clientIp}); }};
