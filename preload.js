const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Workspace
    selectWorkspace: () => ipcRenderer.invoke('select-workspace'),
    getWorkspacePath: () => ipcRenderer.invoke('get-workspace-path'),

    // Settings
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

    // File System
    readDir: (path) => ipcRenderer.invoke('read-dir', path),
    readFile: (path) => ipcRenderer.invoke('read-file', path),
    writeFile: (path, content) => ipcRenderer.invoke('write-file', path, content),
    deletePath: (path) => ipcRenderer.invoke('delete-path', path),
    createFolder: (path) => ipcRenderer.invoke('create-folder', path),

    // Shell
    executeCommand: (command) => ipcRenderer.invoke('execute-command', command),
    sendTerminalInput: (input) => ipcRenderer.invoke('terminal-input', input),

    // Token Usage
    getTokenUsage: () => ipcRenderer.invoke('get-token-usage'),
    updateTokenUsage: (usage) => ipcRenderer.invoke('update-token-usage', usage),

    // History
    getSessions: () => ipcRenderer.invoke('get-sessions'),
    saveSessions: (sessions) => ipcRenderer.invoke('save-sessions', sessions),

    // Events
    onTerminalData: (callback) => ipcRenderer.on('terminal-data', (event, data) => callback(data)),
});
