"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function VerifyEmailPage() {
  const params = useParams<{ token: string }>();
  const [message, setMessage] = useState("Verifying email…");
  useEffect(() => {
    fetch("/api/auth/verify-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: params.token }) })
      .then(async (res) => { const data = await res.json(); setMessage(res.ok ? "Email verified successfully." : data.error); })
      .catch(() => setMessage("Verification failed."));
  }, [params.token]);
  return <main className="shell page-wrap"><section className="auth-card"><h2>Email verification</h2><p className={message.includes("success") ? "success" : "muted"}>{message}</p><Link className="btn" href="/">Continue</Link></section></main>;
}
