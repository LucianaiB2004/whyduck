# 凭啥鸭 · UI 设计交付

这是可点击的设计原型，包含示例数据，不是正式 AI 应用。全套 UI 完善后进入业务开发。原参考素材保留不变。

## 打开预览

在项目根目录运行：

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

浏览器访问 `http://127.0.0.1:4173/design/index.html`。右上角菜单可查看全部页面，顶部「查看交互状态」可查看加载、失败、缺证据、上传进度、空状态和结果过期。

## 内容

- 19 个页面：首页、群聊、六鸭独立聊天、案件、凭证盒、证据核对、时间线、跟进、草稿、报告、设置、登录、指南、品牌规范。
- 桌面、平板、手机响应式布局。
- 原创 AI 生成角色，透明 PNG、WebP 与头像在 `../public/assets/whyduck/`。
- 交互：导航、示例填入、@ 选择、成员面板、案件筛选、表单核对、弹层与状态展示。
- 注册、上传、保存、发送、AI 分析、导出均为设计预览；界面与提示中明确标识，不会收集密码或处理用户材料。

## 验证

```powershell
node --check design/prototype.js
node design/verify.cjs
```

验证脚本使用本机 Edge 与已安装的 Playwright；本机默认模块路径见脚本，也可用 `PLAYWRIGHT_MODULE` 指向其他安装位置。运行验证前需要启动上述本地服务器。

截图在 `screenshots/`，完整检查结果在 `verification.json`。脚本验证设计预览，不能用其结果宣称真实业务、数据库、AI 或支付宝已经通过测试。

## 设计规格

完整页面、角色、交互、数据与开发边界见 `../docs/superpowers/specs/2026-10-08-whyduck-design.md`。
