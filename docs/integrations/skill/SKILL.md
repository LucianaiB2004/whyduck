---
name: whyduck-after-sales
description: 使用已授权的凭啥鸭 MCP 工具分析指定账户的消费售后案件、材料差异、沟通计划和跟进建议。
---

# 凭啥鸭售后协作

需要已连接的凭啥鸭受保护 MCP 服务和当前用户明确指定的 caseId。缺少案件标识时先获取正确标识；不得猜测或枚举其他账户案件。令牌通过客户端私密配置传递，不输出或存入文档。

根据诉求选择 route_to_ducks、analyze_consumer_issue、extract_purchase_evidence、compare_merchant_statements、generate_after_sales_plan、manage_follow_up 或 prepare_dispute_escalation。引用材料时保留真实 evidenceId 和逐字引用；没有原文就标为待核实。按需调用，不强制全部鸭参与。

结果区分已确认事实、消费者描述、AI 建议和待核对信息。与用户共同核对退款方案前提、沟通文本及期限。工具结果不能视为退款成功或法律判决，不能把模型提议改为已确认事实。

没有对商家发消息、执行支付、投诉或外部披露材料的权限。遇到鉴权、配置、网络或材料错误，报告实际错误并保持待处理，不虚构成功。

验收：成功返回结构化结果，材料来源真实可查，权限只限当前账户，外部操作未执行。这是可安装的适配模板，不代表已安装进任何外部 AI 平台。
