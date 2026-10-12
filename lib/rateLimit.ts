import { LRUCache } from "lru-cache";

// Each limiter gets its own cache so routes don't share quotas.
export function createRateLimiter(limitPerDay: number) {
  // Store: ip -> count today. TTL of 24 hours.
  const cache = new LRUCache<string, number>({
    max: 5000,
    ttl: 1000 * 60 * 60 * 24, // 24 hours
  });

  return function checkRateLimit(ip: string): {
    allowed: boolean;
    remaining: number;
  } {
    const current = cache.get(ip) ?? 0;
    if (current >= limitPerDay) {
      return { allowed: false, remaining: 0 };
    }
    cache.set(ip, current + 1);
    return { allowed: true, remaining: limitPerDay - current - 1 };
  };
}

export const checkRateLimit = createRateLimiter(5);
