export interface TokenBucketOptions {
  capacity: number;
  refillPerSecond: number;
  now?: () => number;
}

export class TokenBucket {
  private tokens: number;
  private lastRefillAt: number;

  constructor(private readonly options: TokenBucketOptions) {
    this.tokens = options.capacity;
    this.lastRefillAt = this.now();
  }

  tryConsume(): boolean {
    this.refill();
    if (this.tokens < 1) {
      return false;
    }
    this.tokens -= 1;
    return true;
  }

  private refill(): void {
    const now = this.now();
    const elapsedMs = now - this.lastRefillAt;
    if (elapsedMs <= 0) {
      return;
    }
    this.lastRefillAt = now;
    const refilled =
      this.tokens + (elapsedMs / 1000) * this.options.refillPerSecond;
    this.tokens = Math.min(this.options.capacity, refilled);
  }

  private now(): number {
    return this.options.now ? this.options.now() : Date.now();
  }
}

export type RealtimeRateLimit = 'room' | 'signaling' | 'audio';

interface RealtimeRateLimitConfig {
  capacity: number;
  refillPerSecond: number;
}

const LIMITS: Record<RealtimeRateLimit, RealtimeRateLimitConfig> = {
  room: { capacity: 5, refillPerSecond: 5 },
  signaling: { capacity: 30, refillPerSecond: 30 },
  audio: { capacity: 60, refillPerSecond: 60 },
};

export interface SocketRateLimiterOptions {
  now?: () => number;
}

export class SocketRateLimiter {
  private readonly buckets = new Map<RealtimeRateLimit, TokenBucket>();

  constructor(private readonly options: SocketRateLimiterOptions = {}) {}

  allow(limit: RealtimeRateLimit): boolean {
    let bucket = this.buckets.get(limit);
    if (!bucket) {
      bucket = new TokenBucket({ ...LIMITS[limit], ...this.options });
      this.buckets.set(limit, bucket);
    }
    return bucket.tryConsume();
  }
}
