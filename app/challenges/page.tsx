"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type User = { id: string; name: string; username: string; avatar: string; niche: string };
type Challenge = { id: string; title: string; description: string; theme: string; prize: string; endsAt: string; host: User | null; entryCount: number; voteCount: number; isActive: boolean };
type Entry = { id: string; challengeId: string; title: string; body: string; imageUrl?: string; author: User | null; voteCount: number; hasVoted: boolean; createdAt: string };

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selected, setSelected] = useState<Challenge | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [entryForm, setEntryForm] = useState({ title: "", body: "", imageUrl: "" });
  const [challengeForm, setChallengeForm] = useState({ title: "", theme: "", description: "", prize: "" });
  const [toast, setToast] = useState("");

  const loadChallenges = async () => {
    const res = await fetch("/api/challenges");
    const data = await res.json();
    setChallenges(data.challenges || []);
    if (!selected && data.challenges?.[0]) setSelected(data.challenges[0]);
  };

  const loadEntries = async (challengeId: string) => {
    const res = await fetch(`/api/challenges/${challengeId}/entries`);
    const data = await res.json();
    setEntries(data.entries || []);
  };

  useEffect(() => { loadChallenges(); }, []);
  useEffect(() => { if (selected) loadEntries(selected.id); }, [selected?.id]);

  const createChallenge = async (event: FormEvent) => {
    event.preventDefault();
    const res = await fetch("/api/challenges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(challengeForm) });
    const data = await res.json();
    if (!res.ok) return setToast(data.error || "Could not create challenge.");
    setChallengeForm({ title: "", theme: "", description: "", prize: "" });
    setSelected(data.challenge);
    setToast("Challenge created.");
    await loadChallenges();
  };

  const submitEntry = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    const res = await fetch(`/api/challenges/${selected.id}/entries`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entryForm) });
    const data = await res.json();
    if (!res.ok) return setToast(data.error || "Could not submit entry.");
    setEntryForm({ title: "", body: "", imageUrl: "" });
    setToast("Entry submitted.");
    await loadEntries(selected.id);
    await loadChallenges();
  };

  const vote = async (entryId: string) => {
    if (!selected) return;
    const res = await fetch(`/api/challenges/${selected.id}/entries/${entryId}/vote`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return setToast(data.error || "Could not vote.");
    setEntries((prev) => prev.map((entry) => entry.id === entryId ? data.entry : entry).sort((a, b) => b.voteCount - a.voteCount));
    setToast(data.entry.hasVoted ? "Vote added." : "Vote removed.");
  };

  return (
    <main className="shell page-wrap">
      <div className="split"><Link className="btn ghost small" href="/">← Home</Link><h2>Creator challenges</h2><span className="live-chip">● Weekly growth loops</span></div>
      {toast && <p className="success">{toast}</p>}

      <section className="explore-hero card">
        <span className="eyebrow">🏁 Challenges</span>
        <h1><span className="gradient-text">Compete, vote, and get discovered.</span><br />Turn community prompts into creator growth.</h1>
        <p className="lead">Challenges help users return weekly, create more content, and discover creators through voting.</p>
      </section>

      <section className="main-grid">
        <div className="stack">
          {selected ? <section className="card">
            <div className="split"><div><h3>{selected.title}</h3><p className="muted">Theme: {selected.theme}</p></div><span className="tag">{selected.isActive ? "Active" : "Ended"}</span></div>
            <p>{selected.description}</p>
            <div className="row"><span className="tag">Prize: {selected.prize}</span><span className="tag">{selected.entryCount} entries</span><span className="tag">{selected.voteCount} votes</span><span className="tag">Ends {new Date(selected.endsAt).toLocaleDateString()}</span></div>
          </section> : <div className="empty">No challenges yet.</div>}

          {selected && <form className="composer" onSubmit={submitEntry}>
            <h3>Submit an entry</h3>
            <input className="input" value={entryForm.title} onChange={(e) => setEntryForm({ ...entryForm, title: e.target.value })} placeholder="Entry title" />
            <textarea className="textarea" value={entryForm.body} onChange={(e) => setEntryForm({ ...entryForm, body: e.target.value })} placeholder="Describe your creation…" />
            <div className="row"><input className="input" value={entryForm.imageUrl} onChange={(e) => setEntryForm({ ...entryForm, imageUrl: e.target.value })} placeholder="Optional image URL" /><button className="btn">Enter challenge</button></div>
          </form>}

          <section className="stack">
            {entries.length === 0 ? <div className="empty">No entries yet. Be first.</div> : entries.map((entry, index) => <article className="post" key={entry.id}>
              <div className="split"><div className="post-head"><img className="avatar" src={entry.author?.avatar || "https://api.dicebear.com/8.x/adventurer/svg?seed=Entry"} alt="" /><div><strong>#{index + 1} {entry.title}</strong><span>by @{entry.author?.username}</span></div></div><span className="tag">{entry.voteCount} votes</span></div>
              <p className="post-body">{entry.body}</p>
              {entry.imageUrl && <img className="post-image" src={entry.imageUrl} alt="" />}
              <div className="actions"><button className={`action ${entry.hasVoted ? "active" : ""}`} onClick={() => vote(entry.id)}>▲ {entry.hasVoted ? "Voted" : "Vote"}</button></div>
            </article>)}
          </section>
        </div>

        <aside className="sidebar">
          <section className="card"><h3>All challenges</h3><div className="creator-list">{challenges.map((challenge) => <button className={`challenge-button ${selected?.id === challenge.id ? "active" : ""}`} key={challenge.id} onClick={() => setSelected(challenge)}><strong>{challenge.title}</strong><span>{challenge.theme} · {challenge.entryCount} entries</span></button>)}</div></section>
          <form className="card form" onSubmit={createChallenge}><h3>Create challenge</h3><input className="input" value={challengeForm.title} onChange={(e) => setChallengeForm({ ...challengeForm, title: e.target.value })} placeholder="Title" /><input className="input" value={challengeForm.theme} onChange={(e) => setChallengeForm({ ...challengeForm, theme: e.target.value })} placeholder="Theme" /><textarea className="textarea" value={challengeForm.description} onChange={(e) => setChallengeForm({ ...challengeForm, description: e.target.value })} placeholder="Description" /><input className="input" value={challengeForm.prize} onChange={(e) => setChallengeForm({ ...challengeForm, prize: e.target.value })} placeholder="Prize" /><button className="btn">Create</button></form>
        </aside>
      </section>
    </main>
  );
}
