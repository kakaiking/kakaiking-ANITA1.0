// Note: In this environment, we are using Babel Standalone for the renderer.
const { useState, useEffect, useRef, useMemo } = React;

const FolderOpen = 'folder-open';
const Settings = 'settings';
const MessageSquare = 'message-square';
const List = 'list';
const Terminal = 'terminal';
const Play = 'play';
const Save = 'save';
const Trash2 = 'trash-2';
const Edit = 'edit';
const Plus = 'plus';
const ChevronRight = 'chevron-right';
const ChevronDown = 'chevron-down';
const ChevronUp = 'chevron-up';
const FileText = 'file-text';
const CodeIcon = 'code';
const CheckCircle = 'check-circle';
const AlertCircle = 'alert-circle';
const RefreshCw = 'refresh-cw';
const Loader2 = 'loader-2';
const Send = 'send';
const X = 'x';
const PanelLeft = 'panel-left';
const PanelRight = 'panel-right';
const PanelBottom = 'panel-bottom';

const getFileIcon = (name) => {
    const ext = name.split('.').pop().toLowerCase();
    switch (ext) {
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx':
            return { name: CodeIcon, color: '#f7df1e' };
        case 'html':
            return { name: 'code', color: '#e34f26' };
        case 'css':
            return { name: 'hash', color: '#1572b6' };
        case 'json':
            return { name: 'database', color: '#f1e05a' };
        case 'py':
            return { name: 'terminal', color: '#3776ab' };
        case 'md':
            return { name: 'file-text', color: '#ffffff' };
        default:
            return { name: FileText, color: 'var(--text-secondary)' };
    }
};

const FileTree = ({ files, expandedFolders, toggleFolder, openFile, activeFile, depth = 0 }) => {
    return (
        <>
            {files.map(file => (
                <div key={file.path}>
                    <div
                        className={`file-tree-item ${activeFile === file.path ? 'active' : ''}`}
                        onClick={() => file.isDirectory ? toggleFolder(file) : openFile(file)}
                        style={{ paddingLeft: 20 + depth * 12 }}
                    >
                        <Icon
                            name={file.isDirectory ? (expandedFolders.has(file.path) ? ChevronDown : ChevronRight) : FileText}
                            size={14}
                            style={{ marginRight: 8, opacity: activeFile === file.path ? 1 : 0.6 }}
                        />
                        <span>{file.name}</span>
                    </div>
                    {file.isDirectory && expandedFolders.has(file.path) && file.children && (
                        <FileTree
                            files={file.children}
                            expandedFolders={expandedFolders}
                            toggleFolder={toggleFolder}
                            openFile={openFile}
                            activeFile={activeFile}
                            depth={depth + 1}
                        />
                    )}
                </div>
            ))}
        </>
    );
};

const Icon = ({ name, size = 16, className, style, ...props }) => {
    const iconRef = useRef(null);
    useEffect(() => {
        if (window.lucide && iconRef.current) {
            // Re-render only when name or other props change
            iconRef.current.innerHTML = `<i data-lucide="${name}"></i>`;
            window.lucide.createIcons({
                attrs: {
                    width: size,
                    height: size,
                    strokeWidth: 2
                }
            });
        }
    }, [name, size]);

    return (
        <span
            ref={iconRef}
            className={className}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: size,
                height: size,
                ...style
            }}
            {...props}
        ></span>
    );
};

class AIService {
    constructor(apiKey, model) {
        this.apiKey = apiKey;
        this.model = model || 'deepseek/deepseek-chat';
        this.baseUrl = "https://openrouter.ai/api/v1";
    }

    async chat(messages) {
        if (!this.apiKey) throw new Error("API Key missing. Go to Settings.");
        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://github.com/google-deepmind/antigravity",
                    "X-Title": "Anita IDE"
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: messages,
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
            if (!data.choices || data.choices.length === 0) throw new Error("No response from AI.");

            if (data.usage) {
                window.api.updateTokenUsage(data.usage.total_tokens);
            }
            return data.choices[0].message.content;
        } catch (err) {
            console.error(err);
            throw err;
        }
    }
}

