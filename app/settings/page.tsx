"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type Settings = {
  defaultPostVisibility: "public" | "followers" | "friends" | "only_me";
  allowMessagesFrom: "everyone" | "friends" | "none";
  profileDiscoverable: boolean;
  notifyLikes: boolean;
  notifyComments: boolean;
  notifyFollows: boolean;
  notifyFriendRequests: boolean;
  notifyMessages: boolean;
  notifyMentions: boolean;
};

type SettingsResponse = { settings: Settings; user: { username: string; name: string } };

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [user, setUser] = useState<SettingsResponse["user"] | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not load settings.");
        setSettings(json.settings);
        setUser(json.user);
      })
      .catch((err) => setError(err.message));
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!settings) return;
    const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    const json = await res.json();
    if (!res.ok) return setToast(json.error || "Could not save settings.");
    setSettings(json.settings);
    setToast("Settings saved.");
  };

  const toggle = (key: keyof Settings) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: !settings[key] });
  };

  if (error) return <main className="shell page-wrap"><Link className="btn ghost small" href="/">← Home</Link><div className="empty">{error}</div></main>;
  if (!settings) return <main className="shell page-wrap"><div className="empty">Loading settings…</div></main>;

  return (
    <main className="shell page-wrap">
      <div className="split"><Link className="btn ghost small" href="/">← Home</Link><h2>Settings</h2><span className="live-chip">● Account controls</span></div>
      {toast && <p className="success">{toast}</p>}

      <section className="explore-hero card">
        <span className="eyebrow">⚙️ Preferences</span>
        <h1><span className="gradient-text">Control your experience.</span><br />Privacy, messages, and notifications.</h1>
        <p className="lead">Settings make the social platform safer and more personal for {user?.name || "you"}.</p>
      </section>

      <form className="main-grid" onSubmit={save}>
        <div className="stack">
          <section className="card form">
            <h3>Privacy defaults</h3>
            <label className="settings-label">Default post visibility</label>
            <select className="input" value={settings.defaultPostVisibility} onChange={(e) => setSettings({ ...settings, defaultPostVisibility: e.target.value as Settings["defaultPostVisibility"] })}>
              <option value="public">🌍 Public</option>
              <option value="followers">👥 Followers</option>
              <option value="friends">🤝 Friends</option>
              <option value="only_me">🔒 Only me</option>
            </select>
            <label className="settings-row"><input type="checkbox" checked={settings.profileDiscoverable} onChange={() => toggle("profileDiscoverable")} /><span><strong>Profile discoverable</strong><small>Allow your profile to appear in Discover and Search.</small></span></label>
          </section>

          <section className="card form">
            <h3>Messaging</h3>
            <label className="settings-label">Who can message you?</label>
            <select className="input" value={settings.allowMessagesFrom} onChange={(e) => setSettings({ ...settings, allowMessagesFrom: e.target.value as Settings["allowMessagesFrom"] })}>
              <option value="everyone">Everyone</option>
              <option value="friends">Friends only</option>
              <option value="none">No one</option>
            </select>
          </section>
        </div>

        <aside className="sidebar">
          <section className="card form">
            <h3>Notifications</h3>
            {([
              ["notifyLikes", "Likes and reactions"],
              ["notifyComments", "Comments and replies"],
              ["notifyFollows", "New followers"],
              ["notifyFriendRequests", "Friend requests"],
              ["notifyMessages", "Messages"],
              ["notifyMentions", "Mentions"]
            ] as [keyof Settings, string][]).map(([key, label]) => (
              <label className="settings-row" key={key}><input type="checkbox" checked={Boolean(settings[key])} onChange={() => toggle(key)} /><span><strong>{label}</strong><small>{settings[key] ? "Enabled" : "Muted"}</small></span></label>
            ))}
            <button className="btn" type="submit">Save settings</button>
          </section>
        </aside>
      </form>
    </main>
  );
}
