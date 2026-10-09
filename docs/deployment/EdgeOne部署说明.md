# EdgeOne 部署说明

静态页面与后端分别部署：`dist/client` 是唯一公开静态目录，`cloud-functions/api/[[default]].js` 导出 Express 实例处理 `/api/*`。没有 `listen()`，不使用云函数临时 SQLite 保存案件。

构建命令：`npm run build:edgeone`，对应 `tsc --noEmit && vite build --mode edgeone && node scripts/build-edgeone.mjs`。构建脚本生成两个私有目录中的服务 bundle；法律来源 JSON 由源代码静态导入并打入服务 bundle。Cloud Functions 和 Agents 均使用显式 `onRequest(context)` Web 入口，再通过共享适配器调用 Express。原生 `sharp` 在平台安装阶段由 externalNodeModules 单独处理。

## 运行环境变量

- `TURSO_DATABASE_URL`：真实远程 libSQL 数据库的 `libsql://` 或 `https://` URL。
- `TURSO_AUTH_TOKEN`：数据库访问凭据。
- `EVIDENCE_STORAGE=edgeone-blob`：使用平台 Blob，证据不保存在临时文件系统。
- `EVIDENCE_ENCRYPTION_KEY`：32 字节随机数据的标准 Base64，证据采用 AES-256-GCM 加密。须安全备份；更换密钥会使旧证据无法解密。
- `PUBLIC_ORIGIN`：实际公开 HTTPS 域名的 origin，用于来源校验及安全 Cookie。
- 按 `.env.example` 配置真实千问参数；模型凭据仅进入平台服务端环境变量。

缺少或不合法的持久化配置会返回 JSON 503 `CLOUD_UNCONFIGURED`，不会静默回退临时数据库。配置存在但初始化失败时返回 `CLOUD_INITIALIZATION_FAILED`，不向访客泄露连接串或凭据。

## 长任务

`agents/whyduck/index.js` 使用官方 `onRequest(context)` 接口，允许多智能体分析在 900 秒任务期限内完成。前端将消息、重试、取消请求映射到 `/whyduck?path=<编码后的原始API路径>`，例如 `/whyduck?path=%2Fapi%2Fcases%2F案件UUID%2Fmessages`。仍传递 Cookie、`X-WhyDuck-Client:web` 及真实 origin；额外传递 `Makers-Conversation-Id:案件UUID`。UUID 必须与 path 的案件相同。真正的身份及案件所有权继续由服务端验证，会话头不作为授权凭据。

云函数适用于查询及普通短请求（120 秒）。长任务状态必须由远程数据库 lease 协调；平台会话粘性不替代持久化、权限或并发控制。

## 发布验收

必须实际验证注册、Cookie、刷新恢复、证据上传/下载、真实千问多智能体任务、共享案件记录、取消、重试。只验证静态页面或本地兼容测试不算真实云端通过。缺少数据库或平台配置时明确保留未验证状态。

`.edgeone.cool` 默认预览链接存在访问时限；永久公开访问仍需平台允许的正式域名配置。401 平台访问限制与后端 503 是两个不同问题。

官方依据：[Node 函数](https://cloud.tencent.com/document/product/1552/127419)、[Agents 快速开始](https://pages.edgeone.ai/document/agents-quick-start)、[edgeone.json](https://pages.edgeone.ai/zh/document/edgeone-json)。

## 2026-10-09 本次验证

- 本地 API 使用真实千问完成管家路由、证据提取/对比、退款草稿、跟进待办、最终汇总；5 个独立角色运行，8 条真实材料引用，原图 SHA-256、重新登录恢复及报告验证通过。证据：本地忽略目录 `artifacts/acceptance/cloud-migration-local-live.json`。
- 千问文本、视觉及组聊独立检查通过；页面自动检查 57 项（19 页面×3种宽度）及 13 项交互通过。
- 云端适配及 SQL/Blob 单元测试不等于真实远程数据库或 Blob 联调；尚无 Turso URL/Token 与自定义域名，永久公网发布未完成。
- SQL 租约串行化案件写入；无租约保存不能覆盖被锁案件。AI 结果、原始任务上下文和审计在同一事务提交。MCP 图片提取使用相同租约。取消通过当前运行身份或数据库运行 Token 校验。

## 尚未开通外部资源时

1. 到 https://app.turso.tech/ 完成个人账户登录/注册，选择 Free 计划并创建 `whyduck` 数据库。取数据库 URL 与专用于该数据库的访问 Token，配置到 EdgeOne 项目服务端环境变量中。不要提交到 GitHub。官方入门：https://docs.turso.tech/quickstart 。
2. 准备一个可以设置 DNS 的正式域名，再在 EdgeOne 域名管理中绑定。是否备案取决于实际加速区域，依控制台要求办理。项目默认 `.edgeone.cool` 域名只能限时预览。
3. 按上述清单配置加密证据存储、备份加密密钥及千问服务端密钥，然后触发部署并执行真实云端流程验收。

账户服务条款接受、域名购买和付款由账户所有者完成；当前未创建收费资源。
