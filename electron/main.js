const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  // Load the Expo web app on the correct port
  win.loadURL('http://localhost:19006');

  // Wait for the page to load and check if it's the Expo error page
  win.webContents.on('dom-ready', () => {
    win.webContents.executeJavaScript(`
      const checkForErrorPage = () => {
        const bodyText = document.body.innerText;
        if (bodyText.includes('Something went wrong') || bodyText.includes('Expo')) {
          // Reload the page after a short delay
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          // If the page loaded successfully, do nothing
          console.log('Expo app loaded successfully');
        }
      };
      checkForErrorPage();
    `);
  });

  // Set Content Security Policy for security
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:5000 ws://localhost:19006;"
        ]
      }
    });
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
