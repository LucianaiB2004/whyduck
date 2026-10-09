# 支付宝与 MCP 集成

核查日期：2026-10-08（Asia/Shanghai）。此文区分真实本地协议验证与平台授权。

## 当前实现

Web、小程序和 MCP 共用账户、案件、材料与 BusinessServices。MCP 路径 /mcp，采用官方 SDK Streamable HTTP，无服务端会话，每个请求验证账户签发的 Bearer token。七个工具为 analyze_consumer_issue、extract_purchase_evidence、compare_merchant_statements、generate_after_sales_plan、manage_follow_up、prepare_dispute_escalation、route_to_ducks。参数 caseId 必填，message/evidenceIds 可选；案件所有权由服务端再次验证。工具不会自动发送沟通或投诉。

支付宝身份关联使用 alipay-sdk 的 alipay.system.oauth.token，服务端签名请求并 validateSign:true 验证响应。关联开始绑定当前已登录凭啥鸭用户，以随机 state、HttpOnly cookie、五分钟有效期和单次使用约束回调。只申请 auth_base。解除关联仅删除本站关联，不撤回外部授权。没有实现账单读取、支付或退款调用。

## 配置

ALIPAY_ENABLED=true；ALIPAY_APP_ID、ALIPAY_PRIVATE_KEY、ALIPAY_PUBLIC_KEY、PUBLIC_ORIGIN=https://正式服务域名。应用私钥和支付宝公钥从该应用官方控制台获取，禁止提交。PUBLIC_ORIGIN 必须与配置的回调来源一致。未配置 /api/alipay/status 明确返回 unconfigured。进程重启会使未完成授权 state 失效，用户重新开始即可。生产多副本部署前需将 state 存储迁移到统一有 TTL 的存储。

接口：GET /api/alipay/status；POST /api/alipay/authorize 返回官方授权 url；GET /api/alipay/callback?state=...&auth_code=...；DELETE /api/alipay/link。主服务统一进行登录与写请求来源校验，设置 res.locals.user 和实际数据库关联状态 res.locals.alipayLinked。OAuth 只有经过签名校验的返回 user_id 可关联，禁止信任前端传入身份。

## 小程序

导入 miniapp/ 作为支付宝小程序工程根目录。app.json 声明六页面和四入口 TabBar。设置页输入已配置 HTTPS 白名单的服务地址和 Web 设置页签发的账户令牌，调用 /api/session 验证。令牌在设备本地存储，退出清除，可从 Web 撤销。页面包含首页、六鸭定向/群聊、共享案件列表、材料上传、文本核对、跟进办事单、设置与产品入口分享。聊天等待完整 SSE 响应后刷新，并未宣称真机流式能力。图片字段核对当前通过 Web 完整原件预览完成，小程序不能仅凭文件名确认图片。

官方 [my.request](https://opendocs.alipay.com/mini/api/owycmh) 的请求头字段 headers，返回状态字段 status；[my.uploadFile](https://opendocs.alipay.com/mini/api/kmq4hc) 使用 name、filePath、header，返回 statusCode。2026-10-08 在官方浏览器实际读取，两者需要 HTTPS 与服务器域名白名单。my.uploadFile 的 HTTP 错误仍可能进入 success，工程检查 statusCode 后才能显示成功。官方文档建议不要依赖 Android cookie，因此选择账户 Bearer token。

## 官方平台核查

[小程序应用文档指引](https://opendocs.alipay.com/mini/01bu16)：官方公开文字明确企业或个人可以创建开发小程序；但这不等于所有类目、交易能力、AI 邀测或本次比赛都向个人开放。类目与资质需逐项核查 [准入规范](https://rulecenter.alipay.com/gateway/details?docId=134000937)、[类目资质](https://rulecenter.alipay.com/gateway/details?docId=134000944)。未登陆申请，不能断言已具资格。

[AI 开放平台](https://open.alipay.com/ai/ai-resource-center/welcome) 公开导航提供 AI开发、小程序、市场、AI应用、代开发。[AI开发工作台](https://open.alipay.com/ai/ai-resource-center/workbench) 在当前未登录访问明确显示“登录后可查看”并要求阅读同意服务协议。本次没有接受协议或申请权限，miniApp/webApp/aipay 各通道具体邀测资格、沙箱和发布规范尚未核实。工程可服务化不代表已被支付宝 AI 平台调用。

## 验证与联调边界

npx vitest run tests/integrations.test.ts 真实官方 MCP Client 已跑通 initialize、listTools、callTool；验证无令牌/伪造令牌拒绝与跨案件拒绝。业务服务使用明确测试 fixture，不是千问实网或支付宝沙箱证明。支付宝未配置状态、伪造 OAuth state 被拒绝；本地 SDK stub 进一步验证交换时启用验签、验签失败不关联、state 单次使用。新增小程序 VM 合约测试覆盖账户鉴权、上传状态、@ 路由、SSE 错误及分享保护；这不是平台真机结果。小程序 node miniapp/validate.mjs 验证页面、配置与 JS 语法，不等于支付宝 IDE 编译、真机或审核。

需要真实环境后完成：模型密钥实网；支付宝应用创建及能力准入；HTTPS 部署与白名单；官方工具编译；真机上传/聊天/分享；授权正常、拒绝、过期、重复回调、错误验签；评审提交规则确认。
