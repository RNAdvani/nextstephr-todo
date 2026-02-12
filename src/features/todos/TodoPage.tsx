// src/features/todos/TodoPage.tsx
import { useTodos, useCreateTodo, useToggleTodo, useDeleteTodo, useUpdateTodo, useReorderTodos } from "./hooks";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { logout } from "../auth/useAuth";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import type { Todo } from "./api";
import { todoPageAnimations, modalAnimations } from "../../util/gsap";
import AIPanel from "../ai/AIPanel";
import { parseNaturalLanguageTodo } from "../ai/aiService";
import { hasGeminiKey } from "../../lib/gemini";

const todoSchema = z.object({
  title: z.string().min(1, "Todo cannot be empty").max(200, "Todo is too long"),
  due_at: z.string().optional(),
  remind: z.boolean().optional(),
  tags: z.string().optional(),
});

type TodoFormData = z.infer<typeof todoSchema>;
type FilterType = "all" | "active" | "completed";

// Sortable Todo Item Component
function SortableTodoItem({ todo, onToggle, onDelete }: {
  todo: Todo;
  onToggle: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<Todo>) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isOverdue = todo.due_at && !todo.completed && isPast(new Date(todo.due_at));
  const isDueToday = todo.due_at && isToday(new Date(todo.due_at));
  const isDueTomorrow = todo.due_at && isTomorrow(new Date(todo.due_at));

  const formatDueDate = () => {
    if (!todo.due_at) return null;
    const date = new Date(todo.due_at);
    if (isDueToday) return "Today";
    if (isDueTomorrow) return "Tomorrow";
    return format(date, "MMM d");
  };

  return (
    <div data-gsap-todo-item className="todo-item-wrapper">
      <div
        ref={setNodeRef}
        style={style}
        className={`group flex items-center gap-4 p-4 bg-card border-2 ${
          isOverdue ? "border-primary" : "border-border"
        } hover:translate-x-0.5 hover:translate-y-0.5 transition-all duration-200`}
        {...attributes}
      >
      {/* Drag Handle */}
      <button
        type="button"
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted transition-colors"
        aria-label="Drag to reorder"
      >
        <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </button>

      {/* Custom Checkbox */}
      <label className="relative flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={onToggle}
          className="sr-only peer"
        />
        <div className="w-6 h-6 border-2 border-border bg-background peer-checked:bg-accent peer-checked:border-accent transition-all duration-200 flex items-center justify-center">
          {todo.completed && (
            <svg
              className="w-4 h-4 text-accent-foreground"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M5 13l4 4L19 7"></path>
            </svg>
          )}
        </div>
      </label>

      {/* Todo Content */}
      <div className="flex-1 min-w-0">
        <span
          className={`text-lg block ${
            todo.completed
              ? "line-through text-muted-foreground"
              : "text-foreground"
          } transition-all duration-200`}
        >
          {todo.title}
        </span>
        
        {/* Tags and Due Date */}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {todo.tags && todo.tags.length > 0 && todo.tags.map((tag, idx) => (
            <span
              key={idx}
              className="tag-pill text-xs px-2 py-0.5 bg-secondary text-secondary-foreground border border-border"
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              {tag}
            </span>
          ))}
          {todo.due_at && (
            <span
              className={`tag-pill text-xs px-2 py-0.5 border ${
                isOverdue
                  ? "bg-primary text-primary-foreground border-primary"
                  : isDueToday
                  ? "bg-accent text-accent-foreground border-accent"
                  : "bg-muted text-muted-foreground border-border"
              }`}
            >
              📅 {formatDueDate()}
            </span>
          )}
        </div>
      </div>

      {/* Delete Button */}
      <button
        type="button"
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 p-2 hover:bg-destructive hover:text-destructive-foreground border-2 border-transparent hover:border-border transition-all duration-200 cursor-pointer"
        style={{ boxShadow: "var(--shadow-xs)" }}
        aria-label="Delete todo"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
      </div>
    </div>
  );
}

