import { SlidingWindowLimiter } from './sliding-window-limiter';

describe('SlidingWindowLimiter', () => {
  it('allows up to the limit within the window, then blocks', () => {
    const limiter = new SlidingWindowLimiter(3, 1000);

    expect([0, 10, 20, 30].map((t) => limiter.tryAcquire('user', t))).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it('allows again once old actions leave the window', () => {
    const limiter = new SlidingWindowLimiter(2, 1000);
    limiter.tryAcquire('user', 0);
    limiter.tryAcquire('user', 100);

    expect(limiter.tryAcquire('user', 500)).toBe(false);
    expect(limiter.tryAcquire('user', 1001)).toBe(true);
  });

  it('tracks each key separately', () => {
    const limiter = new SlidingWindowLimiter(1, 1000);

    expect(limiter.tryAcquire('a', 0)).toBe(true);
    expect(limiter.tryAcquire('b', 0)).toBe(true);
    expect(limiter.tryAcquire('a', 1)).toBe(false);
  });
});
