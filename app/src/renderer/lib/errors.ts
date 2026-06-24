import { ApiError } from './api';

/** 把一轮对话失败映射成给用户看的中文文案。从聊天状态机里分出来，纯函数、可单测。 */
export function chatErrorText(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'LLM_TIMEOUT':
        return '搭子有点忙（响应超时），稍后再试～';
      case 'CONFIG_REQUIRED':
        return '请先在「设置」里填写 apiKey，再发送消息。';
      case 'LLM_ERROR':
        return 'LLM 暂时不可用，去「设置」检查 baseURL / apiKey / model。';
    }
  }
  return `出错了：${error instanceof Error ? error.message : '未知错误'}`;
}
