import { useState } from "react";
import { signIn, signUp } from "../lib/auth";

export function AuthCard() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        await signUp(email.trim(), password);
        setMsg("Signed up! Check your email if confirmation is enabled.");
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err: any) {
      setMsg(err?.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "80px auto", padding: 20, border: "1px solid #ddd", borderRadius: 12 }}>
      <h2 style={{ marginTop: 0 }}>{mode === "signin" ? "Sign in" : "Create account"}</h2>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          style={{ padding: 10 }}
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          style={{ padding: 10 }}
        />

        <button disabled={busy} style={{ padding: 10 }}>
          {busy ? "Working…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
      </form>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

      <div style={{ marginTop: 12 }}>
        {mode === "signin" ? (
          <button onClick={() => setMode("signup")} style={{ padding: 0, background: "none", border: "none", textDecoration: "underline", cursor: "pointer" }}>
            Need an account? Sign up
          </button>
        ) : (
          <button onClick={() => setMode("signin")} style={{ padding: 0, background: "none", border: "none", textDecoration: "underline", cursor: "pointer" }}>
            Already have an account? Sign in
          </button>
        )}
      </div>
    </div>
  );
}
