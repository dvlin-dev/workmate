# Skills 集成方案（待审核 · v3 最终）

> **定位**：Skill 是 Workmate 走向**开放 agent 平台**的扩展层 —— 搭子能围绕「目标 / 工作」按需加载并执行各种能力：写 HTML / 落地页、生成文档表格、做图、跑浏览器自动化、调研汇总…并把产物沉淀回目标。长期愿景：Workmate = **目标管理 + 开放 agent 平台**（"目标管理版的 openclaw"）。
>
> **本版按三条指示定稿**：① 执行工具（文件/检索/bash/web）**全做**；② **不做沙箱、不做审批，开放最大权限直接执行**（演示优先）；③ skills 系统与前端**照搬成熟范式**，不自造复杂设计；④ 趁此**加左侧侧边栏**，重排整体布局。
>
> 实现范式来源见本地 `.local/dev-reference.md`（不入库）。**本文是 plan，审核通过再动工。** §9 是待拍板项。

---

## 0. 决策已定（来自本轮指示，不再讨论）

| # | 决策 | 定论 |
|---|------|------|
| 执行工具范围 | 文件 read/write/edit、ls/glob/grep、**bash**、web fetch/search | **全做** |
| 沙箱 | 命令沙箱、路径硬隔离 | **不做**（开放最大权限） |
| 审批闸 | 危险操作弹窗确认 / allowed-tools 白名单门禁 | **不做**（直接执行；`allowed-tools` 仅作信息提示，不拦截） |
| 系统复杂度 | registry / 远端同步 / 状态机 | **照搬成熟范式**，按需裁剪，不自造 |
| 布局 | 左对话｜右看板 → +侧边栏 | **加侧边栏**，主区按导航切换 |

> ⚠️ 安全声明（写进代码注释与 docs）：bash/文件工具以**用户本机最大权限**执行，无沙箱无审批。这是**演示/单人自用**取向；若未来面向不可信 skill 或多用户，必须补回审批+沙箱（接口预留，见 §4.4）。

---

## 1. 工作量全景（四块）

```
A 执行 substrate ── 工作区 + 文件工具(read/write/edit/ls/glob/grep) + bash + web(fetch/search)
                     【最大权限，无沙箱无审批】
B 加载层 ────────── SkillsRegistry(扫描/启停/装卸/远端同步) + skill 工具 + prompt 注入 <available_skills>
C UI 重排 ───────── 左侧边栏 + 主区路由（对话看板 / 技能页）+ 技能页(已装/推荐/详情)
D 融合(可选,后做) ── 产物↔目标关联、看板展示、周报引用
```

A+B+C 是本次目标（开放平台可用版 + 技能管理界面）；D 视反馈再排。

---

## 2. UI 重排：加左侧边栏（参考成熟范式）

### 2.1 现状 → 目标

```
现状：  ┌────────────┬──────────────┐
        │ 对话        │ 看板          │       两栏，无全局导航
        └────────────┴──────────────┘

目标：  ┌──┬──────────────────────────┐
        │侧│  主区（按 destination 切换）：       │
        │边│   • home   → 对话 | 看板（现有两栏）  │
        │栏│   • skills → 技能页（已装/推荐/详情） │
        │  │  （未来：sites / automations …）     │
        └──┴──────────────────────────┘
```

### 2.2 侧边栏（`components/sidebar/`，参考成熟侧边栏的「模块导航」范式）

- 窄侧边栏（约 56–220px，可后续做收起）：顶部 Logo/标题；中部**模块导航**（图标+名）；底部设置入口。
- 模块项（`ModulesNav` 范式）：`home`（搭子/看板，icon `LayoutDashboard`）、`skills`（技能，icon `Boxes`）。预留 `sites`/`automations` 占位但不实现。
- 选中态：`bg-sidebar-accent`；hover 态；`aria-current="page"`。用 `--sidebar*` token（globals.css 已具备 sidebar token；若缺则补，design-system 已有取值）。
- macOS：侧边栏顶部留红绿灯避让（`pl/pt`），整窗仍 `titleBarStyle:hiddenInset`；侧边栏区域 `window-drag-region`。

### 2.3 导航状态（`renderer/navigation/` 或 store）

