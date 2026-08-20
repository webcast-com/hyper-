"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type AuthCardProps = {
  defaultMode?: "signup" | "login";
  onSuccess?: () => void;
};

export default function AuthCard({ defaultMode = "login", onSuccess }: AuthCardProps) {
  const [authMode, setAuthMode] = useState<"signup" | "login">(defaultMode);
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", niche: "Design", inviteCode: "" });
  const [toast, setToast] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get("invite") || "";
    const mode = params.get("mode");
    if (invite) setAuthForm((prev) => ({ ...prev, inviteCode: invite.toUpperCase() }));
    if (mode === "signup" || mode === "login") setAuthMode(mode);
  }, []);

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setToast(null);
    setBusy(true);
    try {
      const url = authMode === "signup" ? "/api/auth/register" : "/api/auth/login";
      const payload = authMode === "signup" ? authForm : { email: authForm.email, password: authForm.password };
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const raw = await response.text();
      const data = raw ? JSON.parse(raw) : {};
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
      setToast({ type: "success", text: authMode === "signup" ? "Welcome to Creator Connect!" : "You are signed in." });
      if (onSuccess) onSuccess();
      else window.location.href = "/";
    } catch (err) {
      setToast({ type: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside id="join" className="auth-card">
      <form className="form" onSubmit={submitAuth}>
        <div className="tabs">
          <button type="button" className={`tab ${authMode === "signup" ? "active" : ""}`} onClick={() => setAuthMode("signup")}>Sign up</button>
          <button type="button" className={`tab ${authMode === "login" ? "active" : ""}`} onClick={() => setAuthMode("login")}>Log in</button>
        </div>
        {authMode === "signup" && (
          <>
            <input className="input" value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} placeholder="Creator name" required />
            <input className="input" value={authForm.niche} onChange={(e) => setAuthForm({ ...authForm, niche: e.target.value })} placeholder="Niche e.g. Music, Design" />
            <input className="input" value={authForm.inviteCode} onChange={(e) => setAuthForm({ ...authForm, inviteCode: e.target.value.toUpperCase() })} placeholder="Optional invite code" />
          </>
        )}
        <input className="input" type="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} placeholder="Email" required />
        <input className="input" type="password" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} placeholder="Password" required minLength={6} />
        <button className="btn" type="submit" disabled={busy}>{busy ? "Please wait…" : authMode === "signup" ? "Create account" : "Log in"}</button>
        <p className="muted">Demo: maya@example.com / password123</p>
        <Link className="inline-link" href="/forgot-password">Forgot password?</Link>
      </form>
      {toast && <p className={toast.type === "error" ? "error" : "success"}>{toast.text}</p>}
    </aside>
  );
}
