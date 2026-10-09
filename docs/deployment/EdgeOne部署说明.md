# EdgeOne 部署说明

GitHub 仓库：https://github.com/LucianaiB2004/whyduck

## 401 UNAUTHORIZED

EdgeOne 项目默认域名不是永久公开域名。当前项目区域为“全球可用区（含中国大陆）”，必须从项目概览点击“预览”，使用系统生成的完整链接（保留校验参数）。链接有效期为 3 小时；裸域名或过期链接会返回平台 401，此时应用代码尚未执行。不要把预览校验参数提交到仓库。

长期访问需要绑定自定义域名，并满足所选区域的备案要求。改为“全球可用区（不含中国大陆）”也不能让大陆网络直接访问默认域名。

官方说明：https://pages.edgeone.ai/document/error-codes

## 构建输出

`edgeone.json` 明确指定 `dist/client` 为静态发布目录。不能上传整个 `dist`：入口 HTML 引用 `/assets/`，该目录位于 `dist/client/assets`；整个目录发布会使静态资源路径不匹配，并把服务端构建文件一同发布。

## 当前验证边界

静态页面部署不等于 Express API 部署。当前仓库的服务端使用 Node 24、SQLite 和私有证据文件目录；EdgeOne 的静态构建不会自动启动 `dist/server/index.js`。尚未完成持久化数据库、证据存储与云函数适配，不能将云端页面展示报为真实 AI、账户或案件恢复能力已上线。
