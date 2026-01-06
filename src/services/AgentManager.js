export class AgentManager {
    constructor(aiService, addLog, updateUI) {
        this.ai = aiService;
        this.addLog = addLog;
        this.updateUI = updateUI;
        this.sessions = []; // { id, goal, tasks, status, currentTaskIndex }
    }

    async createProposal(goal) {
        this.addLog(`Planner: Analyzing goal - ${goal}`);

        const prompt = `As an expert coding agent, analyze this user request: ${goal}.
    
    INTERACTION PROTOCOL:
    1. GATHER INFO: If vague, ask questions.
    2. CONFIRM: If requirements are clear, DO NOT generate JSON yet. Summarize and ask: "Shall I generate the implementation plan?"
    3. GENERATE: ONLY if user confirms, output the JSON below.
    
    STRICT JSON TEMPLATE (Only after confirmation):
    { "plan": "string describing plan", "tasks": [ { "id": 1, "description": "task description", "type": "file_edit|terminal|folder_create", "path": "relative path if file", "content": "initial content if file", "command": "command if terminal" } ] }`;

        const response = await this.ai.chat([{ role: "user", content: prompt }]);
        try {
            // Check if response is plain text (not JSON)
            if (!response.trim().startsWith('{')) {
                // If it's plain text, we assume it's a question or conversation
                return {
                    isQuestion: true,
                    message: response
                };
            }

            const proposal = JSON.parse(response.replace(/```json|```/g, "").trim());
            const session = {
                id: Date.now(),
                goal,
                plan: proposal.plan,
                tasks: proposal.tasks.map(t => ({ ...t, status: 'pending' })),
                status: 'awaiting_approval'
            };
            this.sessions.unshift(session);
            this.updateUI();
            return session;
        } catch (e) {
            this.addLog(`Error: Failed to parse planner response. ${e.message}`);
            return null;
        }
    }

    async executeSession(sessionId) {
        const session = this.sessions.find(s => s.id === sessionId);
        if (!session) return;

        session.status = 'running';
        this.updateUI();

        for (const task of session.tasks) {
            task.status = 'active';
            this.updateUI();
            this.addLog(`Executing: ${task.description}`);

            try {
                if (task.type === 'file_edit') {
                    // In a real app, Coder agent would generate/refine this content
                    await window.api.writeFile(task.path, task.content || "");
                    this.addLog(`File created/updated: ${task.path}`);
                } else if (task.type === 'terminal') {
                    const approved = await this.requestApproval(`Execute command: ${task.command}`);
                    if (approved) {
                        const result = await window.api.executeCommand('t1', task.command);
                        if (result.success) {
                            this.addLog(`Command output: ${result.stdout}`);
                        } else {
                            this.addLog(`Error: ${result.stderr || result.error}`);
                            task.status = 'error';
                            break;
                        }
                    } else {
                        this.addLog("Command cancelled by user.");
                        task.status = 'cancelled';
                        break;
                    }
                }
                task.status = 'finished';
            } catch (err) {
                task.status = 'error';
                this.addLog(`Task failed: ${err.message}`);
                break;
            }
        }

        session.status = session.tasks.every(t => t.status === 'finished') ? 'finished' : 'error';
        this.updateUI();
        this.addLog(`Session ${session.status}.`);
    }

    async requestApproval(msg) {
        // In a real app, this would show a modal in the UI. 
        // Here we'll use window.confirm for simplicity or trigger a UI state.
        return window.confirm(msg);
    }
}
