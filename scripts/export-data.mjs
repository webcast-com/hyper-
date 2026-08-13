import { mkdir, writeFile } from "node:fs/promises";

const baseUrl = process.env.APP_URL || "http://localhost:3000";
const secret = process.env.CRON_SECRET;
const includeSecrets = process.env.INCLUDE_SECRETS === "true";
const backupDir = process.env.BACKUP_DIR || "backups";

const url = new URL("/api/admin/export", baseUrl);
if (includeSecrets) url.searchParams.set("includeSecrets", "true");

const response = await fetch(url, { headers: secret ? { "x-cron-secret": secret } : undefined });
const data = await response.json();
if (!response.ok) {
  console.error(data);
  process.exit(1);
}
await mkdir(backupDir, { recursive: true });
const file = `${backupDir}/creator-connect-export-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
await writeFile(file, JSON.stringify(data, null, 2));
console.log(`Export written to ${file}`);
