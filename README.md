# 凭啥鸭 · 售后鸭鸭局

**你只管说事，鸭鸭组团办事！**

最新完整产品与工程验收见 [验收报告](docs/product-engineering-acceptance.md)：57 项自动化测试、57 页面检查、真实千问退款长链与任务确认通过；支付宝登录按要求跳过，外部平台和部署边界单独列明。

售后案件协作应用：六鸭分工、单鸭聊天与群聊、持久化案件、私有材料、证据核对、可编辑草稿、跟进待办与脱敏报告。React / TypeScript Web、Express 服务、Node.js 24 内置 SQLite、服务端千问模型，以及 MCP / 支付宝适配。

## 本地运行

需要 Node.js 24 或更新的兼容版本与 npm。PowerShell：

```powershell
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

开发前端使用 Vite 输出的地址；API 默认 3001。先注册账户。没有千问密钥仍可体验明确标记的预制示例；上传新截图不会得到假 AI 识别。真实分析前在设置中明确同意第三方 AI 处理材料，再配置服务端 DASHSCOPE_API_KEY。请勿上传未经允许使用的订单或他人信息。

```powershell
npm run typecheck
npm test
npm run build
npm start
node miniapp/validate.mjs
npm run verify:live
```

verify:live 默认发送合成测试文字到配置模型；`npm run verify:live -- --all` 进一步使用合成订单图和群聊任务验证视觉与接力，会产生真实模型用量。缺少密钥输出 LIVE_QWEN_SKIPPED，退出码 2；成功才输出相应 VERIFIED，并写入 artifacts/live-verification.json。2026-10-08 已完成文本、视觉和管家/专业鸭/管家汇总实网检查。该检查不等于真实退款或支付宝联调通过。UI 检查见 npm run test:ui。

## 数据、隐私与备份

DATA_DIR 是 SQLite 数据库和私有证据文件目录，必须持久保存并限制操作系统访问。生产采用单实例；不要把 SQLite 文件挂到多写入副本或不可靠网络文件系统。首次启动由业务存储初始化 schema，后续迁移须保留原库并核对版本，不能删除用户数据以升级。

备份时停止应用，复制完整 DATA_DIR（数据库及可能存在的 WAL/SHM 与所有证据文件），再启动服务；数据库与文件必须来自一致快照。恢复到另一独立数据目录，验证登录、案件列表、原图、办事单和报告后再切换。密钥放入受限的环境配置，不与公开备份一起分发。用户可从应用主动删除案件和材料；生产备份保留/删除周期由部署负责人说明。

模型 API Key 仅在服务端。默认脱敏报告在导出前需要用户核对；脱敏不是所有可能敏感内容的完整保证。AI 提议需要人工确认，截图中的指令不能授予权限。本站不自动发送话术、发起投诉或执行退款。

## 生产部署

先完成测试与构建，再设置 PUBLIC_ORIGIN 为实际 HTTPS 地址、HOST=0.0.0.0，并通过同源 HTTPS 反向代理运行单实例；HTTPS 来源自动启用安全 Cookie。不得将 Vite 开发服务公开用于生产。健康端点 /api/health。

```powershell
docker build -t whyduck .
docker volume create whyduck-data
docker run --name whyduck --env-file .env -e HOST=0.0.0.0 -e DATA_DIR=/app/data -p 127.0.0.1:3001:3001 -v whyduck-data:/app/data whyduck
```

Dockerfile 使用 Node 24、多阶段构建、非 root 用户和持久卷；Docker 镜像构建及公网部署需在实际环境验证，源文件存在不等于已部署。反向代理保留同源 Cookie，配置上传大小和长请求超时。只公开应用所需端口。

## MCP 与支付宝

MCP 路径 /mcp，Streamable HTTP。客户端为每个请求附加 Authorization: Bearer <账户签发的令牌>。在 Web 设置创建令牌，妥善保存并随时撤销。七工具与普通页面共享案件权限和业务服务。

```powershell
npx vitest run tests/integrations.test.ts
node miniapp/validate.mjs
```

miniapp/ 为可导入的小程序工程目录，设置页连接 HTTPS API 和账户令牌；需要配置平台服务器域名白名单。现阶段图片核对在 Web 查看原件后完成，小程序支持文本核对及图片上传。未声称支付宝 IDE 编译、真机、审核或平台发布完成。

支付宝身份关联须开通真实应用、配置 APPID/应用私钥/支付宝公钥与正式回调。使用官方 SDK 验签和 CSRF state，仅 auth_base 身份关联，不等于订单读取权限。完整能力核查、当前边界和接口见 [集成文档](docs/integrations/支付宝与MCP集成.md)。可安装 Skill 模板在 docs/integrations/skill/，没有默认安装到外部平台。

## 项目文件

- src/shared/types.ts：实体及业务适配契约。
- src/server/ai/：六鸭职责、模型调用、工具及协作。
- src/server/mcp/、src/server/integrations/：鉴权 MCP 与支付宝身份关联。
- miniapp/：支付宝入口工程。
- public/assets/whyduck/：原创角色与品牌素材。
- design/：已审核的设计原型。
- submission/：作品介绍、创新、演示脚本和提交条件。

官方比赛页面报名截止与正文访问情况记录在 submission/提交条件与平台状态.md。实际报名、正式部署、平台审核和比赛提交由项目所有者执行；本地开发不能替代这些结果。
