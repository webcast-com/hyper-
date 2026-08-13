import { id } from "./db";
import { prisma } from "./prisma";
import { prismaUserToUser } from "./prisma-direct-auth";
import type { Challenge, ChallengeEntry, User } from "./types";

const parse = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};
const json = (value: unknown, fallback: unknown) => JSON.stringify(value ?? fallback);
const iso = (value: Date | string | null | undefined) => new Date(value || Date.now()).toISOString();
const toSafeUser = (user: User) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safe } = user;
  return safe;
};

function mapChallenge(challenge: any): Challenge {
  return {
    id: challenge.id,
    title: challenge.title,
    description: challenge.description,
    theme: challenge.theme,
    prize: challenge.prize,
    startsAt: iso(challenge.startsAt),
    endsAt: iso(challenge.endsAt),
    hostId: challenge.hostId,
    createdAt: iso(challenge.createdAt)
  };
}

function mapEntry(entry: any): ChallengeEntry {
  return {
    id: entry.id,
    challengeId: entry.challengeId,
    authorId: entry.authorId,
    title: entry.title,
    body: entry.body,
    imageUrl: entry.imageUrl || "",
    votes: parse<string[]>(entry.votes, []),
    createdAt: iso(entry.createdAt)
  };
}

function publicChallenge(challenge: Challenge, users: User[], entries: ChallengeEntry[]) {
  const host = users.find((user) => user.id === challenge.hostId);
  const challengeEntries = entries.filter((entry) => entry.challengeId === challenge.id);
  return {
    ...challenge,
    host: host ? toSafeUser(host) : null,
    entryCount: challengeEntries.length,
    voteCount: challengeEntries.reduce((sum, entry) => sum + entry.votes.length, 0),
    isActive: Date.parse(challenge.endsAt) > Date.now()
  };
}

function publicEntry(entry: ChallengeEntry, users: User[], currentUserId?: string) {
  const author = users.find((user) => user.id === entry.authorId);
  return {
    ...entry,
    author: author ? toSafeUser(author) : null,
    voteCount: entry.votes.length,
    hasVoted: currentUserId ? entry.votes.includes(currentUserId) : false
  };
}

export async function listChallengesPrisma() {
  const db = prisma();
  const [rawChallenges, rawEntries, rawUsers] = await Promise.all([
    db.challenge.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    db.challengeEntry.findMany({ take: 1000 }),
    db.user.findMany({ take: 300 })
  ]);
  const users = rawUsers.map(prismaUserToUser);
  const entries = rawEntries.map(mapEntry);
  return rawChallenges.map(mapChallenge).map((challenge) => publicChallenge(challenge, users, entries));
}

export async function createChallengePrisma(user: User, input: { title: string; description: string; theme: string; prize: string }) {
  const created = await prisma().challenge.create({
    data: {
      id: id("chl"),
      title: input.title,
      description: input.description,
      theme: input.theme,
      prize: input.prize,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      hostId: user.id
    }
  });
  return publicChallenge(mapChallenge(created), [user], []);
}

export async function listChallengeEntriesPrisma(challengeId: string, currentUserId?: string) {
  const db = prisma();
  const [rawEntries, rawUsers] = await Promise.all([
    db.challengeEntry.findMany({ where: { challengeId }, orderBy: { createdAt: "desc" }, take: 500 }),
    db.user.findMany({ take: 300 })
  ]);
  const users = rawUsers.map(prismaUserToUser);
  return rawEntries
    .map(mapEntry)
    .sort((a, b) => b.votes.length - a.votes.length || Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map((entry) => publicEntry(entry, users, currentUserId));
}

export async function createChallengeEntryPrisma(challengeId: string, user: User, input: { title: string; body: string; imageUrl: string }) {
  const db = prisma();
  const challenge = await db.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge) return null;
  if (challenge.endsAt.getTime() < Date.now()) throw new Error("This challenge has ended.");

  const created = await db.challengeEntry.create({
    data: {
      id: id("entry"),
      challengeId,
      authorId: user.id,
      title: input.title,
      body: input.body,
      imageUrl: input.imageUrl || null,
      votes: "[]"
    }
  });
  return publicEntry(mapEntry(created), [user], user.id);
}

export async function voteChallengeEntryPrisma(challengeId: string, entryId: string, user: User) {
  const db = prisma();
  const [challenge, rawEntry] = await Promise.all([
    db.challenge.findUnique({ where: { id: challengeId } }),
    db.challengeEntry.findFirst({ where: { id: entryId, challengeId } })
  ]);
  if (!challenge || !rawEntry) return null;
  if (challenge.endsAt.getTime() < Date.now()) throw new Error("Voting has ended.");
  if (rawEntry.authorId === user.id) throw new Error("You cannot vote for your own entry.");

  const votes = parse<string[]>(rawEntry.votes, []);
  const nextVotes = votes.includes(user.id) ? votes.filter((id) => id !== user.id) : [...votes, user.id];
  const updated = await db.challengeEntry.update({ where: { id: entryId }, data: { votes: json(nextVotes, []) } });
  const author = await db.user.findUnique({ where: { id: updated.authorId } });
  const users = [user, ...(author ? [prismaUserToUser(author)] : [])];
  return publicEntry(mapEntry(updated), users, user.id);
}
