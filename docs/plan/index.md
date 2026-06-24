# plan — 执行清单

> 这里是面向"一次性 goal 模式实现"的工作区。实现完成、稳定事实回写到 design/reference 后，过程性内容可精简或删除。

- [milestones.md](./milestones.md) — 8 个里程碑、验收标准、测试映射（先闭环后加分）
- [task-breakdown.md](./task-breakdown.md) — 有序、可执行、带 DoD 的任务清单（goal 模式逐条推进）
- [skills-integration.md](./skills-integration.md) — Skills（技能）集成方案，**待审核**：最小本地闭环 + agent skill 工具 + 设置页管理

## 执行总原则

1. **先闭环、后加分**：里程碑 1–6（脚手架 → Store → Provider → Agent → UI → 周报）是必须跑通的最小闭环，周报是 demo 高潮；7–8（提醒事项、主动推送）在闭环稳定后接，时间紧可最后让步。
2. **每改一处就验证**：`npm run build` + 跑相关单测（见 `engineering-standards.md` 的 L0/L1/L2 分级）。
3. **遇到文档未覆盖的细节**：按既定原则自行合理决策并就地记录，不反复确认。
