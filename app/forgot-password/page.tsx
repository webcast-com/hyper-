"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const res = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const data = await res.json();
    setMessage(data.message || data.error || "Check your email.");
  };
  return <main className="shell page-wrap"><Link className="btn ghost small" href="/">← Home</Link><form className="auth-card form" onSubmit={submit}><h2>Forgot password</h2><p className="muted">Enter your email. In development, reset links are printed to the server console.</p><input className="input" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Email" required/><button className="btn">Send reset link</button>{message && <p className="success">{message}</p>}</form></main>;
}
