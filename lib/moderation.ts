import { id, readDb, writeDb } from "./db";
import { prisma } from "./prisma";
import { auditLog } from "./audit";

type TargetType = "post" | "comment" | "message" | "marketplace_listing";

type Rule = {
  id: string;
  phrase: string;
  targetTypes: string[];
  action: "flag" | "block";
  active: boolean;
};

const parse = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};
const iso = (value?: Date | string | null) => new Date(value || Date.now()).toISOString();

async function activeRules(): Promise<Rule[]> {
  if (process.env.DATA_DRIVER !== "json") {
    const rules = await prisma().moderationRule.findMany({ where: { active: true } });
    return rules.map((r) => ({ id: r.id, phrase: r.phrase, targetTypes: parse<string[]>(r.targetTypes, []), action: r.action as "flag" | "block", active: r.active }));
  }
  const db: any = await readDb();
  return (db.moderationRules || []).filter((r: any) => r.active);
}

export async function checkModeration(text: string, targetType: TargetType) {
  const clean = text.toLowerCase();
  const matches = (await activeRules()).filter((rule) => {
    const applies = !rule.targetTypes.length || rule.targetTypes.includes(targetType);
    return applies && rule.phrase && clean.includes(rule.phrase.toLowerCase());
  });
  const blocked = matches.find((rule) => rule.action === "block");
  return { allowed: !blocked, blocked, matches };
}

export async function createModerationFlags(input: { text: string; targetType: TargetType; targetId: string; actorId?: string }) {
  const scan = await checkModeration(input.text, input.targetType);
  const flagRules = scan.matches.filter((rule) => rule.action === "flag");
  if (!flagRules.length) return [];
  const excerpt = input.text.slice(0, 240);

  if (process.env.DATA_DRIVER !== "json") {
    const created = await Promise.all(flagRules.map((rule) => prisma().moderationFlag.create({ data: { id: id("modflag"), ruleId: rule.id, targetType: input.targetType, targetId: input.targetId, actorId: input.actorId, excerpt, status: "open" } })));
    await auditLog({ actorId: input.actorId, action: "moderation.auto_flag", targetType: input.targetType, targetId: input.targetId, metadata: { rules: flagRules.map((r) => r.id) } });
    return created.map((flag) => ({ ...flag, ruleId: flag.ruleId || undefined, actorId: flag.actorId || undefined, createdAt: iso(flag.createdAt) }));
  }

  const db: any = await readDb();
  if (!Array.isArray(db.moderationFlags)) db.moderationFlags = [];
  const now = new Date().toISOString();
  const created = flagRules.map((rule) => ({ id: id("modflag"), ruleId: rule.id, targetType: input.targetType, targetId: input.targetId, actorId: input.actorId, excerpt, status: "open", createdAt: now }));
  db.moderationFlags.push(...created);
  await writeDb(db);
  await auditLog({ actorId: input.actorId, action: "moderation.auto_flag", targetType: input.targetType, targetId: input.targetId, metadata: { rules: flagRules.map((r) => r.id) } });
  return created;
}

export async function listModerationRules() {
  if (process.env.DATA_DRIVER !== "json") {
    const rules = await prisma().moderationRule.findMany({ orderBy: { createdAt: "desc" } });
    return rules.map((r) => ({ ...r, targetTypes: parse<string[]>(r.targetTypes, []), createdAt: iso(r.createdAt), updatedAt: iso(r.updatedAt) }));
  }
  const db: any = await readDb();
  return db.moderationRules || [];
}

export async function upsertModerationRule(input: { id?: string; phrase: string; targetTypes: string[]; action: "flag" | "block"; active: boolean; actorId?: string }) {
  if (process.env.DATA_DRIVER !== "json") {
    const rule = input.id
      ? await prisma().moderationRule.update({ where: { id: input.id }, data: { phrase: input.phrase, targetTypes: JSON.stringify(input.targetTypes), action: input.action, active: input.active } })
      : await prisma().moderationRule.create({ data: { id: id("modrule"), phrase: input.phrase, targetTypes: JSON.stringify(input.targetTypes), action: input.action, active: input.active, createdBy: input.actorId } });
    await auditLog({ actorId: input.actorId, action: "moderation.rule_upsert", targetType: "moderation_rule", targetId: rule.id, metadata: { action: input.action, active: input.active } });
    return { ...rule, targetTypes: parse<string[]>(rule.targetTypes, []), createdAt: iso(rule.createdAt), updatedAt: iso(rule.updatedAt) };
  }
  const db: any = await readDb();
  if (!Array.isArray(db.moderationRules)) db.moderationRules = [];
  let rule = input.id ? db.moderationRules.find((r: any) => r.id === input.id) : null;
  if (!rule) { rule = { id: id("modrule"), createdAt: iso(), createdBy: input.actorId }; db.moderationRules.push(rule); }
  Object.assign(rule, { phrase: input.phrase, targetTypes: input.targetTypes, action: input.action, active: input.active, updatedAt: iso() });
  await writeDb(db);
  await auditLog({ actorId: input.actorId, action: "moderation.rule_upsert", targetType: "moderation_rule", targetId: rule.id, metadata: { action: input.action, active: input.active } });
  return rule;
}

export async function listModerationFlags(status = "open") {
  if (process.env.DATA_DRIVER !== "json") {
    const flags = await prisma().moderationFlag.findMany({ where: status === "all" ? {} : { status }, orderBy: { createdAt: "desc" }, take: 250, include: { rule: true } });
    return flags.map((f) => ({ ...f, ruleId: f.ruleId || undefined, actorId: f.actorId || undefined, createdAt: iso(f.createdAt), rule: f.rule ? { ...f.rule, targetTypes: parse<string[]>(f.rule.targetTypes, []), createdAt: iso(f.rule.createdAt), updatedAt: iso(f.rule.updatedAt) } : null }));
  }
  const db: any = await readDb();
  return (db.moderationFlags || []).filter((f: any) => status === "all" || f.status === status);
}

export async function updateModerationFlag(flagId: string, status: "open" | "reviewed" | "dismissed", actorId?: string, reason?: string) {
  if (process.env.DATA_DRIVER !== "json") {
    const flag = await prisma().moderationFlag.update({ where: { id: flagId }, data: { status } }).catch(() => null);
    if (!flag) return null;
    await auditLog({ actorId, action: "moderation.flag_status", targetType: "moderation_flag", targetId: flagId, metadata: { status, reason } });
    return { ...flag, ruleId: flag.ruleId || undefined, actorId: flag.actorId || undefined, createdAt: iso(flag.createdAt) };
  }
  const db: any = await readDb();
  const flag = (db.moderationFlags || []).find((f: any) => f.id === flagId);
  if (!flag) return null;
  flag.status = status;
  await writeDb(db);
  await auditLog({ actorId, action: "moderation.flag_status", targetType: "moderation_flag", targetId: flagId, metadata: { status, reason } });
  return flag;
}
