import { generateWithGemini } from "../../lib/gemini";
import type { ParsedTodo, OptimizedPlan } from "./types";
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

export async function getDailyBrief(todos: Todo[]): Promise<string> {
  if (todos.length === 0) return "No tasks yet. Add some to get your daily brief!";
  const text = await generateWithGemini(BRIEF_PROMPT(todos), { jsonMode: false });
  return text.trim();
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
