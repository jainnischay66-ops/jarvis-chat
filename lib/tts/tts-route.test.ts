import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST, GET } from '@/app/api/tts/route'
import { NextRequest } from 'next/server'

describe('TTS API Route (/api/tts)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.TTS_PROVIDER = 'openai'
    process.env.OPENAI_API_KEY = 'test-mock-key'
  })

  it('rejects text exceeding 800 characters with 400 status', async () => {
    const longText = 'A'.repeat(801)
    const req = new NextRequest('http://localhost:3000/api/tts', {
      method: 'POST',
      body: JSON.stringify({ text: longText }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('800 characters')
  })

  it('rejects empty text with 400 status', async () => {
    const req = new NextRequest('http://localhost:3000/api/tts', {
      method: 'POST',
      body: JSON.stringify({ text: '   ' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Text cannot be empty')
  })

  it('returns available voice options on GET', async () => {
    const req = new NextRequest('http://localhost:3000/api/tts?voices=1')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.voices).toBeInstanceOf(Array)
    expect(json.voices.length).toBeGreaterThan(0)
  })

  it('rejects with 401 when OpenAI API key is missing', async () => {
    process.env.OPENAI_API_KEY = ''
    const req = new NextRequest('http://localhost:3000/api/tts', {
      method: 'POST',
      body: JSON.stringify({ text: 'Good evening, sir.' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toContain('OPENAI_API_KEY is not configured')
  })
})
