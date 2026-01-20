# PAN-20: AskUserQuestion Interception Implementation Plan

## Problem Statement

Claude Code's `AskUserQuestion` tool doesn't render question options when using `--dangerously-skip-permissions` flag. The questions are written to the JSONL session file but not displayed in the terminal.

## Solution Overview

Intercept `AskUserQuestion` tool calls from agent JSONL files and render them in the Panopticon dashboard, allowing users to respond through the UI and send answers back to the tmux session.

## Data Model

### Agent → JSONL Mapping

1. **Agent State**: `~/.panopticon/agents/<agent-id>/state.json`
   ```json
   {
     "id": "agent-pan-1",
     "workspace": "/home/eltmon/projects/panopticon/workspaces/feature-pan-1"
   }
   ```

2. **Workspace → Claude Project Dir**: Transform path
   - `/home/eltmon/projects/panopticon/workspaces/feature-pan-1`
   - → `~/.claude/projects/-home-eltmon-projects-panopticon-workspaces-feature-pan-1/`

3. **Active Session**: Read `sessions-index.json`
   ```json
   {
     "entries": [{
       "sessionId": "286e638d-add1-490d-b6f4-6b99c8514f58",
       "fullPath": "/path/to/session.jsonl",
       "modified": "2026-01-20T19:50:46.594Z"
     }]
   }
   ```

### AskUserQuestion Structure in JSONL

```json
{
  "message": {
    "content": [{
      "type": "tool_use",
      "id": "toolu_017wfzbruBz63jsFiqrgkpbc",
      "name": "AskUserQuestion",
      "input": {
        "questions": [{
          "question": "Which work items should we import?",
          "header": "Work Items",
          "options": [
            {"label": "User Stories + Defects", "description": "Most common..."},
            {"label": "All except Features", "description": "Include Tasks..."}
          ],
          "multiSelect": false
        }]
      }
    }]
  }
}
```

### Tool Result Structure

When answered, a tool_result entry appears:
```json
{
  "message": {
    "content": [{
      "type": "tool_result",
      "tool_use_id": "toolu_017wfzbruBz63jsFiqrgkpbc",
      "content": "Selected: User Stories + Defects"
    }]
  }
}
```

## Implementation Steps

### Phase 1: Backend JSONL Detection

**File**: `src/dashboard/server/index.ts` (or new `src/dashboard/server/jsonl-watcher.ts`)

```typescript
interface PendingQuestion {
  toolId: string;
  sessionId: string;
  timestamp: string;
  questions: Array<{
    question: string;
    header: string;
    options: Array<{label: string; description: string}>;
    multiSelect: boolean;
  }>;
}

// Get workspace path from agent state
function getAgentWorkspace(agentId: string): string | null {
  const stateFile = join(homedir(), '.panopticon', 'agents', agentId, 'state.json');
  if (!existsSync(stateFile)) return null;
  const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
  return state.workspace;
}

// Transform workspace path to Claude project dir
function getClaudeProjectDir(workspacePath: string): string {
  const dirName = workspacePath.replace(/^\//,'').replace(/\//g, '-');
  return join(homedir(), '.claude', 'projects', `-${dirName}`);
}

// Get active session JSONL path
function getActiveSessionPath(projectDir: string): string | null {
  const indexPath = join(projectDir, 'sessions-index.json');
  if (!existsSync(indexPath)) return null;

  const index = JSON.parse(readFileSync(indexPath, 'utf-8'));
  if (!index.entries?.length) return null;

  // Sort by modified time, get most recent
  const sorted = index.entries.sort((a, b) =>
    new Date(b.modified).getTime() - new Date(a.modified).getTime()
  );
  return sorted[0].fullPath;
}

// Scan JSONL for pending AskUserQuestion
function getPendingQuestions(jsonlPath: string): PendingQuestion[] {
  const content = readFileSync(jsonlPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  const toolCalls = new Map<string, PendingQuestion>(); // id -> question
  const answeredIds = new Set<string>();

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      const content = entry.message?.content;
      if (!Array.isArray(content)) continue;

      for (const item of content) {
        if (item.type === 'tool_use' && item.name === 'AskUserQuestion') {
          toolCalls.set(item.id, {
            toolId: item.id,
            sessionId: entry.sessionId,
            timestamp: entry.timestamp,
            questions: item.input.questions
          });
        }
        if (item.type === 'tool_result') {
          answeredIds.add(item.tool_use_id);
        }
      }
    } catch {}
  }

  // Return unanswered questions
  return Array.from(toolCalls.entries())
    .filter(([id]) => !answeredIds.has(id))
    .map(([, q]) => q);
}
```

### Phase 2: API Endpoint

**Add to `src/dashboard/server/index.ts`**:

