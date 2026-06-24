/**
 * 站点级常量。**发布前必须把 GITHUB_URL 改成实际仓库地址**（否则 CTA 指向占位仓库会 404）。
 * DOWNLOAD_URL 指向 releases 列表页（无产物时是空列表而非 404）；有产物后可改为 /releases/latest。
 */
export const GITHUB_URL = 'https://github.com/your-org/workmate';
export const DOWNLOAD_URL = `${GITHUB_URL}/releases`;
export const ONEAPI_TOKEN_URL = 'https://oneapi-comate.baidu-int.com/token';
