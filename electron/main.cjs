const { app, BrowserWindow, net, protocol, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const APP_SCHEME = 'study829';
const APP_ORIGIN = `${APP_SCHEME}://app`;
const DIST_DIR = path.resolve(__dirname, '..', 'dist');

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

function resolveAppPath(requestUrl) {
  const request = new URL(requestUrl);
  const relativePath = decodeURIComponent(request.pathname === '/' ? '/index.html' : request.pathname)
    .replace(/^\/+/, '');
  const filePath = path.resolve(DIST_DIR, relativePath);

  if (filePath !== DIST_DIR && !filePath.startsWith(`${DIST_DIR}${path.sep}`)) {
    return null;
  }

  return filePath;
}

function registerAppProtocol() {
  protocol.handle(APP_SCHEME, (request) => {
    const filePath = resolveAppPath(request.url);
    if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return new Response('Not found', { status: 404 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

function applicationIconPath() {
  if (app.isPackaged) return path.join(process.resourcesPath, 'app-icon.ico');
  return path.resolve(__dirname, '..', 'public', 'app-shortcut-icon-v2.ico');
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 920,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f7f8f6',
    icon: applicationIconPath(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${APP_ORIGIN}/`)) event.preventDefault();
  });
  window.once('ready-to-show', () => window.show());
  window.loadURL(`${APP_ORIGIN}/index.html`);

  const screenshotPath = process.env.ELECTRON_SMOKE_SCREENSHOT;
  if (screenshotPath) {
    window.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        const image = await window.webContents.capturePage();
        fs.writeFileSync(screenshotPath, image.toPNG());
        app.quit();
      }, 1200);
    });
  }

  return window;
}

const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) {
  app.quit();
} else {
  let mainWindow;

  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    registerAppProtocol();
    mainWindow = createWindow();
  });

  app.on('window-all-closed', () => app.quit());
}
