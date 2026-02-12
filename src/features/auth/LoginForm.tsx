import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { login } from "./useAuth";
import { useState, useRef, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { loginPageAnimations } from "../../util/gsap";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = loginSchema.extend({
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;

export default function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const onLogin = async (values: LoginFormData) => {
    setIsLoading(true);
    setError(null);
    
    const { error: authError } = await login(values.email, values.password);
    
    if (authError) {
      setError(authError.message);
      setIsLoading(false);
    } else {
      window.location.href = "/";
    }
  };

  const onSignup = async (values: SignupFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const { error: authError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
    });

    if (authError) {
      setError(authError.message);
      setIsLoading(false);
    } else {
      setSuccess("Account created! You can now log in.");
      setMode("login");
      loginForm.reset();
      signupForm.reset();
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setError(null);
    setSuccess(null);
    loginForm.reset();
    signupForm.reset();
  };

  const currentForm = mode === "login" ? loginForm : signupForm;
  const onSubmit = mode === "login" ? onLogin : onSignup;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let killGsap: (() => void) | undefined;
    const id = requestAnimationFrame(() => {
      killGsap = loginPageAnimations(containerRef.current);
    });
    return () => {
      cancelAnimationFrame(id);
      killGsap?.();
    };
  }, [mode]);

  return (
    <div ref={containerRef} className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Abstract Decorative Shapes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div data-gsap-shape className="absolute -top-20 -left-20 w-64 h-64 border-8 border-primary" style={{ borderRadius: "50%", opacity: 0.06 }} />
        <div data-gsap-shape className="absolute top-32 -right-16 w-48 h-48 bg-secondary border-4 border-border" style={{ boxShadow: "var(--shadow-lg)", opacity: 0.04 }} />
        <div data-gsap-shape className="absolute -bottom-12 -left-8 w-56 h-32 bg-accent border-4 border-border" style={{ transform: "rotate(-8deg)", boxShadow: "var(--shadow-md)", opacity: 0.04 }} />
        <div data-gsap-shape className="absolute bottom-24 -right-24 w-80 h-80 border-8 border-accent" style={{ borderRadius: "50%", opacity: 0.03 }} />
        <div data-gsap-shape className="absolute top-1/2 left-1/2 w-96 h-96 border-4 border-primary" style={{ borderRadius: "50%", transform: "translate(-50%, -50%)", opacity: 0.008 }} />
        <div data-gsap-shape className="absolute top-1/4 right-1/4 w-12 h-12 bg-primary border-2 border-border" style={{ transform: "rotate(45deg)", opacity: 0.08 }} />
        <div data-gsap-shape className="absolute bottom-1/3 left-1/3 w-16 h-16 border-4 border-secondary" style={{ transform: "rotate(25deg)", opacity: 0.06 }} />
        <div data-gsap-shape className="absolute top-1/3 left-1/4 w-32 h-4 bg-primary border-2 border-border" style={{ transform: "rotate(-15deg)", opacity: 0.05 }} />
        <div data-gsap-shape className="absolute top-2/3 right-1/3 w-40 h-3 bg-accent border-2 border-border" style={{ transform: "rotate(20deg)", opacity: 0.04 }} />
      </div>

      {/* Main Content */}
      <div className="w-full max-w-md relative z-10">
        <div className="mb-8 text-center">
          <h1 data-gsap-login-title className="text-5xl font-bold tracking-tight mb-3">
            {mode === "login" ? "Welcome" : "Sign Up"}
            <span className="text-primary">.</span>
          </h1>
          <p data-gsap-login-subtitle className="text-muted-foreground">
            {mode === "login" ? "Sign in to manage your todos" : "Create an account to get started"}
          </p>
        </div>

        <form data-gsap-login-form onSubmit={currentForm.handleSubmit(onSubmit as any)} className="space-y-6">
          {/* Success Message */}
          {success && (
            <div
              className="p-4 bg-accent/10 border-2 border-accent text-accent-foreground animate-slide-in"
              style={{ boxShadow: "var(--shadow-sm)" }}
            >
              <p className="text-sm font-medium">{success}</p>
            </div>
          )}

          {/* Global Error */}
          {error && (
            <div
              className="p-4 border-2 animate-shake"
              style={{ 
                boxShadow: "var(--shadow-sm)",
                borderColor: "var(--primary)",
                backgroundColor: "rgba(255, 51, 51, 0.1)"
              }}
            >
              <p className="text-sm font-medium" style={{ color: "var(--primary)" }}>{error}</p>
            </div>
          )}

          {/* Email Field */}
          <div data-gsap-login-field>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-2 text-foreground"
            >
              Email
            </label>
            <input
              {...(currentForm.register as any)("email")}
              id="email"
              type="email"
              placeholder="you@example.com"
              className={`w-full px-4 py-3 border-2 ${
                currentForm.formState.errors.email ? "border-primary" : "border-border"
              } bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-ring/20 transition-all`}
              style={{ boxShadow: currentForm.formState.errors.email ? "var(--shadow-sm)" : "none" }}
            />
            {currentForm.formState.errors.email && (
              <p className="mt-2 text-sm font-medium" style={{ color: "var(--primary)" }}>
                {currentForm.formState.errors.email.message}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div data-gsap-login-field>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-2 text-foreground"
            >
              Password
            </label>
            <input
              {...(currentForm.register as any)("password")}
              id="password"
              type="password"
              placeholder="••••••••"
              className={`w-full px-4 py-3 border-2 ${
                currentForm.formState.errors.password ? "border-primary" : "border-border"
              } bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-ring/20 transition-all`}
              style={{
                boxShadow: currentForm.formState.errors.password ? "var(--shadow-sm)" : "none",
              }}
            />
            {currentForm.formState.errors.password && (
              <p className="mt-2 text-sm font-medium" style={{ color: "var(--primary)" }}>
                {currentForm.formState.errors.password.message}
              </p>
            )}
          </div>

          {/* Confirm Password Field (Signup only) */}
          {mode === "signup" && (
            <div data-gsap-login-field>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium mb-2 text-foreground"
              >
                Confirm Password
              </label>
              <input
                {...signupForm.register("confirmPassword")}
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                className={`w-full px-4 py-3 border-2 ${
                  signupForm.formState.errors.confirmPassword ? "border-primary" : "border-border"
                } bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-ring/20 transition-all`}
                style={{
                  boxShadow: signupForm.formState.errors.confirmPassword ? "var(--shadow-sm)" : "none",
                }}
              />
              {signupForm.formState.errors.confirmPassword && (
                <p className="mt-2 text-sm font-medium" style={{ color: "var(--primary)" }}>
                  {signupForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            data-gsap-login-submit
            type="submit"
            disabled={isLoading}
            className="w-full px-6 py-3 bg-primary text-primary-foreground font-medium border-2 border-border hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
            style={{ boxShadow: "var(--shadow)" }}
          >
            {isLoading 
              ? mode === "login" ? "Signing in..." : "Creating account..."
              : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        {/* Toggle Mode */}
        <div data-gsap-login-toggle className="mt-6 text-center">
          <button
            type="button"
            onClick={toggleMode}
            className="text-sm text-muted-foreground hover:text-primary transition-colors duration-200"
          >
            {mode === "login" 
              ? "Don't have an account? Sign up" 
              : "Already have an account? Sign in"}
          </button>
        </div>

        {/* Footer Note */}
        {mode === "login" && (
          <div className="mt-8 text-center">
            <p className="text-xs text-muted-foreground">
              Demo: test@example.com / password123
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
