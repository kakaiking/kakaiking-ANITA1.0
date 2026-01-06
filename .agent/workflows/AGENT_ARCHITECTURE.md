# Anita Agent Architecture & Logic Specification

## 1. Core Philosophy: Finite State Machine (FSM)
To resolve the issues of the agent being "off" or "hallucinating plans", the Agent logic is rigorously defined as a **Finite State Machine**. The agent can only exist in ONE state at a time. Transitions must be explicit.

### The States
1.  **Thinking (Chat/Idle)**: Standard conversation. No aggressive planning.
2.  **Clarifying (Requirement Gathering)**: Triggered when intent is detected but vague.
3.  **Proposing (Planning)**: Triggered ONLY when requirements are fully gathered and confirmed.
4.  **Executing (running)**: The systematic execution of the approved plan.
5.  **Reviewing**: Post-execution state for user feedback.

---

## 2. State Logic Definitions

### Scenario A: Normal Chat (State: *Thinking*)
- **Trigger**: User sends a Hello, asks a question, or discusses a topic without a clear build intent.
- **Logic**: 
    - Use efficient model (e.g., Llama-3-70B/Deepseek).
    - **System Prompt**: "You are a helpful coding assistant. Answer questions concisely. Do NOT propose implementation plans unless explicitly asked."
    - **Output**: Plain text.

### Scenario B: Vague Request (State: *Clarifying*)
- **Trigger**: User says "Build an app", "Make a website" (High Intent, Low Detail).
- **Logic**:
    - **System Prompt**: "User wants to build something but details are missing. Ask specific clarifying questions (Tech stack? Features? Design?). Do NOT generate a plan."
    - **Output**: Plain text questions.

### Scenario C: Detailed Request (State: *Proposing*)
- **Trigger**: User provides details and implicitly or explicitly authorizes a plan. "I want a React Todo app with Tailwind."
- **Logic**:
    - **Step 1 (Handoff)**: Summarize understanding. Ask: "Shall I generate the implementation plan?"
    - **Step 2 (Generation)**: On confirmation, generate STRICT JSON plan.
    - **System Prompt**: "Generate a JSON implementation plan with surgical precision. Verify file existence first."
    - **Output**: JSON Object `{ plan, tasks: [] }`.

### Scenario D: Execution (State: *Executing*)
- **Trigger**: User clicks "Start Execution" on a Plan Card.
- **Logic**:
    - **Loop**: For each task:
        1.  **Pre-check**: Read file content or check directory.
        2.  **Action**: Write file or Run Command.
        3.  **Verify**: Run `npm run lint` or `node -c` to check syntax.
        4.  **Report**: Update Task Status.
    - **Error Handling**: If a step fails, STOP. Ask user for direction or attempt 1 auto-retry.

---

## 3. Data Structures

### The Plan Object
```json
{
  "id": "session_123",
  "goal": "Build Homepage",
  "status": "pending",
  "tasks": [
    {
      "id": 1,
      "type": "terminal",
      "command": "dir",
      "purpose": "Verify current structure"
    },
    {
      "id": 2,
      "type": "file_edit",
      "path": "src/App.js",
      "description": "Add Hero component"
    }
  ]
}
```

## 4. Implementation Strategy
All prompts and state transitions are stored in `src/services/AgentStateDefinitions.js` to separate logic from UI (`App.js`).
