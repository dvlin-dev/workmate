// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '@shared/config';
import { useConfigStore } from '../../store/useConfigStore';
import { useChatStore } from '../../store/useChatStore';
import { ChatPanel } from './ChatPanel';

describe('ChatPanel', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    Element.prototype.scrollTo = vi.fn();
    useConfigStore.setState({ config: DEFAULT_CONFIG, loaded: true });
    useChatStore.setState({ messages: [], sending: false, activeId: null });
  });

  it('未配置 apiKey 时点击发送会打开设置引导，不创建对话消息', () => {
    const onRequireConfig = vi.fn();

    render(<ChatPanel onRequireConfig={onRequireConfig} />);

    fireEvent.change(screen.getByLabelText('输入消息'), {
      target: { value: '这周要做完登录联调' },
    });
    fireEvent.click(screen.getByLabelText('发送'));

    expect(onRequireConfig).toHaveBeenCalledTimes(1);
    expect(useChatStore.getState().messages).toHaveLength(0);
  });
});
