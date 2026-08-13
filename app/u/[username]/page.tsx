"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type SafeUser = { id: string; name: string; username: string; bio: string; niche: string; website?: string; avatar: string; banner: string; followers: string[]; following: string[]; isFollowing?: boolean };
type Post = { id: string; body: string; imageUrl?: string; tags: string[]; likes: string[]; comments: unknown[]; createdAt: string; author: SafeUser | null };

function timeAgo(input: string) {
  const mins = Math.floor((Date.now() - new Date(input).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function CreatorProfilePage() {
  const params = useParams<{ username: string }>();
  const [user, setUser] = useState<SafeUser | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState("");

  const load = async () => {
    const res = await fetch(`/api/users/${params.username}`);
    const data = await res.json();
    if (!res.ok) setError(data.error || "Creator not found.");
    else { setUser(data.user); setPosts(data.posts); }
  };

  useEffect(() => { load(); }, [params.username]);

  const follow = async () => {
    if (!user) return;
    const res = await fetch(`/api/users/${user.id}/follow`, { method: "POST" });
    if (res.ok) load(); else setError((await res.json()).error || "Could not follow.");
  };

  if (error) return <main className="shell page-wrap"><Link className="btn ghost small" href="/">← Home</Link><div className="empty">{error}</div></main>;
  if (!user) return <main className="shell page-wrap"><div className="empty">Loading creator…</div></main>;

  return (
    <main className="shell page-wrap">
      <Link className="btn ghost small" href="/">← Back to feed</Link>
      <section className="profile-panel public-profile">
        <div className="profile-banner" style={{ background: user.banner }} />
        <div className="profile-main split-mobile">
          <img className="avatar-lg" src={user.avatar} alt="" />
          <div className="creator-meta grow"><h1>{user.name}</h1><span className="muted">@{user.username} · {user.niche}</span></div>
          <div className="row">
            <button className="btn secondary" onClick={follow}>{user.isFollowing ? "Following" : "Follow"}</button>
            <Link className="btn" href={`/messages?to=${user.id}`}>Message</Link>
          </div>
        </div>
        <p>{user.bio}</p>
        {user.website && <a className="tag" href={user.website}>Website</a>}
        <div className="kpis"><div className="kpi"><strong>{user.followers.length}</strong><span className="muted">Followers</span></div><div className="kpi"><strong>{user.following.length}</strong><span className="muted">Following</span></div></div>
      </section>
      <section className="stack">
        {posts.length === 0 ? <div className="empty">No posts yet.</div> : posts.map((post) => (
          <article className="post" key={post.id}>
            <div className="post-head"><img className="avatar" src={user.avatar} alt="" /><div><strong>{user.name}</strong><span>@{user.username} · {timeAgo(post.createdAt)}</span></div></div>
            <p className="post-body">{post.body}</p>
            {post.imageUrl && <img className="post-image" src={post.imageUrl} alt="Post media" />}
            <div className="row">{post.tags.map((tag) => <Link className="tag" key={tag} href={`/tags/${tag}`}>#{tag}</Link>)}</div>
            <div className="actions"><span className="action">♥ {post.likes.length}</span><span className="action">💬 {post.comments.length}</span></div>
          </article>
        ))}
      </section>
    </main>
  );
}
