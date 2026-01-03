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
const Square = 'square';
const History = 'history';
const Maximize2 = 'maximize-2';
const Minimize2 = 'minimize-2';
const Minus = 'minus';

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

const Icon = ({ name, size = 16, className = '', style = {}, ...props }) => {
    const iconRef = useRef(null);

    useEffect(() => {
        if (window.lucide && iconRef.current) {
            // Use a stable way to render the icon that won't confuse React
            iconRef.current.innerHTML = `<i data-lucide="${name}"></i>`;
            window.lucide.createIcons({
                root: iconRef.current, // Scoped to this element
                attrs: {
                    width: size,
                    height: size,
                    strokeWidth: 2,
                    class: className
                }
            });
        }
    }, [name, size, className]);

    return (
        <span
            ref={iconRef}
            className={`lucide-icon-wrapper ${className}`}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                ...style
            }}
            {...props}
        />
    );
};

const Markdown = ({ content }) => {
    const html = useMemo(() => {
        if (!window.marked || !window.DOMPurify) return content;
        try {
            const rawHtml = window.marked.parse(content);
            return window.DOMPurify.sanitize(rawHtml, {
                ADD_TAGS: ['button'],
                ADD_ATTR: ['data-code', 'class'],
                FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed'],
                FORBID_ATTR: ['id', 'name'] // Prevent clashing with IDE elements
            });
        } catch (e) {
            console.error("Markdown parse error", e);
            return content;
        }
    }, [content]);

    const handleCopy = (e) => {
        const btn = e.target.closest('.copy-code-btn');
        if (btn) {
            const encodedCode = btn.getAttribute('data-code');
            const textArea = document.createElement("textarea");
            textArea.innerHTML = encodedCode;
            const code = textArea.value;

            navigator.clipboard.writeText(code);
            const originalText = btn.innerText;
            btn.innerText = 'Copied!';
            btn.classList.add('success');
            setTimeout(() => {
                btn.innerText = originalText;
                btn.classList.remove('success');
            }, 2000);
        }
    };

    useEffect(() => {
        // Find code blocks and inject copy buttons
        // Marked generates <pre><code>...</code></pre>
    }, [html]);

    return (
        <div
            className="markdown-content"
            dangerouslySetInnerHTML={{ __html: html }}
            onClick={handleCopy}
            onError={(e) => {
                console.error("Markdown render error", e);
                e.target.innerText = content; // Fallback to raw text
            }}
        />
    );
};

class AIService {
    constructor(apiKey, model) {
        this.apiKey = apiKey;
        this.model = model || 'deepseek/deepseek-chat';
        this.baseUrl = "https://openrouter.ai/api/v1";
    }

    async chat(messages, signal) {
        if (!this.apiKey) throw new Error("API Key missing. Go to Settings.");

        // Inject a system instruction to ensure standard markdown code blocks and OS compatibility
        const systemMsg = {
            role: "system",
            content: "You are a professional coding assistant. The user is on Windows. CRITICAL: Always wrap any code snippets in standard Markdown triple backticks with a language identifier. For file operations, prioritize the 'file_edit' task type. For terminal commands, ensure compatibility with Windows CMD/PowerShell (avoid bash-specific syntax like '<<' or 'export')."
        };

        const hasSystem = messages.some(m => m.role === 'system');
        const finalMessages = hasSystem ? messages : [systemMsg, ...messages];

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: "POST",
                signal,
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://github.com/google-deepmind/antigravity",
                    "X-Title": "Anita IDE"
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: finalMessages,
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
    const [terminals, setTerminals] = useState([{
        id: 't1',
        logs: [],
        input: '',
        history: [],
        historyIndex: -1,
        cwd: '',
        cwdInput: ''
    }]);
    const [activeTerminalId, setActiveTerminalId] = useState('t1');
    const [composerMode, setComposerMode] = useState('agent');

    // Layout State
    const [isLeftSidebarVisible, setIsLeftSidebarVisible] = useState(true);
    const [isRightPanelVisible, setIsRightPanelVisible] = useState(true);
    const [isTerminalVisible, setIsTerminalVisible] = useState(true);
    const [sidebarWidth, setSidebarWidth] = useState(260);
    const [rightPanelWidth, setRightPanelWidth] = useState(380);
    const [terminalHeight, setTerminalHeight] = useState(240);
    const [resizing, setResizing] = useState(null); // 'left', 'right', 'bottom'
    const [isHistorySidebarVisible, setIsHistorySidebarVisible] = useState(false);
    const [isCentralPanelVisible, setIsCentralPanelVisible] = useState(true);
    const abortControllerRef = useRef(null);

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsPlanning(false);
        setChats(prev => prev.map(c => ({
            ...c,
            messages: c.messages.filter(m => !m.isLoading)
        })));
        addLog(null, "AI request cancelled by user.");
    };

