"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type User = { name: string; username: string; avatar: string };
type Post = { id: string; body: string; imageUrl?: string; tags: string[]; likes: string[]; comments: unknown[]; createdAt: string; author: User | null };

export default function TagPage() {
  const params = useParams<{ tag: string }>();
  const [posts, setPosts] = useState<Post[]>([]);
  const tag = decodeURIComponent(params.tag || "");

  useEffect(() => { fetch(`/api/tags/${encodeURIComponent(tag)}`).then((r) => r.json()).then((data) => setPosts(data.posts || [])); }, [tag]);

  return (
    <main className="shell page-wrap">
      <div className="split"><Link className="btn ghost small" href="/">← Home</Link><h2>#{tag}</h2></div>
      <div className="stack">{posts.length === 0 ? <div className="empty">No posts found for this hashtag.</div> : posts.map((post) => <article className="post" key={post.id}><div className="post-head"><img className="avatar" src={post.author?.avatar} alt="" /><div><strong>{post.author?.name}</strong><span>@{post.author?.username}</span></div></div><p className="post-body">{post.body}</p>{post.imageUrl && <img className="post-image" src={post.imageUrl} alt="" />}<div className="row">{post.tags.map((item) => <Link className="tag" href={`/tags/${item}`} key={item}>#{item}</Link>)}</div><div className="actions"><span className="action">♥ {post.likes.length}</span><span className="action">💬 {post.comments.length}</span></div></article>)}</div>
    </main>
  );
}