- 极简：`useNavStore`（zustand）持 `destination: 'home' | 'skills'`，`go(dest)`。**不引入路由库**（单窗口、两三个目的地，store 足够；对齐"不自造复杂"）。
- `App.tsx` 改为：`<div flex><Sidebar/><main>{destination==='home' ? <HomeView/> : <SkillsView/>}</main></div>`。
- `HomeView` = 现有 `ChatPanel + KanbanPanel` 两栏原样搬入；`SkillsView` = 新技能页。
- 设置仍是弹窗（`SettingsDialog`），入口移到侧边栏底部（保留菜单 ⌘, 与现有 onOpenSettings）。

### 2.4 技能页（`components/skills/`，照搬成熟范式的结构）

- **页头**：标题「技能」+ 副标题 + 刷新按钮 + 搜索框（+ Phase C 的「新建/从仓库安装」）。
- **已安装区**：卡片网格（title + 启停态 + description），点开详情弹层。
- **推荐区**：curated 未装项，卡片带「+」一键安装（Phase C）。
- **详情弹层**（`SkillDetailModal`）：`ui/markdown.tsx` 渲染 `SKILL.md` 正文（已支持）；底部「启用/停用」「卸载」「在 Finder 打开」「试用」按钮。
- 列表/详情交互、搜索过滤逐结构照搬成熟实现，组件换成项目内 shadcn 基础件（Button/Input/Dialog/ScrollArea/Switch 都已拷入）。

---

## 3. 执行层（全做，最大权限，无沙箱无审批）

### 3.1 工作区
工作区目录 `app.getPath('userData')/workspace/`（**默认**；D-1 决定是否首启让用户选可见目录）。文件工具的相对路径锚定于此，但——**按"开放最大权限"指示，不做硬路径隔离**：默认 cwd = 工作区，但允许 agent 用绝对路径/`cwd` 访问工作区外（与本机 shell 等价）。保留 `isInsidePath` 工具函数但默认不强制（接口在，开关默认关）。

### 3.2 执行工具（加进 agent 工具集，`tool()`+zod，参考成熟工具实现的 schema/行为）

| 工具 | 入参 | 行为 | 备注 |
|------|------|------|------|
| `read_file` | `path, offset?, limit?` | 读文件（大文件/二进制提示截断） | 照搬 read-tool 范式 |
| `write_file` | `path, content` | 写/覆盖文件（缺目录自动建） | 直接写，无审批 |
| `edit_file` | `path, old, new` 或 patch | 局部替换 | 照搬 edit-tool 范式 |
| `list_dir` | `path?` | 列目录 | 结果上限 |
| `glob` | `pattern, cwd?` | 文件名匹配 | 照搬 glob-tool |
| `grep` | `pattern, path?` | 内容检索 | 照搬 grep-tool |
| `bash` | `command, cwd?, timeout?` | **`execFile`/`spawn` 直接执行 shell**，默认 cwd=工作区，超时默认 2min/上限 3min | **无沙箱、无审批、最大权限** |
| `web_fetch` | `url, prompt?` | 取网页转文本 | 超时、大小上限 |
| `web_search` | `query` | 联网搜索（需 key 时降级跳过） | 可选，无 key 不报错 |

- 每个工具 `execute` 末尾 `ctx.trace.push({tool, summary})`，复用现有流式工具足迹 UI（搭子干活可见）。
- bash 输出做截断（头尾 + 提示），避免撑爆上下文（照搬成熟 runtime 的输出截断思路）。
- 这些工具对所有会话生效（不止 skill 触发时）；skill 通过 prompt 注入引导何时用哪个。

### 3.3 上下文
`AgentContext` 增 `workspace: { root: string }`（文件/bash 工具读它定位 cwd）。

### 3.4 安全闸接口预留（默认关，不实现拦截）
`bash`/`write_file` 内部留一个 `approve?: (action) => Promise<boolean>` 钩子位与 `allowed-tools` 解析位，**默认直通**。这样未来要补审批/沙箱时是「打开开关 + 接实现」，而非重构。**本期不做任何拦截逻辑**。

---

## 4. 加载层（照搬成熟范式，按需裁剪）

### 4.1 存储
```
~/.workmate/
  skills/                 # 已安装并生效的 skill（每个一目录，含 SKILL.md）
  curated-skills/         # 远端 curated 基线（Phase C）
  skills-state.json       # { disabled[], skippedPreinstall[], managedSkills{} }
app/src/main/skills/builtin/<name>/SKILL.md   # 仓库内置，随包发布，首启拷入
```

