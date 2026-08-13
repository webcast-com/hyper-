import { auditLog } from "./audit";
import { readDb, writeDb } from "./db";
import { prisma } from "./prisma";

export const DEFAULT_FEATURE_FLAGS = [
  { key: "public_registration", enabled: true, description: "Allow visitors to create accounts." },
  { key: "marketplace", enabled: true, description: "Enable creator marketplace pages and APIs." },
  { key: "challenges", enabled: true, description: "Enable creator challenges and voting." },
  { key: "webhooks", enabled: true, description: "Enable outbound webhooks and webhook admin APIs." },
  { key: "media_uploads", enabled: true, description: "Enable media uploads." }
];

const iso = (value?: Date | string | null) => new Date(value || Date.now()).toISOString();

export async function isFeatureEnabled(key: string, defaultEnabled = true) {
  if (process.env.DATA_DRIVER !== "json") {
    const flag = await prisma().featureFlag.findUnique({ where: { key } });
    return flag ? flag.enabled : defaultEnabled;
  }
  const db: any = await readDb();
  const flag = (db.featureFlags || []).find((item: any) => item.key === key);
  return flag ? Boolean(flag.enabled) : defaultEnabled;
}

export async function requireFeature(key: string) {
  const enabled = await isFeatureEnabled(key, true);
  return enabled ? null : { error: `Feature disabled: ${key}` };
}

export async function listFeatureFlags() {
  if (process.env.DATA_DRIVER !== "json") {
    const existing = await prisma().featureFlag.findMany();
    const map = new Map(existing.map((flag) => [flag.key, flag]));
    return DEFAULT_FEATURE_FLAGS.map((base) => {
      const flag = map.get(base.key);
      return {
        key: base.key,
        description: flag?.description || base.description,
        enabled: flag?.enabled ?? base.enabled,
        updatedBy: flag?.updatedBy || undefined,
        updatedAt: iso(flag?.updatedAt),
        createdAt: iso(flag?.createdAt)
      };
    });
  }
  const db: any = await readDb();
  const existing = new Map((db.featureFlags || []).map((flag: any) => [flag.key, flag]));
  return DEFAULT_FEATURE_FLAGS.map((base) => ({ ...base, ...(existing.get(base.key) || {}), updatedAt: (existing.get(base.key) as any)?.updatedAt || iso(), createdAt: (existing.get(base.key) as any)?.createdAt || iso() }));
}

export async function setFeatureFlag(key: string, enabled: boolean, actorId?: string, request?: Request) {
  const base = DEFAULT_FEATURE_FLAGS.find((flag) => flag.key === key);
  if (!base) throw new Error("Unknown feature flag.");

  if (process.env.DATA_DRIVER !== "json") {
    const flag = await prisma().featureFlag.upsert({
      where: { key },
      create: { key, enabled, description: base.description, updatedBy: actorId },
      update: { enabled, updatedBy: actorId }
    });
    await auditLog({ actorId, action: "feature_flag.update", targetType: "feature_flag", targetId: key, metadata: { enabled }, request });
    return { ...flag, updatedAt: iso(flag.updatedAt), createdAt: iso(flag.createdAt) };
  }

  const db: any = await readDb();
  if (!Array.isArray(db.featureFlags)) db.featureFlags = [];
  let flag = db.featureFlags.find((item: any) => item.key === key);
  if (!flag) {
    flag = { key, enabled, description: base.description, updatedBy: actorId, createdAt: iso(), updatedAt: iso() };
    db.featureFlags.push(flag);
  } else {
    flag.enabled = enabled;
    flag.updatedBy = actorId;
    flag.updatedAt = iso();
  }
  await writeDb(db);
  await auditLog({ actorId, action: "feature_flag.update", targetType: "feature_flag", targetId: key, metadata: { enabled }, request });
  return flag;
}
