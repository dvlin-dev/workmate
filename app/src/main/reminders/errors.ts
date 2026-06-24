/** 提醒事项授权被拒错误（bridge 抛出，tool / IPC 捕获后口头引导用户去系统设置授权）。 */
export class ReminderPermissionError extends Error {
  readonly code = 'REMINDER_PERMISSION_DENIED' as const;
  constructor(message = '提醒事项授权被拒绝') {
    super(message);
    this.name = 'ReminderPermissionError';
  }
}
