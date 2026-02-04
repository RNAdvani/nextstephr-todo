// src/app/router.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import LoginForm from "../features/auth/LoginForm";
import TodoPage from "../features/todos/TodoPage";

export function AppRouter({ user }: { user: any }) {
  return (
    <Routes>
      <Route 
        path="/login" 
        element={user ? <Navigate to="/" /> : <LoginForm />} 
      />
      <Route 
        path="/" 
        element={user ? <TodoPage /> : <Navigate to="/login" />} 
      />
    </Routes>
  );
}
