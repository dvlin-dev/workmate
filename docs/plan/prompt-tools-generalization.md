# 系统 Prompt + 工具定义「通用化」优化方案

> 状态：**已落地**（P0+P1 + few-shot 示例 + 带标签精简快照；经两轮 sub-agent 评审至 clean）。
> 稳定事实已回写 `docs/reference/prompts.md` / `docs/reference/agent-runtime.md`；本文保留设计依据与决策记录。
> 已改文件：`app/src/main/agent/prompt.ts`、`tools.ts`、`tools/{fs,bash,web}.ts`、`report.ts`、`orchestrator.ts`（docstring）。
>
> **§7 决策结论**（用户拍板 + 实现取舍）：① 语言＝工具契约英文 / prompt 主体中文 / 用户面中文 ✔。
> ② 目标管理保留**一等旗舰**地位（身份"旗舰能力"、`# 能力`首列），底层通用 Agent ✔。
> ③ 搭子温暖保留、emoji"适度可用"、对冲仅限"明显有错" ✔。④ 加 few-shot：精简为 2 个（执行任务 + 对冲）✔。
> ⑤ 快照＝`<week_snapshot readonly>` + 轻量 `summarizeSnapshot`（不泄 id）✔。
> ⑥ 执行产出落事件→周报通道：**本期不做**（默认 a：周报只覆盖已记录工作）；留作后续。

---

## 1. 背景与目标

Workmate 已从「周目标树」单一核心扩成**开放平台**：可插拔 Skill（`SKILL.md` 按需 `skill` 工具加载）+ 一整套执行工具面（文件 read/write/edit/ls/glob/grep、无沙箱 bash、web fetch/search），产物落 `userData/workspace`。Agent 现在能真正写网页/文档、跑命令、做调研。

但 prompt 与工具定义仍停留在「周目标树维护」时代：身份、行为准则、约束几乎全部围绕 goal-tree，执行工具被当成「技能加载后的下游步骤」而非一等能力。身份框定会直接影响模型去够哪些工具（[A1]）。

**本方案目标**：把整套 system prompt + 全部工具定义改成**通用优先、最佳实践、模型可移植**，同时**不臃肿**。

- **通用化**：Agent 读起来是一个「能干活的通用工作助理，顺带管周目标」，而非「带 shell 的目标秘书」。
- **模型可移植**：目标模型 gpt-5.5（经 `@ai-sdk/openai-compatible` + `@openai/agents-core`，baseURL/model 用户可改）。行为写进 prompt、不依赖 provider 专属旋钮，不 over-fit 任一模型怪癖（[E1][E3]）。
- **搭子人设是硬约束**：友好、口语化的「搭子」register 必须存活；本方案只为它加一条**可靠性对冲**，不把它改成冷淡的纠错器。
- **遵循 CLAUDE.md 边界**：复用成熟机制、按需省略、不臃肿；面向用户文案保持中文，工具 `description`/`.describe` 是模型面内部、可英文。

**评估基线（rubric）**：依据一份合并自 9 个来源（OpenAI GPT-5/4.1、Anthropic Claude-4 / Context-Engineering / Writing-Tools / Building-Effective-Agents、Gemini-3、Google Prompt-strategies、arXiv 2507.21919 warmth↔reliability、moryflow 参考实现）的审计 rubric，下文以 `[A1]…[H8]` 引用其条目。

---

## 2. 现状诊断（按杠杆排序）

### 2.1 Prompt 过拟合 goal-tree（最高杠杆）

- **身份 goal-first**（`prompt.ts:16`）：「使命：…维护一棵"周目标树"…；**也能**围绕目标用技能与工具实际产出」——执行能力是「也能」的附属，「围绕目标」把执行降格为目标的子步骤。
- **行为准则是 5 步 if-else 流程图**（`prompt.ts:34-43`）：全部是 `create_goal→add_task` / `find_goal→complete_task` / `write_reminder` / `generate_report` / `get_snapshot`，**没有任何执行/技能任务的行为回路**。用户说「帮我做个落地页」时，prompt 给的唯一路径就是目标记账。海拔太低、过拟合一条路（[A2][E3]）。
- **执行工具面被藏在条件块里**（`prompt.ts:9-15`）：file/bash/web 工具**只**在 `<available_skills>` 非空时、作为「加载技能后的下游」被提及。没启用技能时，prompt 完全不提这 9 个工具——模型拿到一把它从没被告知的能力（[A1][F5]）。

