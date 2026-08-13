import { describe, expect, it } from "vitest";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";

function request(ip: string) {
  return new Request("http://localhost/test", { headers: { "x-real-ip": ip } });
}

describe("rateLimit memory mode", () => {
  it("allows up to the configured limit then blocks", async () => {
    process.env.RATE_LIMIT_DRIVER = "memory";
    const action = `test:${Date.now()}:${Math.random()}`;
    const first = await rateLimit(request("1.1.1.1"), action, 2, 60_000);
    const second = await rateLimit(request("1.1.1.1"), action, 2, 60_000);
    const third = await rateLimit(request("1.1.1.1"), action, 2, 60_000);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok).toBe(false);
    expect(third.retryAfter).toBeGreaterThan(0);
    expect(rateLimitHeaders(third)["X-RateLimit-Driver"]).toBe("memory");
  });

  it("separates clients by IP", async () => {
    process.env.RATE_LIMIT_DRIVER = "memory";
    const action = `test:${Date.now()}:${Math.random()}`;
    await rateLimit(request("2.2.2.2"), action, 1, 60_000);
    const other = await rateLimit(request("3.3.3.3"), action, 1, 60_000);
    expect(other.ok).toBe(true);
  });
});
