"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type User = { id: string; name: string; username: string; avatar: string; niche: string; isMe?: boolean };
type Message = { id: string; senderId: string; recipientId: string; text: string; createdAt: string; sender: User | null; recipient: User | null };
type Conversation = { id: string; otherUser: User | null; messages: Message[]; updatedAt: string; unreadCount: number };

export default function MessagesPage() {
  const [creators, setCreators] = useState<User[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [recipientId, setRecipientId] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const selectedConversation = useMemo(() => conversations.find((conversation) => conversation.otherUser?.id === recipientId) || conversations[0] || null, [conversations, recipientId]);

  const load = async () => {
    const [creatorRes, messageRes] = await Promise.all([fetch("/api/discover"), fetch("/api/messages")]);
    const creatorData = await creatorRes.json();
    const messageData = await messageRes.json();
    if (!messageRes.ok) { setError(messageData.error || "Sign in to use messages."); return; }
    setCreators((creatorData.users || []).filter((user: User) => !user.isMe));
    setConversations(messageData.conversations || []);
  };

  useEffect(() => {
    setRecipientId(new URLSearchParams(window.location.search).get("to") || "");
    load();
    const interval = window.setInterval(load, 5000);
    return () => window.clearInterval(interval);
  }, []);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const target = recipientId || selectedConversation?.otherUser?.id;
    if (!target) { setError("Choose a creator to message."); return; }
    const res = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipientId: target, text }) });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Could not send message.");
    else { setText(""); setRecipientId(data.conversation.otherUser?.id || target); await load(); }
  };

  return (
    <main className="shell page-wrap">
      <div className="split"><Link className="btn ghost small" href="/">← Home</Link><h2>Direct messages</h2><span className="live-chip">● Live refresh</span></div>
      {error && <p className="error">{error}</p>}
      <section className="messages-layout">
        <aside className="card conversation-list">
          <h3>Conversations</h3>
          {conversations.length === 0 ? <div className="empty compact">No conversations yet.</div> : conversations.map((conversation) => (
            <button className={`conversation-button ${selectedConversation?.id === conversation.id ? "active" : ""}`} key={conversation.id} onClick={() => setRecipientId(conversation.otherUser?.id || "")}>
              <img className="avatar-sm" src={conversation.otherUser?.avatar} alt="" />
              <span><strong>{conversation.otherUser?.name}</strong><small>@{conversation.otherUser?.username}</small></span>
            </button>
          ))}
          <h3>Start new</h3>
          <select className="input" value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
            <option value="">Choose creator</option>
            {creators.map((creator) => <option key={creator.id} value={creator.id}>{creator.name} (@{creator.username})</option>)}
          </select>
        </aside>
        <section className="card message-panel">
          <h3>{selectedConversation?.otherUser ? `Chat with ${selectedConversation.otherUser.name}` : "New message"}</h3>
          <div className="message-stream">
            {!selectedConversation ? <div className="empty compact">Choose a creator and send the first message.</div> : selectedConversation.messages.map((message) => (
              <div className="message-bubble" key={message.id}>
                <strong>{message.sender?.name}</strong>
                <p>{message.text}</p>
              </div>
            ))}
          </div>
          <form className="comment-form" onSubmit={send}>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message…" />
            <button className="btn" disabled={!text.trim()}>Send</button>
          </form>
        </section>
      </section>
    </main>
  );
}
