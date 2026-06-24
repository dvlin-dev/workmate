const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');

const OUT = process.argv[2] || '/tmp/icon.png';

const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:1024px;height:1024px;background:transparent;}
  .canvas{width:1024px;height:1024px;display:flex;align-items:center;justify-content:center;}
  .tile{
    width:832px;height:832px;border-radius:188px;
    background:linear-gradient(145deg,#5E76E6 0%,#455DD3 45%,#3A4FB8 100%);
    box-shadow:0 36px 70px rgba(45,70,180,.42), inset 0 3px 8px rgba(255,255,255,.28), inset 0 -10px 28px rgba(0,0,0,.14);
    display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;
  }
  .tile::before{content:"";position:absolute;inset:0;border-radius:188px;
    background:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,0) 42%);}
  .mark{position:relative;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    font-weight:800;font-size:560px;line-height:1;color:#fff;letter-spacing:-30px;
    text-shadow:0 8px 24px rgba(20,30,100,.35); transform:translateY(-8px);}
</style></head>
<body><div class="canvas"><div class="tile"><span class="mark">W</span></div></div></body></html>`;

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    useContentSize: true,
    frame: false,
    show: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: false },
  });
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(HTML));
  await new Promise((r) => setTimeout(r, 600));
  const img = await win.webContents.capturePage();
  fs.writeFileSync(OUT, img.toPNG());
  const size = img.getSize();
  console.log('captured', size.width + 'x' + size.height, '->', OUT);
  win.destroy();
  app.quit();
});
