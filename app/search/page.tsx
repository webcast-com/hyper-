"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type User = { id: string; name: string; username: string; bio: string; niche: string; avatar: string; followers: string[] };
type Post = { id: string; body: string; imageUrl?: string; tags: string[]; likes: string[]; comments: unknown[]; createdAt: string; author: User | null };

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);

  const runSearch = async (query = q) => {
    if (!query.trim()) return;
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setUsers(data.users || []); setPosts(data.posts || []);
  };

  useEffect(() => { const query = new URLSearchParams(window.location.search).get("q") || ""; setQ(query); if (query) runSearch(query); }, []);

  const submit = (event: FormEvent) => { event.preventDefault(); runSearch(); };

  return (
    <main className="shell page-wrap">
      <div className="split"><Link className="btn ghost small" href="/">← Home</Link><h2>Search</h2></div>
      <form className="composer row" onSubmit={submit}><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search creators, posts, or #tags" /><button className="btn">Search</button></form>
      <section className="main-grid">
        <div className="stack">
          <h3>Posts</h3>
          {posts.length === 0 ? <div className="empty">No post results yet.</div> : posts.map((post) => <article className="post" key={post.id}><div className="post-head"><img className="avatar" src={post.author?.avatar} alt="" /><div><strong>{post.author?.name}</strong><span>@{post.author?.username}</span></div></div><p className="post-body">{post.body}</p>{post.imageUrl && <img className="post-image" src={post.imageUrl} alt="" />}<div className="row">{post.tags.map((tag) => <Link className="tag" href={`/tags/${tag}`} key={tag}>#{tag}</Link>)}</div></article>)}
        </div>
        <aside className="sidebar"><section className="card"><h3>Creators</h3><div className="creator-list">{users.length === 0 ? <div className="empty compact">No creator results.</div> : users.map((user) => <Link className="creator-card" href={`/u/${user.username}`} key={user.id}><div className="creator-head"><img className="avatar" src={user.avatar} alt="" /><div className="creator-meta"><strong>{user.name}</strong><span>@{user.username} · {user.niche}</span></div></div><p className="muted">{user.bio}</p></Link>)}</div></section></aside>
      </section>
    </main>
  );
}
