"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Referral = { id: string; code: string; createdAt: string; invitedUser: { name: string; username: string; avatar: string } | null };
type ReferralData = { referralCode: string; inviteLink: string; referrals: Referral[]; totalReferrals: number; milestones: { count: number; label: string; earned: boolean }[] };

export default function InvitePage() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/referrals")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not load referrals.");
        setData(json);
      })
      .catch((err) => setError(err.message));
  }, []);

  const copy = async () => {
    if (!data) return;
    await navigator.clipboard?.writeText(data.inviteLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (error) return <main className="shell page-wrap"><Link className="btn ghost small" href="/">← Home</Link><div className="empty">{error}</div></main>;
  if (!data) return <main className="shell page-wrap"><div className="empty">Loading invites…</div></main>;

  return (
    <main className="shell page-wrap">
      <div className="split"><Link className="btn ghost small" href="/">← Home</Link><h2>Invite friends</h2><span className="live-chip">● Growth loop</span></div>
      <section className="explore-hero card">
        <span className="eyebrow">🚀 Referrals</span>
        <h1><span className="gradient-text">Grow the creator community.</span><br />Invite friends and unlock milestones.</h1>
        <p className="lead">Share your invite link. New users who join with it automatically follow you, helping your network grow from day one.</p>
        <div className="invite-box">
          <div><span className="muted">Your code</span><strong>{data.referralCode}</strong></div>
          <input className="input" value={data.inviteLink} readOnly />
          <button className="btn" onClick={copy}>{copied ? "Copied!" : "Copy link"}</button>
        </div>
      </section>

      <section className="main-grid">
        <div className="stack">
          <section className="card">
            <div className="split"><h3>Referral history</h3><span className="tag">{data.totalReferrals} joined</span></div>
            <div className="creator-list">
              {data.referrals.length === 0 ? <div className="empty compact">No referrals yet. Share your invite link to get started.</div> : data.referrals.map((referral) => <div className="creator-card" key={referral.id}><div className="creator-head"><img className="avatar" src={referral.invitedUser?.avatar || "https://api.dicebear.com/8.x/adventurer/svg?seed=Invite"} alt="" /><div className="creator-meta"><strong>{referral.invitedUser?.name || "New creator"}</strong><span>Joined {new Date(referral.createdAt).toLocaleDateString()}</span></div></div></div>)}
            </div>
          </section>
        </div>
        <aside className="sidebar">
          <section className="card">
            <h3>Milestones</h3>
            <div className="badge-grid">{data.milestones.map((milestone) => <div className={`achievement ${milestone.earned ? "earned" : ""}`} key={milestone.count}><strong>{milestone.earned ? "🏆" : "🔒"} {milestone.label}</strong><span>{milestone.count} successful invites</span></div>)}</div>
          </section>
          <section className="card"><h3>Growth tip</h3><p className="muted">Invite links are a simple acquisition loop. Later, this can power rewards, creator ambassador programs, and viral onboarding campaigns.</p></section>
        </aside>
      </section>
    </main>
  );
}
