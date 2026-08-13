"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type User = { id: string; name: string; username: string; avatar: string; niche: string };
type EventItem = { id: string; title: string; description: string; location: string; startsAt: string; attendeeCount: number; isAttending: boolean; host: User | null; cover: string; createdAt: string };
type Post = { id: string; body: string; imageUrl?: string; tags: string[]; likes: string[]; comments: unknown[]; shares: number; createdAt: string; author: User | null };

function timeAgo(input: string) {
  const mins = Math.floor((Date.now() - new Date(input).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function EventPage() {
  const params = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [form, setForm] = useState({ body: "", imageUrl: "", tags: "" });
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const res = await fetch(`/api/events/${params.id}`);
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Could not load event."); return; }
    setEvent(data.event);
    setPosts(data.posts || []);
  };

  useEffect(() => { load(); }, [params.id]);

  const rsvp = async () => {
    if (!event) return;
    const res = await fetch(`/api/events/${event.id}/rsvp`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return setToast(data.error || "Could not update RSVP.");
    setEvent(data.event);
    setToast(data.event.isAttending ? "You are going." : "RSVP removed.");
  };

  const publish = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault();
    if (!event) return;
    const res = await fetch(`/api/events/${event.id}/posts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) return setToast(data.error || "Could not publish event post.");
    setPosts((prev) => [data.post, ...prev]);
    setForm({ body: "", imageUrl: "", tags: "" });
    setToast("Event post published.");
  };

  if (error) return <main className="shell page-wrap"><Link className="btn ghost small" href="/">← Home</Link><div className="empty">{error}</div></main>;
  if (!event) return <main className="shell page-wrap"><div className="empty">Loading event…</div></main>;

  const starts = new Date(event.startsAt);

  return (
    <main className="shell page-wrap">
      <div className="split"><Link className="btn ghost small" href="/">← Home</Link><h2>{event.title}</h2><span className="live-chip">● Event hub</span></div>
      {toast && <p className="success">{toast}</p>}

      <section className="profile-panel public-profile">
        <div className="profile-banner" style={{ background: event.cover }} />
        <div className="profile-main split-mobile">
          <div className="group-avatar">📅</div>
          <div className="creator-meta grow"><h1>{event.title}</h1><span className="muted">Hosted by @{event.host?.username} · {event.attendeeCount} going</span></div>
          <button className="btn" onClick={rsvp}>{event.isAttending ? "Going" : "RSVP"}</button>
        </div>
        <p>{event.description}</p>
        <div className="row"><span className="tag">{event.location}</span><span className="tag">{starts.toLocaleDateString()} · {starts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
      </section>

      <section className="main-grid">
        <div className="stack">
          <form className="composer" onSubmit={publish}>
            <h3>Event discussion</h3>
            <textarea className="textarea" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder={event.isAttending ? "Share updates, questions, or prep notes…" : "RSVP to join the discussion"} disabled={!event.isAttending} />
            <div className="row"><input className="input" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="Optional image URL" disabled={!event.isAttending} /><input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Tags" disabled={!event.isAttending} /><button className="btn" disabled={!event.isAttending || (!form.body && !form.imageUrl)}>Publish</button></div>
          </form>

          {posts.length === 0 ? <div className="empty">No event posts yet.</div> : posts.map((post) => <article className="post" key={post.id}>
            <div className="post-head"><img className="avatar" src={post.author?.avatar || "https://api.dicebear.com/8.x/adventurer/svg?seed=Event"} alt="" /><div><strong>{post.author?.name}</strong><span>@{post.author?.username} · {timeAgo(post.createdAt)}</span></div></div>
            <p className="post-body">{post.body}</p>
            {post.imageUrl && <img className="post-image" src={post.imageUrl} alt="" />}
            <div className="row">{post.tags.map((tag) => <Link className="tag" href={`/tags/${tag}`} key={tag}>#{tag}</Link>)}</div>
            <div className="actions"><span className="action">👍 {post.likes.length}</span><span className="action">💬 {post.comments.length}</span><span className="action">↗ {post.shares}</span></div>
          </article>)}
        </div>
        <aside className="sidebar"><section className="card"><h3>Event tools</h3><div className="row"><span className="tag">RSVP</span><span className="tag">Discussion</span><span className="tag">Updates</span></div><p className="muted">Event hubs help creators coordinate launches, meetups, livestreams, workshops, and community activities.</p></section></aside>
      </section>
    </main>
  );
}