### 2.2 工具描述是中文、缺 WHEN/边界（高杠杆）

- **5 个文件里每一条 `description` 和每一个 `.describe()` 都是中文**。工具规格是模型受训过的机器契约，英文跨 provider 对齐更稳（[E2]）。不影响任何用户可见文案（chat / ToolHint / 用户侧 error / 周报输出都另行保持中文）。
- **多数描述只有 WHAT，没有 WHEN，也没有「对比兄弟工具」的边界**（`read_file`/`write_file`/`edit_file`/`list_dir`/`glob`/`grep`/`web_*`/`get_snapshot` 都缺 WHEN）（[C1]）。
- **易混工具簇没消歧**：`log_event`(不动进度条) vs `complete_task`(推进进度)；`complete_task` vs `complete_goal`；`find_goal`(关键词查、返回 taskId) vs `get_snapshot`(全量自查)；`write_file` vs `edit_file` vs `bash`；`web_fetch` vs `web_search`。边界只活在 prompt 散文里，模型每次都要重建（[C2]）。
- **`.describe()` 多为复述名字、无格式/示例**：`goalId:'目标 id'`、`due:'可选 ISO 截止时间'`、`weekOf:'可选指定周（周一日期）'`、`grep.pattern:'正则或字符串'`（grep 实际只走 `new RegExp`，「或字符串」误导）。**id 无来源约束、日期无锚点约束**——正是 Workmate 最易崩处（硬约束#4 weekOf=周一；幻觉 id）（[D1][D2]）。

### 2.3 persona：暖意有余、可靠性无对冲（高杠杆）

- 人设块（`prompt.ts:25-27`）纯暖意：「像一个懂行的搭子…可适度用 emoji」，**没有任何诚实/纠错对冲**。arXiv warmth↔reliability 论文证明：暖意训练让模型对错误信念的附和率 +11pp，**跨全部 5 个模型族普遍成立**；用户难过时差距近乎翻倍。而周目标搭子恰恰在用户着急、提糟糕计划时被用（「这周来不及了，砍掉测试吧」）。这是本方案**最重要的单条审计项**（tension #1）。
- **无反捭阖（anti-capitulation）规则**：没有任何条目要求模型在用户施压/重述错误前提前守住正确答案。sycophancy 在标准 benchmark 上隐形（warm 模型在 MMLU/GSM8K 正常、却在含信念任务上退化）（[B5]）。
- **`write_reminder` 把会话人设塞进了模型面工具描述**（`tools.ts:119`「返回 error 让你**口头引导授权**」）——人设属于 prompt，不属于工具契约（[C5]）。

> **对冲的边界（硬要求）**：对冲只针对「用户判断/计划/前提明显有错」时——此时先讲实话、再安抚。日常闲聊、正常请求里，搭子仍然温暖、口语、简短。不把每句回复都变成纠错。

### 2.4 缺示例、缺回路、缺 eagerness 区分（中杠杆）

- **零 few-shot 示例**：tone/格式全靠形容词（「简洁/主动/靠谱」），这是最不可靠的引导方式，也无法演示新的执行任务形状（[B9][F4]）。
- **没有通用回路**：缺一条 `定位证据 → 执行 → 改动后自查 → 一句话汇报` 的总回路（[A2][H8]）。
- **轻量 vs 开放任务在 prompt 里无差别**：prompt 全写在「轻量归因」海拔，开放任务（skill + 文件/bash 多步产出）只有技能段尾一句。轻量任务会过度调用，开放任务又欠持续性（[H1][H2][H6]）。
  > **注意**：这是**任务形状**问题，不是「8/30 maxTurns 两档」问题。代码里只有单一 `MAX_TURNS = 30`（`orchestrator.ts:24`），同时作用于 `runTurn`（L89）与 `runTurnStream`（L133）；**没有意图分类器、没有 per-turn maxTurns 选择**。所谓「8 轮轻量上限」在代码里不存在，只剩 `orchestrator.ts:2` 与 `agent-runtime.md:79-80` 的**过期 docstring**（写 8、跑 30）。所以 prompt **不能引用模型感知不到的轮次预算**；下文 eagerness 用任务形状启发式表述，并把过期 docstring 一并修掉（§6 P1）。
