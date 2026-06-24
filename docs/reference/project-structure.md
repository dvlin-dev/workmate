# 工程结构与构建配置

> Electron 工具链采用业界成熟的 3-bundle（main/preload/renderer）结构。本文给目录结构、依赖清单（spec）与配置要点，不内联配置原文。两个独立 npm 项目，**不是 monorepo**。

## 1. 仓库布局

```
workmate/
  CLAUDE.md  AGENTS.md→CLAUDE.md  README.md
  docs/{index.md,design/,reference/,plan/}
  app/                      # ← 桌面端 Electron 应用（主交付物）
  website/                  # ← 官网（Vite + React 静态，次交付物）
```

`app/` 与 `website/` 各自独立安装，互不依赖。包管理器 **pnpm**（`packageManager` 锁 `pnpm@9.12.2`；**不建 workspace**）。运行：`corepack enable` 一次性，然后 `cd app && pnpm install && pnpm dev`。

> pnpm 配置（pnpm 9）：`app/package.json` 的 `pnpm.overrides` 去重 `@openai/agents-*` 到 0.4.3/0.5.1；`app/.npmrc` 设 `node-linker=hoisted` + `onlyBuiltDependencies=electron,esbuild,@swc/core`（pnpm 10+ 默认拦截构建脚本，electron 二进制必须放行）。website 同法（`onlyBuiltDependencies=esbuild,@tailwindcss/oxide`）。

## 2. `app/` 目录结构

```
app/
  package.json  electron.vite.config.ts  electron-builder.yml
  tsconfig.json  tsconfig.node.json  vitest.config.ts  components.json
  build/                    # 打包资源：icon.icns / icon.png(1024) / entitlements.mac.plist
  src/
    main/                   # 主进程（Node）
      index.ts              # app 生命周期 + 建窗口 + 注册 IPC + 启动 nudge
      window.ts             # createMainWindow()
      config.ts             # AppConfig 读写（electron-store）
      store.ts              # Store：electron-store 持久化 + 当前周快照
      agent/{model,tools,agent,orchestrator,prompt,report}.ts
      reminders/{bridge,mock}.ts
      nudge/scheduler.ts
      ipc/{register,shared}.ts
    preload/index.ts        # contextBridge.exposeInMainWorld('workmateAPI', api)
    shared/{types,ipc}.ts   # 数据模型 + WorkmateApi/通道/AppResult
    renderer/               # 渲染进程（React）
      index.html  main.tsx  App.tsx
      styles/globals.css    lib/{utils,api}.ts  i18n/zh.ts
      store/{useChatStore,useSnapshotStore,useConfigStore}.ts
      components/{ui/, chat/, kanban/, report/, settings/}
  test/                     # 单测（见 engineering-standards.md §6）
```