### 4.2 SKILL.md 格式（开放生态通用，兼容社区 skill）
```markdown
---
name: agent-browser
description: Browser automation CLI for AI agents. Use when the user needs to interact with websites — navigate, fill forms, click, screenshot, scrape, test web apps.
---
# Browser Automation with agent-browser
## Core Workflow …
## 用 bash 跑 `agent-browser open <url>` / `snapshot` / `click` … 把产物存到工作区
```
frontmatter 取 `name`/`description`；title/description 有正文兜底；kebab-case 目录名即标识。社区 skill 里可能带 `allowed-tools` 等额外字段——**直接忽略**（本期无审批/门禁，不解析、不拦截）。

### 4.3 SkillsRegistry（`app/src/main/skills/`，照搬成熟实现的文件分层）

| 文件 | 职责 | 取舍 |
|------|------|------|
| `types.ts` | `ParsedSkill`/`CuratedSkill`/`SkillStateFile`/`ManagedSkillState`/IPC 类型 | 照搬 |
| `constants.ts` | `~/.workmate` 路径、上限、`resolveBundledSkillRoots()`（dev/打包/asar 容错） | 照搬（路径换 workmate） |
| `file-utils.ts` | `toKebabCase`/`xmlEscape`/frontmatter 解析/`parseSkillFromDirectory`/`copyDirectoryTree`/`replaceDirectoryAtomically`(原子+回滚) | **逐字照搬**（解析/原子覆盖是正确性关键，与"无沙箱"无关，必须保留） |
| `state.ts` | `skills-state.json` 读写 + 校验（坏 JSON 回退） | 照搬 |
| `installer.ts` | 本地拷贝安装 + 远端下载安装 | 照搬 |
| `remote.ts` | GitHub revision 比对 + 快照下载（host 白名单/超时/上限/rate-limit 诊断/并发） | 照搬（Phase C 才接线） |
| `catalog.ts` | curated 清单（name/source/preinstall/recommended） | 照搬骨架，换成 workmate 选的 skill |
| `index.ts` | `SkillsRegistry` 单例：扫描→缓存→list/getDetail/setEnabled/install/uninstall/listRecommended/getAvailableSkillsPrompt/loadSkillForTool | 照搬（remote sync 可后接线） |

> 注：这里照搬的是**registry 的目录扫描/状态/原子写/远端同步**机制——它和"沙箱"是两回事。我们去掉的是**执行 agent 命令时的沙箱与审批**，registry 本身的文件原子性/坏数据回退/符号链接拒绝**保留**（否则装坏一个 skill 会损坏目录，与演示稳定性冲突）。

### 4.4 agent 接入
- `prompt.ts`：system prompt 追加 `<available_skills>`（仅启用项 name/title/description）+ 引导句「匹配某技能 description 时，先调 `skill` 工具按 name 加载它，再用文件/bash/web 等工具执行」。
- `agent/tools.ts`：增 `skill({name})` 工具 → `registry.loadSkillForTool(name)` → 返回 `<skill_content>` + 文件引用；未启用/未找到返回 `<skill_error>`。
- 现有 9 个目标工具 + `skill` + §3.2 执行工具，一并装进 agent。
- `AgentContext` 增 `skills` 端口 + `workspace`；`buildAgent`/`runTurn`/`runTurnStream` 注入 `availableSkillsBlock` 与端口；`index.ts` 构建 `SkillsRegistry` 单例注入 IPC deps 与 orchestrator deps。
- **maxTurns 上调**：开放任务（写多文件/跑命令）需要更多轮，从 8 → **30**（+ 可选 doom-loop 同参去重防失控）。

---

## 5. 生态层（Phase C · 远端 curated）
- `catalog.ts` 维护 curated 清单（GitHub 来源）；首启拷内置基线；后台按 revision 增量更新（TTL/并发/原子覆盖，照搬）。
- 技能页推荐区一键安装；详情弹层卸载；远端走 host 白名单（GitHub API/raw/codeload）+ 超时 + 上限。
- （更开放，D-2）支持用户填**自定义 skill 仓库地址**安装。
- 本期可先只接「内置随包 + 启停」，远端同步代码照搬到位但延后接线——降低首版联网风险，演示更稳。

---

## 6. IPC 契约（沿用 `AppResult` 信封）
| 通道 | 入参 | 返回 | 阶段 |
|------|------|------|------|
| `skills:list` | — | `AppResult<SkillSummary[]>` | B |
| `skills:getDetail` | `{name}` | `AppResult<SkillDetail>` | B |
| `skills:setEnabled` | `{name,enabled}` | `AppResult<SkillSummary>` | B |
| `skills:openDirectory` | `{name}` | `AppResult<void>`（shell 打开目录） | B |
| `skills:listRecommended` | — | `AppResult<RecommendedSkill[]>` | C |
| `skills:install` / `skills:uninstall` | `{name}` | `AppResult<...>` | C |

