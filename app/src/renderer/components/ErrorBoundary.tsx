import { Component, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** 渲染层错误边界：任一组件抛错时给出友好兜底，而不是整屏白屏 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[renderer] uncaught error', error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center text-foreground">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-2xl">😵</div>
        <div className="space-y-1">
          <p className="text-base font-semibold">界面出了点问题</p>
          <p className="max-w-md text-sm text-muted-foreground">
            渲染遇到异常。重载窗口通常能恢复；你的数据已安全保存在本地。
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => location.reload()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            重载窗口
          </button>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(`${error.message}\n${error.stack ?? ''}`)}
            className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-accent"
          >
            复制错误信息
          </button>
        </div>
        <pre className="max-h-32 max-w-md overflow-auto rounded-lg bg-muted p-3 text-left text-xs text-muted-foreground">
          {error.message}
        </pre>
      </div>
    );
  }
}