const App = () => {
    const [workspace, setWorkspace] = useState(null);
    const [files, setFiles] = useState([]);
    const [activeFile, setActiveFile] = useState(null);
    const [tabs, setTabs] = useState([]);
    const [settings, setSettings] = useState({ apiKey: '', theme: 'dark', model: 'deepseek/deepseek-chat' });
    const [showSettings, setShowSettings] = useState(false);
    const [activeTab, setActiveTab] = useState('chat');
    const [composerInput, setComposerInput] = useState('');
    const [logs, setLogs] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [isPlanning, setIsPlanning] = useState(false);
    const [tokenUsage, setTokenUsage] = useState({ session: 0, total: 0 });
    const [expandedFolders, setExpandedFolders] = useState(new Set());
    const [terminalInput, setTerminalInput] = useState('');
    const [terminalHistory, setTerminalHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Layout State
    const [isLeftSidebarVisible, setIsLeftSidebarVisible] = useState(true);
    const [isRightPanelVisible, setIsRightPanelVisible] = useState(true);
    const [isTerminalVisible, setIsTerminalVisible] = useState(true);
    const [sidebarWidth, setSidebarWidth] = useState(260);
    const [rightPanelWidth, setRightPanelWidth] = useState(380);
    const [terminalHeight, setTerminalHeight] = useState(240);
    const [resizing, setResizing] = useState(null); // 'left', 'right', 'bottom'

    const monacoRef = useRef(null);
    const terminalInputRef = useRef(null);
    const ai = useMemo(() => new AIService(settings.apiKey, settings.model), [settings.apiKey, settings.model]);

    useEffect(() => {
        const init = async () => {
            const path = await window.api.getWorkspacePath();
            if (path) {
                setWorkspace(path);
                loadFiles(path);
            }
            const s = await window.api.getSettings();
            if (s) {
                if (!s.model || s.model.includes('deepseek-r1:free')) {
                    s.model = 'deepseek/deepseek-chat';
                }
                setSettings(s);
            }
            const usage = await window.api.getTokenUsage();
            if (usage) setTokenUsage(usage);

            const savedSessions = await window.api.getSessions();
            if (savedSessions) setSessions(savedSessions);

            if (!s || !s.apiKey) setShowSettings(true);

            // Init Monaco
            if (window.require) {
                window.require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
                window.require(['vs/editor/editor.main'], function () {
                    const container = document.getElementById('editor-container');
                    if (container) {
                        monacoRef.current = window.monaco.editor.create(container, {
                            theme: 'vs-dark',
                            automaticLayout: true,
                            fontSize: 14,
                            minimap: { enabled: false }
                        });
                    }
                });
            }
            if (window.api.onTerminalData) {
                window.api.onTerminalData((data) => {
                    // Strip ANSI codes
                    const cleanData = data.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
                    if (!cleanData) return;

                    setLogs(prev => {
                        const lastLog = prev[prev.length - 1];
                        if (lastLog && lastLog.type === 'terminal' && (Date.now() - lastLog.timestamp < 1000)) {
                            // Merge with last terminal log if recent
                            const newLogs = [...prev];
                            newLogs[newLogs.length - 1] = {
                                ...lastLog,
                                msg: lastLog.msg + cleanData
                            };
                            return newLogs.slice(-200);
                        } else {
                            // New log entry
                            return [...prev.slice(-200), {
                                id: Date.now() + Math.random(),
                                timestamp: Date.now(),
                                msg: cleanData,
                                type: 'terminal',
                                time: new Date().toLocaleTimeString()
                            }];
                        }
                    });
                });
            }
        };
        init();
    }, []);

    useEffect(() => {
        const el = document.getElementById('logs-end');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // Drag Resizing Listeners
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!resizing) return;

            if (resizing === 'left') {
                const newWidth = Math.max(150, Math.min(600, e.clientX));
                setSidebarWidth(newWidth);
            } else if (resizing === 'right') {
                const newWidth = Math.max(200, Math.min(600, window.innerWidth - e.clientX));
                setRightPanelWidth(newWidth);
            } else if (resizing === 'bottom') {
                // Simple resizing behavior: Standard Show/Hide
                // Clamp height between 100px and window height
                const newHeight = Math.max(100, Math.min(window.innerHeight - 100, window.innerHeight - e.clientY));
                setTerminalHeight(newHeight);
            }
        };

        const handleMouseUp = () => {
            setResizing(null);
            document.body.classList.remove('is-resizing', 'resizing-left', 'resizing-right', 'resizing-bottom');
        };

        if (resizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.classList.add('is-resizing', `resizing-${resizing}`);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizing, isTerminalVisible]);

    const loadFiles = async (path) => {
        try {
            const dirFiles = await window.api.readDir(path);
            // Sort: directories first, then alphabetically
            const sorted = dirFiles.sort((a, b) => {
                if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
                return a.isDirectory ? -1 : 1;
            });
            setFiles(sorted);
        } catch (err) {
            console.error(err);
        }
    };

    const toggleFolder = async (folder) => {
        const path = folder.path;
        const newExpanded = new Set(expandedFolders);
        if (newExpanded.has(path)) {
            newExpanded.delete(path);
        } else {
            newExpanded.add(path);
            // Pre-load subfiles to nested state if needed? 
            // For now, let's just use a simple recursive render or flat list with expansion.
            // A more robust way is to store children in the file object itself.
        }
        setExpandedFolders(newExpanded);

        // If expanding, make sure we have the children loaded in a nested structure or flat with parent tracking.
        // Let's modify loadFiles to be recursive or fetch on demand.
        if (folder.isDirectory && !folder.children) {
            try {
                const children = await window.api.readDir(path);
                const sortedChildren = children.sort((a, b) => {
                    if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
                    return a.isDirectory ? -1 : 1;
                });
                folder.children = sortedChildren;
                setFiles([...files]); // Trigger re-render
            } catch (err) {
                console.error(err);
            }
        }
    };

    const handleSelectWorkspace = async () => {
        const path = await window.api.selectWorkspace();
        if (path) {
            setWorkspace(path);
            loadFiles(path);
        }
    };

    const addLog = (msg, type = 'info') => {
        setLogs(prev => [...prev.slice(-100), { id: Date.now() + Math.random(), msg, type, time: new Date().toLocaleTimeString() }]);
    };

    const openFile = async (file) => {
        if (file.isDirectory) return;
        try {
            let tab = tabs.find(t => t.path === file.path);
            if (!tab) {
                const content = await window.api.readFile(file.path);
                tab = { ...file, content, isDirty: false };
                setTabs([...tabs, tab]);
            }
            setActiveFile(file.path);

            if (monacoRef.current) {
                const extension = file.name.split('.').pop();
                let language = 'javascript';
                if (['html', 'css', 'json', 'python'].includes(extension)) language = extension === 'py' ? 'python' : extension;

                // Use Uri.file for reliable path handling
                const uri = window.monaco.Uri.file(file.path);
                let model = window.monaco.editor.getModel(uri);

                if (!model) {
                    model = window.monaco.editor.createModel(tab.content, language, uri);
                    model.onDidChangeContent(() => {
                        setTabs(currentTabs => currentTabs.map(t =>
                            t.path === file.path ? { ...t, isDirty: true } : t
                        ));
                    });
                }
                monacoRef.current.setModel(model);

                // Add save shortcut
                monacoRef.current.addCommand(window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.KeyS, () => {
                    saveFile(file.path);
                });
            }
        } catch (err) {
            addLog(`Error opening file: ${err.message}`, 'error');
        }
    };

    const saveFile = async (path) => {
        const tab = tabs.find(t => t.path === path);
        if (!tab) return;

        try {
            const uri = window.monaco.Uri.file(path);
            const model = window.monaco.editor.getModel(uri);
            const content = model ? model.getValue() : tab.content;

            await window.api.writeFile(path, content);
            setTabs(tabs.map(t => t.path === path ? { ...t, content, isDirty: false } : t));
            addLog(`Saved ${tab.name}`);
        } catch (err) {
            addLog(`Error saving file: ${err.message}`, 'error');
        }
    };

    const closeFile = async (e, path) => {
        if (e) e.stopPropagation();
        const tab = tabs.find(t => t.path === path);
        if (!tab) return;

        if (tab.isDirty) {
            if (confirm(`${tab.name} has unsaved changes. Save before closing?`)) {
                await saveFile(path);
            }
        }

        const newTabs = tabs.filter(t => t.path !== path);
        setTabs(newTabs);

        if (activeFile === path) {
            if (newTabs.length > 0) {
                openFile(newTabs[newTabs.length - 1]);
            } else {
                setActiveFile(null);
                if (monacoRef.current) monacoRef.current.setModel(null);
            }
        }

        // Cleanup model
        const uri = window.monaco.Uri.file(path);
        const model = window.monaco.editor.getModel(uri);
        if (model) model.dispose();
    };

    const handleSubmitProposal = async () => {
        if (!composerInput.trim()) return;
        if (!workspace) {
            addLog("Please select a workspace first.", "error");
            return;
        }
        if (!settings.apiKey) return setShowSettings(true);

        const goal = composerInput;
        setComposerInput('');
        setIsPlanning(true);
        addLog(`Planner: analyzing user goal...`);

        const prompt = `As an expert coding agent, create a plan for: "${goal}".
Respond ONLY with a JSON object:
{ "plan": "overview", "tasks": [{ "id": 1, "description": "...", "type": "file_edit|terminal", "path": "relative/path", "content": "initial code", "command": "npm install x" }] }`;

        try {
            const response = await ai.chat([{ role: "user", content: prompt }]);
            const proposal = JSON.parse(response.replace(/```json|```/g, "").trim());

            const newSession = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                goal,
                plan: proposal.plan,
                tasks: proposal.tasks.map(t => ({ ...t, status: 'pending' })),
                status: 'awaiting_approval'
            };

            const updatedSessions = [newSession, ...sessions];
            setSessions(updatedSessions);
            window.api.saveSessions(updatedSessions);
            setActiveTab('manager');
            addLog(`Planner: proposal generated. Awaiting approval.`);
        } catch (err) {
            addLog(`Error: ${err.message}`, 'error');
        } finally {
            setIsPlanning(false);
        }
    };

    const executeSession = async (sessionId) => {
        const session = sessions.find(s => s.id === sessionId);
        if (!session) return;

        session.status = 'running';
        setSessions([...sessions]);
        addLog(`Execution started for: ${session.goal}`);

        for (const task of session.tasks) {
            task.status = 'active';
            setSessions([...sessions]);
            addLog(`Agent: ${task.description}`);

            try {
                if (task.type === 'file_edit') {
                    const fullPath = workspace + '\\' + task.path;
                    await window.api.writeFile(fullPath, task.content || "");
                    addLog(`File written: ${task.path}`);
                    loadFiles(workspace);
                    if (activeFile === fullPath && monacoRef.current) monacoRef.current.setValue(task.content);
                } else if (task.type === 'terminal') {
                    if (confirm(`Approve terminal command: ${task.command}`)) {
                        const result = await window.api.executeCommand(task.command);
                        if (result.success) {
                            addLog(`Command success: ${task.command}`);
                            loadFiles(workspace);
                        } else {
                            addLog(`Command failed: ${result.stderr || result.error}`, 'error');
                            task.status = 'error';
                            break;
                        }
                    } else {
                        addLog(`Command skipped: ${task.command}`);
                        task.status = 'cancelled';
                        break;
                    }
                }
                task.status = 'finished';
            } catch (err) {
                task.status = 'error';
                addLog(`Task failed: ${err.message}`, 'error');
                break;
            }
        }

        session.status = session.tasks.every(t => t.status === 'finished') ? 'finished' : 'error';
        setSessions([...sessions]);
        window.api.saveSessions(sessions);
        loadFiles(workspace);
        const usage = await window.api.getTokenUsage();
        if (usage) setTokenUsage(usage);
    };

    const toggleTerminal = () => {
        if (!isTerminalVisible && terminalHeight < 150) {
            setTerminalHeight(240);
        }
        setIsTerminalVisible(!isTerminalVisible);
    };

    const handleTerminalInput = async (e) => {
        if (e.key === 'Enter') {
            if (!terminalInput.trim()) return;
            const input = terminalInput;
            setTerminalInput('');
            setTerminalHistory(prev => [input, ...prev]);
            setHistoryIndex(-1);
            // Echo input to logs
            addLog(`A > ${input}`, 'terminal');
            await window.api.sendTerminalInput(input);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (historyIndex < terminalHistory.length - 1) {
                const newIndex = historyIndex + 1;
                setHistoryIndex(newIndex);
                setTerminalInput(terminalHistory[newIndex]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                setTerminalInput(terminalHistory[newIndex]);
            } else if (historyIndex === 0) {
                setHistoryIndex(-1);
                setTerminalInput('');
            }
        }
    };

    const onResizerMouseDown = (dir) => (e) => {
        if (e.target.closest('button')) return;
        e.preventDefault();
        setResizing(dir);
    };

    return (
        <div className={`app-container theme-${settings.theme}`}>
            <header className="header glass">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button className="btn-icon-sm" onClick={() => setIsLeftSidebarVisible(!isLeftSidebarVisible)}>
                        <Icon name={PanelLeft} size={20} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 8 }}>
                        <img src="assets/logo.png" style={{ height: 28, width: 28, borderRadius: '6px' }} alt="Anita" />
                        <div className="title" style={{ fontSize: '18px' }}>Anita</div>
                    </div>
                </div>

                <div style={{ display: 'none' }}>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', borderRight: '1px solid var(--border-color)', paddingRight: 12 }}>
                        <button
                            className={`btn-icon-sm ${isTerminalVisible ? 'active' : ''}`}
                            onClick={() => setIsTerminalVisible(!isTerminalVisible)}
                            title="Toggle Terminal"
                        >
                            <Icon name={PanelBottom} size={18} />
                        </button>
                    </div>
                    <div className="workspace-badge" onClick={handleSelectWorkspace}>
                        <Icon name={FolderOpen} size={14} />
                        <span>{workspace ? workspace.split(/[\\/]/).pop() : 'Open Workspace'}</span>
                    </div>
                    <div className="token-usage">
                        Tokens: {tokenUsage.session} <span style={{ opacity: 0.5 }}>/ {tokenUsage.total}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', borderLeft: '1px solid var(--border-color)', paddingLeft: 12, marginLeft: 4 }}>
                        <button className="btn-icon-sm" onClick={() => setShowSettings(true)}>
                            <Icon name={Settings} size={20} />
                        </button>
                        <button className={`btn-icon-sm ${isRightPanelVisible ? 'active' : ''}`} onClick={() => setIsRightPanelVisible(!isRightPanelVisible)}>
                            <Icon name={PanelRight} size={20} />
                        </button>
                    </div>
                </div>
            </header>

            <div className="app-main">
                <aside className={`sidebar ${isLeftSidebarVisible ? '' : 'collapsed'}`} style={{ width: isLeftSidebarVisible ? sidebarWidth : 0 }}>
                    <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 12 }}>
                        <span>EXPLORER</span>
                        <button className="btn-icon-sm" onClick={() => loadFiles(workspace)} title="Refresh Explorer">
                            <Icon name={RefreshCw} size={14} />
                        </button>
                    </div>
                    <div className="scrollable">
                        <FileTree
                            files={files}
                            expandedFolders={expandedFolders}
                            toggleFolder={toggleFolder}
                            openFile={openFile}
                            activeFile={activeFile}
                            depth={0}
                        />
                    </div>
                    {isLeftSidebarVisible && <div className="resizer-handle" onMouseDown={onResizerMouseDown('left')} style={{ position: 'absolute', right: -3, top: 0, bottom: 0, width: 6, cursor: 'col-resize', zIndex: 100 }} />}
                </aside>

                <main className="main-content">
                    <div className="editor-area">
                        {tabs.length > 0 && (
                            <div className="editor-tabs">
                                {tabs.map(tab => {
                                    const icon = getFileIcon(tab.name);
                                    return (
                                        <div
                                            key={tab.path}
                                            className={`editor-tab ${activeFile === tab.path ? 'active' : ''}`}
                                            onClick={() => openFile(tab)}
                                        >
                                            <Icon name={icon.name} size={14} style={{ color: icon.color }} className="tab-icon" />
                                            <span>{tab.name}</span>
                                            {tab.isDirty && <div className="dirty-dot" />}
                                            <button className="tab-close" onClick={(e) => closeFile(e, tab.path)}>
                                                <Icon name={X} size={12} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <div
                            id="editor-container"
                            style={{
                                width: '100%',
                                height: '100%',
                                flex: 1,
                                display: activeFile ? 'block' : 'none'
                            }}
                        ></div>
                        {!activeFile && (
                            <div className="empty-state">
                                <Icon name={CodeIcon} size={64} style={{ opacity: 0.05 }} />
                                <p>Select a file to begin editing</p>
                            </div>
                        )}
                    </div>

                    <div
                        className="bottom-panel"
                        style={{ height: terminalHeight, display: isTerminalVisible ? 'flex' : 'none' }}
                    >
                        <div className="terminal-header" style={{ cursor: 'row-resize', userSelect: 'none' }} onMouseDown={onResizerMouseDown('bottom')}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span>TERMINAL / LOGS</span>
                            </div>
                            <div className="header-actions" onMouseDown={e => e.stopPropagation()}>
                                <button className="btn-icon-sm" onClick={() => setIsTerminalVisible(false)} title="Close Terminal">
                                    <Icon name={X} size={14} />
                                </button>
                                <button className="btn-icon-sm" onClick={(e) => { e.stopPropagation(); setLogs([]); }} title="Clear Logs">
                                    <Icon name={Trash2} size={12} />
                                </button>
                            </div>
                        </div>
                        <div
                            className="terminal-content scrollable"
                            onClick={() => terminalInputRef.current?.focus()}
                        >
                            {logs.map(log => (
                                <div key={log.id} className={`log-entry ${log.type}`}>
                                    <span className="log-time">{log.time}</span>
                                    <span>{log.msg}</span>
                                </div>
                            ))}
                            <div className="terminal-input-line">
                                <span className="terminal-prompt">A</span>
                                <input
                                    type="text"
                                    className="terminal-input-field"
                                    ref={terminalInputRef}
                                    value={terminalInput}
                                    onChange={(e) => setTerminalInput(e.target.value)}
                                    onKeyDown={handleTerminalInput}
                                    autoFocus
                                />
                            </div>
                            <div id="logs-end"></div>
                        </div>
                    </div>
                </main>

                <aside className={`right-panel ${isRightPanelVisible ? '' : 'collapsed'}`} style={{ width: isRightPanelVisible ? rightPanelWidth : 0 }}>
                    {isRightPanelVisible && <div className="resizer-handle" onMouseDown={onResizerMouseDown('right')} style={{ position: 'absolute', left: -3, top: 0, bottom: 0, width: 6, cursor: 'col-resize', zIndex: 100 }} />}
                    <div className="panel-tabs">
                        <button className={activeTab === 'chat' ? 'active' : ''} onClick={() => setActiveTab('chat')}>CHAT</button>
                        <button className={activeTab === 'manager' ? 'active' : ''} onClick={() => setActiveTab('manager')}>HISTORY</button>
                    </div>

                    <div className="scrollable" style={{ background: 'var(--bg-secondary)' }}>
                        {activeTab === 'chat' ? (
                            <div className="chat-view">
                                <div className="welcome-msg" style={{ padding: 24, textAlign: 'center' }}>
                                    <h2 style={{ fontFamily: 'Outfit', fontSize: 20, marginBottom: 8 }}>Hello!</h2>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>
                                        I'm your agentic assistant. Tell me what you'd like to build and I'll create a plan to implement it.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="manager-view">
                                {sessions.length === 0 && (
                                    <div style={{ padding: 40, textAlign: 'center', opacity: 0.3 }}>
                                        <Icon name={List} size={48} style={{ marginBottom: 12 }} />
                                        <p style={{ fontSize: 13 }}>No active tasks</p>
                                    </div>
                                )}
                                {sessions.map(session => (
                                    <div key={session.id} className="session-card">
                                        <div className="session-header">
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <strong>{session.goal}</strong>
                                                <span style={{ fontSize: 10, opacity: 0.5, marginTop: 4 }}>
                                                    {session.timestamp ? new Date(session.timestamp).toLocaleString() : 'Recent'}
                                                </span>
                                            </div>
                                            <span className={`status-badge ${session.status}`}>{session.status.replace('_', ' ')}</span>
                                        </div>
                                        <p className="plan-text">{session.plan}</p>
                                        <div className="task-list">
                                            {session.tasks.map(t => (
                                                <div key={t.id} className={`task-item ${t.status}`}>
                                                    {t.status === 'finished' ? (
                                                        <Icon name={CheckCircle} size={14} style={{ color: 'var(--accent-success)' }} />
                                                    ) : t.status === 'active' ? (
                                                        <Icon name={RefreshCw} size={14} className="spin" style={{ color: 'var(--accent-primary)' }} />
                                                    ) : (
                                                        <div className="dot" />
                                                    )}
                                                    <span>{t.description}</span>
                                                </div>
                                            ))}
                                        </div>
                                        {session.status === 'awaiting_approval' && (
                                            <button
                                                className="btn btn-primary"
                                                style={{ width: '100%', marginTop: 16 }}
                                                onClick={() => executeSession(session.id)}
                                            >
                                                Start Execution
                                            </button>
                                        )}
                                        {session.status === 'finished' && (
                                            <button
                                                className="btn btn-outline"
                                                style={{ width: '100%', marginTop: 12 }}
                                            >
                                                Review Changes
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {sessions.length > 0 && (
                                    <div style={{ padding: '0 16px 20px', textAlign: 'center' }}>
                                        <button
                                            className="btn btn-outline"
                                            style={{ width: '100%', fontSize: 11, opacity: 0.6 }}
                                            onClick={() => {
                                                if (confirm("Clear all session history?")) {
                                                    setSessions([]);
                                                    window.api.saveSessions([]);
                                                }
                                            }}
                                        >
                                            Clear History
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="composer-area">
                        <div className="composer-wrapper">
                            <textarea
                                className="composer-input"
                                placeholder="Describe what you want to build..."
                                value={composerInput}
                                onChange={(e) => setComposerInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSubmitProposal())}
                            />
                            <button className="send-btn" onClick={handleSubmitProposal} disabled={isPlanning}>
                                {isPlanning ? <Icon name={Loader2} className="spin" size={18} /> : <Icon name={Send} size={16} />}
                            </button>
                        </div>
                    </div>
                </aside>
            </div >

            {showSettings && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3>Settings</h3>
                        <div className="field">
                            <label>OpenRouter API Key</label>
                            <input
                                type="password"
                                placeholder="sk-or-..."
                                className="input"
                                value={settings.apiKey}
                                onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                            />
                        </div>
                        <div className="field">
                            <label>Coding Model</label>
                            <select
                                className="input"
                                value={settings.model}
                                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                            >
                                <option value="deepseek/deepseek-chat">DeepSeek Chat (Preferred)</option>
                                <option value="deepseek/deepseek-coder">DeepSeek Coder</option>
                                <option value="google/gemini-flash-1.5-8b">Gemini Flash 1.5</option>
                                <option value="mistralai/mistral-7b-instruct:free">Mistral 7B (Free)</option>
                            </select>
                        </div>
                        <div className="modal-actions" style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 32 }}>
                            <button className="btn btn-outline" onClick={() => setShowSettings(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={async () => {
                                await window.api.saveSettings(settings);
                                setShowSettings(false);
                            }}>Save Changes</button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