```typescript
// Get pending questions for an agent
app.get('/api/agents/:id/pending-questions', async (req, res) => {
  const { id } = req.params;

  try {
    const workspace = getAgentWorkspace(id);
    if (!workspace) {
      return res.json({ pending: false, questions: [] });
    }

    const projectDir = getClaudeProjectDir(workspace);
    const sessionPath = getActiveSessionPath(projectDir);
    if (!sessionPath) {
      return res.json({ pending: false, questions: [] });
    }

    const pending = getPendingQuestions(sessionPath);
    res.json({
      pending: pending.length > 0,
      questions: pending
    });
  } catch (error) {
    console.error('Error checking pending questions:', error);
    res.json({ pending: false, questions: [] });
  }
});

// Submit answer to agent
app.post('/api/agents/:id/answer-question', async (req, res) => {
  const { id } = req.params;
  const { answers } = req.body; // Array of selected option labels

  try {
    // Format answer text (depends on Claude Code's expected format)
    const answerText = answers.join(', ');

    // Send to tmux session
    execSync(`tmux send-keys -t "${id}" "${answerText.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8'
    });
    execSync(`tmux send-keys -t "${id}" Enter`, { encoding: 'utf-8' });

    res.json({ success: true });
  } catch (error) {
    console.error('Error sending answer:', error);
    res.status(500).json({ error: 'Failed to send answer' });
  }
});
```

### Phase 3: Frontend Polling

**Add to agent detail view** (poll every 2-3 seconds when viewing an agent):

```typescript
const [pendingQuestions, setPendingQuestions] = useState<PendingQuestion[]>([]);

useEffect(() => {
  const checkQuestions = async () => {
    const res = await fetch(`/api/agents/${agentId}/pending-questions`);
    const data = await res.json();
    if (data.pending) {
      setPendingQuestions(data.questions);
    }
  };

  const interval = setInterval(checkQuestions, 3000);
  return () => clearInterval(interval);
}, [agentId]);
```

### Phase 4: Question Dialog Component

```tsx
function QuestionDialog({ questions, onSubmit, onDismiss }) {
  const [answers, setAnswers] = useState<Record<number, string[]>>({});

  const handleSubmit = async () => {
    // Format answers for each question
    const allAnswers = questions.flatMap((q, i) => answers[i] || []);
    await fetch(`/api/agents/${agentId}/answer-question`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ answers: allAnswers })
    });
    onSubmit();
  };

  return (
    <Dialog open={questions.length > 0} onClose={onDismiss}>
      <DialogTitle>Agent needs your input</DialogTitle>
      <DialogContent>
        {questions.map((q, qi) => (
          <div key={qi}>
            <Typography variant="overline">{q.header}</Typography>
            <Typography variant="body1">{q.question}</Typography>
            {q.multiSelect ? (
              <FormGroup>
                {q.options.map((opt, oi) => (
                  <FormControlLabel
                    key={oi}
                    control={<Checkbox onChange={...} />}
                    label={opt.label}
                  />
                ))}
              </FormGroup>
            ) : (
              <RadioGroup>
                {q.options.map((opt, oi) => (
                  <FormControlLabel
                    key={oi}
                    control={<Radio />}
                    label={opt.label}
                  />
                ))}
              </RadioGroup>
            )}
          </div>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onDismiss}>Skip</Button>
        <Button onClick={handleSubmit} variant="contained">Submit</Button>
      </DialogActions>
    </Dialog>
  );
}
```

## Answer Format Investigation

**CRITICAL**: Need to determine what format Claude Code expects for AskUserQuestion responses.

Options to investigate:
1. Just the option label (e.g., "User Stories + Defects")
2. The option index (e.g., "1")
3. JSON format (e.g., `{"answer": "User Stories + Defects"}`)
4. Special escape sequences

**Investigation method**:
1. Run Claude Code WITHOUT `--dangerously-skip-permissions`
2. Observe what text is sent when answering questions
3. Match that format in our response

## Files to Modify

| File | Changes |
|------|---------|
| `src/dashboard/server/index.ts` | Add pending questions endpoint, answer endpoint, helper functions |
| `src/dashboard/frontend/src/components/AgentDetail.tsx` | Add polling, question dialog |
| New: `src/dashboard/frontend/src/components/QuestionDialog.tsx` | Question UI component |

## Testing Plan

1. **Unit test**: Mock JSONL file with AskUserQuestion, verify detection
2. **Integration test**: Start agent, trigger AskUserQuestion, verify API returns pending
3. **E2E test**: Full flow - agent asks question, dashboard shows dialog, user answers, agent continues

## Risks

| Risk | Mitigation |
|------|------------|
| Answer format mismatch | Test with real Claude Code session first |
| Polling overhead | Only poll when viewing specific agent, not on agent list |
| Race condition (question answered before we detect) | Check tool_result exists before sending |
| Multiple questions at once | UI handles array of questions |

## Open Questions

1. What happens if user answers via dashboard but also somehow in terminal?
2. Should we show "Other" option and text input field?
3. Should we persist question history for audit/debugging?

## Implementation Order

1. Backend helper functions (workspace → JSONL path)
2. JSONL parsing for AskUserQuestion detection
3. API endpoints (`pending-questions`, `answer-question`)
4. Frontend polling hook
5. Question dialog component
6. Integration and testing