    // Chat Sessions State
    const [chats, setChats] = useState([{ id: 'default', title: 'New Chat', messages: [], createdAt: Date.now(), lastUpdatedAt: Date.now() }]);
    const [activeChatId, setActiveChatId] = useState('default');
    const [openChatIds, setOpenChatIds] = useState(['default']);
    const [historyLoaded, setHistoryLoaded] = useState(false);

    const monacoRef = useRef(null);
    const terminalInputRef = useRef(null);
    const composerRef = useRef(null);
    const ai = useMemo(() => new AIService(settings.apiKey, settings.model), [settings.apiKey, settings.model]);

    useEffect(() => {
        const init = async () => {
            const path = await window.api.getWorkspacePath();
            if (path) {
                setWorkspace(path);
                setTerminals(prev => prev.map(t => ({ ...t, cwd: path, cwdInput: path })));
                loadFiles(path);
            }
            const tcwd = await window.api.getTerminalCwd(activeTerminalId);
            if (tcwd) {
                setTerminals(prev => prev.map(t => t.id === 't1' ? { ...t, cwd: tcwd, cwdInput: tcwd } : t));
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

            const savedChats = await window.api.getChats();
            if (savedChats && savedChats.length > 0) {
                setChats(savedChats);

                // Load open tabs from localStorage
                const savedOpenIds = window.localStorage.getItem('openChatIds');
                if (savedOpenIds) {
                    try {
                        const parsed = JSON.parse(savedOpenIds);
                        // Filter out any IDs that might have been deleted but are still in localStorage
                        const validIds = parsed.filter(id => savedChats.some(c => c.id === id));
                        setOpenChatIds(validIds.length > 0 ? validIds : [savedChats[0].id]);
                        setActiveChatId(validIds.includes(activeChatId) ? activeChatId : (validIds[0] || savedChats[0].id));
                    } catch (e) {
                        setOpenChatIds([savedChats[0].id]);
                        setActiveChatId(savedChats[0].id);
                    }
                } else {
                    setOpenChatIds([savedChats[0].id]);
                    setActiveChatId(savedChats[0].id);
                }
            }
            setHistoryLoaded(true);

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

            if (window.marked) {
                // Use the modern .use API for consistent rendering
                window.marked.use({
                    renderer: {
                        code(args, language) {
                            let code = typeof args === 'object' ? args.text : args;
                            let lang = typeof args === 'object' ? (args.lang || 'code') : (language || 'code');

                            if (typeof code !== 'string') code = String(code || '');

                            const escapedCode = code
                                .replace(/&/g, "&amp;")
                                .replace(/</g, "&lt;")
                                .replace(/>/g, "&gt;")
                                .replace(/"/g, "&quot;")
                                .replace(/'/g, "&#039;");

                            return `
                                <div class="code-block-wrapper">
                                    <div class="code-block-header">
                                        <span>${lang}</span>
                                        <button class="copy-code-btn" data-code="${escapedCode}">Copy</button>
                                    </div>
                                    <pre><code class="language-${lang}">${code}</code></pre>
                                </div>
                            `;
                        }
                    },
                    breaks: true,
                    gfm: true
                });
            }
            if (window.api.onTerminalData) {
                window.api.onTerminalData(({ terminalId, data }) => {
                    const cleanData = data.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
                    if (!cleanData) return;

                    setTerminals(prev => prev.map(t => {
                        if (t.id === terminalId) {
                            const lastLog = t.logs[t.logs.length - 1];
                            if (lastLog && lastLog.type === 'terminal' && (Date.now() - lastLog.timestamp < 1000)) {
                                const newLogs = [...t.logs];
                                newLogs[newLogs.length - 1] = { ...lastLog, msg: lastLog.msg + cleanData };
                                return { ...t, logs: newLogs.slice(-200) };
                            } else {
                                return {
                                    ...t,
                                    logs: [...t.logs.slice(-200), {
                                        id: Date.now() + Math.random(),
                                        timestamp: Date.now(),
                                        msg: cleanData,
                                        type: 'terminal',
                                        time: new Date().toLocaleTimeString()
                                    }]
                                };
                            }
                        }
                        return t;
                    }));
                });
            }
        };
        init();
    }, []);

    useEffect(() => {
        const el = document.getElementById('logs-end');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, [terminals, activeTerminalId]);

    useEffect(() => {
        const el = document.getElementById('chat-end');
        if (el) el.scrollIntoView({ behavior: 'smooth' });

        if (historyLoaded) {
            window.api.saveChats(chats.map(c => ({
                ...c,
                messages: c.messages.filter(m => !m.isLoading)
            })));
            // Save open tabs too
            window.localStorage.setItem('openChatIds', JSON.stringify(openChatIds));
        }
    }, [chats, openChatIds, historyLoaded]);

    const activeChat = chats.find(c => c.id === activeChatId);

    const createNewChat = () => {
        const existingTitles = new Set(chats.map(c => c.title));
        let newTitle = 'New Chat';
        if (existingTitles.has(newTitle)) {
            let counter = 1;
            while (existingTitles.has(`New Chat(${counter})`)) {
                counter++;
            }
            newTitle = `New Chat(${counter})`;
        }

        const newChat = {
            id: 'c-' + Date.now(),
            title: newTitle,
            messages: [],
            createdAt: Date.now(),
            lastUpdatedAt: Date.now()
        };
        setChats(prev => [...prev, newChat]);
        setOpenChatIds(prev => [...prev, newChat.id]);
        setActiveChatId(newChat.id);
    };

    const closeChatTab = (id, e) => {
        e.stopPropagation();
        const newOpenIds = openChatIds.filter(oid => oid !== id);
        setOpenChatIds(newOpenIds);

        if (activeChatId === id) {
            setActiveChatId(newOpenIds.length > 0 ? newOpenIds[newOpenIds.length - 1] : null);
        }
    };



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
            setTerminalCwd(path);
            setTerminalCwdInput(path);
            loadFiles(path);
        }
    };

    const addLog = (terminalId, msg, type = 'info') => {
        const targetId = terminalId || activeTerminalId;
        setTerminals(prev => prev.map(t => {
            if (t.id === targetId) {
                return {
                    ...t,
                    logs: [...t.logs.slice(-100), { id: Date.now() + Math.random(), msg, type, time: new Date().toLocaleTimeString() }]
                };
            }
            return t;
        }));
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
            addLog(null, `Error opening file: ${err.message}`, 'error');
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
            addLog(null, `Saved ${tab.name}`);
        } catch (err) {
            addLog(null, `Error saving file: ${err.message}`, 'error');
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
        if (isPlanning) return handleStop();
        if (!composerInput.trim()) return;
        if (!workspace) {
            addLog(null, "Please select a workspace first.", "error");
            return;
        }
        if (!settings.apiKey) return setShowSettings(true);

        const goal = composerInput;
        setComposerInput('');
        setIsPlanning(true);

        const currentController = new AbortController();
        abortControllerRef.current = currentController;
        const signal = currentController.signal;

        const userMsg = {
            id: 'u-' + Date.now(),
            role: 'user',
            content: goal,
            timestamp: new Date().toLocaleTimeString()
        };

        const currentActiveChat = chats.find(c => c.id === activeChatId);
        if (!currentActiveChat) return;

        const updatedMessages = [...currentActiveChat.messages, userMsg];

        // Update local state for immediate feedback
        setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: updatedMessages, lastUpdatedAt: Date.now() } : c));

