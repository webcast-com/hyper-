"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type User = { id: string; name: string; username: string; avatar: string; niche: string };
type Listing = { id: string; sellerId: string; title: string; description: string; type: "service" | "digital_product" | "collaboration"; category: string; price: number; currency: string; imageUrl?: string; tags: string[]; saveCount: number; isSaved: boolean; seller: User | null; createdAt: string };

type MarketplaceResponse = { listings: Listing[]; categories: string[] };

export default function MarketplacePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [toast, setToast] = useState("");
  const [form, setForm] = useState({ title: "", description: "", type: "service", category: "", price: "", currency: "USD", imageUrl: "", tags: "" });

  const load = async () => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    if (type) params.set("type", type);
    const res = await fetch(`/api/marketplace?${params.toString()}`);
    const data: MarketplaceResponse = await res.json();
    setListings(data.listings || []);
    setCategories(data.categories || []);
  };

  useEffect(() => { load(); }, []);

  const filteredStats = useMemo(() => ({
    listings: listings.length,
    saved: listings.reduce((sum, listing) => sum + listing.saveCount, 0),
    avgPrice: listings.length ? Math.round(listings.reduce((sum, listing) => sum + listing.price, 0) / listings.length) : 0
  }), [listings]);

  const createListing = async (event: FormEvent) => {
    event.preventDefault();
    const res = await fetch("/api/marketplace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) return setToast(data.error || "Could not create listing.");
    setForm({ title: "", description: "", type: "service", category: "", price: "", currency: "USD", imageUrl: "", tags: "" });
    setToast("Listing published.");
    await load();
  };

  const saveListing = async (listingId: string) => {
    const res = await fetch(`/api/marketplace/${listingId}/save`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return setToast(data.error || "Could not save listing.");
    setListings((prev) => prev.map((listing) => listing.id === listingId ? data.listing : listing));
  };

  const inquire = async (listing: Listing) => {
    const message = window.prompt(`Message ${listing.seller?.name || "the seller"} about ${listing.title}`, "Hi, I am interested in this listing.");
    if (!message) return;
    const res = await fetch(`/api/marketplace/${listing.id}/inquire`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
    const data = await res.json();
    if (!res.ok) return setToast(data.error || "Could not send inquiry.");
    setToast("Inquiry sent and conversation created.");
  };

  return (
    <main className="shell page-wrap">
      <div className="split"><Link className="btn ghost small" href="/">← Home</Link><h2>Creator marketplace</h2><span className="live-chip">● Monetization layer</span></div>
      {toast && <p className="success">{toast}</p>}

      <section className="explore-hero card">
        <span className="eyebrow">🛒 Marketplace</span>
        <h1><span className="gradient-text">Sell services, products, and collaborations.</span><br />Help creators earn from their audience.</h1>
        <p className="lead">A social network becomes stickier when creators can make money, find clients, and collaborate.</p>
        <div className="analytics-grid">
          <div className="stat"><strong>{filteredStats.listings}</strong><span>Listings</span></div>
          <div className="stat"><strong>{filteredStats.saved}</strong><span>Saves</span></div>
          <div className="stat"><strong>${filteredStats.avgPrice}</strong><span>Avg price</span></div>
        </div>
      </section>

      <section className="main-grid">
        <div className="stack">
          <form className="composer row" onSubmit={(event) => { event.preventDefault(); load(); }}>
            <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search services, products, tags…" />
            <select className="input privacy-select" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <select className="input privacy-select" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option><option value="service">Services</option><option value="digital_product">Digital products</option><option value="collaboration">Collaborations</option></select>
            <button className="btn">Filter</button>
          </form>

          <div className="market-grid">
            {listings.length === 0 ? <div className="empty">No marketplace listings found.</div> : listings.map((listing) => <article className="market-card" key={listing.id}>
              <div className="market-image">{listing.imageUrl ? <img src={listing.imageUrl} alt="" /> : <span>{listing.type === "service" ? "🧰" : listing.type === "digital_product" ? "📦" : "🤝"}</span>}</div>
              <div className="split"><span className="tag">{listing.category}</span><strong>{listing.currency} {listing.price}</strong></div>
              <h3>{listing.title}</h3>
              <p className="muted">{listing.description}</p>
              <div className="creator-head"><img className="avatar-sm" src={listing.seller?.avatar || "https://api.dicebear.com/8.x/adventurer/svg?seed=Seller"} alt="" /><div className="creator-meta"><Link href={`/u/${listing.seller?.username}`}><strong>{listing.seller?.name}</strong></Link><span>@{listing.seller?.username}</span></div></div>
              <div className="row">{listing.tags.map((tag) => <span className="tag" key={tag}>#{tag}</span>)}</div>
              <div className="actions"><button className={`action ${listing.isSaved ? "active" : ""}`} onClick={() => saveListing(listing.id)}>★ {listing.saveCount}</button><button className="action" onClick={() => inquire(listing)}>Inquire</button></div>
            </article>)}
          </div>
        </div>

        <aside className="sidebar">
          <form className="card form" onSubmit={createListing}>
            <h3>Create listing</h3>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" />
            <textarea className="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe your offer" />
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="service">Service</option><option value="digital_product">Digital product</option><option value="collaboration">Collaboration</option></select>
            <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category" />
            <div className="row"><input className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Price" /><input className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} placeholder="USD" /></div>
            <input className="input" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="Optional image URL" />
            <input className="input" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Tags: design, logo" />
            <button className="btn">Publish listing</button>
          </form>

          <section className="card"><h3>Why marketplace?</h3><p className="muted">Monetization attracts serious creators. Listings can evolve into paid checkout, escrow, reviews, subscriptions, and brand deals.</p></section>
        </aside>
      </section>
    </main>
  );
}
