import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../../lib/utils';

/** 轻量 markdown 渲染：服务搭子回复与周报。组件覆盖样式，不依赖 typography 插件。 */
const components: Components = {
  h1: ({ children }) => <h1 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h1>,
  h2: ({ children }) => (
    <h2 className="mb-1.5 mt-3 text-[0.95rem] font-semibold text-foreground first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => <h3 className="mb-1 mt-2.5 text-sm font-semibold first:mt-0">{children}</h3>,
  p: ({ children }) => <p className="my-2 leading-relaxed first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-2 ml-1 list-none space-y-1 first:mt-0 last:mb-0">{children}</ul>,
  ol: ({ children }) => (
    <ol className="my-2 ml-5 list-decimal space-y-1 first:mt-0 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="relative pl-4 leading-relaxed before:absolute before:left-0 before:top-[0.6em] before:size-1 before:rounded-full before:bg-muted-foreground/50 [ol_&]:pl-1 [ol_&]:before:hidden">
      {children}
    </li>
  ),
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ children, href }) => (
    <a
      href={href}
      className="font-medium text-brand underline decoration-brand/40 underline-offset-2 hover:decoration-brand"
      target="_blank"
      rel="noreferrer noopener"
    >
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className ?? '');
    if (isBlock) {
      return <code className="font-mono text-[0.8rem] leading-relaxed">{children}</code>;
    }
    return (
      <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.82em] text-foreground">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg border border-border-muted bg-muted/50 p-3">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-brand/40 pl-3 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border-muted" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-border-muted">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-border-muted bg-muted/50 px-2.5 py-1.5 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border-b border-border-muted/60 px-2.5 py-1.5">{children}</td>,
};

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('min-w-0 max-w-full break-words text-sm text-foreground', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
