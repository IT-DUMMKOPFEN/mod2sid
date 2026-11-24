// mod2sid – Electron main process
// (c) IT-DUMMKOPFEN, GPL-3.0
const { app, BrowserWindow, ipcMain, dialog, protocol, net, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

let win = null;
let pendingPath = process.argv.slice(1).find(a => /\.(mod|nst|stk|med|mmd[0-3]|xm|it|dbm|aon[48]?)$/i.test(a)) || null;
const isMac = process.platform === 'darwin';
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', (_e, argv) => {
  const p = argv.slice(1).find(a => /\.(mod|nst|stk|med|mmd[0-3]|xm|it|dbm|aon[48]?)$/i.test(a));
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); if (p) win.webContents.send('open-path', p); }
});
app.on('open-file', (e, p) => { e.preventDefault(); if (win) win.webContents.send('open-path', p); else pendingPath = p; });
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1100, minHeight: 720,
    title: 'mod2sid', backgroundColor: '#14102a',
    icon: path.join(ROOT, 'renderer', 'icon.png'),
    autoHideMenuBar: !isMac,
    ...(isMac ? { titleBarStyle: 'hiddenInset' } : {}),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadURL('app://local/renderer/index.html');
  win.webContents.on('did-finish-load', () => { if (pendingPath) { win.webContents.send('open-path', pendingPath); pendingPath = null; } });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const u = new URL(req.url);
    const p = path.normalize(path.join(ROOT, decodeURIComponent(u.pathname)));
    if (!p.startsWith(ROOT)) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(p).toString());
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { label: 'Datei / File', submenu: [
      { label: 'MOD öffnen / Open MOD…', accelerator: 'CmdOrCtrl+O', click: () => win && win.webContents.send('menu', 'open') },
      { label: 'SID + SNG speichern / Save…', accelerator: 'CmdOrCtrl+S', click: () => win && win.webContents.send('menu', 'save') },
      { type: 'separator' }, isMac ? { role: 'close' } : { role: 'quit' }] },
    { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
  ]));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('open-mod', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Tracker-Module (MOD, MED, XM, IT, DBM, AON)', extensions: ['mod', 'MOD', 'nst', 'stk', 'med', 'MED', 'mmd0', 'mmd1', 'mmd2', 'mmd3', 'xm', 'XM', 'it', 'IT', 'dbm', 'DBM', 'aon', 'aon4', 'aon8'] }, { name: '*', extensions: ['*'] }] });
  if (r.canceled || !r.filePaths.length) return null;
  const p = r.filePaths[0];
  return { name: path.basename(p), path: p, data: fs.readFileSync(p) };
});
ipcMain.handle('read-file', async (_e, p) => {
  if (typeof p !== 'string') return null;
  return { name: path.basename(p), path: p, data: fs.readFileSync(p) };
});
ipcMain.handle('save-output', async (_e, { baseName, sid, sng, songExt, defaultDir }) => {
  const ext = songExt === 'ggt' ? 'ggt' : 'sng';
  const r = await dialog.showSaveDialog(win, {
    defaultPath: path.join(defaultDir || app.getPath('documents'), (baseName || 'tune') + '.sid'),
    filters: [{ name: 'SID + ' + ext.toUpperCase(), extensions: ['sid'] }],
  });
  if (r.canceled || !r.filePath) return null;
  const base = r.filePath.replace(/\.(sid|sng|ggt)$/i, '');
  fs.writeFileSync(base + '.sid', Buffer.from(sid));
  fs.writeFileSync(base + '.' + ext, Buffer.from(sng));
  return { sid: base + '.sid', sng: base + '.' + ext };
});
ipcMain.handle('reveal', async (_e, p) => { if (typeof p === 'string') shell.showItemInFolder(p); });
ipcMain.handle('open-url', async (_e, u) => { if (/^https:\/\//.test(u)) shell.openExternal(u); });
ipcMain.handle('app-info', async () => ({ version: app.getVersion(), electron: process.versions.electron, platform: process.platform, arch: process.arch }));