- **L34↔L49 push/pull 冲突**：`# 行为准则（务必用工具…）` 硬推「总是调工具」，`别陷入反复调用同一工具` 又往回拉；强指令模型上「务必」容易赢 → 过度调用 / 幻觉参数（[A6][H3]）。
- **进度派生不变量重复 3–4 次**（`prompt.ts` L30/31/35 + 行为准则 step1/2 + L47），浪费注意力预算（[A3]）。
- **快照是裸 `JSON.stringify` 全量注入**（`prompt.ts:8,22-23`），无标签、夹在身份与人设之间，邀请「陈旧 blob 当真」+ id 泄漏入 chat（经典 full-data-up-front 反模式）（[F1][F2]）。

### 2.5 降级与周报层（中杠杆，附带）

- **软失败无通用处理规则**：prompt 只覆盖 `write_reminder` 权限一种；而 `skill`/`edit_file`/`read_file`/`grep`/`web_search`/`bash(exitCode)` 都返回软失败，模型没被告知要读它们、自救或如实报告，可能把软失败当成功（[C6][G2][H8]）。
- **REPORT_SYSTEM 只认 goal/event 材料**（`report.ts:16-23`）：四段叙事围绕目标/待办/事件。但执行工具（bash/write_file/web_*）**不落任何事件**，`assembleMaterial`（`report.ts:47-65`）也只喂 goals + events。**这是数据通道缺失，不是文案问题**：硬约束#3 规定「events 是周报唯一原料」，所以光改 REPORT_SYSTEM 散文无法让它叙述未落事件的执行产出——它没有素材可叙述。处理方式见 §5、§6（不违反 #3 的前提下只能：要么把执行产出落成事件，要么放弃叙述未记录的工作）。
- **maxTurns 兜底是死字符串**（`orchestrator.ts:28`，含 🙏），开放任务接近上限时无收尾，非流式路径会丢掉部分进展（[H5][H6]）。

> **诊断更正**：原稿曾称 highlights(累计 `progress>=50`) 与 blockers(本周 `progressedGoals`) 口径不一致、同一目标可能既是亮点又是卡点。**经核实这在真实数据上不可达**：每个 `WeeklyPlan` 以 `goals:[]` 起始、无跨周结转（`store.ts:117`）；进度纯由本周 task `done` 派生；任何 done 跃迁都会落 `task_done`(`store.ts:249`) 或 `progress_update`(`store.ts:233`) 事件、带 `relatedGoalId`，从而进入 `progressedGoals`。故任何 ≥50% 的目标必在 `progressedGoals` 里、必被排除出 blockers。**这不是 bug**，最多是一条防御性滤镜——不列入修复项，避免评审为一个 no-op 花精力。

---

## 3. 目标态：新版 system prompt 结构

### 3.1 语言策略（**决策点**）

**建议：工具定义全英文；system prompt 主体保留中文。**

| 面向 | 内容 | 语言 |
|------|------|------|
| 模型面工具契约 | 工具 `name`/`description`、全部 `.describe()`、truncation `note` | **英文** |
| system prompt 主体 | `buildSystemPrompt` 全文（身份/人设/回路/约束/快照） | **中文** |
| 用户面 | chat 回复、ToolHint summary、surfaced error 文案、`REPORT_SYSTEM` 输出 | **中文** |

理由：**只有工具规格**这一项有强证据支持英文（[E2]，9 来源在「工具契约英文跨 provider 更稳」上收敛）。证据**不**支持把 system prompt 主体也英文化——gpt-5.5 级模型处理中文指令无碍，而整体英文化几乎不增可移植性，却显著伤团队可读性、并给「搭子中文 register + 中文输出不变量」凭空加回归风险。故 prompt 主体保留中文。

> 这是从原稿「prompt 主体英文」收窄后的默认。下文 §3.3 示意稿用中文给。

### 3.2 章节骨架（有序、固定、通用优先）

```
1. 身份 Identity        通用工作助理；目标管理是诸能力之一（非唯一使命）
2. 能力 Capabilities    技能 + 执行工具面(file/bash/web) + 目标树 + 周报 + 提醒，皆一等
3. 人设 Style           搭子 register（温暖/口语/简短）+ 一条可靠性对冲
4. 回路 Loop & strategy 通用回路 + 几条高信号启发式 + 任务形状 eagerness + 并行/串行 carve-out + 自查/降级
5. 约束 Safety          可逆性闸门 + 通用 grounding + 真·不变量(不编进度%/幂等/weekOf=周一)
6. 技能 Skills (lazy)    <available_skills> 索引 + 一行 SKILL_POLICY（仅非空时 append）
7. <week_snapshot>      带标签只读数据块（精简）
—— 末尾：单条最承重规则（中文回复 + 不编造）
```

