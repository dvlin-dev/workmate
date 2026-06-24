import { DOWNLOAD_URL, GITHUB_URL } from '../lib/site';

type FooterLink = { label: string; href: string; external?: boolean };

const GROUPS: { title: string; links: FooterLink[] }[] = [
  {
    title: '产品',
    links: [
      { label: '看演示', href: '#demo' },
      { label: '怎么用', href: '#how' },
      { label: '能力', href: '#features' },
      { label: '下载 macOS App', href: DOWNLOAD_URL, external: true },
    ],
  },
  {
    title: '开源',
    links: [
      { label: 'GitHub 仓库', href: GITHUB_URL, external: true },
      { label: '问题反馈', href: `${GITHUB_URL}/issues`, external: true },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border-muted bg-card px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* 品牌 */}
          <div className="col-span-2 space-y-3 md:col-span-2">
            <a href="#top" className="flex items-center gap-2 font-semibold">
              <span className="flex size-7 items-center justify-center rounded-[10px] bg-gradient-to-br from-brand to-brand-light text-sm font-bold text-white">
                W
              </span>
              <span className="tracking-tight">Workmate · 工作搭子</span>
            </a>
            <p className="max-w-xs text-sm leading-relaxed text-tertiary">
              用说话维护周目标、一键生成周报的 macOS 工作搭子。你说话，它替你把一周写成周报。
            </p>
          </div>

          {GROUPS.map((group) => (
            <div key={group.title} className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">{group.title}</h3>
              <ul className="space-y-2">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-tertiary transition-colors hover:text-foreground"
                      {...(link.external ? { target: '_blank', rel: 'noreferrer' } : {})}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border-muted pt-6 text-sm text-tertiary sm:flex-row">
          <span>© {new Date().getFullYear()} Workmate · 工作搭子</span>
          <span>开源 · 仅 macOS · 数据全部本地</span>
        </div>
      </div>
    </footer>
  );
}
