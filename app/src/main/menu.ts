/**
 * 应用菜单。macOS 上必须显式提供 Edit 菜单（含 roles），否则输入框里的 ⌘C/⌘V/⌘A/⌘Z 不生效。
 */

import { app, Menu, type MenuItemConstructorOptions } from 'electron';
import { CH } from '@shared/ipc';
import { broadcastToAllWindows } from './ipc/shared';

type AppMenuOptions = {
  checkForUpdates?: () => void;
};

export function buildAppMenu({ checkForUpdates }: AppMenuOptions = {}): void {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const, label: '关于 Workmate' },
              { type: 'separator' as const },
              {
                label: '设置…',
                accelerator: 'CmdOrCtrl+,',
                click: () => broadcastToAllWindows(CH.menuOpenSettings, undefined),
              },
              {
                label: '检查更新…',
                click: () => checkForUpdates?.(),
              },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const, label: '退出 Workmate' },
            ],
          },
        ]
      : []),
    {
      label: '编辑',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },
    { role: 'windowMenu' },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
