import type { AgentEvent, AgentId } from "../shared/types";
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const r = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    headers: {
      "X-WhyDuck-Client": "web",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.headers.get("content-type")?.includes("application/json")) {
    throw new Error("后端服务尚未部署或 API 路由配置不正确，暂时无法登录、保存案件或调用 AI。");
  }
  if (!r.ok) {
    const data = await r.json().catch(() => null);
    throw new Error(data?.error?.message || `请求失败 ${r.status}`);
  }
  return r.json();
}
export async function stream(
  path: string,
  body: unknown,
  onEvent: (event: AgentEvent) => void,
  signal: AbortSignal,
) {
  const r = await fetch("/api" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-WhyDuck-Client": "web" },
    credentials: "same-origin",
    body: JSON.stringify(body),
    signal,
  });
  if (!r.ok) {
    const e = await r.json().catch(() => null);
    throw Error(e?.error?.message || `请求失败 ${r.status}`);
  }
  if (!r.body) throw Error("服务器没有返回数据流");
  const reader = r.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = block
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("\n");
      if (data) onEvent(JSON.parse(data));
    }
    if (done) break;
  }
}
export const ducks: {
  id: AgentId;
  name: string;
  role: string;
  desc: string;
  color: string;
  tags: string[];
}[] = [
  {
    id: "butler",
    name: "管家鸭",
    role: "总管家 · 任务分派",
    desc: "不知道找谁？鸭来安排",
    color: "#fff1c6",
    tags: ["理解诉求", "邀请专业鸭", "汇总办事单"],
  },
  {
    id: "analyst",
    name: "凭啥鸭",
    role: "消费问题分析官",
    desc: "先把事情捋清楚",
    color: "#fff5dc",
    tags: ["倾听经历", "区分事实与推测", "诊断争议"],
  },
  {
    id: "detective",
    name: "据理力争鸭",
    role: "AI 证据侦探",
    desc: "查订单，核对商家说法",
    color: "#e5f1ff",
    tags: ["识别截图", "追溯原始材料", "对比说法"],
  },
  {
    id: "refund",
    name: "退退退鸭！",
    role: "退换货军师",
    desc: "有理有据，谈退谈换",
    color: "#ffe8e2",
    tags: ["比较处理方案", "生成沟通草稿", "核对适用条件"],
  },
  {
    id: "followup",
    name: "后手鸭",
    role: "售后跟进官",
    desc: "记承诺，盯进度，不烂尾",
    color: "#e8f4e8",
    tags: ["记录商家承诺", "创建待办", "接续新进展"],
  },
  {
    id: "escalation",
    name: "不服鸭",
    role: "协商升级顾问",
    desc: "协商不顺？再想办法",
    color: "#eee8fc",
    tags: ["复盘协商", "准备正式材料", "核查官方渠道"],
  },
];
export const character = (id: AgentId) =>
  "/assets/whyduck/characters/" + id + ".webp";
export const avatar = (id: AgentId) =>
  "/assets/whyduck/avatars/" + id + ".webp";
export async function uploadForm<T>(path: string, data: FormData): Promise<T> {
  const response = await fetch("/api" + path, {
    method: "POST",
    headers: { "X-WhyDuck-Client": "web" },
    credentials: "same-origin",
    body: data,
  });
  if (!response.ok) {
    const e = await response.json().catch(() => null);
    throw new Error(e?.error?.message || "上传失败");
  }
  return response.json();
}
