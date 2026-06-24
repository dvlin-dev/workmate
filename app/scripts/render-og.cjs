// 渲染官网 og 分享卡（1200×630）。用法：./node_modules/.bin/electron scripts/render-og.cjs ../website/public/og-image.png
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');

const OUT = process.argv[2] || '/tmp/og-image.png';

const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:1200px;height:630px;}
  body{position:relative;display:flex;flex-direction:column;justify-content:center;padding:0 90px;
    background:linear-gradient(135deg,#5168DE 0%,#3A4FB8 55%,#2A3795 100%);color:#fff;
    font-family:'Inter',-apple-system,BlinkMacSystemFont,'PingFang SC','Segoe UI',sans-serif;}
  .brand{display:flex;align-items:center;gap:22px;margin-bottom:38px;}
  .tile{width:96px;height:96px;border-radius:24px;background:rgba(255,255,255,.16);
    border:1px solid rgba(255,255,255,.28);display:flex;align-items:center;justify-content:center;
    font-size:60px;font-weight:800;}
  .name{font-size:42px;font-weight:700;}
  .title{font-size:66px;font-weight:800;line-height:1.15;letter-spacing:-1px;margin-bottom:26px;}
  .sub{font-size:31px;color:rgba(255,255,255,.85);}
  .foot{position:absolute;left:90px;bottom:46px;font-size:23px;color:rgba(255,255,255,.62);}
</style></head>
<body>
  <div class="brand"><div class="tile">W</div><div class="name">Workmate · 工作搭子</div></div>
  <div class="title">会归因的工作搭子，<br/>替你把进展写成周报</div>
  <div class="sub">用说话维护周目标 · 一键生成周报 · 写入提醒事项</div>
  <div class="foot">AI-native · 仅 macOS · 开源免费 · 数据全部本地</div>
</body></html>`;

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 630,
    useContentSize: true,
    frame: false,
    show: false,
    webPreferences: { offscreen: false },
  });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(HTML));
  await new Promise((r) => setTimeout(r, 600));
  const img = await win.webContents.capturePage();
  fs.writeFileSync(OUT, img.toPNG());
  console.log('og captured', img.getSize().width + 'x' + img.getSize().height, '->', OUT);
  win.destroy();
  app.quit();
});