类型 `SkillSummary{name,title,description,enabled,location,updatedAt}` / `SkillDetail extends + {content,files[]}` / `RecommendedSkill{name,title,description}`。preload 暴露 `skills.*`；`lib/api.ts` 函数式 + `unwrap`；`useSkillsStore`（zustand，原子 selector）。

> 执行工具（文件/bash/web）在**主进程 agent 内部**调用，**不经渲染层 IPC**（渲染层只发消息、agent 在主进程里用工具），所以执行工具不新增 IPC 通道——简化面、对齐"不复杂"。

---

## 7. 内置 skill 初始集（随包，已定）

本期内置 **2 个**真实 skill，**直接复用本地既有的成熟 skill**（已验证、含完整 SKILL.md + 附带资源，兼容性最稳）：

| skill | 作用 | 目录结构（随包拷入 `app/src/main/skills/builtin/`） | 依赖的执行工具 |
|-------|------|------|------|
| **`agent-browser`** | 浏览器自动化 CLI：打开网页、填表、点击、截图、抓数据、测 web app。围绕「调研 / 验证 / 取材」类目标很有用。 | `SKILL.md` + `references/`（7 个 md）+ `templates/`（3 个 .sh） | `bash`（跑 `agent-browser`/`npx agent-browser`）、`read_file` |
| **`find-skills`** | 技能发现：用户问「有没有能做 X 的技能 / 怎么做 X」时，帮其从开放生态发现并安装 skill。是开放平台的「入口级」skill。 | 仅 `SKILL.md` | （引导用户去技能页/Phase C 安装；本身轻量） |

要点：
- **逐字拷入**这两个 skill 目录（含 `references/`、`templates/` 等全部附带文件）到 `app/src/main/skills/builtin/<name>/`，构建时随包发布、首启拷到 `~/.workmate/skills/`。
- frontmatter 里的 `allowed-tools` 字段**保留原样但不解析/不拦截**（本期无门禁，见 §4.2）。
- 二者都 `preinstall: true`（首启即装、默认启用），让演示开箱可用。
- `agent-browser` 依赖外部 CLI（`agent-browser` / `npx agent-browser`）——首次用时由 `bash` 工具按需 `npx` 拉起；文档 README 注明该 skill 需要网络/npx。
- 后续要加更多内置/推荐 skill 时，按同样方式拷目录 + 在 `catalog.ts` 登记即可（Phase C）。

> 这两个的选择对齐「开放平台」定位：`agent-browser` 展示「skill × bash 执行工具」能让搭子真正动手干活；`find-skills` 展示「平台可自我扩展」。围绕目标的产出类 skill（落地页/周报润色等）作为 Phase C 推荐项后续补，不占内置位。

---

## 8. 分阶段交付
- **Phase A**（执行 substrate）：工作区 + 文件/检索工具 + bash + web，最大权限直执行。演示：「把这段写成 workspace 的 HTML 并打开」。
- **Phase B**（加载层）：SkillsRegistry（本地）+ `skill` 工具 + prompt 注入 + 内置 skill（`agent-browser` / `find-skills`）。演示：让搭子用 `agent-browser` skill 打开网页、截图取材，产物存进工作区。
- **Phase C-ui**（界面）：左侧边栏 + 主区路由 + 技能页（已装/推荐/详情/启停）。
- **Phase C-remote**（可选）：远端 curated 安装/更新、自定义仓库。
- **Phase D**（可选）：产物↔目标融合。

> 推荐一次性做 **A + B + C-ui**（开放平台可用 + 完整技能管理界面 + 侧边栏新布局），C-remote/D 看反馈。

---

## 9. 待拍板（少量）
- **D-1 工作区位置**：默认 `userData/workspace`（隐蔽但零摩擦）vs 首启让用户选一个可见目录（更像项目工作区，产物好找）。默认前者。
- **D-2 自定义仓库安装**：Phase C 是否开放「填任意 GitHub 仓库地址装 skill」。默认：先 curated，自定义随后。
- **D-3 内置 skill 初始集**：~~已定~~ —— `agent-browser` + `find-skills`（见 §7）。
- **D-4 侧边栏样式**：极简窄栏（图标+短名）vs 稍宽（带分组标题）。默认极简窄栏，可收起。

