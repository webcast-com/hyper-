"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AuthCard from "./components/AuthCard";

type SafeUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  bio: string;
  niche: string;
  website?: string;
  avatar: string;
  banner: string;
  followers: string[];
  following: string[];
  friends: string[];
  blockedUsers: string[];
  mutedUsers: string[];
  isAdmin: boolean;
  suspended: boolean;
  referralCode: string;
  savedPosts: string[];
  settings: {
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
  createdAt: string;
};

type Comment = { id: string; text: string; parentId?: string; likes: string[]; createdAt: string; author: SafeUser | null };
type ReactionType = "like" | "love" | "care" | "haha" | "wow" | "sad" | "angry";
type PollOption = { id: string; text: string; votes: string[] };
type Poll = { question: string; options: PollOption[]; allowMultiple: boolean; closesAt?: string };
type Post = {
  id: string;
  body: string;
  imageUrl?: string;
  poll?: Poll;
  tags: string[];
  visibility: "public" | "followers" | "friends" | "only_me";
  likes: string[];
  reactions: Partial<Record<ReactionType, string[]>>;
  shares: number;
  comments: Comment[];
  createdAt: string;
  author: SafeUser | null;
};

type Story = { id: string; body: string; imageUrl?: string; views: string[]; createdAt: string; expiresAt: string; author: SafeUser | null };
type Group = { id: string; name: string; description: string; cover: string; memberCount: number; isMember: boolean; owner: SafeUser | null };
type EventItem = { id: string; title: string; description: string; location: string; startsAt: string; attendeeCount: number; isAttending: boolean; host: SafeUser | null; cover: string };

type DiscoverUser = SafeUser & { isFollowing: boolean; isMe: boolean };

type Notification = {
  id: string;
  recipientId: string;
  actorId: string;
  type: "like" | "comment" | "follow" | "friend_request" | "friend_accept" | "message" | "mention";
  postId?: string;
  commentId?: string;
  read: boolean;
  createdAt: string;
  actor: SafeUser | null;
  post: { id: string; body: string; imageUrl?: string; authorId: string } | null;
};

type FriendRequest = { id: string; senderId: string; recipientId: string; status: "pending" | "accepted" | "declined"; sender: SafeUser | null; recipient: SafeUser | null; createdAt: string };
type FriendData = { friends: SafeUser[]; incoming: FriendRequest[]; outgoing: FriendRequest[]; suggestions: SafeUser[] };
type SafetyData = { blockedUsers: SafeUser[]; mutedUsers: SafeUser[] };
type PostPage = { posts: Post[]; nextCursor: string | null; hasMore: boolean; feed?: string };
type FeedMode = "latest" | "trending" | "following" | "friends" | "communities";

type Toast = { type: "error" | "success"; text: string } | null;

const api = async <T,>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) }
  });

  // A crashed route (or a proxy/gateway error) replies with an empty body or HTML,
  // not JSON. Parsing that directly throws "Unexpected end of JSON input", which
  // hides the real status code from the user. Read as text and parse defensively.
  const raw = await response.text();
  let data: unknown = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const serverMessage =
      data && typeof data === "object" && "error" in data && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : null;
    // HTTP/2 responses carry no statusText, so fall back to a description of the
    // status code rather than rendering an empty "Request failed (500 )".
    const statusText =
      response.statusText || (response.status >= 500 ? "Server error" : "Request error");
    throw new Error(serverMessage || `Request failed (${response.status} ${statusText}).`);
  }

  if (data === null) throw new Error("The server returned an empty or invalid response.");
  return data as T;
};

function notificationText(notification: Notification) {
  const actorName = notification.actor?.name || "A creator";
  if (notification.type === "like") return `${actorName} liked your post`;
  if (notification.type === "comment") return `${actorName} commented on your post`;
  if (notification.type === "follow") return `${actorName} followed you`;
  if (notification.type === "friend_request") return `${actorName} sent you a friend request`;
  if (notification.type === "friend_accept") return `${actorName} accepted your friend request`;
  if (notification.type === "message") return `${actorName} sent you a message`;
  return `${actorName} mentioned you`;
}

function timeAgo(input: string) {
  const diff = Date.now() - new Date(input).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(input).toLocaleDateString();
}