        try {
            if (composerMode === 'agent') {
                addLog(null, `Planner: analyzing user goal with context...`);

                const historyContext = updatedMessages
                    .slice(-10)
                    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
                    .join('\n');

                const agentPrompt = `You are an expert coding agent. 
Previous conversation context:
${historyContext}

Your current goal: "${goal}"

The OS is Windows. 

Based on the conversation history and the current goal, create a comprehensive plan.
Respond ONLY with a JSON object:
{ 
  "plan": "detailed explanation of the summarized requirements and the implementation strategy", 
  "tasks": [
    { 
      "id": 1, 
      "description": "Short summary of the task", 
      "type": "file_edit", 
      "path": "folder/filename.ext", 
      "content": "Fully written code for file_edit tasks" 
    },
    { 
      "id": 2, 
      "description": "Install dependencies", 
      "type": "terminal", 
      "command": "npm install package-name" 
    }
  ] 
}`;

                const response = await ai.chat([{ role: "user", content: agentPrompt }], signal);
                let proposal;
                try {
                    proposal = JSON.parse(response.replace(/```json|```/g, "").trim());
                } catch (e) {
                    console.error("Failed to parse AI response as JSON", response);
                    throw new Error("AI response was not valid JSON. Please try again.");
                }

                const newSession = {
                    id: Date.now(),
                    chatId: activeChatId,
                    timestamp: new Date().toISOString(),
                    goal,
                    plan: proposal.plan,
                    tasks: proposal.tasks.map(t => ({ ...t, status: 'pending' })),
                    status: 'awaiting_approval'
                };

                const updatedSessions = [newSession, ...sessions];
                setSessions(updatedSessions);
                window.api.saveSessions(updatedSessions);

                const summaryMsg = {
                    id: 'agent-' + Date.now(),
                    role: 'assistant',
                    type: 'agent_session',
                    sessionId: newSession.id,
                    timestamp: new Date().toLocaleTimeString()
                };

                setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...updatedMessages, summaryMsg] } : c));
                addLog(null, `Planner: proposal generated inline.`);
            } else {
                // Chat Mode
                const loadingMsg = {
                    id: 'l-' + Date.now(),
                    role: 'assistant',
                    content: '...',
                    isLoading: true,
                    timestamp: new Date().toLocaleTimeString()
                };

                setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: [...updatedMessages, loadingMsg] } : c));
                setActiveTab('chat');

                const response = await ai.chat(updatedMessages.map(m => ({ role: m.role, content: m.content })), signal);

                const assistantMsg = {
                    id: 'a-' + Date.now(),
                    role: 'assistant',
                    content: response,
                    timestamp: new Date().toLocaleTimeString()
                };

                setChats(prev => prev.map(c => {
                    if (c.id === activeChatId) {
                        const newMessages = [...updatedMessages.filter(m => !m.isLoading), assistantMsg];
                        let newTitle = c.title;

                        // Only rename if it's the first exchange and title is still default
                        const isOriginalDefault = c.title === 'New Chat' || c.title.startsWith('New Chat(');
                        const userMessages = newMessages.filter(m => m.role === 'user');

                        if (isOriginalDefault && userMessages.length === 1) {
                            // Trigger background title generation
                            generateChatTitle(userMessages[0].content).then(generatedTitle => {
                                if (generatedTitle) {
                                    setChats(latestChats => latestChats.map(lc =>
                                        lc.id === activeChatId ? { ...lc, title: generatedTitle } : lc
                                    ));
                                }
                            });
                        }

                        return { ...c, messages: newMessages };
                    }
                    return c;
                }));
            }
        } catch (err) {
            if (err.name === 'AbortError') {
                console.log("Request cancelled successfully");
            } else {
                console.error(err);
                addLog(null, `Error: ${err.message}`, "error");
            }
            setChats(prev => prev.map(c => c.id === activeChatId ? { ...c, messages: c.messages.filter(m => !m.isLoading) } : c));
        } finally {
            setIsPlanning(false);
            if (abortControllerRef.current === currentController) {
                abortControllerRef.current = null;
            }
        }
    };

    const generateChatTitle = async (userPrompt) => {
        try {
            const titlePrompt = `Based on this user message, generate a VERY short (max 3-4 words) descriptive title for the chat. Respond ONLY with the title text, no quotes or punctuation unless necessary.

User Message: "${userPrompt}"`;
            const title = await ai.chat([{ role: "user", content: titlePrompt }]);
            return title.trim().replace(/^["']|["']$/g, '');
        } catch (err) {
            console.error("Failed to generate title", err);
            return null;
        }
    };

    const executeSession = async (sessionId) => {
        const session = sessions.find(s => s.id === sessionId);
        if (!session) return;

        session.status = 'running';
        setSessions([...sessions]);
        addLog(null, `Execution started for: ${session.goal}`);

        for (const task of session.tasks) {
            task.status = 'active';
            setSessions([...sessions]);
            addLog(null, `Agent: ${task.description}`);

            try {
                if (task.type === 'file_edit') {
                    const fullPath = workspace + '\\' + task.path;
                    await window.api.writeFile(fullPath, task.content || "");
                    addLog(null, `File written: ${task.path}`);
                    loadFiles(workspace);
                    if (activeFile === fullPath && monacoRef.current) monacoRef.current.setValue(task.content);
                } else if (task.type === 'terminal') {
                    if (confirm(`Approve terminal command: ${task.command}`)) {
                        const result = await window.api.executeCommand(task.command);
                        if (result.success) {
                            addLog(null, `Command success: ${task.command}`);
                            loadFiles(workspace);
                        } else {
                            addLog(null, `Command failed: ${result.stderr || result.error}`, 'error');
                            task.status = 'error';
                            break;
                        }
                    } else {
                        addLog(null, `Command skipped: ${task.command}`);
                        task.status = 'cancelled';
                        break;
                    }
                }
                task.status = 'finished';
            } catch (err) {
                task.status = 'error';
                addLog(null, `Task failed: ${err.message}`, 'error');
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
        const activeTerminal = terminals.find(t => t.id === activeTerminalId);
        if (!activeTerminal) return;

        if (e.key === 'Enter') {
            const input = activeTerminal.input;
            if (!input.trim()) return;

            setTerminals(prev => prev.map(t => {
                if (t.id === activeTerminalId) {
                    return {
                        ...t,
                        input: '',
                        history: [input, ...t.history],
                        historyIndex: -1
                    };
                }
                return t;
            }));

            // Echo input to logs
            addLog(activeTerminalId, `Phil > ${input}`, 'terminal');
            await window.api.sendTerminalInput(activeTerminalId, input);

            // Refresh CWD after a short delay
            setTimeout(async () => {
                const updatedCwd = await window.api.getTerminalCwd(activeTerminalId);
                setTerminals(prev => prev.map(t => t.id === activeTerminalId ? { ...t, cwd: updatedCwd, cwdInput: updatedCwd } : t));
            }, 100);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (activeTerminal.historyIndex < activeTerminal.history.length - 1) {
                const newIndex = activeTerminal.historyIndex + 1;
                const prevCommand = activeTerminal.history[newIndex];
                setTerminals(prev => prev.map(t => t.id === activeTerminalId ? { ...t, historyIndex: newIndex, input: prevCommand } : t));
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (activeTerminal.historyIndex > 0) {
                const newIndex = activeTerminal.historyIndex - 1;
                const nextCommand = activeTerminal.history[newIndex];
                setTerminals(prev => prev.map(t => t.id === activeTerminalId ? { ...t, historyIndex: newIndex, input: nextCommand } : t));
            } else if (activeTerminal.historyIndex === 0) {
                setTerminals(prev => prev.map(t => t.id === activeTerminalId ? { ...t, historyIndex: -1, input: '' } : t));
            }
        }
    };

    const handleDirectorySubmit = async () => {
        const activeTerminal = terminals.find(t => t.id === activeTerminalId);
        if (!activeTerminal) return;

        if (!activeTerminal.cwdInput.trim() || activeTerminal.cwdInput === activeTerminal.cwd) {
            setTerminals(prev => prev.map(t => t.id === activeTerminalId ? { ...t, cwdInput: t.cwd } : t));
            return;
        }

        const result = await window.api.setTerminalCwd(activeTerminalId, activeTerminal.cwdInput.trim());
        if (result.success) {
            setTerminals(prev => prev.map(t => t.id === activeTerminalId ? { ...t, cwd: result.path, cwdInput: result.path } : t));
            addLog(activeTerminalId, `Directory changed to: ${result.path}`, 'info');
        } else {
            addLog(activeTerminalId, `Failed to change directory: ${result.error}`, 'error');
            setTerminals(prev => prev.map(t => t.id === activeTerminalId ? { ...t, cwdInput: t.cwd } : t));
        }
    };

    const addTerminal = () => {
        const newId = 't-' + Date.now();
        const newTerminal = {
            id: newId,
            logs: [],
            input: '',
            history: [],
            historyIndex: -1,
            cwd: workspace || '',
            cwdInput: workspace || ''
        };
        setTerminals([...terminals, newTerminal]);
        setActiveTerminalId(newId);
    };

    const closeTerminal = async (id, e) => {
        if (e) e.stopPropagation();
        if (terminals.length <= 1) return;

        await window.api.closeTerminal(id);
        const newTerminals = terminals.filter(t => t.id !== id);
        setTerminals(newTerminals);
        if (activeTerminalId === id) {
            setActiveTerminalId(newTerminals[newTerminals.length - 1].id);
        }
    };

    const onResizerMouseDown = (dir) => (e) => {
        if (e.target.closest('button') || e.target.closest('.terminal-cwd-box')) return;
        e.preventDefault();
        setResizing(dir);
    };

    return (
        <div className={`app-container theme-${settings.theme}`}>
            <header className="header glass">
                <div className="header-left">
                    <img src="assets/logo.png" className="header-logo" alt="Anita" />
                    <div className="title" style={{ marginLeft: 8 }}>Anita</div>
                </div>

                <div className="header-center">
                    <span>{workspace ? workspace.replace(/\\/g, '/').split('/').pop() : 'No Project'} - {activeChat ? activeChat.title : 'Anita'}</span>
                </div>

                <div className="header-right">
                    <div className="header-actions">
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <button
                                className={`btn-icon-sm ${isLeftSidebarVisible ? 'active' : ''}`}
                                onClick={() => setIsLeftSidebarVisible(!isLeftSidebarVisible)}
                                title="Toggle Explorer"
                            >
                                <Icon name={PanelLeft} size={14} />
                            </button>
                            <button
                                className={`btn-icon-sm ${isTerminalVisible ? 'active' : ''}`}
                                onClick={() => setIsTerminalVisible(!isTerminalVisible)}
                                title="Toggle Terminal"
                            >
                                <Icon name={PanelBottom} size={14} />
                            </button>
                            <button
                                className={`btn-icon-sm ${isRightPanelVisible ? 'active' : ''}`}
                                onClick={() => setIsRightPanelVisible(!isRightPanelVisible)}
                                title="Toggle Chat"
                            >
                                <Icon name={PanelRight} size={14} />
                            </button>
                            <button
                                className={`btn-icon-sm ${!isCentralPanelVisible ? 'active' : ''}`}
                                onClick={() => setIsCentralPanelVisible(!isCentralPanelVisible)}
                                title={isCentralPanelVisible ? "Expand Chat" : "Show Editor"}
                            >
                                <Icon name={isCentralPanelVisible ? Maximize2 : Minimize2} size={14} />
                            </button>
                        </div>

                        <div className="token-usage" style={{ fontSize: '11px', marginLeft: 12, marginRight: 8 }}>
                            Tokens: {tokenUsage.session} <span style={{ opacity: 0.5 }}>/ {tokenUsage.total}</span>
                        </div>

                        <button className="btn-icon-sm" onClick={() => setShowSettings(true)} title="Settings">
                            <Icon name={Settings} size={16} />
                        </button>
                    </div>

                    <div className="window-controls">
                        <button className="ctrl-btn" onClick={() => window.api.minimize()}>
                            <Icon name={Minus} size={14} />
                        </button>
                        <button className="ctrl-btn" onClick={() => window.api.maximize()}>
                            <Icon name={Square} size={12} />
                        </button>
                        <button className="ctrl-btn close" onClick={() => window.api.close()}>
                            <Icon name={X} size={14} />
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

                {isCentralPanelVisible && (
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
                            <div className="terminal-tabs">
                                {terminals.map((t, idx) => (
                                    <div
                                        key={t.id}
                                        className={`terminal-tab ${activeTerminalId === t.id ? 'active' : ''}`}
                                        onClick={() => setActiveTerminalId(t.id)}
                                    >
                                        <Icon name={Terminal} size={14} />
                                        <span>Terminal {idx + 1}</span>
                                        {terminals.length > 1 && (
                                            <button className="close-tab" onClick={(e) => closeTerminal(t.id, e)}>
                                                <Icon name={X} size={12} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button className="add-tab-btn" onClick={addTerminal} title="Add Terminal">
                                    <Icon name={Plus} size={14} />
                                </button>
                            </div>
                            <div className="terminal-header" style={{ cursor: 'row-resize', userSelect: 'none' }} onMouseDown={onResizerMouseDown('bottom')}>
                                <div className="terminal-header-left">
                                    <input
                                        className="terminal-cwd-box"
                                        value={terminals.find(t => t.id === activeTerminalId)?.cwdInput || ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setTerminals(prev => prev.map(t => t.id === activeTerminalId ? { ...t, cwdInput: val } : t));
                                        }}
                                        onFocus={(e) => e.target.select()}
                                        onBlur={handleDirectorySubmit}
                                        onKeyDown={(e) => e.key === 'Enter' && (e.target.blur())}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        title="Click to edit current directory"
                                    />
                                </div>
                                <div className="header-actions" onMouseDown={e => e.stopPropagation()}>
                                    <button className="btn-icon-sm" onClick={() => setIsTerminalVisible(false)} title="Close Panel">
                                        <Icon name={Minimize2} size={14} />
                                    </button>
                                    <button className="btn-icon-sm" onClick={(e) => {
                                        e.stopPropagation();
                                        setTerminals(prev => prev.map(t => t.id === activeTerminalId ? { ...t, logs: [] } : t));
                                    }} title="Clear Logs">
                                        <Icon name={Trash2} size={12} />
                                    </button>
                                </div>
                            </div>
                            <div
                                className="terminal-content scrollable"
                                onClick={() => {
                                    const selection = window.getSelection();
                                    if (selection.type !== 'Range') {
                                        terminalInputRef.current?.focus();
                                    }
                                }}
                            >
                                {terminals.find(t => t.id === activeTerminalId)?.logs.map(log => (
                                    <div key={log.id} className={`log-entry ${log.type}`}>
                                        <span className="log-time">{log.time}</span>
                                        <div className="log-content-wrapper">
                                            {log.type === 'terminal' && !log.msg.startsWith('Phil > ') && (
                                                <div className="log-response-icon">A</div>
                                            )}
                                            <span>{log.msg}</span>
                                        </div>
                                    </div>
                                ))}
                                <div className="terminal-input-line">
                                    <span className="terminal-prompt">Phil &gt;</span>
                                    <input
                                        ref={terminalInputRef}
                                        type="text"
                                        className="terminal-input"
                                        value={terminals.find(t => t.id === activeTerminalId)?.input || ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setTerminals(prev => prev.map(t => t.id === activeTerminalId ? { ...t, input: val } : t));
                                        }}
                                        onKeyDown={handleTerminalInput}
                                    />
                                </div>
                                <div id="logs-end"></div>
                            </div>
                        </div>
                    </main>
                )}

                <aside className={`right-panel ${isRightPanelVisible ? '' : 'collapsed'} ${!isCentralPanelVisible ? 'expanded' : ''}`} style={{ width: (isRightPanelVisible && isCentralPanelVisible) ? rightPanelWidth : (isRightPanelVisible ? 'auto' : 0) }}>
                    {isRightPanelVisible && isCentralPanelVisible && <div className="resizer-handle-left" onMouseDown={onResizerMouseDown('right')} style={{ position: 'absolute', left: -3, top: 0, bottom: 0, width: 6, cursor: 'col-resize', zIndex: 100 }} />}
                    <div className="sidebar-header">
                        <span>CONTEXT & CHAT</span>
                    </div>

                    <div className="scrollable" style={{ background: 'var(--bg-secondary)' }}>
                        <div className="chat-view">
                            <div className="chat-sessions-bar">
                                <button
                                    className={`add-chat-btn ${isHistorySidebarVisible ? 'active' : ''}`}
                                    onClick={() => setIsHistorySidebarVisible(!isHistorySidebarVisible)}
                                    title="Chat History"
                                    style={{ marginRight: 4 }}
                                >
                                    <Icon name={History} size={14} />
                                </button>
                                <div className="sessions-list scrollable-x">
                                    {openChatIds.map(id => {
                                        const chat = chats.find(c => c.id === id);
                                        if (!chat) return null;
                                        return (
                                            <div
                                                key={chat.id}
                                                className={`chat-tab ${activeChatId === chat.id ? 'active' : ''}`}
                                                onClick={() => setActiveChatId(chat.id)}
                                            >
                                                <span className="tab-title">{chat.title}</span>
                                                <button className="close-tab" onClick={(e) => closeChatTab(chat.id, e)}>
                                                    <Icon name={X} size={10} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                                <button className="add-chat-btn" onClick={createNewChat} title="New Chat">
                                    <Icon name={Plus} size={14} />
                                </button>
                            </div>

                            {/* Off-canvas History Sidebar */}
                            <div className={`history-sidebar ${isHistorySidebarVisible ? 'open' : ''}`}>
                                <div className="history-sidebar-header">
                                    <span>Chat History</span>
                                    <button className="close-btn" onClick={() => setIsHistorySidebarVisible(false)}>
                                        <Icon name={X} size={14} />
                                    </button>
                                </div>
                                <div className="history-sidebar-content scrollable">
                                    {(() => {
                                        const sortedChats = [...chats].sort((a, b) => (b.lastUpdatedAt || b.createdAt) - (a.lastUpdatedAt || a.createdAt));
                                        const groups = {};

                                        sortedChats.forEach(chat => {
                                            const date = new Date(chat.lastUpdatedAt || chat.createdAt);
                                            const today = new Date();
                                            const yesterday = new Date();
                                            yesterday.setDate(today.getDate() - 1);

                                            let dayKey;
                                            if (date.toDateString() === today.toDateString()) {
                                                dayKey = 'Today';
                                            } else if (date.toDateString() === yesterday.toDateString()) {
                                                dayKey = 'Yesterday';
                                            } else {
                                                dayKey = date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
                                            }

                                            if (!groups[dayKey]) groups[dayKey] = [];
                                            groups[dayKey].push(chat);
                                        });

                                        return Object.entries(groups).map(([day, dayChats]) => (
                                            <div key={day} className="history-group">
                                                <div className="history-group-title">{day}</div>
                                                {dayChats.map(chat => (
                                                    <div
                                                        key={chat.id}
                                                        className={`history-item ${activeChatId === chat.id ? 'active' : ''}`}
                                                        onClick={() => {
                                                            if (!openChatIds.includes(chat.id)) {
                                                                setOpenChatIds(prev => [...prev, chat.id]);
                                                            }
                                                            setActiveChatId(chat.id);
                                                            setIsHistorySidebarVisible(false);
                                                        }}
                                                    >
                                                        <Icon name={MessageSquare} size={14} style={{ marginRight: 10, opacity: 0.6 }} />
                                                        <div className="history-item-info">
                                                            <div className="history-item-title">{chat.title}</div>
                                                            <div className="history-item-date">
                                                                {new Date(chat.lastUpdatedAt || chat.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        </div>

                                                    </div>
                                                ))}
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>

                            {isHistorySidebarVisible && (
                                <div className="history-sidebar-overlay" onClick={() => setIsHistorySidebarVisible(false)} />
                            )}

                            {(!activeChat || activeChat.messages.length === 0) ? (
                                <div className="welcome-msg" style={{ padding: 24, textAlign: 'center' }}>
                                    <h2 style={{ fontFamily: 'Outfit', fontSize: 20, marginBottom: 8 }}>Hello!</h2>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>
                                        I'm your agentic assistant. Tell me what you'd like to build and I'll create a plan to implement it.
                                    </p>
                                </div>
                            ) : (
                                <div className="messages-list">
                                    {activeChat.messages.map((m) => {
                                        if (m.type === 'agent_session') {
                                            const session = sessions.find(s => s.id === m.sessionId);
                                            if (!session) return null;
                                            return (
                                                <div key={m.id} className="session-card inline-session">
                                                    <div className="session-header">
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <strong style={{ fontSize: '15px' }}>{session.goal}</strong>
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
                                                    <div className="session-footer" style={{ marginTop: 16 }}>
                                                        {session.status === 'awaiting_approval' && (
                                                            <button
                                                                className="btn btn-primary"
                                                                style={{ width: '100%' }}
                                                                onClick={() => executeSession(session.id)}
                                                            >
                                                                Start Execution
                                                            </button>
                                                        )}
                                                        {session.status === 'finished' && (
                                                            <button
                                                                className="btn btn-outline"
                                                                style={{ width: '100%' }}
                                                            >
                                                                Review Changes
                                                            </button>
                                                        )}
                                                        {session.status === 'error' && (
                                                            <div style={{ color: 'var(--accent-error)', fontSize: '11px', textAlign: 'center' }}>
                                                                Execution encountered an error.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={m.id} className={`message-bubble ${m.role} ${m.isLoading ? 'loading' : ''}`}>
                                                <div className="message-content">
                                                    {m.isLoading ? (
                                                        <Icon name={Loader2} className="spin" size={16} />
                                                    ) : m.role === 'assistant' ? (
                                                        <Markdown content={m.content} />
                                                    ) : (
                                                        m.content
                                                    )}
                                                </div>
                                                <div className="message-time">{m.timestamp}</div>
                                            </div>
                                        );
                                    })}
                                    <div id="chat-end"></div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="composer-area">
                        <div className="composer-wrapper">
                            <textarea
                                ref={composerRef}
                                className="composer-input"
                                placeholder={composerMode === 'agent' ? "Describe what you want to build..." : "Ask a question..."}
                                value={composerInput}
                                onChange={(e) => {
                                    setComposerInput(e.target.value);
                                    if (composerRef.current) {
                                        composerRef.current.style.height = 'auto';
                                        composerRef.current.style.height = composerRef.current.scrollHeight + 'px';
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSubmitProposal();
                                        if (composerRef.current) composerRef.current.style.height = 'auto';
                                    }
                                }}
                            />
                            <div className="composer-footer">
                                <div className="composer-mode-container">
                                    <select
                                        className="composer-mode-select"
                                        value={composerMode}
                                        onChange={(e) => setComposerMode(e.target.value)}
                                    >
                                        <option value="chat">Chat</option>
                                        <option value="agent">Agent</option>
                                    </select>
                                </div>
                                <button className="send-btn" onClick={handleSubmitProposal}>
                                    {isPlanning ? <Icon name={Square} size={14} fill="currentColor" /> : <Icon name={Send} size={16} />}
                                </button>
                            </div>
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
                                <option value="xiaomi/mimo-v2-flash:free">MiMo-V2 Flash (Xiaomi - Free)</option>
                                <option value="mistralai/devstral-2512:free">Devstral 2 2512 (Mistral - Free)</option>
                                <option value="kwaipilot/kat-coder-pro:free">KAT-Coder-Pro V1 (Kwai - Free)</option>
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
