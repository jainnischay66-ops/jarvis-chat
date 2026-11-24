import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { COMMAND_REGISTRY, type IntentId } from '@/lib/commands'
import { getProvider } from '@/lib/llm'
import { getServerEnv, validateApiKey } from '@/lib/env'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const requestSchema = z.object({
  transcript: z.string().min(1).max(500),
})

const ALLOWED_INTENTS = [
  'WAKE',
  'SLEEP',
  'NEW_ARCHIVE',
  'OPEN_SETTINGS',
  'MUTE',
  'UNMUTE',
  'STOP',
  'CHAT',
] as const

const intentResponseSchema = z.object({
  intent: z.enum(ALLOWED_INTENTS),
  confidence: z.number().min(0).max(1),
})

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'

  // Reuse sliding-window rate limiter
  const rateLimit = checkRateLimit(`intent:${ip}`)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded.', retryAfter: rateLimit.retryAfter },
      { status: 429 }
    )
  }

  let body: z.infer<typeof requestSchema>
  try {
    const raw = await request.json()
    body = requestSchema.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { transcript } = body
  const env = getServerEnv()
  const providerName = env.LLM_PROVIDER

  const keyValidation = validateApiKey(providerName)
  if (!keyValidation.valid) {
    // If LLM provider is not configured, fall back to CHAT with 0 confidence
    return NextResponse.json({ intent: 'CHAT', confidence: 0 })
  }

  // Registry summary for the LLM
  const registrySummary = COMMAND_REGISTRY.map(
    cmd => `- ${cmd.id}: ${cmd.description} (example: "${cmd.displayPhrase}")`
  ).join('\n')

  const prompt = `You are a strict, secure intent classifier for the J.A.R.V.I.S. voice assistant.
Classify the user's spoken transcript into exactly ONE intent from the registry below, or CHAT if it is a general question, conversational query, or command not listed.

Available Intents:
${registrySummary}
- CHAT: Any regular question, discussion, conversational message, or unrecognized command.

User transcript: "${transcript.replace(/"/g, '\\"')}"

Respond ONLY with valid, raw JSON matching this schema with no markdown code blocks:
{"intent": "<INTENT_ID>", "confidence": <number between 0 and 1>}

Example 1: {"intent": "WAKE", "confidence": 0.95}
Example 2: {"intent": "CHAT", "confidence": 0.85}`

  try {
    const provider = getProvider(providerName)
    let model = env.GEMINI_MODEL
    if (providerName === 'anthropic') model = env.ANTHROPIC_MODEL
    else if (providerName === 'openai-compatible') model = env.OPENAI_MODEL

    let resultText = ''
    for await (const chunk of provider.stream(
      [
        {
          id: 'system',
          role: 'system',
          content: 'You are a classification engine. You output strictly raw JSON and nothing else.',
          createdAt: 0,
        },
        {
          id: 'user',
          role: 'user',
          content: prompt,
          createdAt: 0,
        },
      ],
      {
        model,
        temperature: 0.1,
        maxTokens: 60,
      }
    )) {
      if (chunk.type === 'text') {
        resultText += chunk.content
      }
    }

    // Clean JSON response
    const jsonMatch = resultText.match(/\{[\s\S]*?\}/)
    if (!jsonMatch) {
      return NextResponse.json({ intent: 'CHAT', confidence: 0 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    const validated = intentResponseSchema.safeParse(parsed)

    if (validated.success) {
      return NextResponse.json(validated.data)
    } else {
      return NextResponse.json({ intent: 'CHAT', confidence: 0 })
    }
  } catch (err) {
    console.warn('Intent classification error:', err)
    return NextResponse.json({ intent: 'CHAT', confidence: 0 })
  }
}
