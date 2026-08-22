import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { Mark } from "../../components/ui/Mark";
import { useAuth } from "./AuthContext";

type Mode = "login" | "register";

export function safeAuthRedirect(value: string | null): string {
  return value?.startsWith("/app") ? value : "/app/overview";
}

export function AuthPage({ mode }: { mode: Mode }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = safeAuthRedirect(searchParams.get("redirect"));
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const isRegister = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      if (isRegister) {
        await auth.register({ email, password, display_name: displayName });
      } else {
        await auth.login({ email, password });
      }
      navigate(redirect, { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Authentication could not be completed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-page grid">
      <section className="auth-panel" aria-labelledby="auth-title">
        <Link to="/" className="auth-brand" aria-label="ProjectOps home">
          <Mark />
          <span>ProjectOps</span>
        </Link>
        <div>
          <div className="eyebrow">{isRegister ? "Create account" : "Workspace sign in"}</div>
          <h1 id="auth-title">{isRegister ? "Create your ProjectOps account" : "Sign in to ProjectOps"}</h1>
          <p>
            {isRegister
              ? "Create an account to keep Projects separated."
              : "Sign in to your ProjectOps workspace."}
          </p>
        </div>
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input id="auth-email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-describedby={error ? "auth-error" : undefined} required />
          </div>
          {isRegister && (
            <div className="field">
              <label htmlFor="auth-display-name">Display name</label>
              <input id="auth-display-name" name="display_name" autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} aria-describedby={error ? "auth-error" : undefined} />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <input id="auth-password" name="password" type="password" autoComplete={isRegister ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} aria-describedby={error ? "auth-error" : undefined} required />
          </div>
          {error && (
            <p className="error-text" role="alert" id="auth-error">
              {error}
            </p>
          )}
          <button className="button primary" type="submit" disabled={pending}>
            {pending ? (isRegister ? "Creating account..." : "Signing in...") : isRegister ? "Create account" : "Sign in"}
          </button>
        </form>
        <p className="auth-switch">
          {isRegister ? "Already have an account?" : "New to ProjectOps?"}{" "}
          <Link className="link" to={isRegister ? "/login" : "/register"}>
            {isRegister ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </section>
      <aside className="auth-context-panel" aria-label="Authentication context">
        <div className="eyebrow">Ownership foundation</div>
        <h2>Projects you create are tied to your account.</h2>
        <p>Demo data is sample data for your account only.</p>
      </aside>
    </main>
  );
}
