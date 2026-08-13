"use client";

import { useParams } from "next/navigation";
import Link from "next/link";

export default function PublicInvitePage() {
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(params.code || "").toUpperCase();

  return (
    <main className="shell page-wrap">
      <section className="explore-hero card invite-landing">
        <span className="eyebrow">✨ You are invited</span>
        <h1><span className="gradient-text">Join Creator Connect.</span><br />Build, share, sell, and grow with creators.</h1>
        <p className="lead">Your invite code is ready. Create an account and you will automatically connect with the creator who invited you.</p>
        <div className="invite-box">
          <div><span className="muted">Invite code</span><strong>{code}</strong></div>
          <Link className="btn" href={`/?invite=${encodeURIComponent(code)}#join`}>Join with this invite</Link>
          <Link className="btn ghost" href="/explore">Explore first</Link>
        </div>
      </section>
    </main>
  );
}
