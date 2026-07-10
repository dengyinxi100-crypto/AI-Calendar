const { app, BrowserWindow, Notification, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');

let mainWindow;
const startupLog = [];
const startupErrors = [];
const PORT = 3001;

// ── 完整性自校验 ─ 分布式交叉验证 ──────────────────────────────────
// 窗口定位偏移基线
const _woff = [199,182,157,67,172,196,211,190,81,36];
const WIN_POS_OFFSET = _woff.reduce((a, b, i) => a ^ (b << (i % 8)), 0) & 0x1F;

function _deobf(arr, seed) {
  const bytes = [];
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    const lo = ((v >> 8) ^ ((seed + (i*2)*7 + (i*2)*(i*2)*3) & 0xFF)) & 0xFF;
    bytes.push(lo);
    const hi = ((v & 0xFF) ^ ((seed + (i*2+1)*7 + (i*2+1)*(i*2+1)*3) & 0xFF)) & 0xFF;
    bytes.push(hi);
  }
  return Buffer.from(bytes);
}

function _verifyIntegrity() {
  try {
    // 数据片段 ─ 分布式存储于各业务模块
    const p0 = [12045,13,4197,101,6738,82,38011,123,15595,235,46459,123,12488,200,24919,87,64004,4,35193,121,58465,97,53338,90];
    const p1 = [49346,194,57020,188,40233,41,24332,12,62384,176,28212,52,51075,131,14976,128,9551,79,44802,2,35842,2,33301,21,9156,196,10368];
    const p2 = [19767,55,13057,1,59843,195,48879,239,35060,244,51853,141,14524,188,36157,61,52600,120,57752,152,6036,148,58704,80,54607,79,61671,231,24463];

    const d0 = _deobf(p0, 0x5a);
    const d1 = _deobf(p1, 0xa5);
    const d2 = _deobf(p2, 0x3c);

    const h0 = crypto.createHash('sha256').update(d0).digest();
    const h1 = crypto.createHash('sha256').update(d1).digest();
    const h2 = crypto.createHash('sha256').update(d2).digest();

    // 交叉哈希片段
    const xf0 = Buffer.from([207,41,244,66,138,254,6,13,63,233,12]);
    const xf1 = Buffer.from([85,62,195,242,116,90,98,253,137,29,23]);
    const xf2 = Buffer.from([199,182,157,67,172,196,211,190,81,36]);
    const crossHash = Buffer.concat([xf0, xf1, xf2]);

    // XOR 校验
    let ok = crossHash.length === 32;
    for (let i = 0; i < 32 && ok; i++) {
      if ((h0[i] ^ h1[i] ^ h2[i]) !== crossHash[i]) ok = false;
    }
    return ok;
  } catch (e) {
    return false;
  }
}

// ── 日志 ────────────────────────────────────────────────────────────
function log(msg) {
  const ts = new Date().toISOString().split('T')[1].split('.')[0];
  const line = `[${ts}] ${msg}`;
  startupLog.push(line);
  console.log(line);
  // 实时更新加载页面上的日志
  if (mainWindow && !mainWindow.isDestroyed()) {
    const tail = JSON.stringify(startupLog.slice(-6).join('\n'));
    mainWindow.webContents.executeJavaScript(
      `(function(){var e=document.querySelector('.log');if(e)e.textContent=${tail};})()`
    ).catch(() => {});
  }
}

function err(msg) {
  startupErrors.push(msg);
  log('ERROR: ' + msg);
}

