// Fuzzy + semantic search for todos
import { hasGeminiKey } from "../lib/gemini";
import { generateWithGemini } from "../lib/gemini";
import type { Todo } from "../features/todos/api";

/**
 * Fuzzy substring match: query chars appear in order in text (allows gaps).
 * E.g. "eggs" matches "buy eggs", "poutry" matches "poultry"
 */
function fuzzyMatch(text: string, query: string): boolean {
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return true;

  let ti = 0;
  let qi = 0;
  while (ti < t.length && qi < q.length) {
    if (t[ti] === q[qi]) qi++;
    ti++;
  }
  return qi === q.length;
}

/**
 * Word-based fuzzy: each query word partially matches some word in text.
 * "poultry" matches "buy eggs" when we use semantic (Gemini).
 * For fuzzy-only: "eggs" matches "buy eggs", "groceries" matches "grocery shopping"
 */
function fuzzyWordMatch(text: string, query: string): boolean {
  const words = text.toLowerCase().split(/\s+/);
  const queryWords = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (queryWords.length === 0) return true;

  for (const qw of queryWords) {
    const found = words.some((w) => fuzzyMatch(w, qw) || fuzzyMatch(qw, w));
    if (!found) return false;
  }
  return true;
}

/**
 * Check if a single todo matches the search query (fuzzy).
 */
export function todoMatchesFuzzy(todo: Todo, query: string): boolean {
  if (!query.trim()) return true;
  const text = [todo.title, ...(todo.tags || [])].filter(Boolean).join(" ");
  return fuzzyMatch(text, query) || fuzzyWordMatch(text, query);
}

/**
 * Fuzzy search: typo-tolerant, partial matching on title and tags.
 */
export function fuzzySearchTodos(todos: Todo[], query: string): Todo[] {
  if (!query.trim()) return todos;

  const q = query.trim().toLowerCase();
  const searchable = (t: Todo) =>
    [t.title, ...(t.tags || [])].filter(Boolean).join(" ");

  return todos.filter((t) => {
    const text = searchable(t);
    return fuzzyMatch(text, q) || fuzzyWordMatch(text, q);
  });
}

/**
 * Semantic search: uses Gemini to find related todos.
 * E.g. "poultry" matches "buy eggs" (eggs are poultry-related).
 */
export async function semanticSearchTodoIds(
  todos: Todo[],
  query: string
): Promise<string[]> {
  if (!hasGeminiKey() || todos.length === 0 || !query.trim()) {
    return [];
  }

  const list = todos
    .map(
      (t) =>
        `- id: ${t.id} | ${t.title}${t.tags?.length ? ` [${t.tags.join(", ")}]` : ""}`
    )
    .join("\n");

  const prompt = `You are a search assistant. Given a search query and a list of todos, return ONLY the todo IDs that are semantically related to the query.

Examples:
- Query "poultry" matches "buy eggs" (eggs are poultry)
- Query "grocery" matches "buy milk", "get bread"
- Query "work" matches tasks with work-related tags
- Query "meetings" matches "call John", "team sync"

Return ONLY a JSON array of todo ids (strings). No explanation. If none match, return [].

Todos:
${list}

Query: "${query}"

JSON array of ids:`;

  try {
    const text = await generateWithGemini(prompt, { jsonMode: true });
    const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
    const ids = JSON.parse(cleaned) as string[];
    return Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Combined search: fuzzy + optional semantic when Gemini key exists.
 */
export async function searchTodos(
  todos: Todo[],
  query: string
): Promise<Todo[]> {
  if (!query.trim()) return todos;

  const fuzzyResults = fuzzySearchTodos(todos, query);
  const fuzzyIds = new Set(fuzzyResults.map((t) => t.id));

  if (!hasGeminiKey()) {
    return fuzzyResults;
  }

  const semanticIds = await semanticSearchTodoIds(todos, query);
  const semanticTodos = todos.filter((t) => semanticIds.includes(t.id));

  for (const t of semanticTodos) {
    if (!fuzzyIds.has(t.id)) {
      fuzzyResults.push(t);
      fuzzyIds.add(t.id);
    }
  }

  return fuzzyResults;
}
