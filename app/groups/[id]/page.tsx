"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type User = { id: string; name: string; username: string; avatar: string; niche: string };
type Group = { id: string; name: string; description: string; cover: string; memberCount: number; isMember: boolean; owner: User | null; createdAt: string };
type Post = { id: string; body: string; imageUrl?: string; tags: string[]; likes: string[]; comments: unknown[]; shares: number; createdAt: string; author: User | null };

function timeAgo(input: string) {
  const mins = Math.floor((Date.now() - new Date(input).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function GroupPage() {
  const params = useParams<{ id: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [form, setForm] = useState({ body: "", imageUrl: "", tags: "" });
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const res = await fetch(`/api/groups/${params.id}`);
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Could not load group."); return; }
    setGroup(data.group);
    setPosts(data.posts || []);
  };

  useEffect(() => { load(); }, [params.id]);

  const join = async () => {
    if (!group) return;
    const res = await fetch(`/api/groups/${group.id}/join`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return setToast(data.error || "Could not update membership.");
    setGroup(data.group);
    setToast(data.group.isMember ? "Joined group." : "Left group.");
  };

  const publish = async (event: FormEvent) => {
    event.preventDefault();
    if (!group) return;
    const res = await fetch(`/api/groups/${group.id}/posts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) return setToast(data.error || "Could not publish group post.");
    setPosts((prev) => [data.post, ...prev]);
    setForm({ body: "", imageUrl: "", tags: "" });
    setToast("Group post published.");
  };

  if (error) return <main className="shell page-wrap"><Link className="btn ghost small" href="/">← Home</Link><div className="empty">{error}</div></main>;
  if (!group) return <main className="shell page-wrap"><div className="empty">Loading group…</div></main>;

  return (
    <main className="shell page-wrap">
      <div className="split"><Link className="btn ghost small" href="/">← Home</Link><h2>{group.name}</h2><span className="live-chip">● Group community</span></div>
      {toast && <p className="success">{toast}</p>}

      <section className="profile-panel public-profile">
        <div className="profile-banner" style={{ background: group.cover }} />
        <div className="profile-main split-mobile">
          <div className="group-avatar">👥</div>
          <div className="creator-meta grow"><h1>{group.name}</h1><span className="muted">Hosted by @{group.owner?.username} · {group.memberCount} members</span></div>
          <button className="btn" onClick={join}>{group.isMember ? "Joined" : "Join group"}</button>
        </div>
        <p>{group.description}</p>
      </section>

      <section className="main-grid">
        <div className="stack">
          <form className="composer" onSubmit={publish}>
            <h3>Post to {group.name}</h3>
            <textarea className="textarea" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder={group.isMember ? "Start a group discussion…" : "Join the group to post"} disabled={!group.isMember} />
            <div className="row"><input className="input" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="Optional image URL" disabled={!group.isMember} /><input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Tags" disabled={!group.isMember} /><button className="btn" disabled={!group.isMember || (!form.body && !form.imageUrl)}>Publish</button></div>
          </form>

          {posts.length === 0 ? <div className="empty">No group posts yet.</div> : posts.map((post) => <article className="post" key={post.id}>
            <div className="post-head"><img className="avatar" src={post.author?.avatar || "https://api.dicebear.com/8.x/adventurer/svg?seed=Group"} alt="" /><div><strong>{post.author?.name}</strong><span>@{post.author?.username} · {timeAgo(post.createdAt)}</span></div></div>
            <p className="post-body">{post.body}</p>
            {post.imageUrl && <img className="post-image" src={post.imageUrl} alt="" />}
            <div className="row">{post.tags.map((tag) => <Link className="tag" href={`/tags/${tag}`} key={tag}>#{tag}</Link>)}</div>
            <div className="actions"><span className="action">👍 {post.likes.length}</span><span className="action">💬 {post.comments.length}</span><span className="action">↗ {post.shares}</span></div>
          </article>)}
        </div>
        <aside className="sidebar"><section className="card"><h3>Group features</h3><div className="row"><span className="tag">Member posts</span><span className="tag">Community feed</span><span className="tag">Group discovery</span></div><p className="muted">Groups are one of the strongest retention tools in a real social network because they create focused communities.</p></section></aside>
      </section>
    </main>
  );
}
