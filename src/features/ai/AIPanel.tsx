import { useState, useRef, useEffect } from "react";
import {
  processSmartRequest,
  getDailyBrief,
  getOptimizedPlan,
  processEditRequest,
} from "./aiService";
import { searchTodos } from "../../util/search";
import { hasGeminiKey } from "../../lib/gemini";
import type { ParsedTodo, OptimizedPlan, EditTodoResult } from "./types";
import type { Todo } from "../todos/api";
import type { CreateTodoInput } from "../todos/api";

const COMMANDS = [
  {
    slug: "optimize",
    label: "@optimize",
    description: "Get optimized task order & reminders",
  },
  { slug: "brief", label: "@brief", description: "Your day in 60 seconds" },
  { slug: "search", label: "@search", description: "Semantic & fuzzy search (e.g. poultry → eggs)" },
  { slug: "edit", label: "@edit", description: "Edit a todo with natural language" },
] as const;

type PanelView = "idle" | "parsed" | "generated" | "view_mine" | "brief" | "optimize" | "search" | "edit" | "loading" | "error";

interface AIPanelProps {
  todos: Todo[];
  onAddTodo: (input: CreateTodoInput) => void;
  onUpdateTodo?: (id: string, updates: Partial<CreateTodoInput>) => void;
  onApplyOptimize: (
    updates: {
      id: string;
      order?: number;
      due_at?: string | null;
      remind?: boolean;
    }[],
  ) => void;
  createPending: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export default function AIPanel({
  todos,
  onAddTodo,
  onUpdateTodo,
  onApplyOptimize,
  createPending,
  isOpen,
  onClose,
}: AIPanelProps) {
  const [input, setInput] = useState("");
  const [view, setView] = useState<PanelView>("idle");
  const [parsedTodo, setParsedTodo] = useState<ParsedTodo | null>(null);
  const [generatedTodos, setGeneratedTodos] = useState<ParsedTodo[]>([]);
  const [briefText, setBriefText] = useState("");
  const [optimizedPlan, setOptimizedPlan] = useState<OptimizedPlan | null>(
    null,
  );
  const [searchResults, setSearchResults] = useState<Todo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editResult, setEditResult] = useState<EditTodoResult | null>(null);
  const [editTargetTodo, setEditTargetTodo] = useState<Todo | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [commandHighlight, setCommandHighlight] = useState(0);
  const [commandListOpen, setCommandListOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasKey = hasGeminiKey();

  const atIndex = input.indexOf("@");
  const showCommands = atIndex !== -1;
  const filterAfterAt = input
    .slice(atIndex + 1)
    .toLowerCase()
    .trim();
  const filteredCommands = COMMANDS.filter((c) =>
    c.slug.startsWith(filterAfterAt),
  );
  const hasCommands = filteredCommands.length > 0;

  useEffect(() => {
    if (showCommands) setCommandHighlight(0);
  }, [filterAfterAt, showCommands]);

  useEffect(() => {
    if (!showCommands) return;
    const el = inputRef.current;
    if (!el) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!hasCommands) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCommandHighlight((i) => (i + 1) % filteredCommands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCommandHighlight((i) =>
          i === 0 ? filteredCommands.length - 1 : i - 1,
        );
      } else if (e.key === "Enter" && filteredCommands[commandHighlight]) {
        e.preventDefault();
        setInput(filteredCommands[commandHighlight].label);
        setCommandListOpen(false);
      } else if (e.key === "Escape") {
        setInput((v) => v.slice(0, atIndex));
        setCommandListOpen(false);
      }
    };
    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [
    showCommands,
    hasCommands,
    filteredCommands,
    commandHighlight,
    atIndex,
    input,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const raw = input.trim();
    if (!raw) return;

    setErrorMessage("");
    setView("loading");

    try {
      const lower = raw.toLowerCase();
      if (lower === "@optimize" || lower.startsWith("@optimize")) {
        const plan = await getOptimizedPlan(todos);
        setOptimizedPlan(plan);
        setView("optimize");
      } else if (
        lower === "@brief" ||
        lower === "brief my day" ||
        lower.startsWith("@brief")
      ) {
        const brief = await getDailyBrief(todos);
        setBriefText(brief);
        setView("brief");
      } else if (lower === "@search" || lower.startsWith("@search")) {
        const q = raw.replace(/^@search\s*/i, "").trim();
        setSearchQuery(q || "(all)");
        const results = await searchTodos(todos, q || "");
        setSearchResults(results);
        setView("search");
      } else if (
        lower === "@edit" ||
        lower.startsWith("@edit") ||
        /^(edit|change|update|modify)\s/i.test(lower) ||
        /\b(edit|change|update)\s+.+\s+(to|into)\s+/i.test(raw)
      ) {
        const instruction = raw.replace(/^@edit\s*/i, "").trim();
        if (!instruction && (lower === "@edit" || lower.startsWith("@edit"))) {
          setErrorMessage("Add an edit instruction, e.g. @edit buy eggs add due tomorrow");
          setView("error");
        } else {
          const result = await processEditRequest(instruction || raw, todos);
          if (result) {
            const target = todos.find((t) => t.id === result.todoId);
            setEditTargetTodo(target ?? null);
            setEditResult(result);
            setView("edit");
          } else {
            setErrorMessage("Could not find a matching todo to edit.");
            setView("error");
          }
        }
      } else {
        const result = await processSmartRequest(raw);
        if (result.type === "view_mine") {
          setView("view_mine");
        } else if (result.type === "single") {
          setParsedTodo(result.todo);
          setView("parsed");
        } else {
          setGeneratedTodos(result.todos);
          setView("generated");
        }
      }
    } catch (err) {
      setView("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setInput("");
    }
  }

  function handleAddParsed() {
    if (!parsedTodo) return;
    onAddTodo({
      title: parsedTodo.title,
      tags: parsedTodo.tags,
      due_at: parsedTodo.due_at,
      remind: parsedTodo.remind,
    });
    setParsedTodo(null);
    setView("idle");
  }

  function handleAddGenerated(todo: ParsedTodo) {
    onAddTodo({
      title: todo.title,
      tags: todo.tags,
      due_at: todo.due_at,
      remind: todo.remind,
    });
    setGeneratedTodos((prev) => prev.filter((t) => t !== todo));
    if (generatedTodos.length <= 1) setView("idle");
  }

  function handleAddAllGenerated() {
    generatedTodos.forEach((todo) => {
      onAddTodo({
        title: todo.title,
        tags: todo.tags,
        due_at: todo.due_at,
        remind: todo.remind,
      });
    });
    setGeneratedTodos([]);
    setView("idle");
  }

  function handleApplyEdit() {
    if (!editResult || !onUpdateTodo) return;
    const { todoId, updates } = editResult;
    onUpdateTodo(todoId, updates);
    setEditResult(null);
    setEditTargetTodo(null);
    setView("idle");
  }

  function handleApplyOptimize() {
    if (!optimizedPlan?.items?.length) return;
    onApplyOptimize(
      optimizedPlan.items.map((item) => ({
        id: item.id,
        order: item.suggested_order - 1,
        due_at: item.suggested_due_at ?? undefined,
        remind: item.suggested_remind,
      })),
    );
    setOptimizedPlan(null);
    setView("idle");
  }

  if (!isOpen) return null;

  const header = (
    <div className="p-3 border-b-2 border-border flex items-center justify-between shrink-0">
      <h3 className="font-bold">AI Assistant</h3>
      <button
        type="button"
        onClick={onClose}
        className="p-2 border-2 border-border hover:bg-muted transition-colors cursor-pointer"
        aria-label="Close panel"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );

  if (!hasKey) {
    return (
      <div className="h-full flex flex-col">
        {header}
        <div className="p-4">
          <p className="text-sm text-muted-foreground">
            Add <code className="bg-muted px-1">VITE_GEMINI_API_KEY</code> to
            your <code className="bg-muted px-1">.env</code> to enable AI
            features.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {header}
      <div className="p-3 border-b-2 border-border shrink-0">
        <p className="text-xs text-muted-foreground mb-2">
          Type a task, or <code>@optimize</code> / <code>@brief</code> / <code>@search</code> / <code>@edit</code>
        </p>
        <form onSubmit={handleSubmit} className="relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              const v = e.target.value;
              setInput(v);
              if (v.includes("@")) setCommandListOpen(true);
            }}
            placeholder="e.g. buy groceries tomorrow #shopping"
            className="w-full px-3 py-2 border-2 border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            autoComplete="off"
          />
          {showCommands && hasCommands && commandListOpen && (
            <ul
              className="absolute left-0 right-0 top-full mt-1 border-2 border-border bg-white shadow-lg z-10 max-h-48 overflow-auto"
              role="listbox"
              aria-label="Commands"
            >
              {filteredCommands.map((cmd, i) => (
                <li
                  key={cmd.slug}
                  role="option"
                  aria-selected={i === commandHighlight}
                  className={`px-3 py-2 text-sm cursor-pointer border-b border-border last:border-b-0 ${
                    i === commandHighlight
                      ? "bg-accent text-accent-foreground"
                      : "bg-card hover:bg-muted"
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setInput(cmd.label);
                    setCommandListOpen(false);
                  }}
                >
                  <span className="font-medium">{cmd.label}</span>
                  <span className="ml-2 text-muted-foreground">
                    {cmd.description}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <button
            type="submit"
            disabled={view === "loading"}
            className="mt-2 w-full py-2 bg-accent text-accent-foreground text-sm font-medium border-2 border-border hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {view === "loading" ? "Thinking..." : "Send"}
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {view === "idle" && (
          <p className="text-sm text-muted-foreground">
            Try: &quot;give me my todos&quot;, add a task, @search poultry, @edit buy eggs add due tomorrow, or @optimize / @brief
          </p>
        )}

        {view === "error" && (
          <div className="text-sm" style={{ color: "var(--primary)" }}>
            <p className="font-medium">Error</p>
            <p>{errorMessage}</p>
          </div>
        )}

        {view === "parsed" && parsedTodo && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Add this task?</p>
            <div className="p-3 border-2 border-border bg-muted/30 text-sm">
              <p className="font-medium">{parsedTodo.title}</p>
              {parsedTodo.tags.length > 0 && (
                <p className="text-muted-foreground mt-1">
                  Tags: {parsedTodo.tags.join(", ")}
                </p>
              )}
              {parsedTodo.due_at && (
                <p className="text-muted-foreground">
                  Due: {parsedTodo.due_at}
                </p>
              )}
              {parsedTodo.remind && (
                <p className="text-muted-foreground">Remind: yes</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAddParsed}
                disabled={createPending}
                className="flex-1 py-2 bg-primary text-primary-foreground text-sm font-medium border-2 border-border"
              >
                {createPending ? "Adding..." : "Add to list"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setParsedTodo(null);
                  setView("idle");
                }}
                className="py-2 px-3 border-2 border-border text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {view === "view_mine" && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Your todos</p>
            {todos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No todos yet. Add one or ask for suggestions for a topic (e.g. &quot;give me todos for moving&quot;).
              </p>
            ) : (
              <ul className="space-y-2 text-sm max-h-64 overflow-auto">
                {todos.map((t) => (
                  <li
                    key={t.id}
                    className="p-2 border-2 border-border bg-muted/20 flex items-center gap-2"
                  >
                    {t.completed && (
                      <span className="text-muted-foreground text-xs">Done</span>
                    )}
                    <span className={t.completed ? "line-through text-muted-foreground" : "font-medium"}>
                      {t.title}
                    </span>
                    {t.due_at && (
                      <span className="text-xs text-muted-foreground">Due {t.due_at}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setView("idle")}
              className="py-2 px-3 border-2 border-border text-sm"
            >
              Close
            </button>
          </div>
        )}

        {view === "generated" && generatedTodos.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              {generatedTodos.length} task{generatedTodos.length !== 1 ? "s" : ""} suggested
            </p>
            <ul className="space-y-2 text-sm">
              {generatedTodos.map((todo, i) => (
                <li
                  key={i}
                  className="p-3 border-2 border-border bg-muted/20 flex flex-col gap-2"
                >
                  <p className="font-medium">{todo.title}</p>
                  {(todo.tags?.length > 0 || todo.due_at || todo.remind) && (
                    <p className="text-muted-foreground text-xs">
                      {todo.tags?.length ? todo.tags.join(", ") : ""}
                      {todo.due_at ? ` · Due ${todo.due_at}` : ""}
                      {todo.remind ? " · Remind" : ""}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => handleAddGenerated(todo)}
                    disabled={createPending}
                    className="self-start py-1.5 px-3 bg-primary text-primary-foreground text-xs font-medium border-2 border-border"
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAddAllGenerated}
                disabled={createPending}
                className="flex-1 py-2 bg-primary text-primary-foreground text-sm font-medium border-2 border-border"
              >
                {createPending ? "Adding..." : "Add all to list"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setGeneratedTodos([]);
                  setView("idle");
                }}
                className="py-2 px-3 border-2 border-border text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {view === "brief" && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Your day in 60 seconds</p>
            <div className="p-3 border-2 border-border bg-muted/30 text-sm whitespace-pre-wrap">
              {briefText}
            </div>
            <button
              type="button"
              onClick={() => setView("idle")}
              className="py-2 px-3 border-2 border-border text-sm"
            >
              Close
            </button>
          </div>
        )}

        {view === "optimize" && optimizedPlan && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Optimized plan</p>
            <p className="text-xs text-muted-foreground">
              {optimizedPlan.summary}
            </p>
            {optimizedPlan.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No incomplete tasks to optimize.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {optimizedPlan.items.map((item, i) => (
                  <li
                    key={item.id}
                    className="p-2 border-2 border-border bg-muted/20"
                  >
                    <span className="font-medium">
                      {i + 1}. {item.title}
                    </span>
                    {item.suggested_due_at && (
                      <p className="text-xs text-muted-foreground">
                        Due: {item.suggested_due_at}
                      </p>
                    )}
                    {item.suggested_remind && (
                      <p className="text-xs text-muted-foreground">Remind on</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {optimizedPlan.items.length > 0 && (
              <button
                type="button"
                onClick={handleApplyOptimize}
                className="w-full py-2 bg-primary text-primary-foreground text-sm font-medium border-2 border-border"
              >
                Apply to my list
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setOptimizedPlan(null);
                setView("idle");
              }}
              className="w-full mt-1 py-2 border-2 border-border text-sm"
            >
              Cancel
            </button>
          </div>
        )}

        {view === "search" && (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              Search: &quot;{searchQuery}&quot; — {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
            </p>
            {searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No matching todos. Try different keywords (e.g. poultry → eggs).
              </p>
            ) : (
              <ul className="space-y-2 text-sm max-h-64 overflow-auto">
                {searchResults.map((t) => (
                  <li
                    key={t.id}
                    className="p-2 border-2 border-border bg-muted/20 flex items-center gap-2"
                  >
                    {t.completed && (
                      <span className="text-muted-foreground text-xs">Done</span>
                    )}
                    <span className={t.completed ? "line-through text-muted-foreground" : "font-medium"}>
                      {t.title}
                    </span>
                    {t.due_at && (
                      <span className="text-xs text-muted-foreground">Due {t.due_at}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setView("idle")}
              className="py-2 px-3 border-2 border-border text-sm"
            >
              Close
            </button>
          </div>
        )}

        {view === "edit" && editResult && editTargetTodo && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Edit this todo?</p>
            <div className="p-3 border-2 border-border bg-muted/30 text-sm space-y-2">
              <p>
                <span className="text-muted-foreground">Current:</span> {editTargetTodo.title}
                {editTargetTodo.due_at && ` · Due ${editTargetTodo.due_at}`}
                {editTargetTodo.tags?.length ? ` [${editTargetTodo.tags.join(", ")}]` : ""}
              </p>
              <p>
                <span className="text-muted-foreground">Changes:</span>{" "}
                {editResult.updates.title && `Title → ${editResult.updates.title}`}
                {editResult.updates.due_at !== undefined && ` · Due → ${editResult.updates.due_at ?? "none"}`}
                {editResult.updates.tags?.length ? ` · Tags → ${editResult.updates.tags.join(", ")}` : ""}
                {editResult.updates.remind !== undefined && ` · Remind → ${editResult.updates.remind}`}
                {!editResult.updates.title && !editResult.updates.due_at && !editResult.updates.tags?.length && editResult.updates.remind === undefined && "—"}
              </p>
            </div>
            <div className="flex gap-2">
              {onUpdateTodo && (
                <button
                  type="button"
                  onClick={handleApplyEdit}
                  className="flex-1 py-2 bg-primary text-primary-foreground text-sm font-medium border-2 border-border"
                >
                  Apply
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setEditResult(null);
                  setEditTargetTodo(null);
                  setView("idle");
                }}
                className="py-2 px-3 border-2 border-border text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