要点：通用在前、goal-mgmt 作为一项能力；每条规则只说一次（[A3]）；per-tool 机制下沉到工具描述（[A4]）；最承重不变量靠后（[A7]）；快照=带标签数据块、行为规则压轴（[F3]）。按「非空才 append」的有序块组装（[E5]，**只采块组装，不做多平台 profile 机器**）。

> **决策（能力面常驻的预算权衡）**：本方案把 9 个执行工具从「技能条件块」移到常驻 Capabilities 段，换发现性。代价：每个轻量归因轮（常见情形）都常驻这段 prompt 文本（工具 **schema** 本就一直注册、不随此变）。权衡判断：文本增量是几行、远小于工具 schema 本身，发现性收益更大，故**默认常驻**。若后续证明轻量轮预算吃紧，可改为「workspace/skills 在用时才 append 能力段」——记为可选回退，不在本期做。

### 3.3 关键章节示意稿（中文；非最终文案，给海拔与形状）

**身份（通用优先）**
```
你是「Workmate / 工作搭子」，跑在用户 Mac 上的通用工作助理。
你靠一组工具真正把活干完，而不只是聊：
- 用可插拔技能 + 执行工具（读写改文件、跑 bash、上网）产出网页/文档/脚本/调研/小工具……
- 把用户口语化的计划/进展整理成「周目标树」并归因进度；
- 周末写叙事性周报；需要时把待办写进 macOS 提醒事项。
优先挑「真能把这件事做完的最小动作」，做完用一句话回报。
别把请求一律变成一条目标记账——能直接做的，就直接做。
```
（去掉「围绕目标」限定，使执行不从属于目标管理——[A1] 核心。）

**人设——搭子 warmth + 一条可靠性对冲（最重要的一处）**
```
做个利落、不端着的搭子：温暖、口语、说到做到。中文回复。
日常回复一两句口语即可；只有真交付物（周报/文档/代码）才写长、写结构化。
可适度用 emoji，但克制。
一条对冲：当用户的判断/计划/前提明显有问题时——先把哪儿不对讲清楚、给你的真实判断，
再安抚；别因为对方着急或在抱怨就把评估说软。这只针对「明显有错」的情况，日常聊天照常温暖。
顶着用户重复施压也别把对的答案改成错的——只对新证据让步，不对坚持让步。
```
（对冲并入人设、且优先于「附和」——直接对冲搭子 warmth 信号 [B3][B4][B5][B6]。搭子温暖 register 显式保留；emoji 维持「适度可用」，不下调成「几乎不用」。）

**回路与工具策略（通用回路 + 启发式 + 任务形状 eagerness）**
```
通用回路：先取证据（find_goal / get_snapshot / read_file / glob / grep / web_*）
→ 挑最小够用的动作 → 改完自查 → 一句话回报。

启发式：
- 有真实状态变更或要拿真实信息 → 用对应工具；纯聊天/问答 → 直接答。
- 提到计划/目标 → 落成可勾选的待办（进度只由它推动）。
- 提到进展 → 先查再归因；对不上就问一次。
- 任务匹配某技能的 description → 执行前先用 skill 工具加载它。

按任务形状把握 eagerness（不是按轮数）：
- 轻量归因：find_goal/get_snapshot 自查一两次就动手；还对不上就直接问归到哪个目标，别过度调用。
- 开放多步（技能/文件/bash/web）：一路做到请求真正解决；拿不准就按最合理的方式推进、做完再回报（之后可调）。
  先列一句话计划、简短叙述、调工具前说一句为什么、失败就换法。
```

**并行/串行 + 自救（同属回路段）**
```
并行 vs 串行：相互独立的只读（多个 read_file、list_dir+glob、web_fetch 扇出）可放一轮并行；
有依赖的串行、且绝不猜参数——find_goal → complete_task 必须串行（用返回的 taskId）。

自救：工具返回 error / note / 非零 exitCode 一律当失败、不当成功。按提示自纠一次
（找不到→glob/list_dir；edit 非唯一→先 read；技能缺→核对已启用；搜索空→换说法）。
还卡住就如实告诉用户卡在哪——没做完绝不说做完了。
```