// Keyboard Shortcuts Modal
function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      modalAnimations(backdropRef.current, contentRef.current);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        ref={contentRef}
        className="bg-white border-2 border-border p-6 max-w-md w-full"
        style={{ boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold mb-4">Keyboard Shortcuts</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Add new todo</span>
            <kbd className="px-2 py-1 bg-muted border-2 border-border text-sm font-mono">Ctrl+Enter</kbd>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Focus search</span>
            <kbd className="px-2 py-1 bg-muted border-2 border-border text-sm font-mono">Ctrl+/</kbd>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Clear filters</span>
            <kbd className="px-2 py-1 bg-muted border-2 border-border text-sm font-mono">Escape</kbd>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Show shortcuts</span>
            <kbd className="px-2 py-1 bg-muted border-2 border-border text-sm font-mono">?</kbd>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Close this dialog</span>
            <kbd className="px-2 py-1 bg-muted border-2 border-border text-sm font-mono">Escape</kbd>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full px-4 py-2 bg-primary text-primary-foreground font-medium border-2 border-border hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 cursor-pointer transition-all duration-150"
          style={{ boxShadow: "var(--shadow)" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default function TodoPage() {
  const { data: todos, isLoading } = useTodos();
  const create = useCreateTodo();
  const toggle = useToggleTodo();
  const remove = useDeleteTodo();
  const update = useUpdateTodo();
  const reorder = useReorderTodos();
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiParseLoading, setAiParseLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const hasAnimatedRef = useRef(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<TodoFormData>({
    resolver: zodResolver(todoSchema),
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape closes modal first, then clears filters
      if (e.key === "Escape") {
        if (showShortcuts) {
          setShowShortcuts(false);
        } else {
          setSearchQuery("");
          setSelectedTag(null);
          setFilter("all");
          searchInputRef.current?.blur();
          titleInputRef.current?.blur();
        }
        return;
      }
      
      // Ctrl+Enter to focus title input (for quick add)
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        titleInputRef.current?.focus();
      }
      // Ctrl+/ to focus search
      if (e.ctrlKey && e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // ? to show shortcuts
      if (e.key === "?" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault();
          setShowShortcuts(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showShortcuts]);

  useEffect(() => {
    if (isLoading || hasAnimatedRef.current || !pageRef.current) return;
    hasAnimatedRef.current = true;
    const cleanup = todoPageAnimations(pageRef.current);
    return cleanup;
  }, [isLoading]);

  const onSubmit = async (data: TodoFormData) => {
    const tags = data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
    await create.mutateAsync({
      title: data.title,
      due_at: data.due_at || null,
      remind: data.remind || false,
      tags,
    });
    reset();
  };

  const handleAiParseAndAdd = async () => {
    const raw = watch("title")?.trim();
    if (!raw || !hasGeminiKey()) return;
    setAiParseLoading(true);
    try {
      const parsed = await parseNaturalLanguageTodo(raw);
      await create.mutateAsync({
        title: parsed.title,
        tags: parsed.tags,
        due_at: parsed.due_at,
        remind: parsed.remind,
      });
      reset();
    } catch {
      // fallback: add as plain title
      await create.mutateAsync({ title: raw });
      reset();
    } finally {
      setAiParseLoading(false);
    }
  };

  const handleApplyOptimize = async (
    updates: { id: string; order?: number; due_at?: string | null; remind?: boolean }[]
  ) => {
    if (!todos?.length) return;
    const incompleteIds = updates.map((u) => u.id);
    const completed = todos.filter((t) => t.completed);
    const completedIds = completed.map((t) => t.id);
    const orderUpdates = [
      ...updates.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((u) => ({ id: u.id, order: u.order ?? 0 })),
      ...completedIds.map((id, i) => ({ id, order: incompleteIds.length + i })),
    ];
    await reorder.mutateAsync(orderUpdates);
    for (const u of updates) {
      if (u.due_at !== undefined || u.remind !== undefined) {
        await update.mutateAsync({
          id: u.id,
          ...(u.due_at !== undefined && { due_at: u.due_at }),
          ...(u.remind !== undefined && { remind: u.remind }),
        });
      }
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (over && active.id !== over.id && filteredTodos) {
      const oldIndex = filteredTodos.findIndex((t) => t.id === active.id);
      const newIndex = filteredTodos.findIndex((t) => t.id === over.id);

      const newOrder = arrayMove(filteredTodos, oldIndex, newIndex);
      const updates = newOrder.map((todo, index) => ({
        id: todo.id,
        order: index,
      }));

      reorder.mutate(updates);
    }
  };

  const completedCount = todos?.filter((t) => t.completed).length || 0;
  const totalCount = todos?.length || 0;
  const activeCount = totalCount - completedCount;

  // Get all unique tags
  const allTags = Array.from(
    new Set(todos?.flatMap((t) => t.tags || []).filter(Boolean))
  ).sort();

  // Filter todos
  const filteredTodos = todos?.filter((todo) => {
    // Filter by status
    if (filter === "active" && todo.completed) return false;
    if (filter === "completed" && !todo.completed) return false;

    // Filter by search
    if (searchQuery && !todo.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Filter by tag
    if (selectedTag && (!todo.tags || !todo.tags.includes(selectedTag))) {
      return false;
    }

    return true;
  });

  return (
    <div
      className={`min-h-screen bg-background flex ${showAIPanel ? "h-screen overflow-hidden" : ""}`}
    >
      <div
        className={`flex-1 flex justify-center min-w-0 transition-[width] duration-300 ease-out p-4 ${showAIPanel ? "min-h-0 overflow-auto items-start pt-6" : "items-center"}`}
      >
        <div ref={pageRef} className="w-full max-w-3xl">
        {/* Header */}
        <div data-gsap-todo-header className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-5xl font-bold tracking-tight">
              Todo<span className="text-primary">.</span>
            </h1>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAIPanel(true)}
                className="p-2 border-2 border-border bg-card hover:bg-muted hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 cursor-pointer transition-all duration-150"
                style={{ boxShadow: "var(--shadow-sm)" }}
                title="Open AI Assistant"
                aria-label="Open AI panel"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setShowShortcuts(true)}
                className="px-4 py-2 text-lg border-2 border-border bg-card hover:bg-muted hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 cursor-pointer transition-all duration-150"
                style={{ boxShadow: "var(--shadow-sm)" }}
                title="Keyboard shortcuts (?)"
                aria-label="Show keyboard shortcuts"
              >
                ⌨️
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium border-2 border-border bg-card hover:bg-destructive hover:text-destructive-foreground hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 cursor-pointer transition-all duration-150"
                style={{ boxShadow: "var(--shadow-sm)" }}
              >
                Logout
              </button>
            </div>
          </div>
          <p className="text-muted-foreground">
            {totalCount === 0
              ? "No todos yet. Create one to get started!"
              : `${completedCount} of ${totalCount} completed`}
          </p>
        </div>

        {/* Search Bar */}
        <div data-gsap-todo-search className="mb-4">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search todos... (Ctrl+/)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 border-2 border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-ring/20 transition-all"
          />
        </div>

        {/* Add Todo Form */}
        <form data-gsap-todo-add-form onSubmit={handleSubmit(onSubmit)} className="mb-8">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  {...register("title")}
                  ref={(e) => {
                    register("title").ref(e);
                    (titleInputRef as any).current = e;
                  }}
                  placeholder={hasGeminiKey() ? "Type naturally or use ✨ AI (Ctrl+Enter)" : "What needs to be done? (Ctrl+Enter)"}
                  className={`w-full px-4 py-3 border-2 ${
                    errors.title ? "border-primary" : "border-border"
                  } bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-ring/20 transition-all`}
                  style={{ boxShadow: errors.title ? "var(--shadow-sm)" : "none" }}
                />
                {errors.title && (
                  <p className="mt-2 text-sm font-medium animate-shake" style={{ color: "var(--primary)" }}>
                    {errors.title.message}
                  </p>
                )}
              </div>
              {hasGeminiKey() && (
                <button
                  type="button"
                  onClick={handleAiParseAndAdd}
                  disabled={create.isPending || aiParseLoading || !watch("title")?.trim()}
                  className="px-4 py-3 border-2 border-border bg-card font-medium hover:bg-muted disabled:opacity-50 cursor-pointer transition-all duration-150"
                  title="Parse with AI and add (tags, due, remind)"
                >
                  {aiParseLoading ? "..." : "✨ AI"}
                </button>
              )}
              <button
                type="submit"
                disabled={create.isPending}
                className="px-6 py-3 bg-primary text-primary-foreground font-medium border-2 border-border hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
                style={{ boxShadow: "var(--shadow)" }}
              >
                {create.isPending ? "Adding..." : "Add"}
              </button>
            </div>

            {/* Additional Fields */}
            <div className="flex gap-3 flex-wrap">
              <input
                {...register("due_at")}
                type="date"
                className="px-3 py-2 border-2 border-border bg-card text-foreground focus:outline-none focus:ring-4 focus:ring-ring/20 transition-all text-sm"
                placeholder="Due date"
              />
              <input
                {...register("tags")}
                placeholder="Tags (comma separated)"
                className="flex-1 px-3 py-2 border-2 border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-ring/20 transition-all text-sm"
              />
              <label className="flex items-center gap-2 px-3 py-2 border-2 border-border bg-card cursor-pointer hover:bg-muted transition-colors">
                <input
                  {...register("remind")}
                  type="checkbox"
                  className="w-4 h-4"
                />
                <span className="text-sm">Remind me</span>
              </label>
            </div>
          </div>
        </form>

        {/* Tags Filter */}
        {allTags.length > 0 && (
          <div className="mb-6 flex gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground py-2">Tags:</span>
            {allTags.map((tag, idx) => (
              <button
                type="button"
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`tag-pill px-3 py-1 text-sm border-2 border-border cursor-pointer ${
                  selectedTag === tag
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-card text-foreground hover:bg-muted"
                }`}
                style={{ animationDelay: `${idx * 0.04}s` }}
              >
                {tag}
              </button>
            ))}
            {selectedTag && (
              <button
                type="button"
                onClick={() => setSelectedTag(null)}
                className="tag-pill px-3 py-1 text-sm border-2 border-border bg-muted hover:bg-destructive hover:text-destructive-foreground cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Filter Tabs */}
        {todos && todos.length > 0 && (
          <div data-gsap-todo-filters className="mb-6 flex gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-4 py-2 text-sm font-medium border-2 border-border transition-all duration-200 cursor-pointer ${
                filter === "all"
                  ? "bg-accent text-accent-foreground"
                  : "bg-card text-foreground hover:bg-muted"
              }`}
              style={{ boxShadow: filter === "all" ? "var(--shadow-sm)" : "none" }}
            >
              All ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter("active")}
              className={`px-4 py-2 text-sm font-medium border-2 border-border transition-all duration-200 cursor-pointer ${
                filter === "active"
                  ? "bg-accent text-accent-foreground"
                  : "bg-card text-foreground hover:bg-muted"
              }`}
              style={{ boxShadow: filter === "active" ? "var(--shadow-sm)" : "none" }}
            >
              Active ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter("completed")}
              className={`px-4 py-2 text-sm font-medium border-2 border-border transition-all duration-200 cursor-pointer ${
                filter === "completed"
                  ? "bg-accent text-accent-foreground"
                  : "bg-card text-foreground hover:bg-muted"
              }`}
              style={{ boxShadow: filter === "completed" ? "var(--shadow-sm)" : "none" }}
            >
              Completed ({completedCount})
            </button>
          </div>
        )}

        {/* Todo List with Drag & Drop */}
        <div data-gsap-todo-list className="space-y-3">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-border border-t-primary mb-4"></div>
              <p>Loading todos...</p>
            </div>
          ) : filteredTodos && filteredTodos.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={filteredTodos.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {filteredTodos.map((todo) => (
                  <SortableTodoItem
                    key={todo.id}
                    todo={todo}
                    onToggle={() =>
                      toggle.mutate({ id: todo.id, completed: !todo.completed })
                    }
                    onDelete={() => remove.mutate(todo.id)}
                    onUpdate={(updates) =>
                      update.mutate({ id: todo.id, ...updates } as any)
                    }
                  />
                ))}
              </SortableContext>
            </DndContext>
          ) : todos && todos.length > 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-border bg-muted/20">
              <p className="text-muted-foreground text-lg mb-2">
                No {filter} todos
                {searchQuery && " matching your search"}
                {selectedTag && ` with tag "${selectedTag}"`}
              </p>
              <p className="text-muted-foreground text-sm">
                Try adjusting your filters!
              </p>
            </div>
          ) : (
            <div className="text-center py-12 border-2 border-dashed border-border bg-muted/20">
              <p className="text-muted-foreground text-lg mb-2">
                No todos yet
              </p>
              <p className="text-muted-foreground text-sm">
                Add your first todo above to get started!
              </p>
            </div>
          )}
        </div>

        {/* Stats Footer */}
        {todos && todos.length > 0 && (
          <div data-gsap-todo-footer className="mt-8 p-4 bg-muted border-2 border-border" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">
                {totalCount} {totalCount === 1 ? "task" : "tasks"} total
              </span>
              <span className="text-muted-foreground">
                {activeCount} remaining
              </span>
              <span className="text-muted-foreground">
                Press <kbd className="px-1 py-0.5 bg-background border border-border text-xs">?</kbd> for shortcuts
              </span>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* AI Panel - in flow, column width animates so main content slides left */}
      <div
        className={`overflow-hidden flex flex-col transition-[width] duration-300 ease-out ${showAIPanel ? "w-96 h-screen shrink-0" : "w-0"}`}
        aria-hidden={!showAIPanel}
      >
        {showAIPanel && (
          <div
            className="w-96 min-w-96 h-full flex flex-col bg-card border-2 border-border shrink-0"
            style={{ boxShadow: "var(--shadow-lg)" }}
            role="dialog"
            aria-label="AI Assistant"
          >
            <AIPanel
              todos={todos ?? []}
              onAddTodo={(input) => create.mutate(input)}
              onApplyOptimize={handleApplyOptimize}
              createPending={create.isPending}
              isOpen={showAIPanel}
              onClose={() => setShowAIPanel(false)}
            />
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Modal - render in portal so it's always on top */}
      {showShortcuts &&
        createPortal(
          <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />,
          document.body
        )}
    </div>
  );
}
