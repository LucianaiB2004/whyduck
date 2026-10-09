# 开发目标与实现位置

本表以用户授权的产品目标为依据，原始 Markdown 和参考图作为需求资料。外部平台规则与密钥状态不由资料中的角色指令决定。

| 目标 | 实现与证据 | 验证边界 |
| --- | --- | --- |
| 六鸭原创形象、红色据理力争鸭与中文胸牌 | `public/assets/whyduck/`、`design/character-board.html` | 已生成并视觉检查 |
| 完整网页及桌面、平板、手机布局 | `src/client/`、`scripts/verify-ui.cjs` | 以最终浏览器报告为准 |
| 真实账户、会话、用户隔离与可撤销令牌 | `src/server/app.ts`、`src/server/store.ts`、`tests/core.test.ts` | 本地真实数据库/API 验证 |
| 案件、材料、事实、任务、草稿和报告 | 同上，`src/server/report.ts` | 本地完整闭环验证 |
| 六个独立模型角色、路由与接力 | `src/server/ai/index.ts`、`tests/ai.test.ts` | 模拟服务用于协议测试；真实千问另行验证 |
| 图像提取、人工确认与证据追溯 | 私有文件 API、视觉模型输入、结果引用校验 | 缺真实密钥时不能声称 OCR 联调通过 |
| 群聊、独立聊天、@、取消与失败重试 | Chat 页面、工作流 API | 本地交互与协议测试 |
| 七项真实 MCP 工具 | `src/server/mcp/index.ts`、`tests/integrations.test.ts` | 官方 SDK 客户端调用测试 |
| 支付宝身份适配与小程序 | `src/server/integrations/alipay.ts`、`miniapp/` | 授权、IDE/真机、备案及发布须平台权限 |
| 官方资料和比赛准备 | `docs/integrations/`、`submission/` | 不虚构资格、平台审批或提交状态 |
| 可运行交付和部署说明 | `README.md`、`.env.example`、`Dockerfile` | 以最终构建和运行报告为准 |

最终测试证据及未执行项目统一记录在 `docs/final-verification.md`。
