# WhyDuck Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for the integrated backend; bounded independent UI, AI and platform work may use subagents. 用户已明确要求连续执行，不再追加设计或计划批准步骤。

**Goal:** 将已确认 UI 转换为可运行、持久化、鉴权的售后多智能体应用，并交付平台适配与可核验材料。

**Execution status (2026-10-08):** 五项工程任务已完成。原始计划条目保留为计划记录；最终实际结果以 `docs/final-verification.md` 为准：37 项测试、类型检查、构建、57 项正式页面检查和 11 项真实业务交互通过，源码包已提供。真实模型与平台联调仍缺凭证，未声称完成。

**Architecture:** 单体模块化后端和 React 前端共享案件契约。SQLite 事务与私有本地文件支持低成本单实例部署，Web、小程序与鉴权 MCP 调用同一业务服务。模型只有服务端 Provider 能访问。

**Tech Stack:** Node 24、TypeScript、Express、SQLite、React、Vite、Zod、Sharp、MCP SDK；版本以安装结果锁定。

**Spec:** `docs/superpowers/specs/2026-10-08-whyduck-design.md`；`docs/api-contract.md`。

## Global Constraints

- 项目名称：凭啥鸭 · 售后鸭鸭局；口号：你只管说事，鸭鸭组团办事！
- 据理力争鸭红头，所有角色有中文名牌，复用已有原创图片。
- 材料私有、身份验证、所有权验证；不把用户上传内容作为权限指令。
- 真实模式与示例模式明确区分；没有 API Key 不伪造模型结果。
- 不代发消息、不执行退款、不代提交投诉；导出前核对和脱敏。
- 不宣称未经验证的支付宝准入、真机、小程序发布或比赛提交完成。

## Review Focus

- 两个账户交换案件或证据 ID 必须得到拒绝，不能读取原图。
- 图片扩展名与内容不符、超大像素和超大文件必须拒绝。
- 模型 JSON 带未知证据、非法字段或越权工具调用不能写入确认事实。
- 任务取消、事实并发修改及重试不能丢失案件或重复执行已完成步骤。
- cookie 写请求防 CSRF；Bearer 工具按账户、案件范围校验。

## Task 1: 安全持久化业务核心

Files: `src/server/{config,db,auth,store,app,index,report,demo}.ts`，`tests/core.test.ts`。

Interfaces: `createApp(config)`、`BusinessServices`、`CaseRecord`、统一错误与 REST 契约。

- [ ] 先写 HTTP 测试，证明创建账户、创建案件、重启恢复、账户隔离、证据鉴权、事实版本、任务确认、导出脱敏等目标失败。
- [ ] 实现事务式 SQLite 存储、scrypt 密码、opaque 会话与 token、写请求校验、限流、上传内容验证和私有读取。
- [ ] 实现案件、事实、证据、任务、草稿、报告和标识清楚的演示案件。
- [ ] 执行 `npm test -- tests/core.test.ts`，检查所有权和敏感信息泄露边界。

## Task 2: 真正的 AI Provider 与六鸭编排

Files: `src/server/ai/`、`tests/ai.test.ts`、`docs/ai.md`。

Interfaces: `runWorkflow(caseData,request,deps)`，`WorkflowDeps.persist/emit`、`AgentOutput`；七项业务工具与角色权限。

- [ ] 先写结构化校验、未知证据拒绝、按需路由、@ 指定路由、依赖接力、超时与取消测试。
- [ ] 实现千问兼容 Provider，真实 HTTP、文本与视觉、工具调用、有限重试、用量与安全错误。
- [ ] 每鸭独立提示词、schema、工具权限和输入；Router 选择专家，后者读取前序结果，结果经校验后交由服务持久化。
- [ ] 用本地协议测试服务器验证真实编排代码；真实模型无密钥时明确未执行，不将契约测试当作百炼成功。

## Task 3: 正式 React UI

Files: `src/client/`、`scripts/verify-ui.cjs`。

Interfaces: `docs/api-contract.md`，共享类型；复用 `public/assets/whyduck/`。

- [ ] 将 19 个设计页面实现为组件、路由与 API 操作，清除设计预览的假保存状态。
- [ ] 真实账户、案件恢复、文件上传、原图、人工纠正、@ 路由、成员、SSE 状态、取消与重试。
- [ ] 真实待办、期限提示、草稿编辑/保存/复制、报告核对脱敏与下载、数据删除与授权。
- [ ] 浏览器验证 1440/768/390px，跑完整演示及手动案件流程，保留截图。

## Task 4: MCP、支付宝与小程序

Files: `src/server/integrations/`、`src/server/mcp/`、`miniapp/`、`tests/integrations.test.ts`、`docs/integrations/`。

Interfaces: `BusinessServices`，MCP Express router 工厂，支付宝鉴权路由工厂。

- [ ] 核查比赛、支付宝、小程序、授权、AI 平台和 MCP 官方文档，记录来源与访问限制。
- [ ] 实现经 Bearer 认证的真实 MCP 七项工具，并用 SDK 客户端执行测试。
- [ ] 实现支付宝服务端 code exchange 与签名验证、账户关联/解除、安全状态；无凭证时禁用。
- [ ] 实现小程序工程：复用业务 API、凭证上传、案件、聊天、任务、分享；没有 APPID 时记录真机未执行。

## Task 5: 集成、检查与交付

Files: `.env.example`、`README.md`、`Dockerfile`、`docs/`、`submission/`、`artifacts/`。

- [ ] 服务端挂载模型编排、MCP 与平台适配，纠正跨模块契约问题。
- [ ] `npm test`、`npm run typecheck`、`npm run build`、依赖安全检查与最终代码审查。
- [ ] 实际浏览器跑完整业务链，截图并确认数据持久化、跨账户隔离与移动端可操作。
- [ ] 交付部署指南、环境变量、测试报告、平台真实状态、作品介绍、三分钟演示脚本和源码包。
- [ ] 只列真实需要用户办理的密钥、平台权限、部署/提交事项，不追加普通开发审批。
