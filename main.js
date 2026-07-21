const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // Hardened defaults: no Node in renderer.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    },
    title: 'Map Digitizer',
    icon: path.join(__dirname, 'public', 'favicon.ico')
  });

  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  Menu.setApplicationMenu(null);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
