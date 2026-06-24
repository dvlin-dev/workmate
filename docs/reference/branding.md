# 品牌与图标

> 图标管线由 workmate 自建（从一张 1024 PNG 母版生成全部尺寸）。品牌色/Logo 是 workmate 自有。

## 1. 品牌

- **名称**：Workmate（中文「工作搭子」）。`appId: com.workmate.app`，`productName: Workmate`。
- **品牌色**：蓝 **`#455DD3`**（已落为 `--brand` token，见 design-system.md），渐变 `linear-gradient(135deg, #455DD3, #6B7FE0)`。区别于进度条用的 `--success` 绿。
  > 这是一个合理默认，**易改**：想换配色只需调 `globals.css` 的 `--brand` 一处 + Logo/图标重导。
- **气质**：搭子 = 靠谱、友好、专注。App 内部仍以 macOS 冷灰中性色为主，蓝色只用于关键强调（如官网 Hero、生成周报按钮可选）。

## 2. Logo 资产（已产出）

| 资产 | 规格 | 用途 | 状态 |
|------|------|------|------|
| `app/build/icon.png` | **1024×1024** PNG（母版） | App 图标母版 | ✓ 已生成 |
| `app/build/icon.icns` | macOS 图标 | electron-builder `mac.icon` | ✓ 已生成 |
| `website/public/{favicon.svg, logo.svg}` | 矢量 | 官网 favicon/Header | ✓ |
| `website/public/og-image.png` | 1200×630 | 官网社交分享卡 | 待补 |

**当前图标造型**：macOS 圆角方块（superellipse 风圆角），蓝色渐变底（`#5E76E6→#455DD3→#3A4FB8`）+ 白色粗体 **W**，含微妙内高光与投影。与官网 favicon（蓝 W）同源一致。

## 3. macOS App 图标管线（可复现，已落地）

`app/scripts/` 下两步，仅用 macOS 自带 `sips`/`iconutil` + 项目内 Electron，无需额外依赖：

1. **渲染母版**（紫罗兰 W → 1024 PNG）：`./node_modules/.bin/electron scripts/render-icon.cjs build/icon.png`
   - `render-icon.cjs` 用 Electron 离屏 `capturePage` 把一段 HTML/CSS（渐变圆角块 + 白色 W）渲染成 PNG（无 SVG 渲染器依赖）。
2. **生成 icns**：`bash scripts/make-icns.sh`
   - 从 `build/icon.png` 用 `sips -z` 生成 16/32/128/256/512 各尺寸及 `@2x`，`iconutil -c icns` 打包成 `build/icon.icns`。

`electron-builder.yml` 指 `mac.icon: build/icon.icns`，打包时自动派生最终各尺寸。换配色/换标记：改 `render-icon.cjs` 的 CSS，重跑两步即可。

## 4. 官网 favicon / manifest

`website/public/`：
- `favicon.ico`（从 logo 导出 32×32/16×16）+ `logo.svg`。
- `manifest.json`：`name="Workmate · 工作搭子"`、`short_name="Workmate"`、`theme_color="#455DD3"`、`background_color="#F2F2F7"`、`display="standalone"`、`icons` 指向 `/logo.svg`。

`__root.tsx` 里设 `theme-color` meta(`#455DD3`)、favicon link、manifest link。

## 5. 不做（对齐"省略用不到的功能"）

不做 Windows `.ico` / Linux 图标 / NSIS 安装器图标 / DMG 背景图（`background.tiff`）—— macOS-only、dmg 默认外观即可。母版只维护一张 1024 PNG。
