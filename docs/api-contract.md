# 正式工程协作接口

除 SSE、材料下载和报告外，响应为 JSON；成功返回以下对象，错误统一 `{error:{code,message}}`。私有接口必须登录或持有账户签发的 Bearer token，按当前身份校验案件所有权。Web 写请求携带 `X-WhyDuck-Client: web`；同源 Cookie 为 HttpOnly / SameSite=Lax，HTTPS 来源启用 Secure；密码至少 12 位。前端不能直接调用模型。

## 会话与能力

- `GET /api/session` → `{user: User|null, capabilities: Capabilities}`。
- `POST /api/auth/register {email,password,name}` → `{user}`，创建会话 cookie。
- `POST /api/auth/login {email,password}` → `{user}`。
- `POST /api/auth/logout` → `{ok:true}`。
- `PATCH /api/profile {name?,aiConsent?}` → `{user}`。
- `POST /api/auth/tokens {label}` → `{token,id}`，明文只显示一次。
- `GET /api/auth/tokens` → `{tokens:[{id,label,createdAt}]}`。
- `DELETE /api/auth/tokens/:id` → `{ok:true}`。
- `GET /api/alipay/status` → `{configured,linked,status,note}`；平台适配模块提供关联开始/完成/解除，未配置时不能显示成功。
- `GET /api/health` → `{ok:true,storage:'sqlite',version}`，不得泄露密钥。

## 案件

- `GET /api/cases` → `{cases:CaseRecord[]}`。
- `POST /api/cases {title,description?}` → `{case}`。description 写入用户诉求，用户消息由消息接口保存。
- `POST /api/cases/demo {scenario:'refund'|'contradiction'|'evidence-missing'|'continue'}` → `{case}`，清楚标记 demo=true，不调用真实模型。
- `GET /api/cases/:id` → `{case}`。
- `PATCH /api/cases/:id {title?,merchant?,product?,amount?,purchaseDate?,request?,category?,status?,members?}` → `{case}`。
- `DELETE /api/cases/:id {confirmation:caseId}` → `{ok:true}`。

## 对话与实际协作

- `POST /api/cases/:id/messages {message,target?,mode:'group'|'direct',requestId?}` → SSE，事件为 `{type:'start'|'result'|'route'|'error'|'done'|'cancelled',...}`，每事件使用 `data: JSON\n\n`。已有结果先持久化再发送。关闭请求或调用取消端点终止当前任务。
- `POST /api/cases/:id/runs/:runId/cancel` → `{ok:true}`。
- `POST /api/cases/:id/retry {runId}` → SSE，针对失败任务重试；不会重复添加用户消息。

`type=start` 显示具体鸭执行；`result.output` 为 AgentOutput；`done` 后重新 GET 案件。未配置模型返回真实错误且保留用户描述，不生成虚假分析。demo 案件只提供预制示例，不把新材料变成伪识别结果。

## 材料与事实

- `POST /api/cases/:id/evidence` multipart（单 `file` 字段，或 `sourceText` 与 `filename`）→ `{evidence,case}`。仅收 PNG/JPG/WebP，10MB，上限与内容校验服务端执行。
- `GET /api/cases/:id/evidence/:evidenceId/file` → 私有文件；文本材料返回纯文本。
- `PATCH /api/cases/:id/evidence/:evidenceId {extraction,confirmed}` → `{case}`，人工核对提取结果；事实仍须单独添加和确认，不把材料核对直接视为事实确认。
- `DELETE /api/cases/:id/evidence/:evidenceId {confirmation:evidenceId}` → `{case}`。
- `POST /api/cases/:id/facts {label,value,evidenceId?,quote?}` → `{case}`，用户主动记录事实为 proposed，需确认。
- `PATCH /api/cases/:id/facts/:factId {label?,value?,status:'proposed'|'confirmed'}` → `{case}`。事实修改提升 factRevision，衍生草稿标记 stale。
- `DELETE /api/cases/:id/facts/:factId` → `{case}`。

## 跟进、草稿与报告

- `POST /api/cases/:id/tasks {title,agentId,priority,dueAt?,status:'proposed'|'pending'}` → `{case}`。
- `PATCH /api/cases/:id/tasks/:taskId {title?,dueAt?,priority?,status?}` → `{case}`。用户确认 AI 建议时从 proposed 变 pending。
- `DELETE /api/cases/:id/tasks/:taskId` → `{case}`。
- `POST /api/cases/:id/drafts {tone,text}` → `{case}`。
- `PATCH /api/cases/:id/drafts/:draftId {text,tone?,acknowledgeRevision?:boolean}` → `{case}`。
- `DELETE /api/cases/:id/drafts/:draftId` → `{case}`。
- `GET /api/cases/:id/report?format=markdown|html&redact=true|false` → 可靠文件，默认脱敏；引用证据为编号与文件名，保留待核实标签。

实体类型唯一真源 `src/shared/types.ts`。`BusinessServices` 是 MCP/支付宝适配所消费的业务接口。服务端模块导出 `createApp(config?)` 返回 Express app；测试通过临时存储和 HTTP 调用验证，不依赖真实密钥。
