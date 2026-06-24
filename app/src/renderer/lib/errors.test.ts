import { describe, it, expect } from 'vitest';
import { ApiError } from './api';
import { chatErrorText } from './errors';

describe('chatErrorText', () => {
  it('按 ApiError code 映射中文文案', () => {
    expect(chatErrorText(new ApiError('LLM_TIMEOUT', 'x'))).toContain('响应超时');
    expect(chatErrorText(new ApiError('CONFIG_REQUIRED', 'x'))).toContain('apiKey');
    expect(chatErrorText(new ApiError('LLM_ERROR', 'x'))).toContain('LLM 暂时不可用');
  });

  it('未知 ApiError code / 普通 Error 走兜底', () => {
    expect(chatErrorText(new ApiError('NOT_FOUND', 'x'))).toContain('出错了');
    expect(chatErrorText(new Error('boom'))).toBe('出错了：boom');
    expect(chatErrorText('weird')).toContain('未知错误');
  });
});
