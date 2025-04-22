const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let pythonProcess;

function createWindow() {
    let win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true
        }
    });

    win.loadFile('index.html');

    // Start the Python backend
    const scriptPath = path.join(__dirname, 'python-backend', 'dist', 'main'); // or main.exe on Windows
    pythonProcess = spawn(scriptPath);

    pythonProcess.stdout.on('data', (data) => {
        console.log(`Python stdout: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Python stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`Python process exited with code ${code}`);
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    if (pythonProcess) pythonProcess.kill(); // Gracefully stop Python
});
