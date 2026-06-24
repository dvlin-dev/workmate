/**
 * 演示案例数据（脱敏 · 软件工程师的一周「订单服务 v2 重构」）。
 * 忠实于 docs/demo-script.md 与桌面端数据模型（Goal{status,progress,tasks}）、
 * 周报四段式（docs/reference/prompts.md）。官网演示版块只读这份静态数据，不接后端。
 */

export interface DemoTask {
  title: string;
  done: boolean;
  /** 带日期的待办会单向写入 macOS「提醒事项」 */
  due?: string;
  reminder?: boolean;
}

export interface DemoGoal {
  title: string;
  status: 'active' | 'done';
  progress: number;
  tasks: DemoTask[];
}

/** 周三（今天 6/24）时的看板快照——由一周的自然语言录入累积而成。 */
export const DEMO_GOALS: DemoGoal[] = [
  {
    title: '订单服务 v2 重构',
    status: 'active',
    progress: 62,
    tasks: [
      { title: '读旧订单服务代码、理清依赖', done: true },
      { title: '拆订单 / 库存强耦合（接口隔离）', done: true },
      { title: 'v2 核心链路补单测到 70%', done: false },
      { title: '完成 v2 重构的 code review', done: false, due: '6/25', reminder: true },
      { title: '灰度上线 10% 流量', done: false, due: '6/27', reminder: true },
    ],
  },
  {
    title: '修复线上问题',
    status: 'active',
    progress: 33,
    tasks: [
      { title: '修复下单偶尔超时（连接池未释放）', done: true },
      { title: '修复导出乱码', done: false, due: '6/25', reminder: true },
      { title: '修复列表分页错位', done: false, due: '6/25', reminder: true },
    ],
  },
  {
    title: '接入监控告警',
    status: 'active',
    progress: 25,
    tasks: [
      { title: '埋点：下单成功率、P99 延迟（Prometheus）', done: true },
      { title: '配置告警规则', done: false },
      { title: '全量上线并接入监控告警', done: false, due: '6/30', reminder: true },
    ],
  },
];

export interface DemoTurn {
  role: 'user' | 'mate';
  text: string;
  /** 搭子这一轮调用的工具（行内小提示，体现"真的在落事件"） */
  tool?: string;
  /** 周几标签，只在用户消息上显示 */
  day?: string;
}

/** 左栏对话流——从周一建盘到周五出周报，全程只是"说话"。 */
export const DEMO_CHAT: DemoTurn[] = [
  {
    role: 'user',
    day: '周一',
    text: '这周的安排同步给你：6/25 完成订单服务 v2 重构的 code review、6/27 灰度上线 10% 流量、6/30 全量上线并接入监控告警；todo 是读旧代码理清依赖、拆开订单和库存的强耦合、给核心链路补单测到 70%、修掉用户反馈的 3 个线上问题、接入 Prometheus 指标+告警。',
  },
  {
    role: 'mate',
    text: '收到，给你建好 3 个目标了：订单服务 v2 重构、修复线上问题、接入监控告警 👍 带日期的几条已经写进「提醒事项」，到点会提醒你。这周节奏挺满，开干吧。',
    tool: 'create_goal ×3 · write_reminder（6/25 · 6/27 · 6/30）',
  },
  {
    role: 'user',
    day: '周一晚',
    text: '今天把旧订单服务代码过了一遍，依赖关系基本理清楚了，下单链路里耦合最重的是库存校验那块。',
  },
  {
    role: 'mate',
    text: '搞定，把「读代码理清依赖」标完成，订单服务 v2 重构推进到 25% 了。库存校验那块我先记下来，拆耦合时重点照顾它。',
    tool: 'complete_task · update_progress 订单服务 v2 → 25%',
  },
  {
    role: 'user',
    day: '周二',
    text: '线上那个下单偶尔超时的问题定位到了，是数据库连接池没正确释放，已经提了个 fix 等审。',
  },
  {
    role: 'mate',
    text: '归到「修复线上问题」了，超时 bug 标为已修复待合并，这个目标到 33%。还差导出乱码和分页错位两个，要不要也排一下时间？',
    tool: 'find_goal · update_progress 修复线上问题 → 33%',
  },
  {
    role: 'user',
    text: '排吧，导出乱码和分页错位都放到明天集中弄。',
  },
  {
    role: 'mate',
    text: '好，两条都排到 6/25、写进「提醒事项」了 ✅ 明天集中清掉。',
    tool: 'write_reminder（导出乱码 · 分页错位 → 6/25）',
  },
  {
    role: 'user',
    day: '周三',
    text: 'v2 的单元测试补了一半，核心下单和退款链路覆盖到 60% 了，还差优惠券那条分支。',
  },
  {
    role: 'mate',
    text: '更新好啦，补单测推进到 60%，订单服务 v2 重构整体到 62%。优惠券那条分支我挂成待办，免得你漏。',
    tool: 'update_progress 订单服务 v2 → 62%',
  },
  {
    role: 'user',
    day: '周五',
    text: '帮我生成一下这周的周报。',
  },
  {
    role: 'mate',
    text: '这就来 📝 把这周你说过的每条进展都翻了一遍，四段式周报写好了，可以直接复制发出去。',
    tool: 'generate_report',
  },
];

export interface DemoReportSection {
  heading: string;
  items: string[];
}

/** 一键生成的四段式叙事周报（忠实 prompts.md 的结构）。 */
export const DEMO_REPORT = {
  range: '6/22 ~ 6/28',
  sections: [
    {
      heading: '本周完成',
      items: [
        '通读旧订单服务代码、理清依赖，定位下单链路里库存校验耦合最重。',
        '完成订单与库存的强耦合拆分，库存侧先用接口 mock 隔离。',
        '定位并修复下单偶发超时（连接池未正确释放），fix 已提审。',
      ],
    },
    {
      heading: '进展亮点',
      items: [
        '订单服务 v2 重构整体推进至约 62%，核心下单 / 退款链路单测覆盖到 60%。',
        '监控起步：已埋下单成功率与 P99 延迟两个 Prometheus 指标。',
      ],
    },
    {
      heading: '风险与卡点',
      items: [
        'v2 仍差优惠券分支单测与 code review（6/25），灰度上线（6/27）时间偏紧。',
        '告警规则尚未配置；导出乱码、列表分页错位两个用户反馈问题待处理。',
      ],
    },
    {
      heading: '下周计划',
      items: [
        '完成 code review 并按时灰度 10% 流量，补齐优惠券分支单测至 70%。',
        '配置告警规则、推进 6/30 全量上线，集中处理两个遗留线上问题。',
      ],
    },
  ] satisfies DemoReportSection[],
};
