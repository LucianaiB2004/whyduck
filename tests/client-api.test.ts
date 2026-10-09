import { afterEach, expect, it, vi } from "vitest";
import { api, evidenceDataUrl } from "../src/client/api";

afterEach(() => vi.unstubAllGlobals());
it('reassembles binary evidence chunks without UTF8 conversion',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json({mime:'image/png',base64:'iVBORw==',size:6,offset:0,nextOffset:4})).mockResolvedValueOnce(Response.json({mime:'image/png',base64:'AP8=',size:6,offset:4,nextOffset:null}));vi.stubGlobal('fetch',fetcher);
 expect(await evidenceDataUrl('/cases/c/evidence/e/file')).toBe('data:image/png;base64,iVBORwD/');expect(fetcher.mock.calls[1][0]).toContain('offset=4');
});

it("explains a static hosting HTML response instead of treating it as API success", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<!doctype html><html></html>", {
    headers: { "content-type": "text/html" },
  })));
  await expect(api("/session")).rejects.toThrow("后端服务尚未部署");
});

it("preserves real JSON API responses", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ user: null })));
  await expect(api("/session")).resolves.toEqual({ user: null });
});
