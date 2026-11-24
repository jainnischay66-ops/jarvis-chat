import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAICompatibleProvider } from './openai-compatible'
import { GeminiProvider } from './gemini'
import { AnthropicProvider } from './anthropic'
import type { Message } from './types'

describe('OpenAICompatibleProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.LLM_PROVIDER = 'openai-compatible'
    process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1'
    process.env.OPENAI_API_KEY = 'test-mock-key'
    process.env.OPENAI_MODEL = 'gpt-4o-mini'
  })

  it('streams text chunks and terminates with done', async () => {
    const ssePayload = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world!"}}]}\n\n',
      'data: [DONE]\n\n',
    ].join('')

    const mockResponse = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(ssePayload))
          controller.close()
        },
      }),
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
    )

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse)

    const provider = new OpenAICompatibleProvider()
    const messages: Message[] = [
      { id: '1', role: 'user', content: 'hello', createdAt: Date.now() },
    ]

    const chunks = []
    for await (const chunk of provider.stream(messages, { model: 'gpt-4o-mini' })) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual([
      { type: 'text', content: 'Hello' },
      { type: 'text', content: ' world!' },
      { type: 'done', content: '' },
    ])
  })

  it('classifies 401 as Invalid API key', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Incorrect API key provided' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const provider = new OpenAICompatibleProvider()
    const chunks = []
    for await (const chunk of provider.stream(
      [{ id: '1', role: 'user', content: 'hello', createdAt: 0 }],
      { model: 'gpt-4o-mini' }
    )) {
      chunks.push(chunk)
    }

    expect(chunks[0].type).toBe('error')
    expect(chunks[0].content).toContain('Invalid API key (401)')
  })

  it('classifies 403 with provider actual message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Country not supported' } }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const provider = new OpenAICompatibleProvider()
    const chunks = []
    for await (const chunk of provider.stream(
      [{ id: '1', role: 'user', content: 'hello', createdAt: 0 }],
      { model: 'gpt-4o-mini' }
    )) {
      chunks.push(chunk)
    }

    expect(chunks[0].type).toBe('error')
    expect(chunks[0].content).toContain('Access forbidden (403)')
    expect(chunks[0].content).toContain('Country not supported')
  })

  it('classifies 404 with not found cause', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'The model `foo` does not exist' } }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const provider = new OpenAICompatibleProvider()
    const chunks = []
    for await (const chunk of provider.stream(
      [{ id: '1', role: 'user', content: 'hello', createdAt: 0 }],
      { model: 'foo' }
    )) {
      chunks.push(chunk)
    }

    expect(chunks[0].type).toBe('error')
    expect(chunks[0].content).toContain('Endpoint or model not found (404)')
    expect(chunks[0].content).toContain('The model `foo` does not exist')
  })

  it('classifies 429 with rate limit cause', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Rate limit reached for requests' } }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const provider = new OpenAICompatibleProvider()
    const chunks = []
    for await (const chunk of provider.stream(
      [{ id: '1', role: 'user', content: 'hello', createdAt: 0 }],
      { model: 'gpt-4o-mini' }
    )) {
      chunks.push(chunk)
    }

    expect(chunks[0].type).toBe('error')
    expect(chunks[0].content).toContain('Rate limit or quota exceeded (429)')
  })
})

describe('GeminiProvider error classification', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.GEMINI_API_KEY = 'test-gemini-key'
  })

  it('preserves provider message on 403 instead of reporting Invalid key', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            message:
              'The Gemini API free tier is not available for this project. To use the Gemini API, please set up billing.',
          },
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    )

    const provider = new GeminiProvider()
    const chunks = []
    for await (const chunk of provider.stream(
      [{ id: '1', role: 'user', content: 'hello', createdAt: 0 }],
      { model: 'gemini-2.0-flash' }
    )) {
      chunks.push(chunk)
    }

    expect(chunks[0].type).toBe('error')
    expect(chunks[0].content).toContain('Gemini access forbidden (403)')
    expect(chunks[0].content).toContain('free tier is not available for this project')
    expect(chunks[0].content).not.toContain('Invalid Gemini API key')
  })

  it('only reports Invalid key on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: 'API key not valid. Please pass a valid API key.' } }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    )

    const provider = new GeminiProvider()
    const chunks = []
    for await (const chunk of provider.stream(
      [{ id: '1', role: 'user', content: 'hello', createdAt: 0 }],
      { model: 'gemini-2.0-flash' }
    )) {
      chunks.push(chunk)
    }

    expect(chunks[0].type).toBe('error')
    expect(chunks[0].content).toContain('Invalid Gemini API key (401)')
  })
})
