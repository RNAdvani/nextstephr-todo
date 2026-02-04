// src/features/todos/api.ts
import { supabase } from "../../lib/supabase";
import { z } from "zod";

// Zod schemas for validation
export const TodoSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  completed: z.boolean(),
  created_at: z.string(),
  user_id: z.string().uuid(),
  due_at: z.string().nullable(),
  remind: z.boolean().default(false),
  reminded: z.boolean().default(false),
  tags: z.array(z.string()).nullable().default([]),
  order: z.number().default(0),
});

export const CreateTodoSchema = z.object({
  title: z.string().min(1, "Todo cannot be empty").max(200, "Todo is too long"),
  due_at: z.string().nullable().optional(),
  remind: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export const UpdateTodoSchema = z.object({
  id: z.string().uuid(),
  completed: z.boolean().optional(),
  title: z.string().min(1).max(200).optional(),
  due_at: z.string().nullable().optional(),
  remind: z.boolean().optional(),
  reminded: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  order: z.number().optional(),
});

export type Todo = z.infer<typeof TodoSchema>;
export type CreateTodoInput = z.infer<typeof CreateTodoSchema>;
export type UpdateTodoInput = z.infer<typeof UpdateTodoSchema>;

export const fetchTodos = async (): Promise<Todo[]> => {
  const { data, error } = await supabase
    .from("todos")
    .select("*")
    .order("order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  
  // Validate response data
  const validatedData = z.array(TodoSchema).parse(data);
  return validatedData;
};

export const createTodo = async (input: CreateTodoInput): Promise<void> => {
  // Validate input
  CreateTodoSchema.parse(input);

  const user = (await supabase.auth.getUser()).data.user;

  if (!user) {
    throw new Error("User not authenticated");
  }

  const { error } = await supabase.from("todos").insert({
    title: input.title.trim(),
    user_id: user.id,
    due_at: input.due_at || null,
    remind: input.remind || false,
    tags: input.tags || [],
  });

  if (error) throw error;
};

export const updateTodo = async (input: UpdateTodoInput): Promise<void> => {
  // Validate input
  UpdateTodoSchema.parse(input);

  const { id, ...updates } = input;

  const { error } = await supabase
    .from("todos")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
};

export const toggleTodo = async (id: string, completed: boolean): Promise<void> => {
  // Validate input
  z.string().uuid().parse(id);

  const { error } = await supabase
    .from("todos")
    .update({ completed })
    .eq("id", id);

  if (error) throw error;
};

export const deleteTodo = async (id: string): Promise<void> => {
  // Validate input
  z.string().uuid().parse(id);

  const { error } = await supabase.from("todos").delete().eq("id", id);
  if (error) throw error;
};

export const reorderTodos = async (todos: { id: string; order: number }[]): Promise<void> => {
  const updates = todos.map((todo) =>
    supabase
      .from("todos")
      .update({ order: todo.order })
      .eq("id", todo.id)
  );

  await Promise.all(updates);
};