**约束（真·不变量保留强调）**
```
工作区文件和所有只读操作可自由动手。做破坏性 bash（rm -rf、覆盖工作区外文件、force-push）
或写提醒事项前，先声明意图/确认。
凡结论必有据：没打开过的文件/页面/命令别下断言——先查；归因只依据 find_goal/get_snapshot
的数据，不靠聊天记忆。
硬不变量（保持强调）：进度由完成待办派生——绝不口编百分比；提醒事项幂等（已有 reminderId
的待办不重复写）；weekOf 锚定周一。绝不编造没做过的动作。
```

**<week_snapshot>（精简、带标签、压轴前的数据块）**
```
<week_snapshot readonly="true">   <!-- 时点快照；改动后用 get_snapshot 刷新 -->
weekOf=2026-06-22 (周一)  today=2026-06-24 周三
goals:
- [g_x1] 登录联调  active  60%  (3/5 done)
- [g_x2] 写设计文档 active  0%   (0/2 done)
todayFocus: 登录联调
</week_snapshot>
```
（统一用 XML 定界、与既有 `<available_skills>` 一致，加 `readonly` 标签——[F1][F2]。轻量摘要 helper 列为**可选**（§6 P2）：**P0 基线只做「把现有 JSON 包进 `<week_snapshot readonly>` 标签块」**，零新代码即拿到定界+只读语义的主要收益；树通常很小，是否值得专门 summarizer 走决策点 5。）

---

## 4. 工具定义规范

### 4.1 重写 rubric（每个工具）

1. **`description` = WHEN + WHAT + 兄弟边界**，1–2 句、动作开头、折入一条关键 caveat；「写给初级工程师看的 docstring」质量（[C1]）。
2. **显式消歧易混簇**：在描述里点名「用本工具 vs 该用哪个兄弟工具」（[C2]）。
3. **`.describe()` = 格式 + 具体示例**，不复述描述；id 钉来源、日期钉锚点（[D1][D2]）。
4. **软 error 可自救**：`{error}` 带下一步提示（找不到→glob/list_dir；edit 非唯一→先 read；skill 缺→核对已启用）（[C6]）。
5. **截断标记可执行**：把 `truncated:true` 升级成带 next-step 的 `note`（[D5]）。
6. **全部英文**（模型面）；**`ctx.trace.push({summary})` 与 surfaced `{error}` 文案保持中文**（用户面）。

> **可逆性闸门只写一次**：高后果/不可逆动作的「不确定就确认」规则归 prompt 的 Safety 段集中表述，**不在 ~10 个工具描述里重复**。工具描述里只保留**工具本地**信息——即「与兄弟工具的边界」。把 confirm/阈值条款抄进每个 read/write 工具，正是本方案要消除的 context 污染。

### 4.2 BEFORE → AFTER 示例（真实 Workmate 工具）

**`find_goal`**（`tools.ts:77-94`）— 加 WHEN/边界/provenance
```
- BEFORE description: '按关键词查找当前周目标，用于归因前定位。返回每个目标的待办清单（含 taskId），便于据此 complete_task。返回空数组时应反问用户。'
+ AFTER  description: 'Look up current-week goals by keyword before attributing progress.
    Returns matching goals with their task lists and taskIds — use those taskIds for
    complete_task. For the full current-week tree (not a keyword search) use get_snapshot;
    if it returns no match, ask the user which goal to attribute to.'
- BEFORE param: query: z.string().min(1).describe('查询关键词')
+ AFTER  param: query: z.string().min(1).describe('Keyword matched against goal titles, e.g. 登录联调')
```

**`write_reminder`**（`tools.ts:117-120`）— 去人设、加幂等边界、id provenance
```
- BEFORE description: '把某个待办写入 macOS「提醒事项」（幂等）。失败不抛错，返回 error 让你口头引导授权。'
+ AFTER  description: 'Write a task into macOS Reminders. Idempotent: a task that already has a
    reminderId is not written again. Use when a task has a time or clearly warrants a system
    reminder. On failure returns { error, needsPermission } instead of throwing.'
- BEFORE param: taskId: z.string().describe('待办 id')
+ AFTER  param: taskId: z.string().describe('Task id, e.g. t_a1b2 — the exact id returned by find_goal/get_snapshot; never invent one.')
```
（人设/口头引导回到 prompt；surfaced 的权限引导文案仍中文，放进 `{error}` 的 message。）

