import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiErrorResponse } from "../lib/api";
import { useAuth } from "../state/auth";

type AuthMode = "login" | "register";

export function AuthPage({ mode }: { mode: AuthMode }) {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    password: "",
  });
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "login") {
        await login({ email: form.email, password: form.password });
      } else {
        await register({ name: form.name, email: form.email, password: form.password });
      }
      navigate("/board", { replace: true });
    } catch (err) {
      if (err instanceof ApiErrorResponse) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="brand">
          <div className="brand-icon">TB</div>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Team Boards</span>
        </div>
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="muted">
          {mode === "login"
            ? "Sign in to access your team board."
            : "Get started by creating a demo account."}
        </p>

        {mode === "register" && (
          <label>
            <span>Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Jane Doe"
              required
            />
          </label>
        )}
        <label>
          <span>Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            placeholder="you@company.com"
            required
          />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            placeholder="Minimum 8 characters"
            required
          />
        </label>

        {error && <div className="banner error">{error}</div>}

        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? "Working…" : mode === "login" ? "Log in" : "Register"}
        </button>

        <p className="switcher">
          {mode === "login" ? "Need an account?" : "Already have an account?"}{" "}
          <Link to={mode === "login" ? "/register" : "/login"}>
            {mode === "login" ? "Register" : "Log in"}
          </Link>
        </p>

        <div className="hint">
          <strong>Demo credentials</strong>
          <div>demo@teamboards.dev / password123</div>
        </div>
      </form>
    </div>
  );
}
