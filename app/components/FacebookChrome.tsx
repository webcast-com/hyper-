"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type SafeUser = { id: string; name: string; username: string; avatar: string; isAdmin?: boolean };

export default function FacebookChrome() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SafeUser | null>(null);
  const [query, setQuery] = useState("");
  const [unread, setUnread] = useState(0);
  const [friendBadge, setFriendBadge] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const me = await fetch("/api/auth/me").then((res) => res.json());
        setUser(me.user || null);
        if (!me.user) {
          setUnread(0);
          setFriendBadge(0);
          return;
        }
        const [messages, friends] = await Promise.all([
          fetch("/api/messages/unread").then((res) => res.json()).catch(() => ({ unreadCount: 0 })),
          fetch("/api/friends").then((res) => res.json()).catch(() => ({ incoming: [] }))
        ]);
        setUnread(messages.unreadCount || 0);
        setFriendBadge(Array.isArray(friends.incoming) ? friends.incoming.length : 0);
      } catch {
        // Ignore chrome background failures.
      }
    };
    load();
    const interval = window.setInterval(load, 15000);
    return () => window.clearInterval(interval);
  }, [pathname]);

  const search = (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  const active = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <header className="topbar fb-topbar">
      <nav className="fb-topnav" aria-label="Facebook-style primary navigation">
        <div className="fb-top-left">
          <Link className="brand" href="/" aria-label="Creator Connect home">
            <span className="logo" aria-hidden="true">C</span>
            <span className="brand-word">creator</span>
          </Link>
          <form className="fb-search" onSubmit={search}>
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Creator Connect"
              aria-label="Search"
            />
          </form>
        </div>

        <div className="fb-top-center">
          <Link className={`fb-tab ${active("/") ? "active" : ""}`} href="/" title="Home">⌂</Link>
          <Link className={`fb-tab ${active("/explore") ? "active" : ""}`} href="/explore" title="Explore">▶</Link>
          <Link className={`fb-tab ${active("/marketplace") ? "active" : ""}`} href="/marketplace" title="Marketplace">▣</Link>
          <Link className={`fb-tab ${active("/groups") ? "active" : ""}`} href="/groups/grp_design" title="Groups">👥</Link>
          <Link className={`fb-tab ${active("/challenges") ? "active" : ""}`} href="/challenges" title="Challenges">🏁</Link>
        </div>

        <div className="fb-top-right">
          {user ? (
            <>
              <Link className="fb-icon-btn" href="/messages" title="Messages">
                ✉{unread > 0 && <b className="badge">{unread}</b>}
              </Link>
              <a className="fb-icon-btn" href="/#notifications" title="Notifications">
                🔔
              </a>
              <a className="fb-icon-btn" href="/#friends" title="Friends">
                👥{friendBadge > 0 && <b className="badge">{friendBadge}</b>}
              </a>
              <Link className="user-chip" href={`/u/${user.username}`} title={user.name}>
                <img className="avatar-sm" src={user.avatar} alt="" />
                <span>{user.name.split(" ")[0]}</span>
              </Link>
              {user.isAdmin && <Link className="btn ghost small" href="/admin">Admin</Link>}
              <button className="btn secondary small" onClick={logout} type="button">Log out</button>
            </>
          ) : (
            <>
              <Link className="btn ghost small" href="/login?mode=signup">Sign up</Link>
              <Link className="btn small" href="/login">Log in</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
