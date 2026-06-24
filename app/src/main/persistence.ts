/**
 * 运行时持久化：用 electron-store 把 WorkmateData 落到 userData 下单个 JSON（原子写）。
 * 仅在主进程运行时使用；单测直接构造 WorkmateStore 注入内存数据，不经此文件。
 */

import Store from 'electron-store';
import { WorkmateDataSchema } from '@shared/schema';
import { createEmptyData, WorkmateStore, type WorkmateData } from './store';

/** 创建 electron-store 支撑的 WorkmateStore 单例 */
export function createWorkmateStore(): WorkmateStore {
  const backing = new Store<WorkmateData>({
    name: 'workmate-data',
    defaults: createEmptyData(),
    // SyntaxError（坏 JSON）直接重置；语义损坏由下方 zod 兜底
    clearInvalidConfig: true,
  });

  // 语义校验：结构损坏（如 weeks 非数组、字段缺失）→ 重置；正常 → 用规整后的数据（补默认、剥未知键）
  const parsed = WorkmateDataSchema.safeParse(backing.store);
  const initial: WorkmateData = parsed.success ? (parsed.data as WorkmateData) : createEmptyData();
  backing.store = initial;

  return new WorkmateStore({
    initial,
    persist: (data) => {
      backing.store = data;
    },
  });
}