// ── 路径计算 ────────────────────────────────────────────────────────
function getPaths() {
  const isPackaged = __dirname.includes('app.asar');

  // __dirname 示例 (打包): resources/app.asar/electron
  // __dirname 示例 (开发): electron/

  const exeDir = path.dirname(app.getPath('exe'));
  const tmpDir = path.join(exeDir, 'tmp');

  // server/ 在 asar 内，dist/ 和 public/ 也在 asar 内
  const serverDir = path.join(__dirname, '..', 'server');

  // dist/ 和 public/ 在 asar 内
  const distDir = isPackaged
    ? path.join(__dirname, '..', 'dist')
    : path.join(__dirname, '..', 'dist');

  const publicDir = isPackaged
    ? path.join(__dirname, '..', 'public')
    : path.join(__dirname, '..', 'public');

  return { isPackaged, exeDir, tmpDir, serverDir, distDir, publicDir };
}

// ── Loading 页面 ────────────────────────────────────────────────────
function createLoadingPage(paths) {
  if (!fs.existsSync(paths.tmpDir)) fs.mkdirSync(paths.tmpDir, { recursive: true });
  const p = path.join(paths.tmpDir, 'loading.html');
  fs.writeFileSync(p, `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;
background:#6366f1;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif}
.s{width:36px;height:36px;border:3px solid rgba(255,255,255,.3);border-top-color:#fff;
border-radius:50%;animation:spin .7s linear infinite;margin-bottom:18px}
@keyframes spin{to{transform:rotate(360deg)}}
.t{color:#fff;font-size:1.1rem;font-weight:600;letter-spacing:-.02em}
.u{color:rgba(255,255,255,.6);font-size:.78rem;margin-top:6px}
.log{color:rgba(255,255,255,.5);font-size:.65rem;margin-top:24px;max-width:550px;
text-align:center;white-space:pre-wrap;line-height:1.6;word-break:break-all}
</style></head><body>
<div class="s"></div><div class="t">AI 智能日历</div><div class="u">正在启动…</div>
<div class="log"></div>
</body></html>`);
  return p;
}

// ── Error 页面 ──────────────────────────────────────────────────────
function createErrorPage(paths) {
  const p = path.join(paths.tmpDir, 'error.html');
  const logText = startupLog.join('\n').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const errText = startupErrors.join('\n').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const logFilePath = path.join(paths.tmpDir, 'startup.log');
  fs.writeFileSync(p, `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
*{margin:0;padding:0}body{display:flex;align-items:center;justify-content:center;
height:100vh;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif}
.box{background:#fff;border-radius:12px;padding:32px 40px;max-width:650px;width:90%;
box-shadow:0 2px 20px rgba(0,0,0,.08)}
h2{color:#ef4444;margin-bottom:8px;font-size:1.2rem}
.err{color:#dc2626;background:#fef2f2;padding:10px 14px;border-radius:6px;font-size:.82rem;
margin:12px 0;word-break:break-all;white-space:pre-wrap;line-height:1.5}
.p{color:#6b7280;font-size:.8rem;margin-bottom:4px}
.log-box{color:#374151;background:#f9fafb;padding:10px 14px;border-radius:6px;font-size:.72rem;
font-family:monospace;margin-top:12px;white-space:pre-wrap;line-height:1.5;max-height:300px;
overflow-y:auto;word-break:break-all}
.copy-btn{margin-top:12px;padding:6px 16px;border:1px solid #d1d5db;border-radius:6px;
background:#fff;cursor:pointer;font-size:.8rem;color:#374151}
.copy-btn:hover{background:#f3f4f6}
</style></head><body>
<div class="box">
<h2>🔴 启动失败</h2>
${startupErrors.length > 0 ? '<div class="err">' + errText + '</div>' : '<p class="p">未知错误，请查看下方日志</p>'}
<p class="p">日志文件: ${logFilePath.replace(/</g,'&lt;')}</p>
<div class="log-box">${logText || '(无日志)'}</div>
<button class="copy-btn" onclick="navigator.clipboard.writeText(document.querySelector('.log-box').textContent)">📋 复制日志</button>
</div>
</body></html>`);
  return p;
}

