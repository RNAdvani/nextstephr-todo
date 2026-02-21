import { generateWithGemini } from "../../lib/gemini";
import type { ParsedTodo, OptimizedPlan, SmartTodoResponse, EditTodoResult } from "./types";
import type { Todo } from "../todos/api";

function getParseTodoPrompt(userInput: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `You are a todo parser. Given a short natural language input from the user, extract a single todo item.
Today's date is ${today}. Use it for relative dates (today, tomorrow, next Monday, etc.).

Rules:
- Return ONLY valid JSON, no markdown or extra text.
- Use this exact shape: {"title":"string","tags":["string"],"due_at":"YYYY-MM-DD or null","remind":boolean}
- title: clear, short task title (max 200 chars). If user said "i wanna go shopping groceries" use "Buy groceries" or "Go grocery shopping".
- tags: 1-5 lowercase tags (e.g. shopping, personal, work). Infer from context (e.g. "groceries" -> shopping, groceries).
- due_at: ISO date YYYY-MM-DD only if user mentioned a day. Use ${today} for "today". Otherwise null.
- remind: true if user said remind/reminder/remind me/alert, or if due_at is set; else false.

User input: ${userInput}`;
}

function getSmartRequestPrompt(userInput: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `You are a smart todo assistant. The user will send a message. Decide the intent:

A) VIEW_MY_TODOS – They want to SEE or LIST their OWN existing todos. E.g. "give me my todos", "show my todos", "what are my tasks", "list my todos", "give me todos" (when they mean show me what I have), "my tasks", "what do I have to do". Reply: {"type":"view_mine"}
B) SINGLE TASK – They are stating ONE task to ADD (e.g. "buy milk tomorrow", "call John", "submit report by Friday"). Return one todo.
C) GENERATE TODOS – They are asking you to GENERATE or SUGGEST new todos FOR A SPECIFIC TOPIC/PROJECT. There must be a clear topic after "for" or similar (e.g. "give me todos for moving", "todos for exam prep", "break down planning a trip into tasks", "suggest tasks for organizing my desk"). Do NOT use this for "give me todos" or "show my todos" – those are VIEW_MY_TODOS. Return 3–8 concrete, actionable todos for that topic.

Today's date is ${today}. Use it for relative dates.
Return ONLY valid JSON. No markdown, no code fence.
Todo shape: {"title":"string","tags":["string"],"due_at":"YYYY-MM-DD or null","remind":boolean}
- title: clear, short (max 200 chars).
- tags: 1–5 lowercase tags. For multiple todos, use tags that group the topic.
- due_at: only if user specified or clearly implied; else null.
- remind: true if due_at is set or user said remind; else false.

If VIEW_MY_TODOS reply: {"type":"view_mine"}
If SINGLE TASK reply: {"type":"single","todo":{...}}
If GENERATE TODOS reply: {"type":"multiple","todos":[{...},{...},...]}

User message: ${userInput}`;
}

function normalizeParsedTodo(t: Partial<ParsedTodo>, fallbackTitle: string): ParsedTodo {
  return {
    title: (t.title && String(t.title).slice(0, 200)) || fallbackTitle,
    tags: Array.isArray(t.tags) ? t.tags : [],
    due_at: t.due_at || null,
    remind: Boolean(t.remind),
  };
}

const BRIEF_PROMPT = (todos: Todo[]) => {
  const list = todos
    .map((t) => {
      const due = t.due_at ? ` (due ${t.due_at})` : "";
      const tags = t.tags?.length ? ` [${t.tags.join(", ")}]` : "";
      return `- ${t.title}${due}${tags} ${t.completed ? "✓" : ""}`;
    })
    .join("\n");
  return `You are a helpful daily brief assistant. Given this todo list, write a very short "Your day in 60 seconds" brief (2-4 sentences max). Mention: how many tasks total, what's most urgent or overdue, one suggested focus for today. Be concise and friendly. Do NOT return JSON, just plain text.

Todo list:
${list}

Brief:`;
};

function getOptimizePrompt(todos: Todo[]): string {
  const today = new Date().toISOString().slice(0, 10);
  const list = todos
    .filter((t) => !t.completed)
    .map((t, i) => {
      const due = t.due_at ? ` due ${t.due_at}` : "";
      return `${i + 1}. id: ${t.id} | ${t.title}${due}`;
    })
    .join("\n");
  return `You are a productivity assistant. Today is ${today}. Given this list of INCOMPLETE todos (with ids), return an optimized plan: suggested order, suggested due dates if missing, and suggest remind true/false for each.

Rules:
- Return ONLY valid JSON, no markdown or extra text.
- Shape: {"summary":"one sentence","items":[{"id":"<todo uuid>","title":"string","suggested_order":1,"suggested_due_at":"YYYY-MM-DD or null","suggested_remind":true,"reason":"short reason"}]}
- suggested_order: 1-based (1 = do first). Consider urgency and due dates.
- suggested_due_at: suggest ${today} or a near date if the todo has none and seems time-sensitive; else null.
- suggested_remind: true for time-sensitive or due tasks.
- Include every incomplete todo in items with same id and title; reorder and add suggestions.
- summary: one short sentence.

Incomplete todos:
${list}

JSON:`;
}

