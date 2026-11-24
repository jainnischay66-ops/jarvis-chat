import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TokenBucket, checkRateLimit } from './rate-limit'

describe('Rate Limiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('allows token consumption within capacity', () => {
    const bucket = new TokenBucket(5, 1) // 5 capacity, 1 token/sec
    expect(bucket.consume(3)).toBe(true)
    expect(bucket.consume(2)).toBe(true)
    expect(bucket.consume(1)).toBe(false) // empty now
  })

  it('refills tokens over time', () => {
    const bucket = new TokenBucket(2, 1)
    expect(bucket.consume(2)).toBe(true)
    expect(bucket.consume(1)).toBe(false)

    // Advance 1 second -> 1 token added
    vi.advanceTimersByTime(1000)
    expect(bucket.consume(1)).toBe(true)
    expect(bucket.consume(1)).toBe(false)
  })

  it('enforces rate limits per identifier', () => {
    const ip = '192.168.1.100'
    let allowedCount = 0

    // Consume all 20 tokens
    for (let i = 0; i < 25; i++) {
      const res = checkRateLimit(ip)
      if (res.allowed) allowedCount++
    }

    expect(allowedCount).toBe(20)
    const blockedRes = checkRateLimit(ip)
    expect(blockedRes.allowed).toBe(false)
    expect(blockedRes.retryAfter).toBeGreaterThan(0)
  })
})