各文件职责详见对应 reference 文档（agent/* → agent-runtime.md，ipc/* + preload + shared/ipc → ipc-contract.md，reminders/* → reminders-bridge.md，store/config → agent-runtime.md §1 + engineering-standards.md）。

## 3. 依赖清单（spec）

**运行时（dependencies）**

| 包 | 版本 | 用途 |
|----|------|------|
| `ai` | `6.0.97` | Vercel AI SDK（`generateText`；测试 `MockLanguageModelV3`） |
| `@ai-sdk/openai-compatible` | `2.0.30` | OpenAI 兼容端点 |
| `@openai/agents` | `0.4.3` | `@openai/agents-extensions` 运行时 peer 依赖（打包必须显式带入） |
| `@openai/agents-core` | `0.5.1` | Agent / `run()` / `tool()` |
| `@openai/agents-extensions` | `0.5.1` | `aisdk()` 适配器 |
| `electron-store` | `^11.0.2` | 单 JSON 持久化（userData，原子写） |
| `zod` | `4.3.6` | tool 入参 / config / DTO |
| `zustand` | `^5.0.2` | 渲染层状态 |
| `react` / `react-dom` | `^19.2` | UI |
| `react-markdown` / `remark-gfm` | `^9` / `^4` | 周报渲染 |
| `lucide-react` / `clsx` / `tailwind-merge` / `class-variance-authority` | 见 design-system | UI 基建 |
| `sonner` | `^2` | toast |
| `@radix-ui/react-{dialog,label,progress,scroll-area,select,separator,slot,tooltip,tabs,switch,avatar,use-controllable-state}` | `^1.x`/`^2.x` | UI 组件依赖 |

> 设置表单**写轻量**（受控 state，不引入 react-hook-form + 表单注册表），故不引入 `react-hook-form`/`@hookform/resolvers`。三态「测试连接」按钮的 UX 自实现。

**开发（devDependencies）**：`electron@^31.7.7`、`electron-vite@^2.2.0`、`electron-builder@^26.0.12`、`vite@^5.4.20`、`@vitejs/plugin-react-swc@^3.7.2`、`@tailwindcss/vite@^4.1.18`、`tailwindcss@^4.1.18`、`tw-animate-css@^1.4.0`、`typescript@~5.9.2`、`vitest@^2.1.8`、`jsdom`、`@types/{node,react,react-dom}`。

**脚本**：`dev=electron-vite dev`、`build=electron-vite build`、`typecheck=tsc --noEmit`、`dist:mac=electron-vite build && electron-builder --mac`、`pack=…--dir`、`test=vitest run`。

发布脚本：`dist:mac:arm64` / `dist:mac:x64` 分别构建单架构 dmg+zip，`smoke:packaged` 校验 `release/${version}` 中的 `.app`、`app.asar` 与关键运行时包。GitHub Actions 发布流程见 [`release.md`](./release.md)。

> `"type":"module"`、`"main":"dist/main/index.js"`。**绝不引入** native 依赖（`better-sqlite3` 等）以免触发 `electron-rebuild`。
>
> **必需的 `overrides`（否则 typecheck 报 `aisdk()` 的 `Model` 类型不匹配）**：`@openai/agents-extensions@0.5.1` 会顺带拉入 `@openai/agents@0.11.8` 的新族（嵌套 `agents-core@0.11.8`），与顶层 `agents-core@0.5.1` 形成两份 agents-core 的结构冲突。固定到验证过的 0.4.3/0.5.1 族即可去重：
> ```json
> "overrides": { "@openai/agents": "0.4.3", "@openai/agents-core": "0.5.1", "@openai/agents-openai": "0.4.3", "@openai/agents-realtime": "0.4.3" }
> ```
> 另：`@ai-sdk/provider@^3.0.8` 作为 devDep 显式引入（mock 模型构造 V3 结果类型用）。

## 4. 构建配置（要点）

| 文件 | 配置要点 |
|------|----------|
| `electron.vite.config.ts` | main/preload(`cjs`)/renderer 三 bundle + `react-swc` + `@tailwindcss/vite` + `@`/`@shared` alias + `dedupe`；renderer `root: 'src/renderer'` |
| `tsconfig.json` | `strict`、`moduleResolution:Bundler`、`jsx:react-jsx`、`noEmit`、`paths`：`@/*→src/renderer/*`、`@shared/*→src/shared/*` |
| `vitest.config.ts` | 标准配置；renderer 测试 `environment:jsdom`，main 测试 `node` |

## 5. 打包与提醒事项权限（`electron-builder.yml`）

- `appId: com.workmate.app`、`productName: Workmate`。
- `mac`: `category: public.app-category.productivity`、`icon: build/icon.icns`、`hardenedRuntime: true`、`entitlements/entitlementsInherit: build/entitlements.mac.plist`、`target: dmg+zip (arch: arm64,x64)`。
- **不出** win/linux/nsis、dmg 背景图。
- **`mac.extendInfo`（提醒事项必需）**：
  - `NSRemindersUsageDescription`：「Workmate 会把你拆出的待办写入「提醒事项」，由系统按时提醒你。」
  - `NSAppleEventsUsageDescription`：「Workmate 通过自动化把待办写入「提醒事项」。」
- **entitlements 加** `com.apple.security.automation.apple-events`（在 `allow-jit`/`allow-dyld` 基础上）。

> 权限 TCC 流程与降级见 [`reminders-bridge.md`](./reminders-bridge.md)。

## 6. `website/`（Vite + React 静态）

**实现已落地为 Vite + React 纯静态单页**（非 TanStack Start）。决策：workmate 官网是单页静态营销站，TanStack Start 的 SSR/文件路由/nitro 对单页零收益且增构建脆弱性（nitro-nightly、routeTree 生成、SSR React 重复实例化）。改用 Vite 静态：`vite build` → `dist/` 纯静态（token 体系、`useScrollReveal` 逐字、scroll-reveal CSS、品牌渐变、SEO meta、landing 结构/内容）。详见 [`../design/website.md`](../design/website.md)。

```
website/
  package.json  vite.config.ts  tsconfig.json
  index.html                      # SEO meta + JsonLd + manifest/favicon link + Inter 字体
  public/{favicon.svg, logo.svg, manifest.json}   # og-image.png 待补
  src/
    main.tsx  App.tsx             # App 内含 Header；按序渲染各 section
    styles/globals.css            # 与 app 同一套 token（light）+ 紫罗兰 brand + scroll-reveal 段
    lib/{utils.ts, site.ts}       # cn() + 站点常量（GitHub/下载/OneAPI 链接）
    hooks/useScrollReveal.ts      # 滚动进入逐字揭示（含 group 版）
    components/ui/Button.tsx      # 轻量 CTA 按钮
    sections/{Hero,Problem,HowItWorks,Features,DownloadCTA,Footer}.tsx
```

依赖：`react/react-dom@^19`、`lucide-react`、`clsx`、`tailwind-merge`；devDeps：`vite@^7`、`@vitejs/plugin-react@^4.3`、`@tailwindcss/vite@^4.1`、`tailwindcss@^4.1`、`tw-animate-css`、`typescript@~5.9`。`vite.config.ts`：`react()` + `tailwindcss()` + `@`→`/src` alias，`build.outDir='dist'`。

## 7. 明确不做（非目标）

内部 workspace 依赖、`better-sqlite3`/`electron-rebuild`、重型 `index.ts`（菜单栏/全局快捷键/深链 OAuth/云同步/记忆索引/telegram/automations/vault watcher/single-instance）、`electron-updater`、OS 安全存储、Windows/Linux/NSIS 目标、DMG 背景图。