function parseJson<T>(raw: string): T {
  const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
  return JSON.parse(cleaned) as T;
}

export async function parseNaturalLanguageTodo(userInput: string): Promise<ParsedTodo> {
  const text = await generateWithGemini(getParseTodoPrompt(userInput), { jsonMode: true });
  const parsed = parseJson<ParsedTodo>(text);
  if (!parsed.title || !Array.isArray(parsed.tags)) {
    parsed.title = parsed.title || userInput.slice(0, 200);
    parsed.tags = Array.isArray(parsed.tags) ? parsed.tags : [];
  }
  parsed.due_at = parsed.due_at || null;
  parsed.remind = Boolean(parsed.remind);
  return parsed;
}

export async function processSmartRequest(userInput: string): Promise<SmartTodoResponse> {
  const text = await generateWithGemini(getSmartRequestPrompt(userInput), { jsonMode: true });
  const raw = parseJson<SmartTodoResponse>(text);
  const fallback = userInput.slice(0, 200);
  if (raw.type === "view_mine") {
    return { type: "view_mine" };
  }
  if (raw.type === "single" && raw.todo) {
    return {
      type: "single",
      todo: normalizeParsedTodo(raw.todo, fallback),
    };
  }
  if (raw.type === "multiple" && Array.isArray(raw.todos)) {
    return {
      type: "multiple",
      todos: raw.todos.map((t, i) => normalizeParsedTodo(t, `${fallback} ${i + 1}`)),
    };
  }
  return { type: "single", todo: normalizeParsedTodo({ title: userInput }, fallback) };
}

export async function getDailyBrief(todos: Todo[]): Promise<string> {
  if (todos.length === 0) return "No tasks yet. Add some to get your daily brief!";
  const text = await generateWithGemini(BRIEF_PROMPT(todos), { jsonMode: false });
  return text.trim();
}

function getEditTodoPrompt(userInput: string, todos: Todo[]): string {
  const d = new Date();
  const today = d.toISOString().slice(0, 10);
  const tomorrow = new Date(d.getTime() + 86400000).toISOString().slice(0, 10);
  const list = todos
    .map((t) => `- id: ${t.id} | ${t.title}${t.due_at ? ` (due ${t.due_at})` : ""}${t.tags?.length ? ` [${t.tags.join(", ")}]` : ""}`)
    .join("\n");
  return `You are a todo editor. The user wants to EDIT an existing todo. Given their message and the todo list, determine which todo to edit and what changes to make.

Today is ${today}.

Rules:
- Return ONLY valid JSON: {"todoId":"<uuid>","updates":{"title":"string or omit","tags":["string"] or omit,"due_at":"YYYY-MM-DD or null" or omit,"remind":boolean or omit}}
- todoId: must be an exact id from the list below.
- updates: only include fields that should CHANGE. Omit unchanged fields.
- title: new title if user wants to change it.
- tags: new tags array if user wants to change them.
- due_at: date if user mentioned one; use ${today} for "today", ${tomorrow} for "tomorrow".
- remind: true/false if user mentioned reminders.

Examples:
- "edit buy eggs to add due tomorrow" -> {"todoId":"<id of buy eggs>","updates":{"due_at":"2025-02-22"}}
- "change the first todo to say buy organic eggs" -> {"todoId":"<id of first>","updates":{"title":"Buy organic eggs"}}
- "add tag urgent to call John" -> {"todoId":"<id of call John>","updates":{"tags":["urgent",...existing]}}

Todos:
${list}

User: "${userInput}"

JSON:`;
}

export async function processEditRequest(
  userInput: string,
  todos: Todo[]
): Promise<EditTodoResult | null> {
  if (!todos.length) return null;
  const text = await generateWithGemini(getEditTodoPrompt(userInput, todos), { jsonMode: true });
  const raw = parseJson<EditTodoResult>(text);
  if (!raw?.todoId || !todos.some((t) => t.id === raw.todoId)) return null;
  return raw;
}

export async function getOptimizedPlan(todos: Todo[]): Promise<OptimizedPlan> {
  const incomplete = todos.filter((t) => !t.completed);
  if (incomplete.length === 0) {
    return { summary: "All done! No tasks to optimize.", items: [] };
  }
  const text = await generateWithGemini(getOptimizePrompt(todos), { jsonMode: true });
  const plan = parseJson<OptimizedPlan>(text);
  if (!Array.isArray(plan.items)) plan.items = [];
  if (!plan.summary) plan.summary = "Optimized order and suggestions below.";
  return plan;
}