**`bash`**（`bash.ts`）— 让位结构化工具 + 加 verify（可逆性闸门归 Safety、不在此重复）
```
- BEFORE: '适合：文件操作、git、npx/pnpm、运行脚本、预览产物等。'
+ AFTER:  'Run a shell command in the workspace (full permissions, no sandbox; default cwd =
    workspace root). Good for: running commands, builds, git, npx/pnpm, scripts, previewing
    artifacts. For reading/searching/editing files, prefer the dedicated tools
    (read_file/glob/grep/edit_file) — they return structured, capped output. After running,
    check exitCode/timedOut before reporting done — non-zero or timeout means it failed.'
```

**`skill`**（`tools.ts:165-169`）— WHEN + 「执行前先加载」+ 仅已启用
```
+ AFTER: 'Load an enabled skill\'s full SKILL.md body and its local file references so you can
   follow it. Use when the task matches a skill\'s description in <available_skills> — load it
   BEFORE using file/bash/web tools to execute. Only enabled skills load; if it returns { error },
   the skill is missing or disabled — check the <available_skills> list.'
- param: name: z.string().min(1).describe('Skill name in kebab-case, matching a <name> in the injected <available_skills> list; do not invent one.')
```

### 4.3 其余工具速查（同一 rubric）

- **`log_event`**：描述加「does NOT advance the bar — to move progress use complete_task」。
  > enum 不动：保留 `['note','progress_update','goal_created','task_done']`。原稿提议收窄为 `['note','progress_update']` 属无收益的类型收紧——`goal_created`/`task_done` 由 store 自动落、不是经 `log_event` 写入，移除不解决任何真实双写；且会牵动 `shared/types.ts` 的 `ProgressEvent` kind 联合与 `report.ts:74` 的过滤，协调成本大于价值。
