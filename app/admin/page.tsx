"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type User = { id: string; name: string; username: string; avatar: string; email?: string; suspended: boolean; isAdmin: boolean; roles?: string[] };
type Report = {
  id: string;
  reporter: User | null;
  targetType: "post" | "user";
  targetId: string;
  reason: string;
  details: string;
  status: "open" | "reviewed" | "dismissed";
  createdAt: string;
  targetUser: User | null;
  targetPost: { id: string; body: string; imageUrl?: string; author: User | null } | null;
};
type AdminData = {
  reports: Report[];
  stats: { totalReports: number; openReports: number; reviewedReports: number; dismissedReports: number; suspendedUsers: number; totalUsers: number; totalPosts: number };
};

type Status = "all" | "open" | "reviewed" | "dismissed";
type AuditLog = { id: string; actorId?: string | null; action: string; targetType?: string | null; targetId?: string | null; metadata: Record<string, unknown>; ip?: string | null; userAgent?: string | null; createdAt: string };
type FeatureFlag = { key: string; enabled: boolean; description?: string; updatedAt: string };
type ModerationRule = { id: string; phrase: string; targetTypes: string[]; action: "flag" | "block"; active: boolean; createdAt: string };
type ModerationFlag = { id: string; ruleId?: string; targetType: string; targetId: string; actorId?: string; excerpt: string; status: "open" | "reviewed" | "dismissed"; createdAt: string; rule?: ModerationRule | null };
type NotificationDigest = { id: string; userId: string; frequency: string; subject: string; itemCount: number; status: string; error?: string | null; sentAt?: string | null; createdAt: string };
type AdminMetrics = { users: number; posts: number; comments: number; messages: number; reports: number; openReports: number; moderationFlags: number; openModerationFlags: number; marketplaceListings: number; groups: number; events: number; challenges: number; auditLogsToday: number };
type MetricSnapshot = { id: string; date: string; metrics: AdminMetrics; createdAt: string };
type WebhookEndpoint = { id: string; url: string; description?: string; events: string[]; active: boolean; createdAt: string; _count?: { deliveries: number } };
type WebhookDelivery = { id: string; endpointId: string; event: string; status: string; statusCode?: number | null; attempts: number; response?: string | null; createdAt: string; deliveredAt?: string | null; nextAttemptAt?: string | null };

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [status, setStatus] = useState<Status>("open");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [moderationRules, setModerationRules] = useState<ModerationRule[]>([]);
  const [moderationFlags, setModerationFlags] = useState<ModerationFlag[]>([]);
  const [ruleForm, setRuleForm] = useState({ phrase: "", action: "flag", targetTypes: "post,comment,message,marketplace_listing", active: true });
  const [digests, setDigests] = useState<NotificationDigest[]>([]);
  const [webhookEndpoints, setWebhookEndpoints] = useState<WebhookEndpoint[]>([]);
  const [webhookDeliveries, setWebhookDeliveries] = useState<WebhookDelivery[]>([]);
  const [webhookForm, setWebhookForm] = useState({ url: "", description: "", events: "post.created,report.created,marketplace.inquiry" });
  const [adminMetrics, setAdminMetrics] = useState<AdminMetrics | null>(null);
  const [metricHistory, setMetricHistory] = useState<MetricSnapshot[]>([]);

  const load = async (nextStatus = status) => {
    setError("");
    const [res, auditRes, usersRes, flagsRes, modRulesRes, modFlagsRes, digestsRes, webhooksRes, metricsRes] = await Promise.all([
      fetch(`/api/admin/reports?status=${nextStatus}`),
      fetch("/api/admin/audit-log?limit=12"),
      fetch("/api/admin/users"),
      fetch("/api/admin/feature-flags"),
      fetch("/api/admin/moderation-rules"),
      fetch("/api/admin/moderation-flags?status=open"),
      fetch("/api/admin/notification-digests?limit=8"),
      fetch("/api/admin/webhooks"),
      fetch("/api/admin/metrics?limit=7")
    ]);
    const json = await res.json();
    if (!res.ok) { setError(json.error || "Could not load admin dashboard."); setData(null); return; }
    setData(json);
    if (auditRes.ok) {
      const auditJson = await auditRes.json();
      setAuditLogs(auditJson.logs || []);
    }
    if (usersRes.ok) {
      const usersJson = await usersRes.json();
      setUsers(usersJson.users || []);
    }
    if (flagsRes.ok) {
      const flagsJson = await flagsRes.json();
      setFeatureFlags(flagsJson.flags || []);
    }
    if (modRulesRes.ok) {
      const rulesJson = await modRulesRes.json();
      setModerationRules(rulesJson.rules || []);
    }
    if (modFlagsRes.ok) {
      const flagsJson = await modFlagsRes.json();
      setModerationFlags(flagsJson.flags || []);
    }
    if (digestsRes.ok) {
      const digestsJson = await digestsRes.json();
      setDigests(digestsJson.digests || []);
    }
    if (webhooksRes.ok) {
      const webhooksJson = await webhooksRes.json();
      const endpoints = webhooksJson.endpoints || [];
      setWebhookEndpoints(endpoints);
      const deliveryLists = await Promise.all(endpoints.slice(0, 5).map((endpoint: WebhookEndpoint) => fetch(`/api/admin/webhooks/${endpoint.id}/deliveries`).then((r) => r.ok ? r.json() : { deliveries: [] }).catch(() => ({ deliveries: [] }))));
      setWebhookDeliveries(deliveryLists.flatMap((item) => item.deliveries || []).slice(0, 12));
    }
    if (metricsRes.ok) {
      const metricsJson = await metricsRes.json();
      setAdminMetrics(metricsJson.current || null);
      setMetricHistory(metricsJson.history || []);
    }
  };

  useEffect(() => { load(); }, []);

  const changeStatus = async (next: Status) => {
    setStatus(next);
    await load(next);
  };

  const createMetricSnapshot = async () => {
    const res = await fetch("/api/admin/metrics/snapshot", { method: "POST" });
    const json = await res.json();
    if (!res.ok) return setToast(json.error || "Could not create metrics snapshot.");
    setToast(`Metrics snapshot saved for ${json.snapshot.date}.`);
    await load();
  };

  const updateReport = async (reportId: string, nextStatus: "open" | "reviewed" | "dismissed") => {
    const reason = window.prompt(`Reason for marking report ${nextStatus}?`, nextStatus === "dismissed" ? "Not actionable" : "Reviewed by admin");
    if (reason === null) return;
    const res = await fetch(`/api/admin/reports/${reportId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus, reason }) });
    const json = await res.json();
    if (!res.ok) return setToast(json.error || "Could not update report.");
    setToast(`Report marked ${nextStatus}.`);
    await load();
  };

  const suspendUser = async (userId?: string) => {
    if (!userId) return;
    const reason = window.prompt("Reason for toggling suspension?", "Policy enforcement");
    if (reason === null) return;
    if (!window.confirm("Confirm suspension toggle for this account?")) return;
    const res = await fetch(`/api/admin/users/${userId}/suspend`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
    const json = await res.json();
    if (!res.ok) return setToast(json.error || "Could not update user.");
    setToast(`${json.user.username} is now ${json.user.suspended ? "suspended" : "active"}.`);
    await load();
  };

  const toggleFeatureFlag = async (key: string, enabled: boolean) => {
    if (!window.confirm(`${enabled ? "Enable" : "Disable"} ${key}?`)) return;
    const res = await fetch("/api/admin/feature-flags", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, enabled }) });
    const json = await res.json();
    if (!res.ok) return setToast(json.error || "Could not update feature flag.");
    setToast(`${key} ${enabled ? "enabled" : "disabled"}.`);
    await load();
  };

  const saveModerationRule = async () => {
    const payload = { ...ruleForm, targetTypes: ruleForm.targetTypes.split(",").map((item) => item.trim()).filter(Boolean) };
    const res = await fetch("/api/admin/moderation-rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await res.json();
    if (!res.ok) return setToast(json.error || "Could not save moderation rule.");
    setToast("Moderation rule saved.");
    setRuleForm({ phrase: "", action: "flag", targetTypes: "post,comment,message,marketplace_listing", active: true });
    await load();
  };

  const updateModerationFlag = async (flagId: string, nextStatus: "reviewed" | "dismissed") => {
    const reason = window.prompt(`Reason for marking moderation flag ${nextStatus}?`, nextStatus === "dismissed" ? "False positive" : "Reviewed by moderator");
    if (reason === null) return;
    const res = await fetch(`/api/admin/moderation-flags/${flagId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus, reason }) });
    const json = await res.json();
    if (!res.ok) return setToast(json.error || "Could not update moderation flag.");
    setToast(`Moderation flag ${nextStatus}.`);
    await load();
  };

  const runDigest = async (frequency: "daily" | "weekly") => {
    const res = await fetch(`/api/admin/notification-digests/run?frequency=${frequency}`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) return setToast(json.error || "Could not run digest job.");
    setToast(`${frequency} digest processed: ${json.result.sent} sent, ${json.result.skipped} skipped.`);
    await load();
  };

  const createWebhook = async () => {
    const payload = { ...webhookForm, events: webhookForm.events.split(",").map((item) => item.trim()).filter(Boolean) };
    const res = await fetch("/api/admin/webhooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await res.json();
    if (!res.ok) return setToast(json.error || "Could not create webhook.");
    setToast(`Webhook created. Secret: ${json.endpoint.secret}`);
    setWebhookForm({ url: "", description: "", events: "post.created,report.created,marketplace.inquiry" });
    await load();
  };

  const toggleWebhook = async (endpoint: WebhookEndpoint) => {
    if (!window.confirm(`${!endpoint.active ? "Enable" : "Disable"} this webhook endpoint?`)) return;
    const res = await fetch(`/api/admin/webhooks/${endpoint.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !endpoint.active }) });
    const json = await res.json();
    if (!res.ok) return setToast(json.error || "Could not update webhook.");
    setToast(`Webhook ${!endpoint.active ? "enabled" : "disabled"}.`);
    await load();
  };

  const retryDelivery = async (deliveryId: string) => {
    const res = await fetch(`/api/admin/webhooks/deliveries/${deliveryId}/retry`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) return setToast(json.error || "Could not retry delivery.");
    setToast("Webhook delivery retry queued.");
    await load();
  };

  const retryFailedWebhooks = async () => {
    const res = await fetch("/api/admin/webhooks/retry-failed", { method: "POST" });
    const json = await res.json();
    if (!res.ok) return setToast(json.error || "Could not retry failed webhooks.");
    setToast(`Retried ${json.retried} failed webhook deliveries.`);
    await load();
  };

  const updateRoles = async (userId: string, roles: string[]) => {
    const reason = window.prompt(`Reason for changing roles to ${roles.join(", ")}?`, "Role management");
    if (reason === null) return;
    const confirm = roles.includes("admin") || roles.includes("owner") ? window.prompt("Type CONFIRM to assign elevated roles") : "";
    if ((roles.includes("admin") || roles.includes("owner")) && confirm !== "CONFIRM") return setToast("Role change cancelled: confirmation did not match.");
    const res = await fetch(`/api/admin/users/${userId}/role`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roles, reason, confirm }) });
    const json = await res.json();
    if (!res.ok) return setToast(json.error || "Could not update roles.");
    setToast(`Updated roles for @${json.user.username}.`);
    await load();
  };

  if (error) return <main className="shell page-wrap"><Link className="btn ghost small" href="/">← Home</Link><div className="empty">{error}</div></main>;
  if (!data) return <main className="shell page-wrap"><div className="empty">Loading admin dashboard…</div></main>;

  return (
    <main className="shell page-wrap">
      <div className="split"><Link className="btn ghost small" href="/">← Home</Link><h2>Admin moderation</h2><span className="live-chip">● Trust & safety</span></div>
      {toast && <p className="success">{toast}</p>}

      <section className="explore-hero card" id="overview">
        <span className="eyebrow">🛡️ Moderation center</span>
        <h1><span className="gradient-text">Keep the community safe.</span><br />Review reports and enforce account actions.</h1>
        <p className="lead">This admin dashboard is organized into operational panels for reports, moderation, users, feature flags, webhooks, digests, audit logs, and system controls.</p>
      </section>

      <nav className="admin-tabs card" aria-label="Admin dashboard sections">
        <a href="#overview">Overview</a>
        <a href="#reports">Reports</a>
        <a href="#moderation">Moderation</a>
        <a href="#users">Users & roles</a>
        <a href="#flags">Feature flags</a>
        <a href="#webhooks">Webhooks</a>
        <a href="#digests">Digests</a>
        <a href="#audit">Audit</a>
      </nav>

      {adminMetrics && <section className="card admin-panel" id="metrics">
        <div className="split"><h3>Operational metrics</h3><button className="btn ghost small" onClick={createMetricSnapshot}>Save snapshot</button></div>
        <div className="analytics-grid" style={{ marginTop: 12 }}>
          <div className="stat"><strong>{adminMetrics.users}</strong><span>Users</span></div>
          <div className="stat"><strong>{adminMetrics.posts}</strong><span>Posts</span></div>
          <div className="stat"><strong>{adminMetrics.messages}</strong><span>Messages</span></div>
          <div className="stat"><strong>{adminMetrics.openReports}</strong><span>Open reports</span></div>
          <div className="stat"><strong>{adminMetrics.openModerationFlags}</strong><span>Open flags</span></div>
          <div className="stat"><strong>{adminMetrics.marketplaceListings}</strong><span>Listings</span></div>
        </div>
        <div className="audit-list">{metricHistory.slice(0, 5).map((snapshot) => <div className="audit-row" key={snapshot.id}><strong>{snapshot.date}</strong><span>{snapshot.metrics.users} users · {snapshot.metrics.posts} posts · {snapshot.metrics.openReports} open reports</span></div>)}</div>
      </section>}

      <section className="analytics-grid" id="stats">
        <div className="stat"><strong>{data.stats.openReports}</strong><span>Open reports</span></div>
        <div className="stat"><strong>{data.stats.reviewedReports}</strong><span>Reviewed</span></div>
        <div className="stat"><strong>{data.stats.dismissedReports}</strong><span>Dismissed</span></div>
        <div className="stat"><strong>{data.stats.suspendedUsers}</strong><span>Suspended users</span></div>
        <div className="stat"><strong>{data.stats.totalUsers}</strong><span>Total users</span></div>
        <div className="stat"><strong>{data.stats.totalPosts}</strong><span>Total posts</span></div>
      </section>

      <section className="card admin-panel" id="flags">
        <div className="split"><h3>Feature flags</h3><span className="muted">Runtime feature controls</span></div>
        <div className="audit-list">
          {featureFlags.map((flag) => <div className="audit-row" key={flag.key}><div><strong>{flag.key}</strong><span>{flag.description || "No description"}</span></div><button className={`btn small ${flag.enabled ? "" : "ghost"}`} onClick={() => toggleFeatureFlag(flag.key, !flag.enabled)}>{flag.enabled ? "Enabled" : "Disabled"}</button></div>)}
        </div>
      </section>

      <section className="card admin-panel" id="moderation">
        <div className="split"><h3>Automated moderation</h3><span className="muted">Rules and open flags</span></div>
        <div className="form" style={{ marginTop: 12 }}>
          <div className="row"><input className="input" value={ruleForm.phrase} onChange={(e) => setRuleForm({ ...ruleForm, phrase: e.target.value })} placeholder="Blocked/flagged phrase" /><select className="input privacy-select" value={ruleForm.action} onChange={(e) => setRuleForm({ ...ruleForm, action: e.target.value })}><option value="flag">Flag</option><option value="block">Block</option></select><button className="btn" onClick={saveModerationRule} disabled={!ruleForm.phrase}>Save rule</button></div>
          <input className="input" value={ruleForm.targetTypes} onChange={(e) => setRuleForm({ ...ruleForm, targetTypes: e.target.value })} placeholder="Target types comma-separated" />
        </div>
        <div className="audit-list">
          {moderationRules.slice(0, 5).map((rule) => <div className="audit-row" key={rule.id}><div><strong>{rule.phrase}</strong><span>{rule.action} · {rule.targetTypes.join(", ") || "all"}</span></div><span className={rule.active ? "tag" : "tag danger-chip"}>{rule.active ? "active" : "inactive"}</span></div>)}
          {moderationFlags.slice(0, 6).map((flag) => <div className="report-card" key={flag.id}><div className="split"><strong>{flag.targetType}/{flag.targetId}</strong><span className="tag danger-chip">{flag.status}</span></div><p>{flag.excerpt}</p><p className="muted">Rule: {flag.rule?.phrase || flag.ruleId || "unknown"}</p><div className="actions"><button className="action" onClick={() => updateModerationFlag(flag.id, "reviewed")}>Reviewed</button><button className="action" onClick={() => updateModerationFlag(flag.id, "dismissed")}>Dismiss</button></div></div>)}
          {moderationFlags.length === 0 && <div className="empty compact">No open moderation flags.</div>}
        </div>
      </section>

      <section className="card admin-panel" id="digests">
        <div className="split"><h3>Notification digests</h3><span className="muted">Digest delivery history</span></div>
        <div className="row" style={{ marginTop: 12 }}><button className="btn small" onClick={() => runDigest("daily")}>Run daily digest</button><button className="btn ghost small" onClick={() => runDigest("weekly")}>Run weekly digest</button></div>
        <div className="audit-list">
          {digests.length === 0 ? <div className="empty compact">No digest deliveries yet.</div> : digests.map((digest) => <div className="audit-row" key={digest.id}><div><strong>{digest.frequency} · {digest.status}</strong><span>{digest.itemCount} items · {new Date(digest.createdAt).toLocaleString()}</span></div><span className={digest.status === "sent" ? "tag" : "tag danger-chip"}>{digest.status}</span></div>)}
        </div>
      </section>

      <section className="card admin-panel" id="webhooks">
        <div className="split"><h3>Webhooks</h3><button className="btn ghost small" onClick={retryFailedWebhooks}>Retry failed</button></div>
        <div className="form" style={{ marginTop: 12 }}>
          <input className="input" value={webhookForm.url} onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })} placeholder="https://example.com/webhook" />
          <div className="row"><input className="input" value={webhookForm.description} onChange={(e) => setWebhookForm({ ...webhookForm, description: e.target.value })} placeholder="Description" /><button className="btn" onClick={createWebhook} disabled={!webhookForm.url}>Create webhook</button></div>
          <input className="input" value={webhookForm.events} onChange={(e) => setWebhookForm({ ...webhookForm, events: e.target.value })} placeholder="Events comma-separated, empty means all" />
        </div>
        <div className="audit-list">
          {webhookEndpoints.length === 0 ? <div className="empty compact">No webhook endpoints configured.</div> : webhookEndpoints.slice(0, 5).map((endpoint) => <div className="audit-row" key={endpoint.id}><div><strong>{endpoint.url}</strong><span>{endpoint.events?.join(", ") || "all events"} · {endpoint._count?.deliveries || 0} deliveries</span></div><button className={`btn small ${endpoint.active ? "" : "ghost"}`} onClick={() => toggleWebhook(endpoint)}>{endpoint.active ? "Active" : "Inactive"}</button></div>)}
          {webhookDeliveries.filter((delivery) => delivery.status !== "delivered").slice(0, 6).map((delivery) => <div className="report-card" key={delivery.id}><div className="split"><strong>{delivery.event}</strong><span className="tag danger-chip">{delivery.status}</span></div><p className="muted">Attempts: {delivery.attempts} · Status: {delivery.statusCode || "n/a"}</p><p>{delivery.response || "No response"}</p><div className="actions"><button className="action" onClick={() => retryDelivery(delivery.id)}>Retry</button></div></div>)}
        </div>
      </section>

      <section className="card admin-panel" id="users">
        <div className="split"><h3>Role management</h3><span className="muted">Owner/admin controls</span></div>
        <div className="audit-list">
          {users.slice(0, 8).map((user) => <div className="audit-row" key={user.id}><div><strong>@{user.username}</strong><span>{(user.roles || []).join(", ") || (user.isAdmin ? "admin" : "user")}</span></div><div className="row"><button className="btn ghost small" onClick={() => updateRoles(user.id, ["user"])}>User</button><button className="btn ghost small" onClick={() => updateRoles(user.id, ["user", "moderator"])}>Moderator</button><button className="btn ghost small" onClick={() => updateRoles(user.id, ["user", "moderator", "admin"])}>Admin</button></div></div>)}
        </div>
      </section>

      <section className="card admin-panel" id="audit">
        <div className="split"><h3>Audit log</h3><span className="muted">Latest security/admin events</span></div>
        <div className="audit-list">
          {auditLogs.length === 0 ? <div className="empty compact">No audit events yet.</div> : auditLogs.map((log) => <div className="audit-row" key={log.id}><strong>{log.action}</strong><span>{new Date(log.createdAt).toLocaleString()} · {log.targetType || "system"}{log.targetId ? `/${log.targetId}` : ""}</span></div>)}
        </div>
      </section>

      <section className="card admin-panel" id="reports">
        <div className="split"><h3>Reports queue</h3><div className="row">{(["all", "open", "reviewed", "dismissed"] as Status[]).map((item) => <button key={item} className={`btn small ${status === item ? "" : "ghost"}`} onClick={() => changeStatus(item)}>{item}</button>)}</div></div>
        <div className="report-list">
          {data.reports.length === 0 ? <div className="empty compact">No reports in this queue.</div> : data.reports.map((report) => {
            const targetOwner = report.targetType === "user" ? report.targetUser : report.targetPost?.author;
            return <article className="report-card" key={report.id}>
              <div className="split">
                <div><strong>{report.reason.toUpperCase()} report</strong><p className="muted">{new Date(report.createdAt).toLocaleString()} · Status: {report.status}</p></div>
                <span className={`tag ${report.status === "open" ? "danger-chip" : ""}`}>{report.targetType}</span>
              </div>
              <p>{report.details || "No extra details provided."}</p>
              <div className="moderation-target">
                <div className="creator-head"><img className="avatar" src={targetOwner?.avatar || "https://api.dicebear.com/8.x/adventurer/svg?seed=Target"} alt="" /><div className="creator-meta"><strong>{targetOwner?.name || "Unknown target"}</strong><span>@{targetOwner?.username || "unknown"}</span></div></div>
                {report.targetPost && <p className="muted">Post: “{report.targetPost.body.slice(0, 160) || "Media post"}”</p>}
                <p className="muted">Reported by @{report.reporter?.username || "unknown"}</p>
              </div>
              <div className="actions">
                <button className="action" onClick={() => updateReport(report.id, "reviewed")}>Mark reviewed</button>
                <button className="action" onClick={() => updateReport(report.id, "dismissed")}>Dismiss</button>
                <button className="action active" onClick={() => suspendUser(targetOwner?.id)}>{targetOwner?.suspended ? "Unsuspend user" : "Suspend user"}</button>
              </div>
            </article>;
          })}
        </div>
      </section>
    </main>
  );
}
