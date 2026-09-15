const { app, BrowserWindow, net, protocol, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const APP_SCHEME = 'study829';
const APP_ORIGIN = `${APP_SCHEME}://app`;
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const STABLE_USER_DATA_DIR = path.join(app.getPath('home'), '829-memory-data');

function virtualizedUserDataDirs() {
  const packagesDirectory = path.join(app.getPath('home'), 'AppData', 'Local', 'Packages');
  try {
    return fs.readdirSync(packagesDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(
        packagesDirectory,
        entry.name,
        'LocalCache',
        'Roaming',
        '829-memory',
      ));
  } catch {
    return [];
  }
}

const LEGACY_USER_DATA_DIRS = [
  path.join(app.getPath('appData'), '829-memory'),
  path.join(app.getPath('appData'), '829石油与天然气工程综合记忆计划'),
  path.join(app.getPath('appData'), '829-memory-plan'),
  path.join(app.getPath('appData'), '829-memory-plan-updater'),
  ...virtualizedUserDataDirs(),
];

function hasLocalSave(directory) {
  const levelDb = path.join(directory, 'Local Storage', 'leveldb');
  if (!fs.existsSync(levelDb)) return false;
  try {
    return fs.readdirSync(levelDb).some((name) => {
      if (!/\.(ldb|log)$/i.test(name)) return false;
      try {
        const text = fs.readFileSync(path.join(levelDb, name), 'utf8');
        return text.includes('829-memory-profiles-v1') || text.includes('829-memory-state-v1');
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function migrateLegacyUserData(targetDirectory) {
  if (hasLocalSave(targetDirectory)) return;
  const targetPath = path.resolve(targetDirectory).toLocaleLowerCase();
  const sourceDirectory = LEGACY_USER_DATA_DIRS.find((candidate) => (
    path.resolve(candidate).toLocaleLowerCase() !== targetPath && hasLocalSave(candidate)
  ));
  if (!sourceDirectory) return;

  const excludedDirectories = new Set([
    'blob_storage',
    'Cache',
    'Code Cache',
    'DawnGraphiteCache',
    'DawnWebGPUCache',
    'GPUCache',
    'Session Storage',
    'Shared Dictionary',
  ]);
  const excludedFiles = new Set(['LOCK', 'lockfile', 'DevToolsActivePort']);

  try {
    fs.cpSync(sourceDirectory, targetDirectory, {
      recursive: true,
      force: true,
      filter: (sourcePath) => {
        const relativePath = path.relative(sourceDirectory, sourcePath);
        const rootName = relativePath.split(path.sep)[0];
        return !excludedDirectories.has(rootName) && !excludedFiles.has(path.basename(sourcePath));
      },
    });
    fs.writeFileSync(path.join(targetDirectory, 'save-migration.json'), JSON.stringify({
      migratedAt: new Date().toISOString(),
      sourceDirectory,
    }, null, 2));
  } catch (error) {
    console.error('Unable to migrate the existing 829 save:', error);
  }
}

const USER_DATA_DIR = process.env.MEMORY829_USER_DATA_DIR || STABLE_USER_DATA_DIR;

if (!process.env.MEMORY829_USER_DATA_DIR) migrateLegacyUserData(USER_DATA_DIR);

// A directory below the user profile is stable even when Windows virtualizes
// AppData for a process launched from an MSIX-packaged development tool.
fs.mkdirSync(USER_DATA_DIR, { recursive: true });
app.setPath('userData', USER_DATA_DIR);

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
  return path.resolve(__dirname, '..', 'public', 'app-shortcut-icon-v3.ico');
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
