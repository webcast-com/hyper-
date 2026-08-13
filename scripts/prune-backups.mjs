import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const backupDir = process.env.BACKUP_DIR || "backups";
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 30);
const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
const dryRun = process.env.DRY_RUN === "true";

let files = [];
try {
  files = await readdir(backupDir);
} catch {
  console.log(JSON.stringify({ ok: true, backupDir, retentionDays, deleted: [], message: "Backup directory does not exist." }, null, 2));
  process.exit(0);
}

const candidates = [];
for (const file of files) {
  if (!/\.(json|sql)$/i.test(file)) continue;
  const fullPath = path.join(backupDir, file);
  const info = await stat(fullPath);
  if (info.mtimeMs < cutoff) candidates.push({ file, path: fullPath, mtime: info.mtime.toISOString(), size: info.size });
}

const deleted = [];
if (!dryRun) {
  for (const item of candidates) {
    await rm(item.path, { force: true });
    deleted.push(item.file);
  }
}

console.log(JSON.stringify({ ok: true, dryRun, backupDir, retentionDays, candidates, deleted }, null, 2));
