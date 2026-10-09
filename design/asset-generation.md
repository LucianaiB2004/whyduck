# 视觉资产生成与导出记录

日期：2026-10-08。使用实际可调用的内置 `imagegen` 工具，未使用 CLI 或自行编写的生图 API。角色与场景均请求真实透明背景，并在导出时检查 alpha。

## 资产目录

- `public/assets/whyduck/characters/`：当前六鸭透明 PNG 主文件及 WebP 页面文件。
- `public/assets/whyduck/characters/v1/`：名牌迭代前的角色主文件，用于保留历史。
- `public/assets/whyduck/avatars/`：同源缩小头像；小尺寸下界面仍显示可读的角色名称。
- `public/assets/whyduck/illustrations/`：四鸭协作场景及历史版本。
- `public/assets/whyduck/logo/`：由真实字体与凭啥鸭图形排版导出的 wordmark、app-icon。

原生生成结果保留在 Codex `generated_images` 目录；项目运行引用仅使用项目内副本，不依赖临时链接。`prepare-assets.py` 只负责透明素材规范化、尺寸和格式导出，不负责生成插画或移除背景。

## 统一角色提示词

第一只标准管家鸭使用以下核心设计约束：

```text
One full-body chubby yellow duck butler on genuinely transparent background.
Oversized round cream-yellow head, tiny oval black eyes with small white highlights,
small orange broad duck bill, peach cheeks, compact yellow body and tiny wings,
dark warm brown rounded bold outlines, restrained flat 2D sticker illustration
with subtle dimensional shading, charming yet professional.
Black top hat, white collar, coral tie, welcoming wing and cream task clipboard.
Entire hat and feet visible. No photorealism, no plush, no emoji, no watermark.
```

其余五鸭使用该角色作为一致性参考，保持脸、身材比例、轮廓与艺术风格；分别变更角色道具：问号牌、侦探帽与眼镜放大镜、钱包与退款单、日历备忘板、坚定眉与紫围巾。

## 用户确认的第二版：红头与胸前名牌

对每只原角色单独调用图像编辑，最终完整提示词模板：

```text
Edit this exact original WhyDuck mascot. Preserve identity, pose, body proportions,
props, expression, bold warm dark-brown outlines, shading and all other elements.
Add a prominent cream-white rectangular rounded employee name badge hanging on a
thin dark cord across the upper chest, below the beak. The badge must be large
enough to read, unobstructed by the wings or props, with EXACT Simplified Chinese
text "{name}" in bold clean dark-brown Chinese characters, horizontal single line.
Badge is an important identification feature.
{role-specific color instruction}
Entire full-body character centered on transparent square background, comfortable
margins, no background, no watermark, no other text. Do not remove or alter role
props. Production 2D sticker asset.
```

`name` 依次为：管家鸭、凭啥鸭、据理力争鸭、退退退鸭！、后手鸭、不服鸭。

据理力争鸭的专属颜色指令：

```text
Change ONLY the blue head/face feathers to vivid warm coral RED (#E96555) to convey
reasoned determined advocacy, keeping yellow body, blue/slate detective hat,
glasses and magnifier unchanged. Keep friendly analytical expression,
not angry or aggressive.
```

其他角色颜色指令：

```text
Preserve the exact existing yellow face and role accessories.
```

六张结果逐张目视核对名称、角色道具和风格；在角色总览中进一步核对。

## 协作插画迭代提示词

```text
Edit Image 1, the four-duck WhyDuck collaborative office illustration. Images 2-5
are the updated character references. Keep the original composition, desk,
documents, props, warm dark-brown rounded outlines and original 2D sticker style.
Change the detective duck's head from blue to coral red exactly like Image 3,
keeping its blue hat glasses magnifier and yellow body. Add hanging cream chest
employee name badges to all four ducks, visible and with exact simplified Chinese
lettering: left butler '管家鸭', detective '据理力争鸭', refund duck '退退退鸭！',
calendar duck '后手鸭'. Follow reference badge designs. Make badges read clearly,
not obscured by props or table. Preserve all identities. IMPORTANT remove the
existing broad brown background glow/haze, use clean genuinely transparent
background outside the ducks and desk, only minimal natural shadow directly below
the desk. No other text, no extra characters, no watermarks.
Wide production UI illustration.
```

Logo 的中文使用系统真实字体排版，由浏览器导出，避免生图中文字替代正式品牌字。

当前主文件尺寸与 SHA-256 记录在 `asset-validation.json`。页面实际加载与截图记录在 `verification.json`，原型用途和功能边界见 `README.md`。
