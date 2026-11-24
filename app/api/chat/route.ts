import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { getProvider } from '@/lib/llm'
import { JARVIS_SYSTEM_PROMPT } from '@/lib/llm/persona'
import { getServerEnv, validateApiKey, getConfigStatus } from '@/lib/env'
import { checkRateLimit } from '@/lib/rate-limit'
import type { Message, ProviderName } from '@/lib/llm/types'

const messageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().max(50000),
  createdAt: z.number(),
  attachments: z.array(z.object({
    id: z.string(),
    type: z.enum(['image', 'text', 'pdf']),
    name: z.string(),
    content: z.string(),
    mimeType: z.string(),
    size: z.number().max(10485760),
  })).optional(),
})

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(200),
  model: z.string().optional(),
  provider: z.enum(['gemini', 'anthropic', 'openai-compatible']).optional(),
  temperature: z.number().min(0).max(2).optional(),
  systemPrompt: z.string().max(10000).optional(),
  generateTitle: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown'
    const rateCheck = checkRateLimit(ip)
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment before trying again.', retryAfter: rateCheck.retryAfter },
        { status: 429 }
      )
    }

    // Parse and validate request
    let body: z.infer<typeof requestSchema>
    try {
      const raw = await request.json()
      body = requestSchema.parse(raw)
    } catch (e) {
      if (e instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request format.', details: e.errors.map(err => err.message) },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: 'Could not parse request body.' }, { status: 400 })
    }

    // Get env and validate
    const env = getServerEnv()
    const providerName = (body.provider ?? env.LLM_PROVIDER) as ProviderName
    let model = body.model
    if (!model) {
      if (providerName === 'gemini') model = env.GEMINI_MODEL
      else if (providerName === 'anthropic') model = env.ANTHROPIC_MODEL
      else if (providerName === 'openai-compatible') model = env.OPENAI_MODEL
    }
    const resolvedModel: string = model || 'gemini-2.0-flash'
    
    const keyValidation = validateApiKey(providerName)
    if (!keyValidation.valid) {
      return NextResponse.json(
        { error: keyValidation.error },
        { status: 401 }
      )
    }

    // Build messages with JARVIS persona as the first system instruction
    const messages: Message[] = [
      {
        id: 'jarvis-persona',
        role: 'system',
        content: JARVIS_SYSTEM_PROMPT,
        createdAt: 0,
      },
    ]
    if (body.systemPrompt) {
      messages.push({
        id: 'system',
        role: 'system',
        content: body.systemPrompt,
        createdAt: 0,
      })
    }
    messages.push(...body.messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
      attachments: m.attachments?.map(a => ({
        id: a.id,
        type: a.type,
        name: a.name,
        content: a.content,
        mimeType: a.mimeType,
        size: a.size,
      })),
    })))

    // Non-streaming title generation
    if (body.generateTitle) {
      const provider = getProvider(providerName)
      let titleText = ''
      for await (const chunk of provider.stream(messages, {
        model: resolvedModel,
        temperature: 0.3,
        maxTokens: 30,
      })) {
        if (chunk.type === 'text') {
          titleText += chunk.content
        }
      }
      return NextResponse.json({ title: titleText.trim().replace(/^["']|["']$/g, '').substring(0, 60) })
    }

    // Streaming response
    const provider = getProvider(providerName)
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const signal = request.signal
          for await (const chunk of provider.stream(messages, {
            model: resolvedModel,
            temperature: body.temperature,
            signal,
          })) {
            if (signal.aborted) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', content: '' })}\n\n`))
              controller.close()
              return
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
            if (chunk.type === 'done' || chunk.type === 'error') {
              break
            }
          }
        } catch (error: unknown) {
          if (error instanceof Error && error.name === 'AbortError') {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', content: '' })}\n\n`))
          } else {
            const message = error instanceof Error ? error.message : 'An unexpected error occurred.'
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', content: message })}\n\n`))
          }
        } finally {
          try { controller.close() } catch { /* already closed */ }
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error: unknown) {
    console.error('Chat API error:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}

// Config endpoint to check if API is set up
export async function GET() {
  const status = getConfigStatus()
  return NextResponse.json({ status, ...status })
}
