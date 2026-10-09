const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    "C:/Users/lucianaib/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const base = process.env.UI_URL || "http://127.0.0.1:5173",
  out = path.resolve(process.env.OUTPUT_DIR || "artifacts/ui");
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: "msedge" }),
    page = await browser.newPage({ acceptDownloads: true });
  const result = {
    checkedAt: new Date().toISOString(),
    pages: [],
    interactions: [],
    errors: [],
    skipped: [],
  };
  page.on("pageerror", (e) => result.errors.push(e.message)); page.on("response",r=>{if(r.status()>=400&&r.url().includes("/api/")) console.log("HTTP",r.status(),new URL(r.url()).pathname)});
  const current = () =>
    page.evaluate(async () => {
      const id = sessionStorage.getItem("whyduck-case");
      const r = await fetch("/api/cases/" + id);
      if (!r.ok) throw Error("Case unavailable " + r.status);
      return (await r.json()).case;
    });
  const visit = async (route) => {
    if(page.url().startsWith(base)){await page.evaluate(route=>{location.hash=route},route);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))}else await page.goto(base + "/#" + route);
    await page.waitForFunction(
      () =>
        document.querySelector(".main") &&
        !document.querySelector(".main .spinner"),
    );
  };
  await visit("register");
  await page.getByLabel("昵称", { exact: true }).fill("界面验收账户");
  await page
    .getByLabel("邮箱", { exact: true })
    .fill(`ui-${Date.now()}@example.test`);
  await page.getByLabel("密码", { exact: true }).fill("WhyDuck-test-2026!");
  await page.getByRole("button", { name: "注册并登录", exact: true }).click();
  await page
    .getByRole("button", { name: "体验退款未到账 · 示例", exact: true })
    .click();
  await page.getByLabel("当前案件", { exact: true }).waitFor();
  result.interactions.push("真实注册并创建服务器示例案件");
  const demo = await current();
  assert.equal(demo.demo, true);
  const eid = demo.evidence[0]?.id;
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const route of [
      "home",
      "meeting",
      "butler",
      "analyst",
      "detective",
      "refund",
      "followup",
      "escalation",
      "cases",
      "evidence",
      eid ? "evidence-detail/" + eid : "case-detail",
      "timeline",
      "tasks",
      "drafts",
      "report",
      "settings",
      "account",
      "guide",
      "brand",
    ]) {
      await visit(route);
      await page.waitForFunction(() =>
        Array.from(document.images).every((i) => i.complete),
      );
      const state = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        brokenImages: Array.from(document.images)
          .filter((i) => !i.naturalWidth)
          .map((i) => i.src),
      }));
      const screenshot = route.replace("/", "-") + "-" + width + ".png";
      await page.screenshot({
        path: path.join(out, screenshot),
        fullPage: true,
      });
      result.pages.push({ route, width, ...state, screenshot });
      assert.equal(state.overflow, false, "Overflow " + route + " " + width);
      assert.deepEqual(state.brokenImages, []);
    }
  }
  await visit("meeting");
  await page.getByLabel("指定鸭鸭").selectOption("detective");
  assert.equal(await page.getByLabel("指定鸭鸭").inputValue(), "detective");
  await page.getByRole("button", { name: "办事单", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByLabel("关闭", { exact: true }).click();
  result.interactions.push("手机办事单抽屉和 @ 目标选择");
  await page.getByRole("button", { name: "新建案件", exact: true }).click();
  await page.getByLabel("案件名称", { exact: true }).fill("真实 UI 验收案件");
  await page.getByRole("button", { name: "创建私有案件", exact: true }).click();
  await page
    .getByRole("heading", { name: "鸭鸭开会 · 真实 UI 验收案件", exact: true })
    .waitFor();
  let c = await current();
  assert.equal(c.demo, false);
  result.interactions.push("真实案件创建及持久化");
  await visit("evidence");
  await page
    .getByLabel("粘贴原始沟通记录")
    .fill(
      "商家：将在 2026 年 10 月 12 日前回复退款处理进度。\n用户：我的电话是 13800138000。",
    );
  await page.getByRole("button", { name: "保存原始记录", exact: true }).click();
  await page.getByRole("heading", { name: /用户提供的沟通记录/ }).waitFor();
  c = await current();
  assert.equal(c.evidence.length, 1);
  await page.getByRole("button", { name: "查看与核对", exact: true }).click();
  await page.getByLabel("商家", { exact: true }).fill("验收商家");
  await page.getByLabel("金额", { exact: true }).fill("299");
  await page
    .getByRole("button", { name: "已对照原图，确认信息", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "提取结果 · 已人工确认", exact: true })
    .waitFor();
  c = await current();
  assert.equal(c.evidence[0].confirmed, true);
  result.interactions.push("文字材料真实上传、原始出处与人工提取确认");
  const secondEvidence = await page.evaluate(async id => {
    const response = await fetch(`/api/cases/${id}/evidence`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-WhyDuck-Client": "web" },
      body: JSON.stringify({ sourceText: "独立材料：请另行核对，不应继承上一份材料的商家字段。", filename: "第二份独立材料.txt" }),
    });
    if (!response.ok) throw Error("Second evidence unavailable " + response.status);
    return (await response.json()).evidence.id;
  }, c.id);
  await page.reload();
  await page.getByLabel("商家", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("商家", { exact: true }).inputValue(), "验收商家");
  await visit("evidence-detail/" + secondEvidence);
  assert.equal(await page.getByLabel("商家", { exact: true }).inputValue(), "");
  result.interactions.push("不同原始材料的核对字段隔离，无上一份材料残留");
  await visit("timeline");
  await page.getByLabel("事实名称", { exact: true }).fill("商家承诺");
  await page.getByLabel("事实内容", { exact: true }).fill("2026-10-12 前回复");
  await page.getByLabel("关联原始材料").selectOption(c.evidence[0].id);
  await page
    .getByRole("button", { name: "记录待核实事实", exact: true })
    .click();
  await page.getByRole("heading", { name: "商家承诺", exact: true }).waitFor();
  const factRow = page
    .locator(".timeline-item")
    .filter({
      has: page.getByRole("heading", { name: "商家承诺", exact: true }),
    });
  await factRow.getByRole("button", { name: "确认事实", exact: true }).click();
  await factRow.getByText("已确认 · 用户记录", { exact: true }).waitFor();
  c = await current();
  assert.equal(c.facts.find((f) => f.label === "商家承诺").status, "confirmed");
  result.interactions.push("关联来源的事实记录及人工确认");
  await visit("tasks");
  await page.getByLabel("新增跟进任务").fill("验收：核对商家回复");
  await page.getByLabel("到期时间", { exact: true }).fill("2026-10-07T12:00");
  await page.getByRole("button", { name: "添加任务", exact: true }).click();
  await page
    .getByRole("heading", { name: "验收：核对商家回复", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "标记完成", exact: true }).click();
  c = await current();
  assert.equal(c.tasks[0].status, "done");
  result.interactions.push("到期任务真实创建并标记完成");
  await visit("drafts");
  await page
    .getByLabel("沟通草稿", { exact: true })
    .fill("您好，请按双方已确认的记录说明退款进度。我的电话 13800138000。");
  await page
    .getByRole("button", { name: "保存已核对草稿", exact: true })
    .click();
  await page
    .getByRole("button", { name: "编辑这个版本", exact: true })
    .waitFor();
  c = await current();
  assert.equal(c.drafts.length, 1);
  await visit("timeline");
  await page
    .getByLabel("编辑事实 商家承诺", { exact: true })
    .fill("2026-10-13 前回复");
  await page
    .getByRole("heading", { name: "案件事实与证据时间线", exact: true })
    .click();
  await page.waitForFunction(async () => {
    const id = sessionStorage.getItem("whyduck-case"),
      c = (await (await fetch("/api/cases/" + id)).json()).case;
    return c.drafts.some((d) => d.stale);
  });
  await visit("drafts");
  await page.getByRole("heading", { name: /事实更新，需要重新核对/ }).waitFor();
  result.interactions.push("草稿真实保存、修改事实触发过期提示");
  await visit("report");
  assert.equal(
    await page
      .getByRole("button", { name: "下载 Markdown", exact: true })
      .isDisabled(),
    true,
  );
  await page
    .getByText("我已核对材料、待核实标签和脱敏选项", { exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "下载 Markdown", exact: true })
    .click();
  const download = await downloadPromise;
  assert.equal(await download.failure(), null);
  const destination = path.join(out, "verified-report.md");
  await download.saveAs(destination);
  assert.equal(
    fs.readFileSync(destination, "utf8").includes("13800138000"),
    false,
  );
  result.interactions.push("报告核对门槛、真实下载与个人电话脱敏");
  await page.getByLabel("当前案件", { exact: true }).selectOption(demo.id);
  await page.waitForFunction(id => document.querySelector('select[aria-label="当前案件"]').value === id, demo.id);
  assert.equal(await page.getByRole("button", { name: "下载 Markdown", exact: true }).isDisabled(), true);
  await visit("drafts");
  assert.equal(await page.getByLabel("沟通草稿", { exact: true }).inputValue(), "");
  await page.getByLabel("当前案件", { exact: true }).selectOption(c.id);
  await page.reload();
  await page.getByLabel("沟通草稿", { exact: true }).waitFor();
  assert.equal((await current()).id, c.id);
  assert.equal((await current()).drafts.length, 1);
  result.interactions.push("切换案件重置草稿与报告确认，刷新后恢复原案件及已保存数据");
  await visit("settings");
  await page.getByLabel("令牌名称", { exact: true }).fill("UI 验收临时令牌");
  await page.getByRole("button", { name: "签发访问令牌", exact: true }).click();
  await page.getByLabel("新访问令牌", { exact: true }).waitFor();
  const token = await page
    .getByLabel("新访问令牌", { exact: true })
    .inputValue();
  assert.ok(token.length > 20);
  const tokenCheck = await fetch(base + "/api/cases", {
    headers: { Authorization: "Bearer " + token },
  });
  assert.equal(tokenCheck.status, 200);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await page.waitForFunction(
    async () => !(await (await fetch("/api/auth/tokens")).json()).tokens.length,
  );
  assert.equal(
    (
      await fetch(base + "/api/cases", {
        headers: { Authorization: "Bearer " + token },
      })
    ).status,
    401,
  );
  result.interactions.push("账户令牌真实签发、无cookie认证及撤销失效");
  await page.getByLabel("同意 AI 材料处理", { exact: true }).click();
  await page.waitForFunction(
    async () => (await (await fetch("/api/session")).json()).user.aiConsent,
  );
  await visit("meeting");
  const session = await page.evaluate(async () => (await fetch("/api/session")).json());
  result.aiConfigured = session.capabilities.aiConfigured;
  if (!session.capabilities.aiConfigured) {
  await page.getByLabel("聊天消息", { exact: true }).fill("请核对这份退款材料");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await page.getByRole("alert").waitFor();
  const errorText = await page.getByRole("alert").innerText();
  assert.match(errorText, /未配置|API_KEY|模型|服务|调用/);
  c = await current();
  assert.ok(
    c.messages.some(
      (m) => m.role === "user" && m.content === "请核对这份退款材料",
    ),
  );
  assert.equal(c.messages.filter((m) => m.role === "agent").length, 0);
  result.interactions.push("未配置模型明确失败且保留用户消息，不伪造分析");
  } else {
    result.skipped.push("服务已配置真实模型：不重复付费调用；真实多智能体长链由独立验收脚本检查");
  }
  await page.getByLabel("当前案件", { exact: true }).selectOption(demo.id);
  await page.getByLabel("聊天消息", { exact: true }).fill("示例案件的新输入");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.match(await page.getByRole("alert").innerText(), /示例/);
  result.interactions.push("示例新输入拒绝真实分析，未伪造结果");
  for (const [route, target, expectedMode, expectedTarget] of [
    ["butler", "", "group", undefined],
    ["meeting", "detective", "group", "detective"],
    ["refund", "refund", "direct", "refund"],
  ]) {
    await visit(route);
    await page.getByLabel("指定鸭鸭").selectOption(target);
    await page.getByLabel("聊天消息", { exact: true }).fill("路由验收：示例案件不得调用真实模型");
    const requestPromise = page.waitForRequest(r => r.method() === "POST" && r.url().endsWith("/messages"));
    const responsePromise = page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith("/messages"));
    await page.getByRole("button", { name: "发送", exact: true }).click();
    const request = await requestPromise, response = await responsePromise;
    assert.equal(request.postDataJSON().mode, expectedMode);
    assert.equal(request.postDataJSON().target, expectedTarget);
    assert.equal(response.status(), 409);
    await page.getByRole("alert").waitFor();
  }
  result.interactions.push("管家入口自动群聊路由、群聊显式指定及独立鸭严格路由请求（示例拒绝模型调用）");
  assert.deepEqual(result.errors, []);
  fs.writeFileSync(
    path.join(out, "verification.json"),
    JSON.stringify(result, null, 2),
  );
  await browser.close();
  console.log(
    JSON.stringify({
      ok: true,
      pages: result.pages.length,
      interactions: result.interactions,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
