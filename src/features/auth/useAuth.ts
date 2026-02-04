import { supabase } from "../../lib/supabase";

export const login = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

export const logout = () => supabase.auth.signOut();

export const getUser = () => supabase.auth.getUser();
