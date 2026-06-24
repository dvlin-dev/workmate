/**
 * 工具执行日志（ToolLogger 的文件实现）：把每次工具调用（成功/失败）以 JSONL 追加到
 * userData/logs/tool-executions.jsonl，本地长期留存以便排查。超过上限滚动一份 .1。
 * 核心实现不依赖 Electron（注入 dir/now，便于单测）；getToolLogger() 负责绑定 userData。
 */

import { app } from 'electron';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import type { ToolLogger, ToolLogRecord } from './context';

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2MB：超过则滚动一份历史
const MAX_FIELD = 2000; // 单字段裁剪，防超长 input/error 撑爆日志文件
const LOG_FILE = 'tool-executions.jsonl';
const ROLLED_FILE = 'tool-executions.1.jsonl';

/** 裁剪超长字段（字符串直接截断；对象序列化后截断） */
function clip(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string') {
    return value.length > MAX_FIELD ? `${value.slice(0, MAX_FIELD)}…` : value;
  }
  try {
    const json = JSON.stringify(value);
    return json.length > MAX_FIELD ? `${json.slice(0, MAX_FIELD)}…` : value;
  } catch {
    return String(value).slice(0, MAX_FIELD);
  }
}

export interface FileToolLoggerOptions {
  /** 日志目录 */
  dir: string;
  /** 滚动阈值（字节） */
  maxBytes?: number;
}

/** 创建文件型 ToolLogger（同步 append；失败静默，绝不影响主流程） */
export function createFileToolLogger(options: FileToolLoggerOptions): ToolLogger {
  const { dir } = options;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const file = path.join(dir, LOG_FILE);

  const ensureDir = () => {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      /* ignore */
    }
  };

  const rollIfNeeded = () => {
    try {
      if (existsSync(file) && statSync(file).size > maxBytes) {
        renameSync(file, path.join(dir, ROLLED_FILE)); // 覆盖旧的历史份
      }
    } catch {
      /* ignore */
    }
  };

  ensureDir();

  return {
    dir,
    record(rec: ToolLogRecord) {
      try {
        rollIfNeeded();
        const line = `${JSON.stringify({
          ...rec,
          input: clip(rec.input),
          error: rec.error ? String(clip(rec.error)) : undefined,
        })}\n`;
        appendFileSync(file, line, 'utf-8');
      } catch {
        /* 日志失败绝不影响主流程 */
      }
    },
    readRecent(limit = 100) {
      try {
        if (!existsSync(file)) return [];
        const lines = readFileSync(file, 'utf-8').split('\n').filter(Boolean);
        return lines
          .slice(-limit)
          .map((l) => JSON.parse(l) as ToolLogRecord)
          .reverse();
      } catch {
        return [];
      }
    },
  };
}

let cached: ToolLogger | null = null;

/** userData/logs 目录（用于"打开日志目录"） */
export function getLogsDir(): string {
  return path.join(app.getPath('userData'), 'logs');
}

/** 运行时单例（绑定 userData/logs）。测试不应调用它，而是注入内存实现。 */
export function getToolLogger(): ToolLogger {
  if (cached) return cached;
  cached = createFileToolLogger({ dir: getLogsDir() });
  return cached;
}
