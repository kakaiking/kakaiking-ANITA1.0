const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { exec } = require('child_process');
const Store = require('electron-store');

const store = new Store();

// Disable GPU acceleration to prevent common crashes on some systems
app.disableHardwareAcceleration();

let mainWindow;
const terminalProcesses = new Map();
let terminalCwds = new Map(); // Track CWD per terminal

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'assets/logo.png'),
        show: false,
        frame: false, // Make it frameless
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        title: "Anita - Agentic AI IDE"
    });

    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC Handlers

// Workspace
ipcMain.handle('select-workspace', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (result.canceled) return null;
    const workspacePath = result.filePaths[0];
    store.set('workspacePath', workspacePath);
    return workspacePath;
});

ipcMain.handle('get-workspace-path', () => {
    return store.get('workspacePath');
});

// Settings
ipcMain.handle('get-settings', () => {
    return {
        apiKey: store.get('apiKey'),
        theme: store.get('theme', 'system'),
        model: store.get('model', 'deepseek/deepseek-coder'),
    };
});

ipcMain.handle('save-settings', (event, settings) => {
    if (settings.apiKey) store.set('apiKey', settings.apiKey);
    if (settings.theme) store.set('theme', settings.theme);
    if (settings.model) store.set('model', settings.model);
    return true;
});

// File System
ipcMain.handle('read-dir', async (event, dirPath) => {
    const workspace = store.get('workspacePath');
    if (!dirPath.startsWith(workspace)) throw new Error("Access denied");

    const files = await fs.readdir(dirPath, { withFileTypes: true });
    return files.map(file => ({
        name: file.name,
        path: path.join(dirPath, file.name),
        isDirectory: file.isDirectory()
    }));
});

ipcMain.handle('read-file', async (event, filePath) => {
    const workspace = store.get('workspacePath');
    if (!filePath.startsWith(workspace)) throw new Error("Access denied");
    return await fs.readFile(filePath, 'utf-8');
});

ipcMain.handle('write-file', async (event, filePath, content) => {
    const workspace = store.get('workspacePath');
    if (!filePath.startsWith(workspace)) throw new Error("Access denied");
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content);
    return true;
});

ipcMain.handle('delete-path', async (event, filePath) => {
    const workspace = store.get('workspacePath');
    if (!filePath.startsWith(workspace)) throw new Error("Access denied");
    await fs.remove(filePath);
    return true;
});

ipcMain.handle('create-folder', async (event, folderPath) => {
    const workspace = store.get('workspacePath');
    if (!folderPath.startsWith(workspace)) throw new Error("Access denied");
    await fs.ensureDir(folderPath);
    return true;
});

const runCommand = (command, terminalId, resolve) => {
    const workspace = store.get('workspacePath');
    let cwd = terminalCwds.get(terminalId) || workspace;

    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
    const args = process.platform === 'win32' ? ['/c', command] : ['-c', command];

    const proc = require('child_process').spawn(shell, args, {
        cwd: cwd || workspace,
        env: { ...process.env, FORCE_COLOR: '1' }
    });

    terminalProcesses.set(terminalId, proc);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        if (mainWindow) mainWindow.webContents.send('terminal-data', { terminalId, data: chunk });
    });

    proc.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        if (mainWindow) mainWindow.webContents.send('terminal-data', { terminalId, data: chunk });
    });

    proc.on('close', (code) => {
        if (terminalProcesses.get(terminalId) === proc) {
            terminalProcesses.delete(terminalId);
        }
        if (resolve) {
            resolve({
                success: code === 0,
                stdout,
                stderr,
                error: code !== 0 ? `Process exited with code ${code}` : null
            });
        }
    });

    return proc;
};

// Shell
ipcMain.handle('execute-command', (event, { terminalId, command }) => {
    return new Promise((resolve) => {
        const proc = runCommand(command, terminalId, resolve);

        const longRunningCmds = ['npm start', 'npm run dev', 'vite', 'serve', 'node '];
        if (longRunningCmds.some(c => command.includes(c))) {
            setTimeout(() => {
                resolve({ success: true, stdout: 'Command started in background...', stderr: '', isBackground: true });
            }, 2000);
        }
    });
});

ipcMain.handle('terminal-input', (event, { terminalId, input }) => {
    const trimmedInput = input.trim();
    const workspace = store.get('workspacePath');
    let cwd = terminalCwds.get(terminalId) || workspace;

    // Simple CD tracking
    if (trimmedInput.startsWith('cd ')) {
        const target = trimmedInput.slice(3).trim().replace(/^["']|["']$/g, '');
        try {
            const newPath = path.resolve(cwd, target);
            if (fs.existsSync(newPath) && fs.statSync(newPath).isDirectory()) {
                terminalCwds.set(terminalId, newPath);
            }
        } catch (e) {
            console.error("Failed to resolve CD path", e);
        }
    }

    const activeProcess = terminalProcesses.get(terminalId);
    if (activeProcess && activeProcess.stdin.writable) {
        activeProcess.stdin.write(input + '\n');
        return true;
    } else {
        runCommand(input, terminalId);
        return true;
    }
});

ipcMain.handle('get-terminal-cwd', (event, terminalId) => {
    return terminalCwds.get(terminalId) || store.get('workspacePath');
});

ipcMain.handle('set-terminal-cwd', (event, { terminalId, newPath }) => {
    if (fs.existsSync(newPath) && fs.statSync(newPath).isDirectory()) {
        terminalCwds.set(terminalId, newPath);
        return { success: true, path: newPath };
    }
    return { success: false, error: "Invalid directory path" };
});

ipcMain.handle('close-terminal', (event, terminalId) => {
    const proc = terminalProcesses.get(terminalId);
    if (proc) {
        proc.kill();
        terminalProcesses.delete(terminalId);
    }
    terminalCwds.delete(terminalId);
    return true;
});

// Token Usage
ipcMain.handle('get-token-usage', () => {
    return store.get('tokenUsage', { session: 0, total: 0 });
});

ipcMain.handle('update-token-usage', (event, usage) => {
    const current = store.get('tokenUsage', { session: 0, total: 0 });
    const updated = {
        session: current.session + usage,
        total: current.total + usage
    };
    store.set('tokenUsage', updated);
    return updated;
});

// History / Sessions
ipcMain.handle('get-sessions', () => {
    return store.get('sessions', []);
});

ipcMain.handle('save-sessions', (event, sessions) => {
    store.set('sessions', sessions);
    return true;
});

// Chat Persistence
ipcMain.handle('get-chats', () => {
    return store.get('chats', []);
});

ipcMain.handle('save-chats', (event, chats) => {
    store.set('chats', chats);
    return true;
});

// Window Controls
ipcMain.handle('window-minimize', () => {
    mainWindow.minimize();
});

ipcMain.handle('window-maximize', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});

ipcMain.handle('window-close', () => {
    mainWindow.close();
});