> D1 边界扩张（已在本轮确认）：审核通过即更新 CLAUDE.md 全局边界/硬约束/技术栈（加文件系统/bash 能力、工作区、开放平台定位）。

---

## 10. 任务拆分（审核通过后执行；A+B+C-ui）

**执行层 A** ✅ 已完成
- [x] **A1** `agent/workspace.ts`：`getWorkspace()`（`userData/workspace`，首启建目录）+ `resolveInWorkspace`（绝对路径放行）；`AgentContext.workspace`。
- [x] **A2** `agent/tools/fs.ts`：`read_file`/`write_file`/`edit_file`/`list_dir`/`glob`/`grep`（`tool()`+zod，trace.push，读/列/grep 上限截断）。
- [x] **A3** `agent/tools/bash.ts`：`bash`（spawn shell、cwd=工作区、2min 默认/3min 上限超时、输出头尾截断）。**无沙箱无审批**。
- [x] **A4** `agent/tools/web.ts`：`web_fetch`（取页转纯文本截断）/`web_search`（DuckDuckGo HTML，无 key，失败降级空）。
- [x] **A5** 接线：执行工具加进 `buildAgent` 工具集；`AgentContext` 加 `skills`/`workspace`；`maxTurns` 8→30、超时 60s→180s。main 进程 typecheck 通过。

**加载层 B** ✅ 已完成
- [x] **B1** `app/src/main/skills/`：types/constants/file-utils/state/index（本地加载层；安全/原子工具逐字照搬：`isInsidePath`/frontmatter 解析/拒符号链接/原子覆盖）。remote/catalog（Phase C 远端）暂未建，接口已在 index 预留。
- [x] **B2** 拷入 `agent-browser`（含 references/templates）+ `find-skills` 到 `app/src/main/skills/builtin/`；electron-vite 加 `copyBuiltinSkillsPlugin` 把 `builtin/`→`dist/main/builtin/`（已验证 dist 产物含两个 skill）。`PREINSTALL_SKILLS` 首启拷入并默认启用。
- [x] **B3** `agent/tools.ts` 加 `skill` 工具（经 `ctx.skills.loadSkillForTool`）；`prompt.ts` 注入 `<available_skills>`；`AgentContext` 加 `skills`/`workspace`；`orchestrator.prepare` 注入；`ipc/register.ts` 构建 registry 单例并注入 `runTurnStream`。

**界面 C-ui** ✅ 已完成
- [x] **C1** `components/sidebar/Sidebar.tsx`：侧边栏 + 模块导航（home/skills）+ 底部设置入口；顶部 `pl-20` 避让红绿灯 + `window-drag-region`。用现有 token（`bg-muted/30`、`bg-accent`），未新增 sidebar token（更省、低冲突）。
- [x] **C2** `store/useNavStore.ts`：`destination`（home/skills）；`App.tsx` 改「侧边栏 + 主区路由」，现有两栏收进 `HomeView`。
- [x] **C3** IPC：`skills:list/getDetail/setEnabled/openDirectory` + CH 常量 + preload + `lib/api.ts`（listSkills/getSkillDetail/setSkillEnabled/openSkillDirectory）+ `useSkillsStore`。`SkillSummary`/`SkillDetail` 提到 `@shared/ipc` 单一事实源。
- [x] **C4** `components/skills/`：`SkillsPage`（页头+搜索+刷新+已装列表卡片+Switch 启停）、`SkillDetailModal`（markdown 渲染正文 + 打开目录 + 启停，读 store 实时态）。

**收尾** ✅ 已完成
- [x] **T1** 单测 `test/skills.test.ts`（11 例）：file-utils（toKebabCase/isInsidePath/frontmatter 解析/缺 SKILL.md）、文件工具（write→read 往返/glob/grep/edit 唯一替换）、bash（echo/cwd）、`skill` 工具（命中/未启用）。
- [x] **DoD**：① skill 工具 → 执行工具链路打通（测试覆盖）；② 侧边栏 home/skills 路由切换；③ 技能页启停生效；④ **typecheck + 全量 69 测试 + build 全绿**，dist 含 builtin skill；⑤ 回写本 plan + CLAUDE.md 边界 + ipc-contract + agent-runtime。

---

## 11. 阶段性不做
sandbox / 审批闸（本期明确不做，仅留钩子）；远端自定义仓库（除非 D-2 选做）；产物↔目标融合（Phase D）；多 skill 并行编排；skill 间依赖；账号/付费。
