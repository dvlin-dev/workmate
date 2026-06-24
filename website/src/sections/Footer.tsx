import { GITHUB_URL, ONEAPI_TOKEN_URL } from '../lib/site';

export function Footer() {
  return (
    <footer className="border-t border-border-muted px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
        <span>© Workmate · 工作搭子 — 开源 macOS 工作搭子</span>
        <nav className="flex items-center gap-5">
          <a className="hover:text-foreground" href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a className="hover:text-foreground" href={ONEAPI_TOKEN_URL} target="_blank" rel="noreferrer">
            获取 OneAPI Token
          </a>
        </nav>
      </div>
    </footer>
  );
}