function RichText({ text }: { text: string }) {
  const parts = text.split(/(@[a-zA-Z0-9_]+|#[a-zA-Z0-9_]+)/g);
  return <>{parts.map((part, index) => {
    if (part.startsWith("@")) return <Link className="inline-link" href={`/u/${part.slice(1)}`} key={`${part}-${index}`}>{part}</Link>;
    if (part.startsWith("#")) return <Link className="inline-link" href={`/tags/${part.slice(1)}`} key={`${part}-${index}`}>{part}</Link>;
    return <span key={index}>{part}</span>;
  })}</>;
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState<SafeUser | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [creators, setCreators] = useState<DiscoverUser[]>([]);
  const [friendData, setFriendData] = useState<FriendData>({ friends: [], incoming: [], outgoing: [], suggestions: [] });
  const [safetyData, setSafetyData] = useState<SafetyData>({ blockedUsers: [], mutedUsers: [] });
  const [stories, setStories] = useState<Story[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [storyText, setStoryText] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const [feedMode, setFeedMode] = useState<FeedMode>("latest");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [postForm, setPostForm] = useState({ body: "", imageUrl: "", tags: "", visibility: "public", pollQuestion: "", pollOptions: "", pollAllowMultiple: false });
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", bio: "", niche: "", website: "", avatar: "" });
  const [comments, setComments] = useState<Record<string, string>>({});

  const load = async (mode: FeedMode = feedMode) => {
    setLoading(true);
    try {
      const [meData, postsData, discoverData] = await Promise.all([
        api<{ user: SafeUser | null }>("/api/auth/me"),
        api<PostPage>(`/api/posts?limit=6&feed=${mode}`),
        api<{ users: DiscoverUser[] }>("/api/discover")
      ]);
      const [storyData, groupData, eventData] = await Promise.all([
        api<{ stories: Story[] }>("/api/stories"),
        api<{ groups: Group[] }>("/api/groups"),
        api<{ events: EventItem[] }>("/api/events")
      ]);
      setCurrentUser(meData.user);
      setPosts(postsData.posts);
      setNextCursor(postsData.nextCursor);
      setHasMorePosts(postsData.hasMore);
      setCreators(discoverData.users);
      setStories(storyData.stories);
      setGroups(groupData.groups);
      setEvents(eventData.events);
      if (meData.user) {
        const [notificationData, friendsResponse, messageUnreadData, safetyResponse] = await Promise.all([
          api<{ notifications: Notification[]; unreadCount: number }>("/api/notifications"),
          api<FriendData>("/api/friends"),
          api<{ unreadCount: number }>("/api/messages/unread"),
          api<SafetyData>("/api/safety")
        ]);
        setNotifications(notificationData.notifications);
        setUnreadCount(notificationData.unreadCount);
        setMessageUnreadCount(messageUnreadData.unreadCount);
        setFriendData(friendsResponse);
        setSafetyData(safetyResponse);
      } else {
        setNotifications([]);
        setUnreadCount(0);
        setMessageUnreadCount(0);
        setFriendData({ friends: [], incoming: [], outgoing: [], suggestions: [] });
        setSafetyData({ blockedUsers: [], mutedUsers: [] });
      }
      if (meData.user) {
        setProfileForm({
          name: meData.user.name,
          bio: meData.user.bio,
          niche: meData.user.niche,
          website: meData.user.website || "",
          avatar: meData.user.avatar
        });
        setPostForm((prev) => ({ ...prev, visibility: meData.user!.settings?.defaultPostVisibility || prev.visibility }));
      }
    } catch (err) {
      setToast({ type: "error", text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const boot = async () => {
      try {
        const meData = await api<{ user: SafeUser | null }>("/api/auth/me");
        setCurrentUser(meData.user);
        if (meData.user) await load();
        else setLoading(false);
      } catch (err) {
        setToast({ type: "error", text: (err as Error).message });
        setLoading(false);
      }
    };
    boot();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const refreshLiveCounts = async () => {
      try {
        const [notificationData, friendsResponse, messageUnreadData] = await Promise.all([
          api<{ notifications: Notification[]; unreadCount: number }>("/api/notifications"),
          api<FriendData>("/api/friends"),
          api<{ unreadCount: number }>("/api/messages/unread")
        ]);
        setNotifications(notificationData.notifications);
        setUnreadCount(notificationData.unreadCount);
        setFriendData(friendsResponse);
        setMessageUnreadCount(messageUnreadData.unreadCount);
      } catch {
        // Ignore background refresh failures.
      }
    };
    const interval = window.setInterval(refreshLiveCounts, 8000);
    return () => window.clearInterval(interval);
  }, [currentUser?.id]);

  const stats = useMemo(() => {
    const totalLikes = posts.reduce((sum, post) => sum + post.likes.length, 0);
    const totalComments = posts.reduce((sum, post) => sum + post.comments.length, 0);
    return { posts: posts.length, creators: creators.length, engagement: totalLikes + totalComments };
  }, [posts, creators]);

  const switchFeedMode = async (mode: FeedMode) => {
    setFeedMode(mode);
    await load(mode);
  };

  const loadMorePosts = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await api<PostPage>(`/api/posts?limit=6&feed=${feedMode}&cursor=${encodeURIComponent(nextCursor)}`);
      setPosts((prev) => {
        const existing = new Set(prev.map((post) => post.id));
        return [...prev, ...data.posts.filter((post) => !existing.has(post.id))];
      });
      setNextCursor(data.nextCursor);
      setHasMorePosts(data.hasMore);
    } catch (err) {
      setToast({ type: "error", text: (err as Error).message });
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const onScroll = () => {
      const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 900;
      if (nearBottom && hasMorePosts && nextCursor && !loading && !loadingMore) loadMorePosts();
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [hasMorePosts, nextCursor, loading, loadingMore, feedMode]);

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    setCurrentUser(null);
    setNotifications([]);
    setUnreadCount(0);
    setMessageUnreadCount(0);
    setFriendData({ friends: [], incoming: [], outgoing: [], suggestions: [] });
    setToast({ type: "success", text: "Signed out." });
    await load();
  };

  const markNotificationsRead = async () => {
    try {
      await api("/api/notifications/read-all", { method: "POST" });
      setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
      setUnreadCount(0);
    } catch (err) {
      setToast({ type: "error", text: (err as Error).message });
    }
  };

  const publishPost = async (event: FormEvent) => {
    event.preventDefault();
    setIsPublishing(true);
    try {
      let imageUrl = postForm.imageUrl;

      if (mediaFile) {
        const uploadBody = new FormData();
        uploadBody.append("file", mediaFile);
        const uploadResponse = await fetch("/api/upload", { method: "POST", body: uploadBody });
        const uploadData = await uploadResponse.json();
        if (!uploadResponse.ok) throw new Error(uploadData.error || "Upload failed.");
        imageUrl = uploadData.url;
      }

      const data = await api<{ post: Post }>("/api/posts", { method: "POST", body: JSON.stringify({ ...postForm, imageUrl }) });
      setPosts((prev) => [data.post, ...prev]);
      setPostForm({ body: "", imageUrl: "", tags: "", visibility: "public", pollQuestion: "", pollOptions: "", pollAllowMultiple: false });
      setMediaFile(null);
      const fileInput = document.getElementById("media-upload") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      setToast({ type: "success", text: "Post published." });
    } catch (err) {
      setToast({ type: "error", text: (err as Error).message });
    } finally {
      setIsPublishing(false);
    }
  };

  const likePost = async (postId: string) => {
    try {
      const data = await api<{ post: Post }>(`/api/posts/${postId}/like`, { method: "POST" });
      setPosts((prev) => prev.map((post) => (post.id === postId ? data.post : post)));
      if (currentUser) {
        const [notificationData, friendsResponse, messageUnreadData] = await Promise.all([
          api<{ notifications: Notification[]; unreadCount: number }>("/api/notifications"),
          api<FriendData>("/api/friends"),
          api<{ unreadCount: number }>("/api/messages/unread")
        ]);
        setNotifications(notificationData.notifications);
        setUnreadCount(notificationData.unreadCount);
        setMessageUnreadCount(messageUnreadData.unreadCount);
        setFriendData(friendsResponse);
      }
    } catch (err) {
      setToast({ type: "error", text: (err as Error).message });
    }
  };

  const addComment = async (event: FormEvent, postId: string) => {
    event.preventDefault();
    const text = comments[postId] || "";
    try {
      const data = await api<{ post: Post }>(`/api/posts/${postId}/comments`, { method: "POST", body: JSON.stringify({ text }) });
      setPosts((prev) => prev.map((post) => (post.id === postId ? data.post : post)));
      setComments((prev) => ({ ...prev, [postId]: "" }));
      if (currentUser) {
        const [notificationData, friendsResponse, messageUnreadData] = await Promise.all([
          api<{ notifications: Notification[]; unreadCount: number }>("/api/notifications"),
          api<FriendData>("/api/friends"),
          api<{ unreadCount: number }>("/api/messages/unread")
        ]);
        setNotifications(notificationData.notifications);
        setUnreadCount(notificationData.unreadCount);
        setMessageUnreadCount(messageUnreadData.unreadCount);
        setFriendData(friendsResponse);
      }
    } catch (err) {
      setToast({ type: "error", text: (err as Error).message });
    }
  };

  const replyToComment = async (postId: string, parentId: string, authorName?: string) => {
    if (!currentUser) { setToast({ type: "error", text: "Sign in to reply." }); return; }
    const text = window.prompt(`Reply to ${authorName || "this comment"}`);
    if (!text?.trim()) return;
    try {
      const data = await api<{ post: Post }>(`/api/posts/${postId}/comments`, { method: "POST", body: JSON.stringify({ text, parentId }) });
      setPosts((prev) => prev.map((post) => (post.id === postId ? data.post : post)));
    } catch (err) { setToast({ type: "error", text: (err as Error).message }); }
  };

  const likeComment = async (postId: string, commentId: string) => {
    if (!currentUser) { setToast({ type: "error", text: "Sign in to like comments." }); return; }
    try {
      const data = await api<{ post: Post }>(`/api/posts/${postId}/comments/${commentId}/like`, { method: "POST" });
      setPosts((prev) => prev.map((post) => (post.id === postId ? data.post : post)));
    } catch (err) { setToast({ type: "error", text: (err as Error).message }); }
  };

  const followCreator = async (creatorId: string) => {
    try {
      await api(`/api/users/${creatorId}/follow`, { method: "POST" });
      await load();
    } catch (err) {
      setToast({ type: "error", text: (err as Error).message });
    }
  };

  const refreshFriends = async () => {
    if (!currentUser) return;
    const data = await api<FriendData>("/api/friends");
    setFriendData(data);
  };

  const sendFriendRequest = async (userId: string) => {
    try {
      await api("/api/friends/request", { method: "POST", body: JSON.stringify({ userId }) });
      await refreshFriends();
      setToast({ type: "success", text: "Friend request sent." });
    } catch (err) { setToast({ type: "error", text: (err as Error).message }); }
  };

  const respondFriendRequest = async (requestId: string, action: "accept" | "decline") => {
    try {
      await api("/api/friends/respond", { method: "POST", body: JSON.stringify({ requestId, action: action === "accept" ? "accept" : "decline" }) });
      await refreshFriends();
      setToast({ type: "success", text: action === "accept" ? "Friend request accepted." : "Friend request declined." });
    } catch (err) { setToast({ type: "error", text: (err as Error).message }); }
  };

  const createStory = async () => {
    if (!storyText.trim()) return;
    try {
      const data = await api<{ story: Story }>("/api/stories", { method: "POST", body: JSON.stringify({ body: storyText }) });
      setStories((prev) => [data.story, ...prev]);
      setStoryText("");
      setToast({ type: "success", text: "Story posted for 24 hours." });
    } catch (err) {
      setToast({ type: "error", text: (err as Error).message });
    }
  };

  const reactPost = async (postId: string, reaction: ReactionType) => {
    try {
      const data = await api<{ post: Post }>(`/api/posts/${postId}/react`, { method: "POST", body: JSON.stringify({ reaction }) });
      setPosts((prev) => prev.map((post) => (post.id === postId ? data.post : post)));
    } catch (err) {
      setToast({ type: "error", text: (err as Error).message });
    }
  };

  const sharePost = async (postId: string) => {
    try {
      const data = await api<{ post: Post }>(`/api/posts/${postId}/share`, { method: "POST" });
      setPosts((prev) => prev.map((post) => (post.id === postId ? data.post : post)));
      setToast({ type: "success", text: "Post shared." });
    } catch (err) {
      setToast({ type: "error", text: (err as Error).message });
    }
  };

  const joinGroup = async (groupId: string) => {
    try {
      await api(`/api/groups/${groupId}/join`, { method: "POST" });
      const data = await api<{ groups: Group[] }>("/api/groups");
      setGroups(data.groups);
    } catch (err) { setToast({ type: "error", text: (err as Error).message }); }
  };

  const rsvpEvent = async (eventId: string) => {
    try {
      await api(`/api/events/${eventId}/rsvp`, { method: "POST" });
      const data = await api<{ events: EventItem[] }>("/api/events");
      setEvents(data.events);
    } catch (err) { setToast({ type: "error", text: (err as Error).message }); }
  };

  const refreshSafety = async () => {
    if (!currentUser) return;
    const data = await api<SafetyData>("/api/safety");
    setSafetyData(data);
  };

  const toggleMute = async (userId: string) => {
    try {
      await api("/api/safety/mute", { method: "POST", body: JSON.stringify({ userId }) });
      await refreshSafety();
      await load();
      setToast({ type: "success", text: "Safety setting updated." });
    } catch (err) { setToast({ type: "error", text: (err as Error).message }); }
  };

  const toggleBlock = async (userId: string) => {
    if (!window.confirm("Block/unblock this user? Blocking removes friendship/follow and prevents interaction.")) return;
    try {
      await api("/api/safety/block", { method: "POST", body: JSON.stringify({ userId }) });
      await refreshSafety();
      await load();
      setToast({ type: "success", text: "Block setting updated." });
    } catch (err) { setToast({ type: "error", text: (err as Error).message }); }
  };

  const votePoll = async (postId: string, optionId: string) => {
    try {
      const data = await api<{ post: Post }>(`/api/posts/${postId}/poll`, { method: "POST", body: JSON.stringify({ optionId }) });
      setPosts((prev) => prev.map((post) => (post.id === postId ? data.post : post)));
    } catch (err) { setToast({ type: "error", text: (err as Error).message }); }
  };

  const toggleSavePost = async (postId: string) => {
    if (!currentUser) { setToast({ type: "error", text: "Sign in to save posts." }); return; }
    try {
      const data = await api<{ savedPosts: string[]; isSaved: boolean }>(`/api/posts/${postId}/save`, { method: "POST" });
      setCurrentUser((prev) => prev ? { ...prev, savedPosts: data.savedPosts } : prev);
      setToast({ type: "success", text: data.isSaved ? "Post saved." : "Post removed from saved." });
    } catch (err) { setToast({ type: "error", text: (err as Error).message }); }
  };

  const reportPost = async (postId: string) => {
    if (!currentUser) {
      setToast({ type: "error", text: "Sign in to report content." });
      return;
    }
    const details = window.prompt("Why are you reporting this post?", "Spam or unsafe content");
    if (details === null) return;
    try {
      await api("/api/reports", { method: "POST", body: JSON.stringify({ targetType: "post", targetId: postId, reason: "other", details }) });
      setToast({ type: "success", text: "Report submitted for review." });
    } catch (err) {
      setToast({ type: "error", text: (err as Error).message });
    }
  };

  const updateProfile = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const data = await api<{ user: SafeUser }>("/api/profile", { method: "PATCH", body: JSON.stringify(profileForm) });
      setCurrentUser(data.user);
      setToast({ type: "success", text: "Profile updated." });
      await load();
    } catch (err) {
      setToast({ type: "error", text: (err as Error).message });
    }
  };

  if (!currentUser) {
    return (
      <main className="landing-page" id="top">
        {loading ? (
          <div className="shell page-wrap"><div className="empty">Loading…</div></div>
        ) : (
          <section className="shell hero landing-hero">
            <div className="hero-copy">
              <span className="eyebrow">Creator Connect</span>
              <h1><span className="gradient-text">Connect with creators</span><br />around you.</h1>
              <p className="lead">
                A home for posting, stories, groups, events, and marketplace — sign in to open your feed.
              </p>
              <div className="row">
                <Link className="btn" href="/login?mode=signup">Sign up</Link>
                <Link className="btn secondary" href="/login">Log in</Link>
                <Link className="btn ghost" href="/explore">Explore without an account</Link>
              </div>
              {toast && <p className={toast.type === "error" ? "error" : "success"}>{toast.text}</p>}
            </div>
            <AuthCard />
          </section>
        )}
      </main>
    );
  }

  return (
    <>
      <main id="top">
        <section className="fb-layout">
          <aside className="fb-left">
            {currentUser && (
              <Link className="fb-nav-item" href={`/u/${currentUser.username}`}>
                <img className="avatar-sm" src={currentUser.avatar} alt="" />
                <strong>{currentUser.name}</strong>
              </Link>
            )}
            <a className="fb-nav-item" href="#feed"><span>⌂</span> Feed</a>
            <a className="fb-nav-item" href="#friends"><span>👥</span> Friends{friendData.incoming.length > 0 && <span className="badge">{friendData.incoming.length}</span>}</a>
            <Link className="fb-nav-item" href="/messages"><span>✉</span> Messages{messageUnreadCount > 0 && <span className="badge">{messageUnreadCount}</span>}</Link>
            <Link className="fb-nav-item" href="/marketplace"><span>▣</span> Marketplace</Link>
            <Link className="fb-nav-item" href="/explore"><span>▶</span> Explore</Link>
            <Link className="fb-nav-item" href="/saved"><span>🔖</span> Saved</Link>
            <Link className="fb-nav-item" href="/groups/grp_design"><span>👥</span> Groups</Link>
            <Link className="fb-nav-item" href="/events/evt_walk"><span>📅</span> Events</Link>
            <Link className="fb-nav-item" href="/challenges"><span>🏁</span> Challenges</Link>
            <Link className="fb-nav-item" href="/analytics"><span>📊</span> Analytics</Link>
            <Link className="fb-nav-item" href="/invite"><span>📨</span> Invite</Link>
            <Link className="fb-nav-item" href="/settings"><span>⚙️</span> Settings</Link>
            <Link className="fb-nav-item" href="/search"><span>⌕</span> Search</Link>
            {currentUser?.isAdmin && <Link className="fb-nav-item" href="/admin"><span>🛡️</span> Admin</Link>}
            {currentUser && (
              <form className="card form" onSubmit={updateProfile}>
                <h3>Edit profile</h3>
                <input className="input" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} placeholder="Name" />
                <input className="input" value={profileForm.niche} onChange={(e) => setProfileForm({ ...profileForm, niche: e.target.value })} placeholder="Niche" />
                <textarea className="textarea" value={profileForm.bio} onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })} placeholder="Bio" />
                <input className="input" value={profileForm.website} onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })} placeholder="Website" />
                <input className="input" value={profileForm.avatar} onChange={(e) => setProfileForm({ ...profileForm, avatar: e.target.value })} placeholder="Avatar URL" />
                <button className="btn" type="submit">Save profile</button>
                <button className="btn secondary" type="button" onClick={logout}>Log out</button>
              </form>
            )}
          </aside>

          <div id="feed" className="fb-center">
            {currentUser && toast && <p className={toast.type === "error" ? "error" : "success"}>{toast.text}</p>}
            <section className="stories card">
              <div className="split"><h3>Stories</h3><span className="muted">24-hour updates</span></div>
              <div className="story-row">
                {currentUser && <div className="story-card create-story">
                  <img className="avatar" src={currentUser.avatar} alt="" />
                  <input className="story-input" value={storyText} onChange={(e) => setStoryText(e.target.value)} placeholder="Create a story…" />
                  <button className="btn small" onClick={createStory} disabled={!storyText.trim()}>Post</button>
                </div>}
                {stories.map((story) => <div className="story-card" key={story.id}>
                  <img className="avatar" src={story.author?.avatar || "https://api.dicebear.com/8.x/adventurer/svg?seed=Story"} alt="" />
                  <strong>{story.author?.name || "Creator"}</strong>
                  <span>{story.body}</span>
                </div>)}
              </div>
            </section>

            <section className="feed-tabs card">
              <div className="split"><h3>Feed</h3><span className="muted">Personalized streams</span></div>
              <div className="row">
                {(["latest", "trending", "following", "friends", "communities"] as FeedMode[]).map((mode) => (
                  <button className={`btn small ${feedMode === mode ? "" : "ghost"}`} key={mode} onClick={() => switchFeedMode(mode)}>
                    {mode === "latest" ? "Latest" : mode === "trending" ? "Trending" : mode === "following" ? "Following" : mode === "friends" ? "Friends" : "Groups & Events"}
                  </button>
                ))}
              </div>
            </section>

            <form className="composer" onSubmit={publishPost}>
              <div className="composer-head">
                <img className="avatar" src={currentUser?.avatar || "https://api.dicebear.com/8.x/adventurer/svg?seed=Guest"} alt="" />
                <div>
                  <strong>{currentUser ? `Post as ${currentUser.name}` : "Join to publish"}</strong>
                  <div className="muted">Share an update, mention @creators, or add #tags.</div>
                </div>
              </div>
              <div style={{ height: 12 }} />
              <textarea className="textarea" value={postForm.body} onChange={(e) => setPostForm({ ...postForm, body: e.target.value })} placeholder={currentUser ? `What's on your mind, ${currentUser.name.split(" ")[0]}?` : "What's on your mind?"} disabled={!currentUser} />
              <details className="poll-builder">
                <summary>Create a poll</summary>
                <input className="input" value={postForm.pollQuestion} onChange={(e) => setPostForm({ ...postForm, pollQuestion: e.target.value })} placeholder="Poll question" disabled={!currentUser || isPublishing} />
                <textarea className="textarea" value={postForm.pollOptions} onChange={(e) => setPostForm({ ...postForm, pollOptions: e.target.value })} placeholder={"Options, one per line\nOption A\nOption B"} disabled={!currentUser || isPublishing} />
                <label className="check-row"><input type="checkbox" checked={postForm.pollAllowMultiple} onChange={(e) => setPostForm({ ...postForm, pollAllowMultiple: e.target.checked })} /> Allow multiple answers</label>
              </details>
              <div style={{ height: 10 }} />
              <div className="row">
                <label className="file-picker" htmlFor="media-upload">
                  <span>Upload image</span>
                  <input
                    id="media-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    disabled={!currentUser || isPublishing}
                    onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                  />
                </label>
                {mediaFile && <span className="muted">{mediaFile.name}</span>}
                <input className="input" style={{ flex: 1, minWidth: 180 }} value={postForm.imageUrl} onChange={(e) => setPostForm({ ...postForm, imageUrl: e.target.value })} placeholder="Or paste image URL" disabled={!currentUser || isPublishing || !!mediaFile} />
                <input className="input" style={{ flex: 1, minWidth: 180 }} value={postForm.tags} onChange={(e) => setPostForm({ ...postForm, tags: e.target.value })} placeholder="Tags: music, process" disabled={!currentUser || isPublishing} />
                <select className="input privacy-select" value={postForm.visibility} onChange={(e) => setPostForm({ ...postForm, visibility: e.target.value })} disabled={!currentUser || isPublishing} aria-label="Post privacy">
                  <option value="public">🌍 Public</option>
                  <option value="followers">👥 Followers</option>
                  <option value="friends">🤝 Friends</option>
                  <option value="only_me">🔒 Only me</option>
                </select>
                <button className="btn" disabled={!currentUser || isPublishing || (!postForm.body && !postForm.imageUrl && !mediaFile && !postForm.pollQuestion)}>{isPublishing ? "Publishing…" : "Publish"}</button>
              </div>
            </form>

            {loading ? <div className="empty">Loading feed…</div> : posts.map((post) => (
              <article className="post" key={post.id}>
                <div className="post-head">
                  <img className="avatar" src={post.author?.avatar || "https://api.dicebear.com/8.x/adventurer/svg?seed=Unknown"} alt="" />
                  <div>
                    <strong>{post.author?.name || "Unknown creator"}</strong>
                    <span>@{post.author?.username || "unknown"} · {timeAgo(post.createdAt)} · {post.visibility === "public" ? "🌍 Public" : post.visibility === "followers" ? "👥 Followers" : post.visibility === "friends" ? "🤝 Friends" : "🔒 Only me"}</span>
                  </div>
                </div>
                {post.body && <p className="post-body"><RichText text={post.body} /></p>}
                {post.imageUrl && <img className="post-image" src={post.imageUrl} alt="Post media" />}
                {post.poll && <div className="poll-card">
                  <strong>{post.poll.question}</strong>
                  {(() => {
                    const total = post.poll.options.reduce((sum, option) => sum + option.votes.length, 0);
                    return post.poll.options.map((option) => {
                      const pct = total ? Math.round((option.votes.length / total) * 100) : 0;
                      const voted = currentUser ? option.votes.includes(currentUser.id) : false;
                      return <button className={`poll-option ${voted ? "active" : ""}`} key={option.id} onClick={() => votePoll(post.id, option.id)} disabled={!currentUser}>
                        <span>{option.text}</span><b>{pct}%</b><i style={{ width: `${pct}%` }} />
                      </button>;
                    });
                  })()}
                  <span className="muted">{post.poll.options.reduce((sum, option) => sum + option.votes.length, 0)} votes · {post.poll.allowMultiple ? "Multiple answers" : "Single answer"}</span>
                </div>}
                {!!post.tags.length && <div className="row">{post.tags.map((tag) => <Link className="tag" href={`/tags/${tag}`} key={tag}>#{tag}</Link>)}</div>}
                <div className="actions">
                  <button className={`action ${currentUser && post.likes.includes(currentUser.id) ? "active" : ""}`} onClick={() => likePost(post.id)}>👍 {post.likes.length}</button>
                  <button className="action" onClick={() => reactPost(post.id, "love")}>❤️ {post.reactions?.love?.length || 0}</button>
                  <button className="action" onClick={() => reactPost(post.id, "haha")}>😂 {post.reactions?.haha?.length || 0}</button>
                  <span className="action">💬 {post.comments.length}</span>
                  <button className="action" onClick={() => sharePost(post.id)}>↗ Share {post.shares || 0}</button>
                  <button className={`action ${currentUser?.savedPosts?.includes(post.id) ? "active" : ""}`} onClick={() => toggleSavePost(post.id)}>🔖 {currentUser?.savedPosts?.includes(post.id) ? "Saved" : "Save"}</button>
                  <button className="action" onClick={() => reportPost(post.id)}>⚑ Report</button>
                  {currentUser && post.author && post.author.id !== currentUser.id && <button className="action" onClick={() => toggleMute(post.author!.id)}>{safetyData.mutedUsers.some((user) => user.id === post.author!.id) ? "Unmute" : "Mute"}</button>}
                  {currentUser && post.author && post.author.id !== currentUser.id && <button className="action" onClick={() => toggleBlock(post.author!.id)}>{safetyData.blockedUsers.some((user) => user.id === post.author!.id) ? "Unblock" : "Block"}</button>}
                </div>
                <div className="comments">
                  {post.comments.filter((comment) => !comment.parentId).slice(-3).map((comment) => {
                    const replies = post.comments.filter((reply) => reply.parentId === comment.id);
                    return <div className="comment thread-comment" key={comment.id}>
                      <strong>{comment.author?.name || "Creator"}</strong><p><RichText text={comment.text} /></p>
                      <div className="comment-actions"><button onClick={() => likeComment(post.id, comment.id)}>♥ {comment.likes?.length || 0}</button><button onClick={() => replyToComment(post.id, comment.id, comment.author?.name)}>Reply</button></div>
                      {replies.length > 0 && <div className="reply-list">{replies.map((reply) => <div className="comment reply-comment" key={reply.id}><strong>{reply.author?.name || "Creator"}</strong><p><RichText text={reply.text} /></p><div className="comment-actions"><button onClick={() => likeComment(post.id, reply.id)}>♥ {reply.likes?.length || 0}</button></div></div>)}</div>}
                    </div>;
                  })}
                </div>
                <form className="comment-form" onSubmit={(event) => addComment(event, post.id)}>
                  <input className="input" value={comments[post.id] || ""} onChange={(e) => setComments({ ...comments, [post.id]: e.target.value })} placeholder={currentUser ? "Add a comment…" : "Sign in to comment"} disabled={!currentUser} />
                  <button className="btn secondary" disabled={!currentUser || !comments[post.id]}>Reply</button>
                </form>
              </article>
            ))}
            {!loading && hasMorePosts && <button className="btn secondary load-more" onClick={loadMorePosts} disabled={loadingMore}>{loadingMore ? "Loading more…" : "Load more posts"}</button>}
            {!loading && !hasMorePosts && posts.length > 0 && <div className="empty compact">You are all caught up in this feed.</div>}
          </div>

          <aside className="fb-right">
            {currentUser && (
              <section className="card">
                <div className="split"><h3>Safety controls</h3><span className="muted">Mute & block</span></div>
                <div className="kpis"><div className="kpi"><strong>{safetyData.mutedUsers.length}</strong><span className="muted">Muted</span></div><div className="kpi"><strong>{safetyData.blockedUsers.length}</strong><span className="muted">Blocked</span></div></div>
                <div className="safety-list">
                  {safetyData.mutedUsers.slice(0,3).map((user) => <button className="safety-chip" key={`m-${user.id}`} onClick={() => toggleMute(user.id)}>Unmute @{user.username}</button>)}
                  {safetyData.blockedUsers.slice(0,3).map((user) => <button className="safety-chip danger-chip" key={`b-${user.id}`} onClick={() => toggleBlock(user.id)}>Unblock @{user.username}</button>)}
                  {safetyData.mutedUsers.length === 0 && safetyData.blockedUsers.length === 0 && <p className="muted">Use Mute/Block on posts to tune your experience.</p>}
                </div>
              </section>
            )}

            {currentUser && (
              <section id="friends" className="card">
                <div className="split"><h3>Friends</h3><span className="muted">{friendData.friends.length} friends</span></div>
                <div className="creator-list">
                  {friendData.incoming.length > 0 && friendData.incoming.map((request) => <div className="creator-card" key={request.id}>
                    <div className="creator-head"><img className="avatar" src={request.sender?.avatar || "https://api.dicebear.com/8.x/adventurer/svg?seed=Friend"} alt="" /><div className="creator-meta"><strong>{request.sender?.name}</strong><span>wants to be friends</span></div></div>
                    <div className="row"><button className="btn small" onClick={() => respondFriendRequest(request.id, "accept")}>Accept</button><button className="btn ghost small" onClick={() => respondFriendRequest(request.id, "decline")}>Decline</button></div>
                  </div>)}
                  {friendData.suggestions.slice(0, 3).map((user) => <div className="creator-card" key={user.id}>
                    <div className="creator-head"><img className="avatar" src={user.avatar} alt="" /><div className="creator-meta"><Link href={`/u/${user.username}`}><strong>{user.name}</strong></Link><span>@{user.username}</span></div></div>
                    <button className="btn secondary small" onClick={() => sendFriendRequest(user.id)}>Add friend</button>
                  </div>)}
                  {friendData.incoming.length === 0 && friendData.suggestions.length === 0 && <div className="empty compact">No new friend suggestions.</div>}
                </div>
              </section>
            )}

            {currentUser && (
              <section id="notifications" className="card">
                <div className="split">
                  <h3>Notifications</h3>
                  {unreadCount > 0 ? <button className="btn ghost small" onClick={markNotificationsRead}>Mark read</button> : <span className="muted">All caught up</span>}
                </div>
                <div className="notification-list">
                  {notifications.length === 0 ? (
                    <div className="empty compact">No notifications yet.</div>
                  ) : notifications.slice(0, 8).map((notification) => (
                    <div className={`notification-item ${notification.read ? "" : "unread"}`} key={notification.id}>
                      <img className="avatar-sm" src={notification.actor?.avatar || "https://api.dicebear.com/8.x/adventurer/svg?seed=Creator"} alt="" />
                      <div>
                        <strong>{notificationText(notification)}</strong>
                        <span>{timeAgo(notification.createdAt)} ago{notification.post?.body ? ` · “${notification.post.body.slice(0, 42)}${notification.post.body.length > 42 ? "…" : ""}”` : ""}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {currentUser && (
              <section className="profile-panel">
                <div className="profile-banner" style={{ background: currentUser.banner }} />
                <div className="profile-main">
                  <img className="avatar-lg" src={currentUser.avatar} alt="" />
                  <div><h3>{currentUser.name}</h3><span className="muted">@{currentUser.username}</span></div>
                </div>
                <p>{currentUser.bio}</p>
                <div className="kpis">
                  <div className="kpi"><strong>{currentUser.followers.length}</strong><span className="muted">Followers</span></div>
                  <div className="kpi"><strong>{currentUser.following.length}</strong><span className="muted">Following</span></div>
                </div>
              </section>
            )}

            <section className="card">
              <div className="split"><h3>Groups</h3><span className="muted">Facebook-style communities</span></div>
              <div className="creator-list">
                {groups.slice(0, 3).map((group) => <div className="creator-card" key={group.id}>
                  <div className="mini-cover" style={{ background: group.cover }} />
                  <Link href={`/groups/${group.id}`}><strong>{group.name}</strong></Link>
                  <p className="muted">{group.description}</p>
                  <div className="split"><span className="muted">{group.memberCount} members</span><button className="btn secondary small" onClick={() => joinGroup(group.id)}>{group.isMember ? "Joined" : "Join"}</button></div>
                </div>)}
              </div>
            </section>

            <section className="card">
              <div className="split"><h3>Events</h3><span className="muted">RSVP</span></div>
              <div className="creator-list">
                {events.slice(0, 3).map((event) => <div className="creator-card" key={event.id}>
                  <div className="mini-cover" style={{ background: event.cover }} />
                  <Link href={`/events/${event.id}`}><strong>{event.title}</strong></Link>
                  <p className="muted">{event.location} · {new Date(event.startsAt).toLocaleDateString()}</p>
                  <p className="muted">{event.description}</p>
                  <div className="split"><span className="muted">{event.attendeeCount} going</span><button className="btn secondary small" onClick={() => rsvpEvent(event.id)}>{event.isAttending ? "Going" : "RSVP"}</button></div>
                </div>)}
              </div>
            </section>

            <section id="discover" className="card">
              <div className="split"><h3>Discover creators</h3><span className="muted">Top by followers</span></div>
              <div className="creator-list">
                {creators.map((creator) => (
                  <div className="creator-card" key={creator.id}>
                    <div className="creator-head">
                      <img className="avatar" src={creator.avatar} alt="" />
                      <div className="creator-meta">
                        <Link href={`/u/${creator.username}`}><strong>{creator.name}</strong></Link>
                        <span>@{creator.username} · {creator.niche}</span>
                      </div>
                    </div>
                    <p className="muted">{creator.bio}</p>
                    <div className="split">
                      <span className="muted">{creator.followers.length} followers</span>
                      {!creator.isMe && <div className="row"><button className="btn secondary small" onClick={() => followCreator(creator.id)}>{creator.isFollowing ? "Following" : "Follow"}</button>{currentUser && !friendData.friends.some((friend) => friend.id === creator.id) && !friendData.outgoing.some((request) => request.recipientId === creator.id) && <button className="btn ghost small" onClick={() => sendFriendRequest(creator.id)}>Add friend</button>}{friendData.outgoing.some((request) => request.recipientId === creator.id) && <span className="muted">Request sent</span>}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card">
              <h3>MVP features</h3>
              <div className="row"><span className="tag">Auth</span><span className="tag">Invites</span><span className="tag">Saved</span><span className="tag">Mentions</span><span className="tag">Posts</span><span className="tag">Feed Filters</span><span className="tag">Polls</span><span className="tag">Privacy</span><span className="tag">Safety</span><span className="tag">Settings</span><span className="tag">Media</span><span className="tag">Stories</span><span className="tag">Groups</span><span className="tag">Group Posts</span><span className="tag">Events</span><span className="tag">Event Hubs</span><span className="tag">Reactions</span><span className="tag">Shares</span><span className="tag">Likes</span><span className="tag">Comments</span><span className="tag">Replies</span><span className="tag">Comment Likes</span><span className="tag">Follows</span><span className="tag">Friends</span><span className="tag">Notifications</span><span className="tag">Profiles</span></div>
            </section>
          </aside>
        </section>
      </main>
    </>
  );
}
