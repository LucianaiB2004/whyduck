# 后端与 AI 只读审查

审查时间：2026-10-08。本轮读取 src/server/app.ts、store.ts、report.ts、ai/index.ts 与相关测试，未修改实现。排除主代理已知并正在修复的图片原件、MCP 路径、法律来源加载、上传并发、重试关联、取消旧 run 和草稿删除项。

本代理此前实现平台适配，本轮对其他代理的业务核心及 AI 做新一轮审查；MCP/OAuth 适配部分不应被描述为完全独立作者审查。

## 发现

### [P2] 支付宝身份允许同时关联多个本站账户

位置：src/server/store.ts:6（users.alipay 无唯一约束）、src/server/app.ts:40（linkAlipay 直接 UPDATE；该行可能随集成移动）。

关联的是经 SDK 验签的身份，但数据库未保护一对一关系。同一个支付宝 user_id 可先后关联 Alice 和 Bob，双方状态都显示已关联。虽然当前不以支付宝身份签发本站登录会话，不构成立即跨账户数据访问，但身份关联的语义失真，后续身份登录或平台调用会出现歧义。

实际合成复现：创建两个测试账户，调用实际 app.locals.services.linkAlipay 为两者设置相同合成身份，数据库查询返回 DUPLICATE_ALIPAY_BINDINGS=2。未发外部授权请求。

建议：users.alipay 建立排除 NULL 的唯一索引，业务关联时处理已被另一个账户绑定的冲突，并在同一账户重复关联时保持幂等；不得自动迁移或覆盖其他账户关联。新增两账户同身份冲突测试。OAuth 层遇到绑定冲突宜返回明确信息，而不误标为平台验签失败。

### [P2] 导出报告丢失 AI 结论的逐字引用、当前状态与时间线

位置：src/server/report.ts:4。

报告的事实清单包含 c.facts 的来源，但“AI协作记录”仅复制 m.content，完全忽略 m.citations。合法结果可以仅在 message.citations 中携带证据引用，facts 为空；此时聊天中能追溯的结论在导出中失去引用。报告也未输出 c.status、消息时间、材料时间或案件阶段时间线，无法满足任务书要求的“当前状态、重要时间线、已进行的处理”。历史材料被删除时，AI 文本仍无来源失效提示。

实际合成复现：使用真实 renderReport，构造 waiting 案件和带 E001 / “三天内处理”引用的侦探消息，结果 reportHasMessageCitation=false、reportHasCaseStatus=false、reportHasMessageTimestamp=false。

建议：每条 AI 记录输出日期、真实证据编号与逐字引用；引用来源缺失时明确显示“来源已删除/不可核验”，不要静默丢掉。补充案件状态、带来源的事件顺序，以及已完成/未完成任务。Markdown 与 HTML 保持相同语义并继续默认脱敏。测试应覆盖只有消息引用、没有事实条目的结果，而不是仅测手机号替换。

## 验证与未发现项

修复进展：业务核心代理正在加入支付宝身份唯一约束及报告引用/状态/时间线回归。本代理已将 OAuth 回调的 ALIPAY_ALREADY_LINKED 业务冲突独立映射为 HTTP 409，提示不包含其他账户标识；其余交换/验签错误仍返回 502。上述发现的最终关闭仍需主代理完成全套验证。

npx vitest run tests/core.test.ts tests/ai.test.ts tests/integrations.test.ts：3 文件、30 测试通过。新增问题由独立合成探针复现，未修改现有测试或实现。

观察到案件读取与写入按 owner 校验，材料下载再次校验归属；Cookie 写请求检查客户端头与来源，Bearer 请求仍经数据库校验；MCP 每次请求校验令牌并核对案件；AI 工具按角色白名单校验，拒绝未知参数与未知证据，引文需匹配可核验原文。接力共享实际完成结果及案件状态，不允许模型通过参数改写账户身份。没有发现可直接跨账户读取的路径。

模型实网、支付宝沙箱/真机及公网部署未执行。本审查不把本地 fixture 或 SDK stub 当成平台验收。

最终复核：两个 P2 已修复并加入回归验证，37 项全套测试通过。支付宝唯一关联与 409 回调提示、报告消息引用、状态与时间线已补齐。证据见 `tests/backend-regression.test.ts` 和最终验证报告。
