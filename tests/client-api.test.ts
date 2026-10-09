import { afterEach, expect, it, vi } from "vitest";
import { api } from "../src/client/api";

afterEach(() => vi.unstubAllGlobals());

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
