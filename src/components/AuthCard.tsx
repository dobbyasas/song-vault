import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Mode = "login" | "register";

export function AuthCard() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isAnimating, setIsAnimating] = useState(false);
  const [lineCount, setLineCount] = useState(5);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const timeoutRef = useRef<number | null>(null);

  const title = useMemo(() => (mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"), [mode]);
  const subtitle = useMemo(
    () => (mode === "login" ? "Enter the vault." : "Generate a new identity."),
    [mode]
  );

  const logoWidth = useMemo(() => Math.max(80, (lineCount - 1) * 8 + 20), [lineCount]);

  const barMap = useMemo(() => {
    const arr = Array.from({ length: lineCount }, (_, i) => ((i * 3 + 1) % 8) + 1);
    return arr;
  }, [lineCount]);

  function handleLogoClick() {
    setIsAnimating(true);
    setLineCount((prev) => Math.min(prev + 3, 50));

    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setIsAnimating(false), 5000);
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const generateLines = () => {
    const lines = [];
    const spacing = 8;
    const totalWidth = (lineCount - 1) * spacing;

    const centerX = logoWidth / 2;
    const startX = centerX - totalWidth / 2;

    const heights = [
      { y1: 24, y2: 56 },
      { y1: 20, y2: 60 },
      { y1: 12, y2: 68 },
      { y1: 26, y2: 54 },
      { y1: 16, y2: 64 },
      { y1: 22, y2: 58 },
      { y1: 18, y2: 62 },
      { y1: 14, y2: 66 },
    ];

    for (let i = 0; i < lineCount; i++) {
      const x = startX + i * spacing;
      const h = heights[i % heights.length];
      const barClass = barMap[i] ?? ((i % 8) + 1);

      lines.push(
        <line
          key={i}
          className={`sound-bar bar-${barClass} line-appear`}
          x1={x}
          y1={h.y1}
          x2={x}
          y2={h.y2}
          stroke="#ffffff"
          strokeWidth="3"
          strokeLinecap="round"
          style={{ animationDelay: `${i * 0.05}s` }}
        />
      );
    }

    return lines;
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    const e1 = email.trim();
    if (!e1) return setErr("Email is required.");
    if (password.length < 6) return setErr("Password must be at least 6 characters.");

    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: e1,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: e1,
          password,
        });
        if (error) throw error;

        setMsg("Account created. If email confirmation is enabled, check your inbox.");
        setMode("login");
      }
    } catch (e: any) {
      setErr(e?.message ?? "Auth failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="cyber-shell">
      <div className="auth-grid">
        {/* Left: brand */}
        <div className="auth-brand fade-in">
          <div
            className={`brand-badge pulse ${isAnimating ? "animating" : ""}`}
            onClick={handleLogoClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleLogoClick();
            }}
            style={{
              cursor: "pointer",
              width: `${logoWidth}px`,
              transition: "width 0.5s ease",
            }}
            aria-label="Animate logo"
            title="Click me"
          >
            <svg
              width={logoWidth}
              height={80}
              viewBox={`0 0 ${logoWidth} 80`}
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="xMidYMid meet"
            >
              {generateLines()}
            </svg>
          </div>

          <h1 className="brand-title">SONG VAULT</h1>
          <p className="brand-sub">
            A private library for riffs, tunings, and obsessions.
            <br />
            Clean. Fast. Yours.
          </p>

          <div className="brand-stats">
            <div className="stat">
              <div className="stat-k">SYNC</div>
              <div className="stat-v">SUPABASE</div>
            </div>
            <div className="stat">
              <div className="stat-k">UI</div>
              <div className="stat-v">CYBERPUNK</div>
            </div>
            <div className="stat">
              <div className="stat-k">MODE</div>
              <div className="stat-v">{mode === "login" ? "ACCESS" : "ONBOARD"}</div>
            </div>
          </div>

          <div className="brand-lines" aria-hidden="true">
            <div className="scanline" />
            <div className="scanline s2" />
            <div className="scanline s3" />
          </div>
        </div>

        {/* Right: auth card */}
        <div className="auth-card card glow fade-in">
          <div className="card-inner">
            <div className="auth-head">
              <div>
                <div className="auth-title">{title}</div>
                <div className="auth-sub">{subtitle}</div>
              </div>

              <div className="auth-toggle" role="tablist" aria-label="Auth mode">
                <button
                  className={`pill ${mode === "login" ? "active" : ""}`}
                  onClick={() => {
                    setErr(null);
                    setMsg(null);
                    setMode("login");
                  }}
                  type="button"
                >
                  Login
                </button>
                <button
                  className={`pill ${mode === "register" ? "active" : ""}`}
                  onClick={() => {
                    setErr(null);
                    setMsg(null);
                    setMode("register");
                  }}
                  type="button"
                >
                  Register
                </button>
              </div>
            </div>

            <form onSubmit={onSubmit} className="auth-form">
              <label className="field">
                <span>Email</span>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tofi@night.city"
                  autoComplete="email"
                />
              </label>

              <label className="field">
                <span>Password</span>
                <input
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </label>

              {err && <div className="notice error">{err}</div>}
              {msg && <div className="notice ok">{msg}</div>}

              <button className="btn auth-submit" disabled={loading} type="submit">
                {loading ? "Working…" : mode === "login" ? "Enter Vault" : "Create Account"}
              </button>

              <div className="auth-foot">
                <span className="muted">
                  {mode === "login" ? "No account?" : "Already have an account?"}
                </span>
                <button
                  type="button"
                  className="link"
                  onClick={() => {
                    setErr(null);
                    setMsg(null);
                    setMode(mode === "login" ? "register" : "login");
                  }}
                >
                  {mode === "login" ? "Register" : "Login"}
                </button>
              </div>
            </form>

            <div className="auth-hint">Tip: Use a password manager. Your vault deserves it.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
