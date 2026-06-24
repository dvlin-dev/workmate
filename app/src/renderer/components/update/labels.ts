import type { AppUpdateState } from '@shared/ipc';

/** 把更新状态机映射成一句中文状态文案（设置区与侧边卡片共用） */
export function updateStatusLabel(state: AppUpdateState | null): string {
  if (!state) return '加载中…';
  switch (state.status) {
    case 'unsupported':
      return '开发构建不检查更新（打包后生效）';
    case 'checking':
      return '正在检查更新…';
    case 'available':
      return `发现新版本${state.availableVersion ? ` v${state.availableVersion}` : ''}，准备下载…`;
    case 'downloading':
      return `下载中${state.progressPercent != null ? ` ${Math.round(state.progressPercent)}%` : '…'}`;
    case 'downloaded':
      return `新版本${state.downloadedVersion ? ` v${state.downloadedVersion}` : ''}已就绪，重启即可安装`;
    case 'restarting':
      return '正在重启安装…';
    case 'error':
      return state.errorMessage || '更新失败，请稍后再试';
    case 'idle':
    default:
      return state.lastCheckedAt ? '已是最新版本' : '尚未检查更新';
  }
}
