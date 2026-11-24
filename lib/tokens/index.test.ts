import { describe, it, expect } from 'vitest'
import { estimateTokens, estimateMessagesTokens, trimMessages } from './index'
import type { Message } from '@/lib/llm/types'

describe('Token Estimation and Trimming', () => {
  it('estimates tokens based on character length', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('abcdefgh')).toBe(2)
    expect(estimateTokens('Hello world')).toBe(3) // 11 chars -> ceil(11/4) = 3
  })

  it('estimates tokens for array of messages', () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: '1234', createdAt: 1 },
      { id: '2', role: 'assistant', content: '12345678', createdAt: 2 },
    ]
    expect(estimateMessagesTokens(messages)).toBe(3) // 1 + 2
  })

  it('does not trim messages if under budget', () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: 'Hello', createdAt: 1 },
      { id: '2', role: 'assistant', content: 'Hi there', createdAt: 2 },
    ]
    const result = trimMessages(messages, 1000)
    expect(result.wasTrimmed).toBe(false)
    expect(result.removedCount).toBe(0)
    expect(result.trimmed.length).toBe(2)
  })

  it('preserves system prompt and latest user message while trimming oldest', () => {
    const messages: Message[] = [
      { id: 'sys', role: 'system', content: 'You are Jarvis.', createdAt: 0 },
      { id: 'm1', role: 'user', content: 'Old user message with a lot of text here 1234567890', createdAt: 1 },
      { id: 'm2', role: 'assistant', content: 'Old assistant response 1234567890', createdAt: 2 },
      { id: 'm3', role: 'user', content: 'Latest user message', createdAt: 3 },
    ]

    // Set maxTokens tight enough so m1 and/or m2 must be removed
    const result = trimMessages(messages, 15)
    expect(result.wasTrimmed).toBe(true)
    expect(result.removedCount).toBeGreaterThan(0)

    const ids = result.trimmed.map(m => m.id)
    // System message preserved
    expect(ids).toContain('sys')
    // Latest user message preserved
    expect(ids).toContain('m3')
    // Oldest messages dropped first
    expect(ids).not.toContain('m1')
  })
})
