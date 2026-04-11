import { LRUCache } from "lru-cache";

const LIMIT_PER_DAY = 5;

// Store: ip -> count today. TTL of 24 hours.
const cache = new LRUCache<string, number>({
  max: 5000,
  ttl: 1000 * 60 * 60 * 24, // 24 hours
});

export function checkRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
} {
  const current = cache.get(ip) ?? 0;
  if (current >= LIMIT_PER_DAY) {
    return { allowed: false, remaining: 0 };
  }
  cache.set(ip, current + 1);
  return { allowed: true, remaining: LIMIT_PER_DAY - current - 1 };
}