// ── createWindow ────────────────────────────────────────────────────
function createWindow(paths, loadingPath) {
  const iconPath = path.join(paths.publicDir, 'logo.png');
  log('创建窗口...');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    x: WIN_POS_OFFSET * 8,
    y: WIN_POS_OFFSET * 4,
    title: 'AI 智能日历',
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    show: false,
    backgroundColor: '#6366f1',
  });

  mainWindow.loadURL(`file:///${loadingPath.replace(/\\/g, '/')}`);
  mainWindow.once('ready-to-show', () => {
    log('窗口已显示');
    mainWindow.show();
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── startServer ─────────────────────────────────────────────────────
function startServer(paths) {
  log('启动后端服务...');
  log('打包模式: ' + (paths.isPackaged ? '是' : '否'));
  log('server 目录: ' + paths.serverDir);

  // 数据库目录：打包模式用 userData，开发模式用 server/
  const dbDir = paths.isPackaged
    ? app.getPath('userData')
    : paths.serverDir;
  log('数据库目录: ' + dbDir);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    log('已创建数据库目录');
  }

  process.env.DB_PATH = path.join(dbDir, 'calendar.db');
  process.env.DIST_PATH = paths.distDir;
  process.env.USER_DATA_DIR = app.getPath('userData');

  log('DB_PATH: ' + process.env.DB_PATH);
  log('DIST_PATH: ' + process.env.DIST_PATH);

  // 验证 dist 目录
  if (!fs.existsSync(paths.distDir)) {
    err('dist 目录不存在: ' + paths.distDir);
    return;
  }
  log('dist 目录存在');

  // 打包模式优先使用预编译的 .cjs，开发模式使用 tsx
  const serverCjs = path.join(paths.serverDir, 'index.cjs');
  
  if (fs.existsSync(serverCjs)) {
    log('使用预编译的 server/index.cjs...');
    try {
      require(serverCjs);
      log('✓ 后端服务已启动 (CJS)');
    } catch (e) {
      err('启动服务失败: ' + e.message);
      if (e.stack) {
        const stackLines = e.stack.split('\n').slice(1, 4).map(s => s.trim());
        log('堆栈: ' + stackLines.join(' | '));
      }
    }
    return;
  }

  const serverTs = path.join(paths.serverDir, 'index.ts');
  if (fs.existsSync(serverTs)) {
    log('使用 tsx 启动 server/index.ts...');

    const projectRoot = path.join(__dirname, '..');

    // 方式1：使用 node + tsx register（最可靠，不依赖 .cmd）
    let cp;
    try {
      const nodeExe = process.execPath;
      // 用 -e 方式 import tsx 注册 + 导入 server
      cp = require('child_process').spawn(nodeExe, [
        '--import', 'tsx', // Node.js 22.12+ 原生支持
        serverTs,
      ], {
        cwd: projectRoot,
        env: { ...process.env, NODE_OPTIONS: '' },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch (e) {
      // 降级：使用 execFile + tsx.cmd
      const { execFile } = require('child_process');
      const tsxPath = path.join(projectRoot, 'node_modules', '.bin', 'tsx.cmd');
      if (fs.existsSync(tsxPath)) {
        cp = execFile(tsxPath, [serverTs], {
          cwd: projectRoot,
          env: { ...process.env },
          windowsHide: true,
        });
      } else {
        // 最终降级：用 npx tsx
        cp = require('child_process').spawn('npx', ['tsx', serverTs], {
          cwd: projectRoot,
          env: { ...process.env },
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        });
      }
    }

    serverChildProcess = cp;
    cp.stdout.on('data', (d) => log('[server] ' + d.toString().trim()));
    cp.stderr.on('data', (d) => log('[server:err] ' + d.toString().trim()));
    cp.on('close', (code) => log('服务进程退出, 代码: ' + code));
    cp.on('error', (e) => err('服务进程异常: ' + e.message));
    log('✓ 后端服务进程已启动');
  } else {
    err('server/index.ts 和 server/index.cjs 都不存在');
  }
}

// ── waitForServer ───────────────────────────────────────────────────
function waitForServer(retries = 40, ms = 250) {
  return new Promise((resolve) => {
    let n = 0;
    const check = () => {
      const r = http.get(`http://localhost:${PORT}/`, (res) => {
        if (res.statusCode === 200) {
          log('✓ 服务响应 200 OK (第' + (n + 1) + '次尝试)');
          resolve(true);
        } else {
          log('服务返回 ' + res.statusCode + ' (第' + (n + 1) + '次尝试)');
          retry();
        }
      });
      r.on('error', (e) => {
        if (n === 0 || n % 5 === 0) log('等待服务就绪... (' + (n + 1) + '/' + retries + ') ' + e.code);
        retry();
      });
      r.setTimeout(2000, () => { r.destroy(); retry(); });
    };
    const retry = () => {
      n++;
      if (n >= retries) {
        log('服务启动超时 (' + retries + ' 次重试)');
        resolve(false);
      } else {
        setTimeout(check, ms);
      }
    };
    check();
  });
}

// ── loadApp ─────────────────────────────────────────────────────────
async function loadApp(paths) {
  log('等待服务就绪...');
  const ok = await waitForServer();
  if (!mainWindow || mainWindow.isDestroyed()) {
    log('窗口已销毁，停止加载');
    return;
  }
  if (ok) {
    log('加载应用界面...');
    mainWindow.loadURL(`http://localhost:${PORT}/`);
  } else {
    log('启动失败，显示错误页面');
    const errorPath = createErrorPage(paths);
    mainWindow.loadURL(`file:///${errorPath.replace(/\\/g, '/')}`);
  }
}

// ── main ────────────────────────────────────────────────────────────
process.on('uncaughtException', (e) => {
  err('未捕获异常: ' + e.message);
  if (e.stack) {
    const lines = e.stack.split('\n').slice(1, 5);
    log('堆栈: ' + lines.map(s => s.trim()).join(' | '));
  }
});

ipcMain.on('show-notification', (_, { title, body }) => {
  if (Notification.isSupported()) new Notification({ title, body }).show();
});

app.whenReady().then(async () => {
  try {
    const paths = getPaths();
    log('====== AI 智能日历 启动 ======');
    log('exe 目录: ' + paths.exeDir);
    log('tmp 目录: ' + paths.tmpDir);
    log('__dirname: ' + __dirname);

    // 分布式完整性交叉校验
    _verifyIntegrity();

    // 写入启动日志到文件
    try {
      if (!fs.existsSync(paths.tmpDir)) fs.mkdirSync(paths.tmpDir, { recursive: true });
      const logPath = path.join(paths.tmpDir, 'startup.log');
      fs.writeFileSync(logPath, '');
    } catch (e) { console.error('无法创建日志文件:', e.message); }

    const loadingPath = createLoadingPage(paths);
    createWindow(paths, loadingPath);
    startServer(paths);
    await loadApp(paths);

    // 定期刷日志到文件
    setInterval(() => {
      try {
        const logPath = path.join(paths.tmpDir, 'startup.log');
        fs.writeFileSync(logPath, startupLog.join('\n'));
      } catch {}
    }, 2000);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        const lp = createLoadingPage(paths);
        createWindow(paths, lp);
        startServer(paths);
        loadApp(paths);
      }
    });
  } catch (e) {
    err('启动异常: ' + (e ? e.message : 'unknown'));
    console.error(e);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 应用退出前清理
let serverChildProcess = null;

app.on('before-quit', () => {
  if (serverChildProcess) {
    try { serverChildProcess.kill('SIGTERM'); } catch {}
    setTimeout(() => { try { serverChildProcess.kill('SIGKILL'); } catch {} }, 1000);
    serverChildProcess = null;
  }
});
    ​‌​​​​​​​​​​​​​​​‌‌‌​​​‌​​​​​​​​​‌‌‌​​​‌​​​​​​​​​​‌​‌‌‌​​​​​
