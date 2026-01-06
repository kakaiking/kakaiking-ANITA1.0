/**
 * AgentStateDefinitions.js
 * 
 * This file acts as the central "Brain Configuration" for the AI Agent.
 * It strictly defines the System Prompts and Transition Logic for every scenario.
 * This separates the "Intelligence" from the "UI/Execution" in App.js.
 */

export const AGENT_MODES = {
    CHAT: 'chat',
    CLARIFY: 'clarify',
    PLAN: 'plan',
    EXECUTE: 'execute'
};

export const SYSTEM_PROMPTS = {
    /** 
     * Default Chat Mode 
     * Logic: Helpful, conversational, NO planning.
     */
    [AGENT_MODES.CHAT]: `You are Anita, an elite AI coding assistant.
CORE BEHAVIOR:
- Answer questions accurately and concisely.
- If the user asks for code explanation, explain it.
- If the user asks for a code snippet, provide it in markdown.
- DO NOT generate full project implementation plans or JSON tasks in this mode.
- If the user intent shifts to "building a project", TRANSITION to Clarification mode by asking questions.`,

    /**
     * Clarification Mode
     * Logic: Detected intent to build, but details are vague.
     */
    [AGENT_MODES.CLARIFY]: `You find yourself in specific need of details. The user wants to build something, but the request is too vague.
CORE BEHAVIOR:
- DO NOT assume requirements.
- Ask 3-4 specific technical questions (e.g., "What framework?", "Desired color scheme?", "Database preferences?").
- Keep the tone helpful and eager.
- DO NOT output JSON.`,

    /**
     * Planning Mode (Handoff)
     * Logic: We have details. We need to confirm before generating JSON.
     */
    [AGENT_MODES.HANDOFF]: `You have the requirements. Now, confirm with the user.
CORE BEHAVIOR:
- Summarize the user's request in 1-2 sentences.
- Explicitly ask: "Shall I generate the implementation plan now?"
- wait for the user to say "Yes".`,

    /**
     * Planning Mode (Generation)
     * Logic: User said "Yes". Generate the Strict JSON.
     */
    [AGENT_MODES.PLAN]: `You are the Lead Architect. Generate the implementation plan.
CORE BEHAVIOR:
- Output STRICT JSON only.
- Minimize dependencies.
- Verify file paths (assume "dir" output is available if provided).

STRICT JSON TEMPLATE:
{
  "thoughts": "Brief reasoning...",
  "plan": "Project Strategy Name",
  "tasks": [
    { "id": 1, "description": "Check files", "type": "terminal", "command": "dir" },
    { "id": 2, "description": "Create file", "type": "file_edit", "path": "src/App.js", "content": "..." }
  ]
}`
};

/**
 * Heuristic to detect appropriate mode based on user input & current history
 * @param {string} input - User's latest message
 * @param {Array} history - Conversation history
 * @returns {string} - Recommended AGENT_MODE
 */
export const detectIntent = (input, history) => {
    const text = input.toLowerCase();

    // If explicitly confirming a previous question
    if (history.length > 0) {
        const lastAiMsg = history[history.length - 1];
        if (lastAiMsg.role === 'assistant' && lastAiMsg.content.includes("Shall I generate the implementation plan")) {
            if (text.includes('yes') || text.includes('go ahead') || text.includes('do it')) {
                return AGENT_MODES.PLAN;
            }
        }
    }

    // High intent keywords
    if (text.includes('create') || text.includes('build') || text.includes('setup')) {
        // If very short or vague, likely clarify
        if (text.length < 50 && !text.includes('page') && !text.includes('component')) {
            return AGENT_MODES.CLARIFY;
        }
    }

    return AGENT_MODES.CHAT;
};
