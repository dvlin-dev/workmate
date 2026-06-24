# 品牌与图标

> 图标管线由 workmate 自建（从一张 1024 PNG 母版生成全部尺寸）。品牌色/Logo 是 workmate 自有。

## 1. 品牌

- **名称**：Workmate（中文「工作搭子」）。`appId: com.workmate.app`，`productName: Workmate`。
- **品牌色**：友好的紫罗兰 **`#7C5CFC`**（已落为 `--brand` token，见 design-system.md），渐变 `linear-gradient(135deg, #7C5CFC, #9D7BFF)`。区别于进度条用的 `--success` 绿。
  > 这是一个合理默认，**易改**：想换配色只需调 `globals.css` 的 `--brand` 一处 + Logo/图标重导。
- **气质**：搭子 = 靠谱、友好、专注。App 内部仍以 macOS 冷灰中性色为主，紫罗兰只用于关键强调（如官网 Hero、生成周报按钮可选）。

## 2. Logo 资产（需产出）

| 资产 | 规格 | 用途 |
|------|------|------|
| `logo.svg` | 矢量，方形画布 | 官网 Header、README |
| `icon.png` | **1024×1024** PNG（唯一母版） | 派生所有尺寸的源（App 图标、favicon） |
| `og-image.png` | 1200×630 | 官网社交分享卡 |

Logo 造型建议：一个简洁的圆角方/圆形标记，紫罗兰渐变底 + 一个表达"搭子/对勾/进度"的极简符号（如对勾 ✓ 或两个并肩的圆点）。保持 macOS 图标的圆润、克制、有微妙高光。

## 3. macOS App 图标管线（从 1024 PNG 生成 `.icns`）

workmate 自建一个 `app/scripts/make-icns.sh`。步骤（命令为 macOS 自带 `sips`/`iconutil`，无需额外依赖）：
1. 以 `build/icon.png`(1024) 为母版，建 `icon.iconset/` 目录。
2. 用 `sips -z <N> <N>` 把母版缩到 16/32/128/256/512 各尺寸及其 `@2x`（如 `icon_32x32.png` 与 `icon_32x32@2x.png`=64px），命名遵循 Apple iconset 约定。
3. `iconutil -c icns icon.iconset -o build/icon.icns`，清理临时目录。

`electron-builder.yml` 指 `mac.icon: build/icon.icns`（见 project-structure.md §5），它会据此自动派生最终各尺寸。

## 4. 官网 favicon / manifest

`website/public/`：
- `favicon.ico`（从 logo 导出 32×32/16×16）+ `logo.svg`。
- `manifest.json`：`name="Workmate · 工作搭子"`、`short_name="Workmate"`、`theme_color="#7C5CFC"`、`background_color="#F2F2F7"`、`display="standalone"`、`icons` 指向 `/logo.svg`。

`__root.tsx` 里设 `theme-color` meta(`#7C5CFC`)、favicon link、manifest link。

## 5. 不做（对齐"省略用不到的功能"）

不做 Windows `.ico` / Linux 图标 / NSIS 安装器图标 / DMG 背景图（`background.tiff`）—— macOS-only、dmg 默认外观即可。母版只维护一张 1024 PNG。
