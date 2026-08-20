"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import AuthCard from "../components/AuthCard";

function LoginLanding() {
  const params = useSearchParams();
  const mode = params.get("mode") === "signup" ? "signup" : "login";

  return (
    <main className="landing-page">
      <section className="shell hero landing-hero">
        <div className="hero-copy">
          <span className="eyebrow">Creator Connect</span>
          <h1><span className="gradient-text">Sign up or log in</span><br />to your creator home.</h1>
          <p className="lead">
            Join the feed, follow creators, post stories, and hang out in groups — after you sign in.
          </p>
          <div className="row">
            <Link className="btn ghost" href="/">Back to landing</Link>
            <Link className="btn ghost" href="/explore">Browse explore</Link>
          </div>
        </div>
        <AuthCard defaultMode={mode} />
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="shell page-wrap"><div className="empty">Loading…</div></main>}>
      <LoginLanding />
    </Suspense>
  );
}
