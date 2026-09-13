import { SocketRateLimiter, TokenBucket } from './socket-rate-limiter';

describe('TokenBucket', () => {
  it('allows up to capacity and rejects the next token', () => {
    const bucket = new TokenBucket({ capacity: 5, refillPerSecond: 5 });

    for (let index = 0; index < 5; index += 1) {
      expect(bucket.tryConsume()).toBe(true);
    }
    expect(bucket.tryConsume()).toBe(false);
  });

  it('refills tokens over time up to the capacity', () => {
    let now = 0;
    const bucket = new TokenBucket({
      capacity: 2,
      refillPerSecond: 2,
      now: () => now,
    });

    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(false);

    now = 500;
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(false);

    now = 2_000;
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(false);
  });

  it('never refills above the capacity after a long idle period', () => {
    let now = 0;
    const bucket = new TokenBucket({
      capacity: 3,
      refillPerSecond: 1,
      now: () => now,
    });

    now = 100_000;

    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(false);
  });
});

describe('SocketRateLimiter', () => {
  it('keeps an independent budget per limit kind', () => {
    const limiter = new SocketRateLimiter();

    for (let index = 0; index < 5; index += 1) {
      expect(limiter.allow('room')).toBe(true);
    }
    expect(limiter.allow('room')).toBe(false);
    expect(limiter.allow('signaling')).toBe(true);
    expect(limiter.allow('audio')).toBe(true);
  });
});
