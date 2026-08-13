const baseUrl = process.env.APP_URL || "http://localhost:3000";
const secret = process.env.CRON_SECRET;
const url = new URL("/api/admin/maintenance", baseUrl);
if (process.env.DRY_RUN === "true") url.searchParams.set("dryRun", "true");
if (process.env.AUDIT_RETENTION_DAYS) url.searchParams.set("auditRetentionDays", process.env.AUDIT_RETENTION_DAYS);
if (process.env.NOTIFICATION_RETENTION_DAYS) url.searchParams.set("notificationRetentionDays", process.env.NOTIFICATION_RETENTION_DAYS);

const response = await fetch(url, {
  method: "POST",
  headers: secret ? { "x-cron-secret": secret } : undefined
});
const data = await response.json();
if (!response.ok) {
  console.error(data);
  process.exit(1);
}
console.log(JSON.stringify(data, null, 2));
