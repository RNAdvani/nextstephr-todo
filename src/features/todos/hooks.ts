// src/features/todos/hooks.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTodos, createTodo, updateTodo, toggleTodo, deleteTodo, reorderTodos } from "./api";
import type { CreateTodoInput, UpdateTodoInput } from "./api";

export const useTodos = () =>
  useQuery({ queryKey: ["todos"], queryFn: fetchTodos });

export const useCreateTodo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTodoInput) => createTodo(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });
};

export const useUpdateTodo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTodoInput) => updateTodo(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });
};

export const useToggleTodo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      toggleTodo(id, completed),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });
};

export const useDeleteTodo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTodo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });
};

export const useReorderTodos = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (todos: { id: string; order: number }[]) => reorderTodos(todos),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
  });
};