- **`complete_goal`**：加「bulk-completes every task & sets 100%, hard to undo; for a single task use complete_task」（边界，非阈值散文）。
- **`write_file` vs `edit_file`**：互相点名（整文件/新建 → write_file；唯一片段替换 → edit_file；跑命令 → bash）。
- **`read_file`/`list_dir`/`glob`/`grep`**：加 WHEN + 兄弟边界；路径统一钉「relative to workspace root (NOT bash's cwd) or absolute」（[D4]）；`grep.pattern` 改「JS RegExp source, e.g. `function\\s+\\w+`」纠正「正则或字符串」误导（grep 只走 `new RegExp`）；截断 `note` 升级为可执行（read_file→「pass offset/limit to read more」，list_dir/glob→「narrow path/pattern」）（[D5]）。
- **`web_fetch` vs `web_search`**：互相点名（有 URL→fetch；先找 URL→search）；空结果自描述（search 带 note 区分「无结果 vs 失败」）（[D5]）。
- **`due`/`weekOf`**：`due`→「ISO-8601 with tz, e.g. 2026-06-27T18:00:00+08:00」；`weekOf`→「Monday-anchored ISO date, e.g. 2026-06-22; must be a Monday; omit for current week」（[D1][D2]，硬约束#4）。

> **返回结构不动**：原稿提议把 `complete_task` 返回升级为 `{taskId,title,goalProgress}`、`create_goal`/`add_task` 加 `title`。**删除**——这是改 **return 契约**（`complete_task` 现返回 `{taskId}`，`tools.ts:55-61`/`store.ts:255`），会动 `tools.test.ts` 断言与调用方，直接打脸 §6 的「返回结构不变 → tool.execute 断言不受影响」承诺；省一次回查纯属 gold-plating，违反最小化。本期只改文案、不改任何 return shape。

---

## 5. 通用性与可移植性

- **通用优先身份 + 一等能力面**（§3.3）：执行工具不再藏在技能条件块；新增常驻 Capabilities 段，技能保持 lazy 索引但执行工具面不依赖技能启用（[A1][F5]，预算权衡见 §3.2 决策框）。
- **行为写进 prompt、不依赖 API 旋钮**：`reasoning_effort`/`verbosity`/`temperature` 仅作可选旋钮放在模型构建层（支持才用），**绝不依赖它们保证正确性**；prompt 不含任何 provider 专属措辞（"as GPT-5 you must…"）。当前 prompt 已无 provider 措辞——保持（[E1]）。
- **通用启发式取代规定脚本**：「挑最小够用动作并提交」胜过手写 N 步计划；不押注任一模型族技巧（Claude 专属 adaptive-thinking/prefill、某族 tuning 咒语）（[E3]）。
- **eagerness 作为强模型类属性、按任务形状编码进 prompt**：轻量归因软化「彻底性」、上限 self-lookup 防过度调用；开放任务强调持续到解决。**不绑定任何轮次预算**（代码只有单一 `MAX_TURNS=30`，无 8 轮档，见 §2.4）。`[C4][Gem3]` 佐证其为强模型类通病，故可移植（tension #5）。
- **指令强度去胁迫化**：`务必/重要/绝不/别` 等强强调**仅保留给真·安全/不可逆不变量**（不编进度%、幂等提醒、weekOf=周一、不拼脚本串）；删掉 "If in doubt, use [tool]"/"Default to using [tool]"——强模型上反而触发过度调用（[H3]）。
- **绝对命令换逃生口**：硬约束#3 在 prompt 散文里从「每次都必须 log_event」改为「有真实进展才落事件；信息不足以确定归属就先问，别为凑事件臆造」——保留「events 是周报唯一原料」不变量、去掉「always」失败模式（[H4]，tension #3）。
- **grounding/反 sycophancy 通用化措辞**（「用户的主张/计划/请求」，非 goal-attribution-specific），一条覆盖 goal + skill/file/bash/web，且经得起换模型（[E4]）。

> **周报数据通道的真相（硬约束#3）**：执行产出（HTML/文档/调研）**不落事件**，故周报读不到。光改 REPORT_SYSTEM 散文无法叙述它（无素材）。本期**不**违反 #3，处理为二选一：(a)**默认**——周报只覆盖已记录的工作；REPORT_SYSTEM 只去掉「四段全围绕目标」的过拟合表述，使其在 goals/events 范围内更通用，**不承诺叙述未记录产出**。(b)**可选、需用户拍板**（决策点 6）——新增一条「执行产出落事件」通道（如 bash/write_file 成功后由 agent 经 `log_event` 记一笔、或 store 侧加 artifact 事件），那才是能让周报看见执行产出的**真实设计改动**，非 prompt tweak。

---

## 6. 分阶段执行清单

> 总原则：每改一处 `npm run build` + 跑相关单测（L0/L1/L2 分级）。改 prompt/工具文案时，**同步更新断言文案的测试**（见下）。

### P0 — 通用化与可移植性主干（必须）

- [ ] **`prompt.ts`** 按 §3.2 骨架重写 `buildSystemPrompt`：通用身份 → Capabilities(常驻，含执行工具面) → 人设(搭子温暖 + 一条对冲) → 回路(通用回路 + 启发式 + 任务形状 eagerness + 并行 carve-out + 自救) → 约束 → Skills(lazy) → `<week_snapshot>` 带标签块 → 末尾压轴中文+不编造。删去重复的进度不变量与 per-tool 机制；**主体保持中文**。
- [ ] **`prompt.ts`** 快照：裸 `JSON.stringify` → 包进 `<week_snapshot readonly>` 标签块（P0 基线即此，零新代码）。
- [ ] **全部工具定义英文化 + rubric 重写**（§4）：`tools.ts`、`tools/fs.ts`、`tools/bash.ts`、`tools/web.ts` 每条 `description` 与 `.describe()`。**保持 `ctx.trace.push({summary})` 与 surfaced `{error}` 文案为中文**。
- [ ] **逐工具落 §4.2/§4.3**：消歧、id provenance、日期锚点、grep 描述纠正、bash 让位+verify、skill「先加载」。**不改 enum、不改 return shape、可逆性闸门只在 Safety 写一次。**

### P1 — 降级与诚实硬化 + 修过期 docstring（强烈建议）

- [ ] **`prompt.ts`** 自救段已含通用软失败处理（P0 内）；确认覆盖 skill/edit/read/grep/search/bash。
- [ ] **截断 `note` 可执行化**：`fs.ts` read_file/list_dir/glob、`bash.ts` clamp 文案加 next-step。
- [ ] **软 error 自救提示**：`fs.ts` edit 非唯一→「read first to disambiguate」、not-found→「glob/list_dir」；`tools.ts` skill→「check enabled skills」；`fs.ts` grep 非法正则→给合法示例。
- [ ] **`report.ts`** REPORT_SYSTEM 去 goal-tree 过拟合：四段中文契约保留，但表述在 goals/events 范围内更中性（不假定每段都围绕目标）。**默认不承诺叙述未落事件的执行产出**（数据通道真相见 §5；通道改造属决策点 6）。
- [ ] **修过期 docstring（grounding 修复）**：`orchestrator.ts:2`（「maxTurns:8」）与 `docs/reference/agent-runtime.md:79-80` 改为反映真实 `MAX_TURNS=30`。否则下一个读者继承「8/30 两档」假前提。

### P2 — 加分（时间紧可缓）

- [ ] **few-shot `<examples>`**：3–5 个中文回合形状（目标录入 / 进展归因 / 模糊反问 / 一个执行任务「帮我做个落地页」/ 闲聊，含一个「用户提糟糕计划、搭子先讲实话再安抚」演示对冲）。用占位内容防 parrot；借此 DELETE 行为准则散文（[B9][F4]）。
- [ ] **可选 `summarizeSnapshot` helper**：把 `<week_snapshot>` 内容从全量 JSON 换成轻量摘要（title+id+progress+status、todayFocus）。仅当评审认为值得（决策点 5）才做；否则停在 P0 的「JSON 包标签块」。
- [ ] **执行产出事件通道**（决策点 6，若采纳）：让周报能看见 HTML/文档/调研产出——bash/write_file 成功后落一条事件，或 store 侧加 artifact 事件。**真实设计改动**，需 `report.ts` 材料通道 + 测试配套。
- [ ] **`report.ts` 降级可见性**：`generate` 返回 `{markdown, degraded?}`，让 agent 如实标「离线兜底版」（需顺带改 `tools.ts:generate_report` 返回与调用方）。
- [ ] **`orchestrator.ts`** 接近上限的 wrap-up：prompt 内加「接近做不完先收尾说清还差什么」；保留 `MAX_TURNS_FALLBACK` 死字符串为最后兜底。
- [ ] **可选**：`weekOf` 周一 regex 校验；same-tool+same-args doom-loop dedup（agent-runtime 已记为可选）。

### 保持不动

- defineTool 软失败约定与 `{error}` 机制；进度派生（无 set-percentage 工具）；osascript execFile 传参防注入；reminderId 幂等；REPORT_SYSTEM 中文输出 + 四段契约；workspace 锚定/允许绝对路径的「开放最大权限」取向；**所有工具 return shape 与 `log_event` enum**。

### 测试如何保持绿

- 受影响测试：`app/test/{agent-loop,report,store,tools,tool-logger}.test.ts`。
- **工具行为/返回结构不变（仅描述与 `.describe` 文案变）**，按 `tool.execute` 直测的断言**不受影响**；若有断言匹配中文 `description` 字符串，改成英文新文案或断言结构。
- `report.ts` 本期**不改**确定性路径逻辑（§2.5 更正：highlights/blockers 非 bug），故 `report.test.ts` 快照不动；仅 REPORT_SYSTEM 散文若被测试断言子串则同步更新。
- 模型用 `MockLanguageModelV3` 直测 → prompt 文案变更不破坏 agent-loop 逻辑；若测试断言了旧 prompt 子串，同步更新。
- 若动 `<available_skills>` 块格式（XML 一致性），**`skills/index.ts:153-160` 的 `getAvailableSkillsPrompt` 生产者及其测试一并改**。本期默认不改其格式（已是 XML）。
- **回归红线**：grep 全工程，确认无**用户可见**字符串（chat/ToolHint/surfaced error/REPORT_SYSTEM 输出）被误译成英文（tension #2）。

---

## 7. 开放决策点（请用户拍板）

1. **语言策略**：采「工具全英文 + prompt 主体中文 + 用户面中文」（推荐，§3.1）。若仍想 prompt 主体也英文，需接受可读性/回归代价——本方案建议否。
2. **goal-tree 去重程度**：目标管理降为「诸能力之一」到何种程度？是否保留「优先把口语同步归因到目标」的轻微倾向（产品核心仍是周目标闭环），还是完全平权？
3. **persona 对冲刻度**：搭子温暖 register 显式保留、emoji 维持「适度可用」、对冲仅限「明显有错」时——这个刻度是否符合品牌预期？（本方案刻意**不**把它冷化成纠错器。）
4. **few-shot 示例（P2）**：是否加 3–5 回合 `<examples>`？增 token 但能 DELETE 散文规则、最可靠地钉住「暖而诚实」register。
5. **快照注入**：P0 已把全量 JSON 包进 `<week_snapshot readonly>` 标签块。是否进一步要 P2 的轻量摘要 `summarizeSnapshot`，还是标签块够用（树通常很小）？
6. **执行产出进周报（P2）**：是否值得新增「执行产出落事件」通道，让周报能叙述 HTML/文档/调研产出？这是真实设计改动（非 prompt tweak），涉及 `report.ts` 材料通道 + 可能的 `generate_report` 返回签名。不做则周报只覆盖已记录的工作。
