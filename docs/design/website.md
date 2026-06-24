# 官网设计（Workmate Website）

> 第二交付物。**已实现为 Vite + React 纯静态单页**（复用同一套设计实质：token、scroll-reveal、品牌渐变、SEO meta、landing 结构/内容）。原计划 TanStack Start，因单页静态站不需要 SSR/路由/nitro 而改用更可靠的 Vite 静态——见 [`reference/project-structure.md`](../reference/project-structure.md) §6 决策说明。差别只在内容（workmate）与规模（单页、中文单语言）。
> 工程脚手架、token 复用、SEO 实现细节见 [`reference/project-structure.md`](../reference/project-structure.md) §7 与 [`reference/design-system.md`](../reference/design-system.md)。
> 优先级：低于桌面端核心闭环。桌面端 demo 跑通后再做；时间紧可只做单屏 Hero + 下载。

## 1. 定位与目标

- 一句话：让访客在 30 秒内理解"workmate 是一个用说话就能维护周目标、自动写周报的 macOS 工作搭子"，并下载。
- 受众：被周报/目标追踪困扰的个人开发者与知识工作者（中文优先）。
- 转化目标：单一 CTA —— **下载 macOS App**（dmg）。次级：GitHub 开源仓库。

## 2. 信息架构（单页落地，自上而下）

段落顺序集中在 `App.tsx` 装配，各 `sections/*` 组件按序渲染（无 i18n、无路由）。

| 段落 | 内容 | 要点 |
|------|------|------|
| `header` | 固定顶栏：Logo + 锚点导航（看演示/怎么用/能力）+ GitHub + 下载 | 滚动后毛玻璃描边；`scroll-padding-top` 防遮挡 |
| `hero` | eyebrow 标签 + 品牌渐变强调大标题 + 副标题 + 双 CTA + 信任脚注 + CSS 拟真 App 截图（左对话/右看板） | 主 CTA 深色前景底；蓝色仅强调 |
| `trust-strip` | 一行 4 个 credential：开源免费 / 数据本地 / BYOK / 无 key mock | lucide 图标，即时建立信任 |
| `problem` | 痛点三连：计划在脑中 / 进展随手忘 / 周五硬回忆 | 共情，短句 |
| `how-it-works` | 三步：① 随手说 ② 结构化+归因 ③ 一键周报+写提醒 | 渐变图标卡 + 序号 |
| `demo` | **核心演示**：左对话流（订单服务 v2 重构一周）+ 右 sticky 看板（进度条入场填充）+ 底部四段式周报卡（可复制） | 静态数据来自 `lib/demo.ts`，忠实 demo-script.md |
| `features` | 4 张 lucide 图标卡 | 见下 |
| `compare` | 诚实对比：传统 Todo/手写周报 vs Workmate（不点名竞品）+ 边界声明 | 右栏蓝色强调 |
| `download-cta` | 收尾下载按钮 + GitHub + 免费/本地/macOS 声明 | 再转化一次 |
| `footer` | 品牌 + 产品/开源链接组 + 版权 | 多列极简 |

> 演示版块（`DemoShowcase`）是全站心脏：用「左对话 → 右看板被一步步维护出来 → 周五一键出周报」讲清"自然语言→结构化产物"的闭环。看板进度条用 `useInView` 在进入视口时从 0 填充到目标值（`motion-reduce` 下禁用过渡）。

### features 四卡（与桌面端 MVP 一一对应）

1. **目标捕获**（`Target`）：说一句话，agent 拆成周目标树，看板自动生成。
2. **进度归因**（`TrendingUp`）：干活途中口语化同步，agent 归因到对应目标、更新进度。
3. **一键周报**（`FileText`）：基于一周进度流，生成完成/亮点/卡点/下周计划的叙事周报。
4. **macOS 提醒同步**（`BellRing`）：拆出的待办单向写入"提醒事项"，由系统按时提醒。

## 3. 内容与文案原则

- 文案中文优先；标题含主关键词；不用"了解更多/探索"这类空开头。
- Hero 标题示例：**「会归因的工作搭子，替你把进展写成周报」**；副标题点出"用说话维护周目标 + 一键周报 + 写入提醒事项"。
- 一个 H1；meta description 120–155 字符；title 形如 `Workmate · 工作搭子 | 用说话维护周目标，一键生成周报`。

## 4. 不做（官网非目标——裁的是用不到的*功能*，不是换框架）

- 栈用 Vite + React **出纯静态**：不跑常驻 SSR Node 服务，也不做 Docker/nginx 部署编排（`dist/` 丢任意静态托管即可）。
- 不做 MDX 博客 / 多 sitemap 路由矩阵 / 多语言 hreflang。
- 不做账号/登录/支付。
- 不做 i18n 框架；中文单语言，必要时手动加一份英文文案常量即可。

## 5. 与桌面端的关系

- **共用同一套设计 token**：把 `reference/design-system.md` 的 `globals.css` 直接拷一份到官网（无需 workspace 包）。
- 品牌色、Logo、favicon 见 [`reference/branding.md`](../reference/branding.md)。
- 下载链接指向 App 的 release 产物（GitHub Releases 或本地 dmg）。
