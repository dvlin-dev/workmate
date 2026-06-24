# 安全策略

如发现安全问题，请**私下**上报，不要在公开 issue 里披露细节，给修复留出时间：

- 在 GitHub 仓库 **Security → Report a vulnerability**（Private vulnerability reporting）提交，或邮件联系维护者。
- 请勿在 issue / PR / 截图里粘贴你的真实 `apiKey` 或任何密钥。

## 设计上的安全边界

- 单机本地应用：`apiKey` 只存在本机 `userData`，绝不上传。
- 渲染进程沙箱化：`contextIsolation` + `sandbox` + 无 `nodeIntegration`；外链一律走系统浏览器。
- 提醒事项 osascript 用 `execFile` argv 传参，绝不拼接用户文本（防注入）。
- 打包构建注入 CSP；不加载任何远程脚本。
