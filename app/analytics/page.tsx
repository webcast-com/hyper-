"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type User = { id: string; name: string; username: string; avatar: string };
type Post = { id: string; body: string; imageUrl?: string; likes: string[]; comments: unknown[]; shares: number; tags: string[]; createdAt: string; author: User | null; engagementScore: number };
type Badge = { id: string; label: string; description: string; earned: boolean };
type TagStat = { tag: string; posts: number; engagement: number };
type AnalyticsData = {
  summary: {
    posts: number;
    followers: number;
    following: number;
    friends: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalReactions: number;
    totalEngagement: number;
    averageEngagement: number;
    estimatedReach: number;
  };
  topPosts: Post[];
  tagPerformance: TagStat[];
  badges: Badge[];
  accountHealth: Record<string, boolean>;
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/analytics")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not load analytics.");
        setData(json);
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <main className="shell page-wrap"><Link className="btn ghost small" href="/">← Home</Link><div className="empty">{error}</div></main>;
  if (!data) return <main className="shell page-wrap"><div className="empty">Loading analytics…</div></main>;

  const earnedBadges = data.badges.filter((badge) => badge.earned);
  const healthScore = Object.values(data.accountHealth).filter(Boolean).length;

  return (
    <main className="shell page-wrap">
      <div className="split">
        <Link className="btn ghost small" href="/">← Home</Link>
        <h2>Creator analytics</h2>
        <span className="live-chip">● MVP insights</span>
      </div>

      <section className="explore-hero card">
        <span className="eyebrow">📊 Growth dashboard</span>
        <h1><span className="gradient-text">Track what works.</span><br />Grow your creator presence.</h1>
        <p className="lead">Monitor engagement, reach, tags, top posts, badges, and account health.</p>
      </section>

      <section className="analytics-grid">
        <div className="stat"><strong>{data.summary.posts}</strong><span>Posts</span></div>
        <div className="stat"><strong>{data.summary.followers}</strong><span>Followers</span></div>
        <div className="stat"><strong>{data.summary.friends}</strong><span>Friends</span></div>
        <div className="stat"><strong>{data.summary.totalEngagement}</strong><span>Total engagement</span></div>
        <div className="stat"><strong>{data.summary.averageEngagement}</strong><span>Avg/post</span></div>
        <div className="stat"><strong>{data.summary.estimatedReach}</strong><span>Estimated reach</span></div>
      </section>

      <section className="main-grid">
        <div className="stack">
          <section className="card">
            <div className="split"><h3>Top posts</h3><span className="muted">Ranked by engagement</span></div>
            <div className="stack">
              {data.topPosts.length === 0 ? <div className="empty compact">Publish posts to see rankings.</div> : data.topPosts.map((post) => (
                <article className="post" key={post.id}>
                  <div className="split"><strong>Score {post.engagementScore}</strong><span className="muted">{new Date(post.createdAt).toLocaleDateString()}</span></div>
                  <p className="post-body">{post.body || "Media post"}</p>
                  {post.imageUrl && <img className="post-image" src={post.imageUrl} alt="" />}
                  <div className="actions"><span className="action">👍 {post.likes.length}</span><span className="action">💬 {post.comments.length}</span><span className="action">↗ {post.shares || 0}</span></div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="sidebar">
          <section className="card">
            <div className="split"><h3>Badges</h3><span className="muted">{earnedBadges.length}/{data.badges.length} earned</span></div>
            <div className="badge-grid">
              {data.badges.map((badge) => <div className={`achievement ${badge.earned ? "earned" : ""}`} key={badge.id}><strong>{badge.earned ? "🏆" : "🔒"} {badge.label}</strong><span>{badge.description}</span></div>)}
            </div>
          </section>

          <section className="card">
            <div className="split"><h3>Top tags</h3><span className="muted">By engagement</span></div>
            <div className="creator-list">
              {data.tagPerformance.length === 0 ? <div className="empty compact">Use tags on posts to unlock tag insights.</div> : data.tagPerformance.map((tag) => <Link className="trend-pill" href={`/tags/${tag.tag}`} key={tag.tag}>#{tag.tag}<span>{tag.posts} posts · {tag.engagement} engagement</span></Link>)}
            </div>
          </section>

          <section className="card">
            <div className="split"><h3>Account health</h3><span className="muted">{healthScore}/5</span></div>
            <div className="creator-list">
              {Object.entries(data.accountHealth).map(([key, value]) => <div className={`health-row ${value ? "ok" : ""}`} key={key}><span>{value ? "✅" : "⬜"}</span><strong>{key.replace(/([A-Z])/g, " $1")}</strong></div>)}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
