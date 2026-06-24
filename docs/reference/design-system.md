# 设计系统 / Token 体系

> macOS 原生质感设计系统。本文讲 token 取值、规范与 workmate 的用法决策。**任何 UI 变更先读本文。**
> 北极星：简约克制、圆润留白、黑白灰为主、微妙层次、丝滑动效。色彩只用于状态与关键强调。

## 1. 样式栈（已锁定）

- **Tailwind v4（CSS-first）**：无 `tailwind.config.js`，用 `@import 'tailwindcss'` + `@theme {}` 在 CSS 里声明。
- **shadcn/ui**，style = `radix-lyra`，baseColor = `neutral`，cssVariables，图标 = lucide。
- 工具：`clsx`+`tailwind-merge`（`cn()`）、`class-variance-authority`（变体）、`tw-animate-css`、`lucide-react`（**唯一**图标库）。
- 暗色：`.dark` class + `@custom-variant dark (&:is(.dark *))`。**Day 1 先只发浅色**（深色 token 已备好）。**不引入 `next-themes`**。

## 2. 样式资产（约定）

| 资产 | 要点 |
|------|------|
| `globals.css`（token 全量） | 含全部自定义 token；`--brand`（见 §5）；`@source` 指向本项目目录 |
| `cn()` | `app/src/renderer/lib/utils.ts`（`clsx` + `tailwind-merge`） |
| `components.json` | radix-lyra/neutral/cssVariables/lucide，`css` 指向本项目 `globals.css` |
| 组件 `.tsx` | shadcn 风格组件，`cn` import 指向本项目 utils |

App 渲染层与官网各放一份 `globals.css`（同一套 token，无需共享包）。

> **重要：`globals.css` 保留全部自定义 token，故组件里的 `duration-fast`/`border-border-muted`/`input-focus`/`shadow-float`/`success`/`warning` 全部开箱即用，无需做任何 token 替换。**

## 3. Token 取值（spec，便于评审/对色，无需翻文件）

| 类别 | 取值（Light；Dark 见 `globals.css` 的 `.dark`） |
|------|----------------------------------------------|
| 圆角 | sm 6 / md 8 / lg 12 / xl 16 / 2xl 20 / full 9999（px） |
| 间距（4px 网格） | `p-1`=4 `p-2`=8 `p-3`=12 `p-4`=16 `p-5/6`=20/24；页边 `px-6`=24 |
| 动效时长 | fast 150 / normal 200 / slow 300 ms；缓动 `cubic-bezier(.4,0,.2,1)` |
| 背景/前景 | `--background` `240 11% 96%`(#F2F2F7) / `--foreground` `240 10% 10%`(#181824) |
| 卡片 | `--card` `0 0% 100%`（白，浮于背景） |
| 主色 | `--primary` `240 10% 10%` / `--primary-foreground` `0 0% 100%` |
| 次要/弱化 | `--secondary`/`--muted` `240 8% 93%`；`--muted-foreground` `240 5% 47%` |
| 强调(hover) | `--accent` `240 6% 89%` |
| 状态 | `--success` `145 55% 42%`(进度条)；`--warning` `35 85% 52%`(卡点)；`--destructive` `4 70% 55%` |
| 边框 | `--border` `240 6% 89%`；`--border-muted` `240 5% 93%` |
| 阴影 | xs `0 1px 2px /.03` → 2xl 递进；浮起元素 `--shadow-float`（带 1px 描边感） |
| 字体 | Inter / 系统；正文 `font-feature-settings:'rlig' 1,'calt' 1` |
| 字号层级 | 页标题 `text-xl font-semibold` · 区块标题 `text-sm font-semibold` · 正文 `text-sm` · 辅助 `text-xs text-muted-foreground` |

## 4. macOS 质感规范（强制）

1. 黑白灰主导，色彩只用于状态/关键强调。
2. 处处圆角，无尖角。
3. 留白表达层次，不堆边框。
4. **不用重阴影**：细边框（`border-border/60`）+ 微阴影（`shadow-xs`）即表达浮起。
5. 200–300ms 自然过渡；**所有动效尊重 `prefers-reduced-motion`**。
6. 深度靠表面色差（卡片比背景浅），不靠强边框。
7. 直接操作、行内编辑优先于弹窗；成功反馈用安静的行内提示，不用满屏 toast。
8. 加载用 Skeleton/行内 spinner，绝不整屏遮罩。

## 5. workmate 品牌色

紫罗兰 **`#7C5CFC`** → 落为 `--brand` token（Light `252 96% 68%` / Dark `252 96% 72%`），渐变 `linear-gradient(135deg,#7C5CFC,#9D7BFF)`。区别于进度条的 `--success` 绿。App 内紫罗兰只用于关键强调；官网 Hero 可用渐变。**易改**：调 `--brand` 一处即可。详见 [`branding.md`](./branding.md)。

## 6. 组件约定（与 shadcn 一致，知识点）

- 每个组件是普通函数，接 `React.ComponentProps<...>`，设 `data-slot`，用 `cn(...)` 合并 class；变体用 `cva`+`VariantProps`；多态用 Radix `Slot`+`asChild`。
- 图标仅 `lucide-react`，行内引用；内联 `size-4`(16px)、独立 `size-5`(20px)。
- 进度条用 `@radix-ui/react-progress`，指示器染 `--success`，`value` 0–100。
- 周报 markdown 用 `react-markdown`+`remark-gfm`（静态周报不需要 Streamdown 的流式/高亮——这是裁掉用不到的*功能*，非重造）。

## 7. workmate 界面映射（左对话 | 右看板）

| 区域 | 处理 |
|------|------|
| 整体 | 两栏：左 chat（约 5 列）/ 右 kanban（约 4 列）；`titleBarStyle:hiddenInset` 留原生红绿灯 |
| 左·对话流 | 用户气泡 `bg-primary text-primary-foreground self-end rounded-2xl px-3 py-2`；搭子气泡 `bg-muted self-start ...`。气泡自写两个 div，不拉 `ai/message-list` |
| 左·工具提示 | agent 调 tool 时显示行内提示（如 `✓ 已更新登录联调到 60%`），`text-xs text-muted-foreground` |
| 左·输入框 | `Textarea`，`field-sizing-content min-h-16`，⌘/Ctrl+Enter 发送 |
| 右·本周目标 | 每个 Goal 一张 `Card`（`rounded-xl border-border/60 shadow-xs`）+ `Progress` + 状态 `Badge` |
| 右·今日聚焦 | Task 列表（只读勾选展示） |
| 右·周报按钮 | `Button`（`brand` 或 `primary`）→ `Dialog` 展示 markdown + 复制 |
| 设置页 | `Input`/`Label`/`Select` 表单：baseURL/apiKey/model + 测试连接 |

## 8. 渲染层 UI 依赖收敛

`clsx` `tailwind-merge` `class-variance-authority` `lucide-react` `tailwindcss@4` `tw-animate-css` + 选用组件所需的少数 `@radix-ui/*` + `react-markdown` `remark-gfm`。
> 主进程的 agent 运行时依赖另见 [`project-structure.md`](./project-structure.md) / [`agent-runtime.md`](./agent-runtime.md)。
