# 官网设计（Workmate Website）

> 第二交付物。**已实现为 Vite + React 纯静态单页**（复用同一套设计实质：token、scroll-reveal、品牌渐变、SEO meta、landing 结构/内容）。原计划 TanStack Start，因单页静态站不需要 SSR/路由/nitro 而改用更可靠的 Vite 静态——见 [`reference/project-structure.md`](../reference/project-structure.md) §6 决策说明。差别只在内容（workmate）与规模（单页、中文单语言）。
> 工程脚手架、token 复用、SEO 实现细节见 [`reference/project-structure.md`](../reference/project-structure.md) §7 与 [`reference/design-system.md`](../reference/design-system.md)。
> 优先级：低于桌面端核心闭环。桌面端 demo 跑通后再做；时间紧可只做单屏 Hero + 下载。

## 1. 定位与目标

- 一句话：让访客在 30 秒内理解"workmate 是一个用说话就能维护周目标、自动写周报的 macOS 工作搭子"，并下载。
- 受众：被周报/目标追踪困扰的个人开发者与知识工作者（中文优先）。
- 转化目标：单一 CTA —— **下载 macOS App**（dmg）。次级：GitHub 开源仓库。

## 2. 信息架构（单页落地，自上而下）

采用 `homepage-sections.ts` 段落数组模式（段落顺序集中在一个常量里，组件按 id 映射）。

| 段落 | 内容 | 要点 |
|------|------|------|
| `hero` | 大标题（含品牌渐变强调字）+ 副标题 + 主 CTA「下载 for macOS」+ App 截图 | OS 检测可选；截图用 `<picture>` AVIF/WebP；首屏 LCP 预加载 |
| `problem` | 痛点三连：计划散落脑中 / 进展不被记录 / 周五全靠回忆 | 共情，短句 |
| `how-it-works` | 三步：① 自然语言随手说 ② AI 结构化成周目标树 ③ 一键周报 + 写入提醒 | 配图或图标 |
| `features` | 4 张 lucide 图标卡 | 见下 |
| `download-cta` | 下载按钮（dmg）+ 版本号 + GitHub 链接 | 收尾再转化一次 |
| `footer` | 版权 / 开源声明 / OneAPI token 说明链接 | 极简 |

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
