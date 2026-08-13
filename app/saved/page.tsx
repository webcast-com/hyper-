"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type User = { id: string; name: string; username: string; avatar: string; niche: string };
type Post = { id: string; body: string; imageUrl?: string; tags: string[]; likes: string[]; comments: unknown[]; shares: number; createdAt: string; author: User | null };
type Listing = { id: string; title: string; description: string; category: string; price: number; currency: string; imageUrl?: string; saveCount: number; seller: User | null; tags: string[] };
type SavedData = { savedPosts: Post[]; savedListings: Listing[]; counts: { posts: number; listings: number } };

type Tab = "posts" | "marketplace";

export default function SavedPage() {
  const [data, setData] = useState<SavedData | null>(null);
  const [tab, setTab] = useState<Tab>("posts");
  const [error, setError] = useState("");

  const load = async () => {
    const res = await fetch("/api/saved");
    const json = await res.json();
    if (!res.ok) { setError(json.error || "Could not load saved items."); return; }
    setData(json);
  };

  useEffect(() => { load(); }, []);

  const unsavePost = async (postId: string) => {
    await fetch(`/api/posts/${postId}/save`, { method: "POST" });
    await load();
  };

  const unsaveListing = async (listingId: string) => {
    await fetch(`/api/marketplace/${listingId}/save`, { method: "POST" });
    await load();
  };

  if (error) return <main className="shell page-wrap"><Link className="btn ghost small" href="/">← Home</Link><div className="empty">{error}</div></main>;
  if (!data) return <main className="shell page-wrap"><div className="empty">Loading saved items…</div></main>;

  return (
    <main className="shell page-wrap">
      <div className="split"><Link className="btn ghost small" href="/">← Home</Link><h2>Saved items</h2><span className="live-chip">● Personal library</span></div>
      <section className="explore-hero card">
        <span className="eyebrow">🔖 Saved</span>
        <h1><span className="gradient-text">Build your creator library.</span><br />Save posts, ideas, and marketplace offers.</h1>
        <div className="analytics-grid"><div className="stat"><strong>{data.counts.posts}</strong><span>Saved posts</span></div><div className="stat"><strong>{data.counts.listings}</strong><span>Saved listings</span></div></div>
      </section>

      <section className="card">
        <div className="row"><button className={`btn small ${tab === "posts" ? "" : "ghost"}`} onClick={() => setTab("posts")}>Posts</button><button className={`btn small ${tab === "marketplace" ? "" : "ghost"}`} onClick={() => setTab("marketplace")}>Marketplace</button></div>
      </section>

      {tab === "posts" ? <section className="stack">
        {data.savedPosts.length === 0 ? <div className="empty">No saved posts yet. Use Save on posts you want to revisit.</div> : data.savedPosts.map((post) => <article className="post" key={post.id}>
          <div className="post-head"><img className="avatar" src={post.author?.avatar || "https://api.dicebear.com/8.x/adventurer/svg?seed=Saved"} alt="" /><div><strong>{post.author?.name}</strong><span>@{post.author?.username}</span></div></div>
          <p className="post-body">{post.body}</p>
          {post.imageUrl && <img className="post-image" src={post.imageUrl} alt="" />}
          <div className="row">{post.tags.map((tag) => <Link className="tag" href={`/tags/${tag}`} key={tag}>#{tag}</Link>)}</div>
          <div className="actions"><span className="action">👍 {post.likes.length}</span><span className="action">💬 {post.comments.length}</span><button className="action active" onClick={() => unsavePost(post.id)}>Unsave</button></div>
        </article>)}
      </section> : <section className="market-grid">
        {data.savedListings.length === 0 ? <div className="empty">No saved marketplace listings yet.</div> : data.savedListings.map((listing) => <article className="market-card" key={listing.id}>
          <div className="market-image">{listing.imageUrl ? <img src={listing.imageUrl} alt="" /> : <span>🛒</span>}</div>
          <div className="split"><span className="tag">{listing.category}</span><strong>{listing.currency} {listing.price}</strong></div>
          <h3>{listing.title}</h3><p className="muted">{listing.description}</p>
          <div className="creator-head"><img className="avatar-sm" src={listing.seller?.avatar || "https://api.dicebear.com/8.x/adventurer/svg?seed=Seller"} alt="" /><div className="creator-meta"><strong>{listing.seller?.name}</strong><span>@{listing.seller?.username}</span></div></div>
          <div className="actions"><button className="action active" onClick={() => unsaveListing(listing.id)}>Unsave</button><Link className="action" href="/marketplace">View marketplace</Link></div>
        </article>)}
      </section>}
    </main>
  );
}
