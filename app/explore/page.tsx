"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type User = { id: string; name: string; username: string; bio: string; niche: string; avatar: string; followers: string[]; friends: string[] };
type Post = { id: string; body: string; imageUrl?: string; tags: string[]; likes: string[]; shares: number; comments: unknown[]; createdAt: string; author: User | null; trendScore: number };
type Tag = { tag: string; posts: number; engagement: number };
type Group = { id: string; name: string; description: string; cover: string; memberCount: number; owner: User | null };
type EventItem = { id: string; title: string; description: string; location: string; startsAt: string; attendeeCount: number; cover: string; host: User | null };
type ExploreData = { trendingPosts: Post[]; trendingTags: Tag[]; suggestedCreators: User[]; popularGroups: Group[]; upcomingEvents: EventItem[] };

type Filter = "all" | "posts" | "creators" | "tags" | "groups" | "events";

function timeAgo(input: string) {
  const mins = Math.floor((Date.now() - new Date(input).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function ExplorePage() {
  const [data, setData] = useState<ExploreData | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/explore").then((res) => res.json()).then(setData);
  }, []);

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!data) return [];
    if (!q) return data.trendingPosts;
    return data.trendingPosts.filter((post) => post.body.toLowerCase().includes(q) || post.tags.some((tag) => tag.includes(q)) || post.author?.name.toLowerCase().includes(q));
  }, [data, query]);

  if (!data) return <main className="shell page-wrap"><div className="empty">Loading Explore…</div></main>;

  return (
    <main className="shell page-wrap">
      <div className="split">
        <Link className="btn ghost small" href="/">← Home</Link>
        <h2>Explore & Trending</h2>
        <span className="live-chip">● Updated from live activity</span>
      </div>

      <section className="explore-hero card">
        <span className="eyebrow">🔥 Discovery engine</span>
        <h1><span className="gradient-text">Find what is rising</span><br />across creators, groups, tags, and events.</h1>
        <div className="row">
          <input className="input explore-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter trending posts…" />
          {(["all", "posts", "creators", "tags", "groups", "events"] as Filter[]).map((item) => (
            <button key={item} className={`btn small ${filter === item ? "" : "ghost"}`} onClick={() => setFilter(item)}>{item}</button>
          ))}
        </div>
      </section>

      {(filter === "all" || filter === "tags") && (
        <section className="card">
          <div className="split"><h3>Trending hashtags</h3><span className="muted">Ranked by posts + engagement</span></div>
          <div className="trend-grid">
            {data.trendingTags.map((tag) => <Link className="trend-pill" href={`/tags/${tag.tag}`} key={tag.tag}>#{tag.tag}<span>{tag.posts} posts · {tag.engagement} engagements</span></Link>)}
          </div>
        </section>
      )}

      <section className="main-grid">
        {(filter === "all" || filter === "posts") && (
          <div className="stack">
            <h3>Trending posts</h3>
            {filteredPosts.length === 0 ? <div className="empty">No trending posts match that filter.</div> : filteredPosts.map((post, index) => (
              <article className="post" key={post.id}>
                <div className="split">
                  <div className="post-head"><img className="avatar" src={post.author?.avatar || "https://api.dicebear.com/8.x/adventurer/svg?seed=Creator"} alt="" /><div><strong>#{index + 1} {post.author?.name}</strong><span>@{post.author?.username} · {timeAgo(post.createdAt)} · score {post.trendScore}</span></div></div>
                  <span className="tag">Trending</span>
                </div>
                <p className="post-body">{post.body}</p>
                {post.imageUrl && <img className="post-image" src={post.imageUrl} alt="" />}
                <div className="row">{post.tags.map((tag) => <Link className="tag" href={`/tags/${tag}`} key={tag}>#{tag}</Link>)}</div>
                <div className="actions"><span className="action">👍 {post.likes.length}</span><span className="action">💬 {post.comments.length}</span><span className="action">↗ {post.shares}</span></div>
              </article>
            ))}
          </div>
        )}

        <aside className="sidebar">
          {(filter === "all" || filter === "creators") && <section className="card"><h3>Suggested creators</h3><div className="creator-list">{data.suggestedCreators.map((user) => <Link className="creator-card" href={`/u/${user.username}`} key={user.id}><div className="creator-head"><img className="avatar" src={user.avatar} alt="" /><div className="creator-meta"><strong>{user.name}</strong><span>@{user.username} · {user.niche}</span></div></div><p className="muted">{user.bio}</p><span className="tag">{user.followers.length} followers</span></Link>)}</div></section>}

          {(filter === "all" || filter === "groups") && <section className="card"><h3>Popular groups</h3><div className="creator-list">{data.popularGroups.map((group) => <div className="creator-card" key={group.id}><div className="mini-cover" style={{ background: group.cover }} /><Link href={`/groups/${group.id}`}><strong>{group.name}</strong></Link><p className="muted">{group.description}</p><span className="tag">{group.memberCount} members</span></div>)}</div></section>}

          {(filter === "all" || filter === "events") && <section className="card"><h3>Upcoming events</h3><div className="creator-list">{data.upcomingEvents.map((event) => <div className="creator-card" key={event.id}><div className="mini-cover" style={{ background: event.cover }} /><Link href={`/events/${event.id}`}><strong>{event.title}</strong></Link><p className="muted">{event.location} · {new Date(event.startsAt).toLocaleDateString()}</p><p className="muted">{event.description}</p><span className="tag">{event.attendeeCount} going</span></div>)}</div></section>}
        </aside>
      </section>
    </main>
  );
}
