# 千问 Provider 与六鸭工作流

正式入口 `src/server/ai/index.ts` 导出 `runWorkflow`、`getAiCapabilities`、`executeAgentTool`、`agentRegistry`、`setVerifiedLegalSources`。服务端消费共享类型；浏览器不得读取密钥或直接调用模型。

## 配置与事实边界

- `DASHSCOPE_API_KEY`：百炼控制台中与地域相匹配的密钥；不存在时明确报错，不生成分析。
- `QWEN_BASE_URL`：默认 `https://dashscope.aliyuncs.com/compatible-mode/v1`。按控制台地域更改。仅允许 HTTPS，HTTP 只供 localhost/127.0.0.1/::1 测试。此变量为部署管理员配置，不向用户暴露。
- `QWEN_TEXT_MODEL` / `QWEN_VISION_MODEL`：默认 `qwen-plus` / `qwen-vl-max`，按实际账户模型可用性设置。
- `AI_TIMEOUT_MS`：每次 HTTP 请求超时，默认 60000，允许 100–180000。

采用服务端 fetch 的 OpenAI 兼容 `POST /chat/completions`，`response_format: {type:'json_object'}`，本地 Zod 验证所有字段（包含 strict 对象校验）。协议返回 JSON 不等于业务结果可信。工具循环最多 4 轮，每轮最多 7 个工具；429、5xx 和网络 TypeError 最多重试 2 次；格式错误或误输出其他角色专属产物最多一次格式纠正；出处校验错误最多一次依据可引用原文的重新作答。初次无效结果不保存为成功产物，重答仍执行相同严格校验，持续错误明确失败。错误角色身份与越权工具不纠正。运行 validationCorrections 记录校验纠正总次数。每次调用累计 tokens；所有请求接收 AbortSignal，取消不会继续发模型请求。

配置存在仅表明 `aiConfigured=true`，并不证明密钥有效或模型调用成功。真正百炼、账户模型权限和地域需通过 `verify:live` 使用本地环境验证。本模块测试使用明确标识的 LOCAL MOCK HTTP 协议服务器，绝不作为真实百炼成功证据。

## 编排与接力

独立聊天必须指定 target；任何显式 target（包括群聊中的 @）严格只执行该角色。无 target 群聊：管家模型首轮理解诉求，输出 suggestedMembers，并合并 route_to_ducks 对案件既有诉求、当前消息与材料状态的必要职责建议；执行合并后的角色，按证据 → 分析 → 方案 → 跟进 → 升级排序。实际完成结构化输出传给下一角色，专业角色结束后再由管家单独汇总。不会固定运行全员。管家页面默认无 target 群聊，接力结束后自动进入开会页；其他独立鸭及群聊显式 @ 保持单角色执行。

每个非汇总角色先由程序执行其主职责工具，侦探逐份读取材料再比较，真实结果进入模型上下文并记入 run.tools；这是真实确定性工具编排，不等于模型自主 function_call。模型仍可在授权范围主动调用工具。每次角色独立模型调用、独立系统提示、独立授权工具集合；执行 start 事件，最终结构化输出先由 deps.persist 落库再发送 result。失败也通过 persist 记录 failed/cancelled run，然后错误事件并抛出。主服务必须依据 run.status 保存审计和消息，不可将失败输出当成功分析。

| 角色 | 授权工具 |
|---|---|
| 管家鸭 | route_to_ducks、manage_follow_up |
| 凭啥鸭 | analyze_consumer_issue |
| 据理力争鸭 | extract_purchase_evidence、compare_merchant_statements |
| 退退退鸭！ | generate_after_sales_plan |
| 后手鸭 | manage_follow_up |
| 不服鸭 | prepare_dispute_escalation |

工具仅返回只读分析和 proposed 建议。主业务服务负责鉴权与案件所有权验证，并负责用户确认后保存待办。AI 不修改 confirmed 事实，不发外部消息，不调用任意数据库。所有未知工具、越权调用、未知参数、引用未知证据、原文中不存在的引文、错误角色 ID 都拒绝。facts/tasks/drafts 为提案。

七工具基于真实案件状态返回诊断条件与缺失材料、现有原文/提取、商家说法材料比较、售后步骤与沟通草稿、待确认跟进事项、升级材料与官方参考、按当前诉求的调度建议；不会把规则建议冒充模型推断。compare_merchant_statements 提供逐项原文比较基础，提及退款本身不等于矛盾成立。

