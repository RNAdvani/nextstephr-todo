// src/features/todos/TodoPage.tsx
import { useTodos, useCreateTodo, useToggleTodo, useDeleteTodo, useUpdateTodo, useReorderTodos } from "./hooks";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { logout } from "../auth/useAuth";
import { useState, useEffect, useRef } from "react";
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
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-4 p-4 bg-card border-2 ${
        isOverdue ? "border-primary" : "border-border"
      } hover:translate-x-0.5 hover:translate-y-0.5 transition-all duration-200 animate-slide-in`}
      {...attributes}
    >
      {/* Drag Handle */}
      <button
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
              className="text-xs px-2 py-0.5 bg-secondary text-secondary-foreground border border-border"
            >
              {tag}
            </span>
          ))}
          {todo.due_at && (
            <span
              className={`text-xs px-2 py-0.5 border ${
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
  );
}

// Keyboard Shortcuts Modal
function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
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

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-slide-in" 
      onClick={onClose}
    >
      <div
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="mb-8 animate-slide-in">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-5xl font-bold tracking-tight">
              Todo<span className="text-primary">.</span>
            </h1>
            <div className="flex gap-2">
              <button
                onClick={() => setShowShortcuts(true)}
                className="px-4 py-2 text-lg border-2 border-border bg-card hover:bg-muted hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 cursor-pointer transition-all duration-150"
                style={{ boxShadow: "var(--shadow-sm)" }}
                title="Keyboard shortcuts (?)"
                aria-label="Show keyboard shortcuts"
              >
                ⌨️
              </button>
              <button
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
        <div className="mb-4 animate-slide-in">
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
        <form onSubmit={handleSubmit(onSubmit)} className="mb-8 animate-slide-in">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  {...register("title")}
                  ref={(e) => {
                    register("title").ref(e);
                    (titleInputRef as any).current = e;
                  }}
                  placeholder="What needs to be done? (Ctrl+Enter)"
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
          <div className="mb-6 animate-slide-in flex gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground py-2">Tags:</span>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-3 py-1 text-sm border-2 border-border transition-all duration-200 ${
                  selectedTag === tag
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-card text-foreground hover:bg-muted"
                }`}
              >
                {tag}
              </button>
            ))}
            {selectedTag && (
              <button
                onClick={() => setSelectedTag(null)}
                className="px-3 py-1 text-sm border-2 border-border bg-muted hover:bg-destructive hover:text-destructive-foreground transition-all duration-200"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Filter Tabs */}
        {todos && todos.length > 0 && (
          <div className="mb-6 flex gap-2 animate-slide-in" style={{ animationDelay: "100ms" }}>
            <button
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
        <div className="space-y-3">
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
          <div className="mt-8 p-4 bg-muted border-2 border-border animate-slide-in" style={{ boxShadow: "var(--shadow-sm)" }}>
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

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}
