type Bucket = { count: number; resetAt: number };

type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfter: number;
  limit: number;
  driver: "memory" | "upstash";
};

declare global {
  // eslint-disable-next-line no-var
  var __creatorRateLimit: Map<string, Bucket> | undefined;
}

const store = globalThis.__creatorRateLimit ?? new Map<string, Bucket>();
globalThis.__creatorRateLimit = store;

function clientId(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwarded || realIp || "local";
}

function safeKey(value: string) {
  return value.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 240);
}

function memoryRateLimit(request: Request, action: string, limit: number, windowMs: number): RateLimitResult {
  const key = `${action}:${clientId(request)}`;
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0, limit, driver: "memory" };
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
      limit,
      driver: "memory"
    };
  }

  bucket.count += 1;
  return { ok: true, remaining: Math.max(0, limit - bucket.count), retryAfter: 0, limit, driver: "memory" };
}

async function upstashRateLimit(request: Request, action: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return memoryRateLimit(request, action, limit, windowMs);

  const now = Date.now();
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const bucket = Math.floor(now / windowMs);
  const key = safeKey(`rl:${action}:${clientId(request)}:${bucket}`);
  const retryAfter = Math.max(1, Math.ceil(((bucket + 1) * windowMs - now) / 1000));

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, windowSec * 2]
      ])
    });

    if (!response.ok) return memoryRateLimit(request, action, limit, windowMs);
    const data = await response.json();
    const count = Number(data?.[0]?.result || 1);
    const remaining = Math.max(0, limit - count);
    return { ok: count <= limit, remaining, retryAfter: count > limit ? retryAfter : 0, limit, driver: "upstash" };
  } catch {
    // Prefer availability over hard failure. If Redis is temporarily unavailable,
    // fall back to the local limiter for this instance.
    return memoryRateLimit(request, action, limit, windowMs);
  }
}

export async function rateLimit(request: Request, action: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const driver = (process.env.RATE_LIMIT_DRIVER || "auto").toLowerCase();
  if (driver === "memory") return memoryRateLimit(request, action, limit, windowMs);
  return upstashRateLimit(request, action, limit, windowMs);
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Driver": result.driver,
    ...(result.retryAfter ? { "Retry-After": String(result.retryAfter) } : {})
  };
}
