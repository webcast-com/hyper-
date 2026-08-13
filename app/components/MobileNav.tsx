"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SafeUser = { id: string; username: string; avatar: string; isAdmin?: boolean };

export default function MobileNav() {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const me = await fetch("/api/auth/me").then((res) => res.json());
        setUser(me.user || null);
        if (me.user) {
          const messages = await fetch("/api/messages/unread").then((res) => res.json());
          setUnread(messages.unreadCount || 0);
        }
      } catch {
        // Ignore mobile nav background failures.
      }
    };
    load();
    const interval = window.setInterval(load, 15000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile primary navigation">
      <Link href="/"><span>⌂</span><small>Home</small></Link>
      <Link href="/explore"><span>⌕</span><small>Explore</small></Link>
      <Link href="/marketplace"><span>▣</span><small>Market</small></Link>
      {user ? (
        <Link href="/messages" className="mobile-nav-badge-wrap"><span>✉</span><small>Messages</small>{unread > 0 && <b>{unread}</b>}</Link>
      ) : (
        <Link href="/#join"><span>＋</span><small>Join</small></Link>
      )}
      <Link href={user ? `/u/${user.username}` : "/#join"}><span>◉</span><small>{user ? "Profile" : "Login"}</small></Link>
    </nav>
  );
}
