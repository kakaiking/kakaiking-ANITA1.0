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
    renamePath: (oldPath, newPath) => ipcRenderer.invoke('rename-path', oldPath, newPath),
    pathExists: (path) => ipcRenderer.invoke('path-exists', path),

    // Shell
    executeCommand: (terminalId, command) => ipcRenderer.invoke('execute-command', { terminalId, command }),
    sendTerminalInput: (terminalId, input) => ipcRenderer.invoke('terminal-input', { terminalId, input }),
    closeTerminal: (terminalId) => ipcRenderer.invoke('close-terminal', terminalId),

    // Token Usage
    getTokenUsage: () => ipcRenderer.invoke('get-token-usage'),
    updateTokenUsage: (usage) => ipcRenderer.invoke('update-token-usage', usage),
    getTerminalCwd: (terminalId) => ipcRenderer.invoke('get-terminal-cwd', terminalId),
    setTerminalCwd: (terminalId, path) => ipcRenderer.invoke('set-terminal-cwd', { terminalId, newPath: path }),

    // History
    getSessions: () => ipcRenderer.invoke('get-sessions'),
    saveSessions: (sessions) => ipcRenderer.invoke('save-sessions', sessions),
    getChats: () => ipcRenderer.invoke('get-chats'),
    saveChats: (chats) => ipcRenderer.invoke('save-chats', chats),

    // Window Controls
    minimize: () => ipcRenderer.invoke('window-minimize'),
    maximize: () => ipcRenderer.invoke('window-maximize'),
    close: () => ipcRenderer.invoke('window-close'),

    // Events
    onTerminalData: (callback) => ipcRenderer.on('terminal-data', (event, { terminalId, data }) => callback({ terminalId, data })),

    // Together Proxy
    togetherProxyChat: (data) => ipcRenderer.invoke('together-proxy-chat', data),
    onTogetherChunk: (requestId, callback) => {
        const listener = (event, chunk) => callback(chunk);
        ipcRenderer.on(`together-chunk-${requestId}`, listener);
        return () => ipcRenderer.removeListener(`together-chunk-${requestId}`, listener);
    },
    onTogetherDone: (requestId, callback) => {
        const listener = () => callback();
        ipcRenderer.once(`together-done-${requestId}`, listener);
        return () => ipcRenderer.removeListener(`together-done-${requestId}`, listener);
    },
    onTogetherError: (requestId, callback) => {
        const listener = (event, err) => callback(err);
        ipcRenderer.once(`together-error-${requestId}`, listener);
        return () => ipcRenderer.removeListener(`together-error-${requestId}`, listener);
    }
});
