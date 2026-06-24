/**
 * 执行工具 · web（web_fetch / web_search）。
 * web_fetch：取网页转纯文本（截断）。web_search：DuckDuckGo 轻量 HTML 端点，无需 key；失败降级返回空。
 */

import { tool, type RunContext, type Tool } from '@openai/agents-core';
import { z } from 'zod';
import type { AgentContext } from '../context';

const FETCH_TIMEOUT = 15_000;
const MAX_TEXT = 20_000;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'workmate-agent' },
    });
  } finally {
    clearTimeout(timer);
  }
}

const webFetchTool = tool({
  name: 'web_fetch',
  description: '抓取一个网页 URL，返回其纯文本内容（已去标签、截断）。',
  parameters: z.object({ url: z.string().url().describe('http(s) URL') }),
  execute: async ({ url }, rc?: RunContext<AgentContext>) => {
    try {
      const res = await fetchWithTimeout(url, FETCH_TIMEOUT);
      if (!res.ok) return { url, error: `HTTP ${res.status}` };
      const html = await res.text();
      rc?.context?.trace.push({ tool: 'web_fetch', summary: `抓取 ${url}` });
      return { url, text: stripHtml(html).slice(0, MAX_TEXT) };
    } catch (e) {
      return { url, error: e instanceof Error ? e.message : '抓取失败' };
    }
  },
});

const webSearchTool = tool({
  name: 'web_search',
  description: '联网搜索关键词，返回标题+链接列表（轻量，无需 key）。',
  parameters: z.object({ query: z.string().min(1).describe('搜索词') }),
  execute: async ({ query }, rc?: RunContext<AgentContext>) => {
    try {
      const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await fetchWithTimeout(url, FETCH_TIMEOUT);
      if (!res.ok) return { query, results: [], note: `搜索不可用：HTTP ${res.status}` };
      const html = await res.text();
      const results: { title: string; url: string }[] = [];
      const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) && results.length < 10) {
        results.push({ url: m[1]!, title: stripHtml(m[2]!) });
      }
      rc?.context?.trace.push({ tool: 'web_search', summary: `搜索「${query}」` });
      return { query, results };
    } catch (e) {
      return { query, results: [], note: e instanceof Error ? e.message : '搜索失败' };
    }
  },
});

export function createWebTools(): Tool<AgentContext>[] {
  return [webFetchTool, webSearchTool];
}
