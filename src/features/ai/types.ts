export interface ParsedTodo {
  title: string;
  tags: string[];
  due_at: string | null;
  remind: boolean;
}

export interface OptimizedItem {
  id: string;
  title: string;
  suggested_order: number;
  suggested_due_at: string | null;
  suggested_remind: boolean;
  reason?: string;
}

export interface OptimizedPlan {
  summary: string;
  items: OptimizedItem[];
}
