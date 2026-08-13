"use client";
import { FormEvent, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const res = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: params.token, password }) });
    const data = await res.json();
    setMessage(res.ok ? "Password reset. You can log in now." : data.error);
  };
  return <main className="shell page-wrap"><Link className="btn ghost small" href="/">← Home</Link><form className="auth-card form" onSubmit={submit}><h2>Reset password</h2><input className="input" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="New password" minLength={6} required/><button className="btn">Reset password</button>{message && <p className={message.startsWith("Password") ? "success" : "error"}>{message}</p>}</form></main>;
}