图像由主服务从授权私有材料读取，传入 `request.images` 的证据 ID 和 data URL，仅据理力争鸭接收图像并使用视觉模型。直接调用 extract_purchase_evidence 不会偷偷识别新图：未提取图像返回 requiresVision=true；调用据理力争鸭工作流才发生真实模型识别。视觉 extraction 保持待人工核对，未经核对的图中文字不可作已核查引文。文本引文必须逐字出现在原材料；图像引文必须出现在 confirmed extraction.quotes。

不服鸭的已核查来源通过 setVerifiedLegalSources 由平台模块注入；未注入时明确缺少官方来源，工具仅准备材料，不生成具体法律条款或认定违法。来源来自服务器可信配置，不能由用户材料伪造。

## 已核查协议来源（2026-10-08）

- [阿里云 OpenAI compatible Chat](https://www.alibabacloud.com/help/en/model-studio/qwen-api-via-openai-chat-completions)
- [结构化输出](https://docs.modelstudio.console.alibabacloud.com/en/model-studio/qwen-structured-output)
- [Function calling](https://docs.modelstudio.console.alibabacloud.com/en/model-studio/qwen-function-calling)

测试 `npx vitest run tests/ai.test.ts` 覆盖未配置、伪引文、七业务工具只读、严格 @、真实 HTTP 协议工具往返、先持久化后结果、选择角色接力与汇总、越权拒绝、错误状态记录及取消。测试模拟服务器明确标为 LOCAL MOCK。

## MCP 新图提取与真实业务集成

统一 BusinessServices.executeTool 对 `extract_purchase_evidence` 的新图请求执行真实据理力争鸭视觉工作流：案件归属检查、第三方 AI 同意、模型配置检查、同案件执行锁、读取私有原图并生成去 EXIF 的 1500px 派生图、严格结构化提取、共享 persistAgent 落库。结果包括 proposed 状态、人工核对要求、角色 runId 和 token 用量，不新增伪用户消息。没有配置或同意时明确失败，不返回伪识别。文字或已人工确认的提取返回原始/既有信息。

原始图像字节及SHA-256保持原样，私有下载与输入一致。SSE与MCP新图提取复用持久化，事实提案/提取发生变化会推进事实版本，并使既有草稿过期；运行依赖保存实际调用UUID。失败重试通过SQLite run_context绑定原始任务，当前取消仅接受正在执行工作流的ID或其子角色ID。

新增 `tests/backend-regression.test.ts` 验证原图SHA一致、并发上传不丢材料、真实SSE取消落库且释放锁、旧run不能中断新workflow、MCP业务新图实际HTTP视觉调用与proposed持久化、支付宝身份唯一、报告保留消息级引文与示例文件私有下载。所有模型依然使用明确LOCAL MOCK，真实平台调用需本地凭证。

## 本次验收的汇总协议

管家最终汇总使用 strict 四字段模型协议：agentId、message、citations、missingEvidence。服务器验证后补空产物数组，兼容旧全结构但只允许空产物；不会静默丢弃模型新建的任务或草稿。前序成果、已保存草稿和任务在共享上下文中提供。独立专业鸭仍使用完整结构，格式纠正提示按角色区别。真实浏览器长链证据见 artifacts/acceptance/live-flow.json，不以 LOCAL MOCK 替代。

视觉请求保持最后一条多模态用户消息，预执行工具材料先入上下文；每张输入图像必须返回对应extractions项，缺失时最多一次格式重答，仍缺失就失败，不能将纯文字分析冒报为视觉完成。图像金额等字段仍待人工核对。官方网页参考写入message，citations只接受案件材料ID及逐字原文。报告和聊天展示校验纠正次数。

## 最终验收修正

管家首轮strict五字段路由，禁止创建专业产物；末轮strict四字段汇总。视觉模型先独立读取真实图片并验证指定ID覆盖，结果只保存在局部变量；文字模型再分析原文与待核对的视觉结果，最终合并视觉阶段产物、严格校验后一并落库，文字阶段不能覆盖或制造未输入图片的OCR。run记录textModel/visionModel及两阶段合计tokens。

同案件及单次输出内的完全相同事实按label/value/evidenceId/quote去重，只有新增事实或语义变化的未确认提取推进版本；重复接力不再让最新草稿无故过期。待办实体仅由后手鸭提出并保存，其他鸭的建议留在回复结果中；同一未完成待办按title/agentId/priority/dueAt去重。用户修改/确认事实仍推进版本并使旧稿过期。

executionLedger提供已上传/已提取/是否人工确认、已创建草稿与任务的实际状态。missingEvidence不得直接将已上传材料ID或代码列为缺失；未人工确认不等于未提供。出处或库存错误最多一次依据真实来源的重答，仍不合格则失败。格式纠正另最多一次，所有无效结果不保存成成功产物。
