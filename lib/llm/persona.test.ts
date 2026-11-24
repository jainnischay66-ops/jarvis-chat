import { describe, it, expect, vi, beforeEach } from 'vitest'
import { JARVIS_SYSTEM_PROMPT } from './persona'
import { OpenAICompatibleProvider } from './openai-compatible'
import { GeminiProvider } from './gemini'
import { AnthropicProvider } from './anthropic'
import { GET as getChatConfig } from '@/app/api/chat/route'
import type { Message } from './types'

describe('JARVIS Persona System Prompt', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.OPENAI_API_KEY = 'mock-key'
    process.env.GEMINI_API_KEY = 'mock-key'
    process.env.ANTHROPIC_API_KEY = 'mock-key'
  })

  it('contains the mandatory identity and creator details', () => {
    expect(JARVIS_SYSTEM_PROMPT).toContain('Nischay, also known as Iron Man')
    expect(JARVIS_SYSTEM_PROMPT).toContain('Nischay created you and is your owner and the only person you serve')
    expect(JARVIS_SYSTEM_PROMPT).toContain('British butler with a sense of humor')
    expect(JARVIS_SYSTEM_PROMPT).toContain('Never claim to be built or owned by OpenAI, Google, Anthropic')
    expect(JARVIS_SYSTEM_PROMPT).toContain("Code's on screen, sir.")
  })

  it('injects JARVIS_SYSTEM_PROMPT as the first message for OpenAICompatibleProvider', async () => {
    let capturedBody: any = null
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (init?.body) {
        capturedBody = JSON.parse(init.body as string)
      }
      return new Response('data: [DONE]\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    })

    const provider = new OpenAICompatibleProvider()
    const messages: Message[] = [
      { id: 'persona', role: 'system', content: JARVIS_SYSTEM_PROMPT, createdAt: 0 },
      { id: 'custom', role: 'system', content: 'Custom user prompt', createdAt: 0 },
      { id: '1', role: 'user', content: 'Who made you?', createdAt: Date.now() },
    ]

    for await (const _ of provider.stream(messages, { model: 'gpt-4o-mini' })) {}

    expect(capturedBody).not.toBeNull()
    expect(capturedBody.messages[0].role).toBe('system')
    expect(capturedBody.messages[0].content).toBe(JARVIS_SYSTEM_PROMPT)
    expect(capturedBody.messages[1].content).toBe('Custom user prompt')
    expect(capturedBody.messages[2].content).toBe('Who made you?')
  })

  it('injects JARVIS_SYSTEM_PROMPT as the first part of systemInstruction for GeminiProvider', async () => {
    let capturedBody: any = null
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (init?.body) {
        capturedBody = JSON.parse(init.body as string)
      }
      return new Response('data: {}\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    })

    const provider = new GeminiProvider()
    const messages: Message[] = [
      { id: 'persona', role: 'system', content: JARVIS_SYSTEM_PROMPT, createdAt: 0 },
      { id: 'custom', role: 'system', content: 'Custom user prompt', createdAt: 0 },
      { id: '1', role: 'user', content: 'Who made you?', createdAt: Date.now() },
    ]

    for await (const _ of provider.stream(messages, { model: 'gemini-2.0-flash' })) {}

    expect(capturedBody).not.toBeNull()
    expect(capturedBody.systemInstruction).toBeDefined()
    const systemText = capturedBody.systemInstruction.parts[0].text
    expect(systemText.startsWith(JARVIS_SYSTEM_PROMPT)).toBe(true)
  })

  it('injects JARVIS_SYSTEM_PROMPT as the first part of top-level system for AnthropicProvider', async () => {
    let capturedBody: any = null
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      if (init?.body) {
        capturedBody = JSON.parse(init.body as string)
      }
      return new Response('event: message_stop\ndata: {"type":"message_stop"}\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    })

    const provider = new AnthropicProvider()
    const messages: Message[] = [
      { id: 'persona', role: 'system', content: JARVIS_SYSTEM_PROMPT, createdAt: 0 },
      { id: 'custom', role: 'system', content: 'Custom user prompt', createdAt: 0 },
      { id: '1', role: 'user', content: 'Who made you?', createdAt: Date.now() },
    ]

    for await (const _ of provider.stream(messages, { model: 'claude-sonnet-4-20250514' })) {}

    expect(capturedBody).not.toBeNull()
    expect(capturedBody.system).toBeDefined()
    expect(capturedBody.system.startsWith(JARVIS_SYSTEM_PROMPT)).toBe(true)
  })

  it('never leaks or exposes JARVIS_SYSTEM_PROMPT in API GET responses', async () => {
    const res = await getChatConfig()
    const data = await res.json()
    const jsonString = JSON.stringify(data)
    expect(jsonString).not.toContain('Nischay')
    expect(jsonString).not.toContain('Iron Man')
    expect(jsonString).not.toContain('loyal sidekick')
  })
})
