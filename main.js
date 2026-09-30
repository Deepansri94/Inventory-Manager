const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const https = require('https');
const fs = require('fs');
const os = require('os');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'Inventory Manager',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile('index.html');
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

function send(event, payload) {
  if (mainWindow) mainWindow.webContents.send(event, payload);
}

function httpsGet(url, headers, callback) {
  const opts = new URL(url);
  const req = https.get({ hostname: opts.hostname, path: opts.pathname + opts.search, headers }, res => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      return httpsGet(res.headers.location, {}, callback);
    }
    callback(null, res);
  });
  req.on('error', err => callback(err));
  req.end();
}

const RELEASES_API = 'https://api.github.com/repos/Deepansri94/Inventory-Manager/releases/latest';

function checkForUpdate(manual = false) {
  httpsGet(RELEASES_API, {
    'User-Agent': 'InventoryManager-App',
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  }, (err, res) => {
    if (err) { if (manual) send('update-result', { status: 'error' }); return; }
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const release = JSON.parse(data);
        const tag = release.tag_name || '';
        if (!tag.startsWith('build-')) { if (manual) send('update-result', { status: 'up-to-date' }); return; }
        const remoteCode = parseInt(tag.replace('build-', ''), 10);
        const localCode = parseInt(app.getVersion().split('.')[2] || '0', 10);
        if (remoteCode > localCode) {
          const asset = (release.assets || []).find(a => a.name.endsWith('.exe'));
          if (!asset) { if (manual) send('update-result', { status: 'error' }); return; }
          if (manual) send('update-result', { status: 'available', version: release.name });
          dialog.showMessageBox(mainWindow, {
            type: 'info', title: 'Update Available',
            message: `Inventory Manager ${release.name} is available!`,
            detail: 'The installer will be downloaded to your Downloads folder.',
            buttons: ['Download & Install', 'Later'], defaultId: 0, cancelId: 1
          }).then(({ response }) => {
            if (response === 0) {
              if (manual) send('update-result', { status: 'downloading' });
              const dest = path.join(os.homedir(), 'Downloads', 'InventoryManager-Setup.exe');
              const file = fs.createWriteStream(dest);
              httpsGet(asset.browser_download_url, { 'User-Agent': 'InventoryManager-App', 'Accept': 'application/octet-stream' }, (err2, res2) => {
                if (err2) { file.close(); if (manual) send('update-result', { status: 'error' }); return; }
                res2.pipe(file);
                file.on('finish', () => file.close(() => { if (manual) send('update-result', { status: 'done' }); shell.openPath(dest); }));
                file.on('error', () => { fs.unlink(dest, () => {}); if (manual) send('update-result', { status: 'error' }); });
              });
            } else if (manual) send('update-result', { status: 'cancelled' });
          });
        } else {
          if (manual) send('update-result', { status: 'up-to-date' });
        }
      } catch { if (manual) send('update-result', { status: 'error' }); }
    });
  });
}

ipcMain.handle('check-update', () => checkForUpdate(true));

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
