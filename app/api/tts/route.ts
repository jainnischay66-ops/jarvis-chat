import { NextRequest, NextResponse } from 'next/server'
import { getServerEnv } from '@/lib/env'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const OPENAI_VOICES = [
  { id: 'onyx', name: 'JARVIS Deep (Onyx)', lang: 'en-US', provider: 'cloud' as const },
  { id: 'echo', name: 'JARVIS Crisp (Echo)', lang: 'en-US', provider: 'cloud' as const },
  { id: 'fable', name: 'JARVIS British (Fable)', lang: 'en-GB', provider: 'cloud' as const },
  { id: 'alloy', name: 'Alloy', lang: 'en-US', provider: 'cloud' as const },
  { id: 'nova', name: 'Nova', lang: 'en-US', provider: 'cloud' as const },
  { id: 'shimmer', name: 'Shimmer', lang: 'en-US', provider: 'cloud' as const },
]

const ELEVENLABS_VOICES = [
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Deep / British)', lang: 'en-GB', provider: 'cloud' as const },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George (Warm / British)', lang: 'en-GB', provider: 'cloud' as const },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold (Crisp / Narrator)', lang: 'en-US', provider: 'cloud' as const },
]

const AZURE_VOICES = [
  { id: 'en-GB-RyanNeural', name: 'Ryan (British Neural)', lang: 'en-GB', provider: 'cloud' as const },
  { id: 'en-GB-AlfieNeural', name: 'Alfie (British Neural)', lang: 'en-GB', provider: 'cloud' as const },
  { id: 'en-US-GuyNeural', name: 'Guy (US Neural)', lang: 'en-US', provider: 'cloud' as const },
]

const GOOGLE_VOICES = [
  { id: 'en-GB-Neural2-B', name: 'Neural2 Male (British)', lang: 'en-GB', provider: 'cloud' as const },
  { id: 'en-GB-Wavenet-B', name: 'WaveNet Male (British)', lang: 'en-GB', provider: 'cloud' as const },
  { id: 'en-GB-Standard-B', name: 'Standard Male (British)', lang: 'en-GB', provider: 'cloud' as const },
]

export async function GET(request: NextRequest) {
  try {
    const env = getServerEnv()
    const provider = env.TTS_PROVIDER

    let voices = OPENAI_VOICES
    if (provider === 'elevenlabs') voices = ELEVENLABS_VOICES
    else if (provider === 'azure') voices = AZURE_VOICES
    else if (provider === 'google') voices = GOOGLE_VOICES

    return NextResponse.json({
      provider,
      voices,
    })
  } catch (err: any) {
    return NextResponse.json(
      { provider: 'browser', voices: OPENAI_VOICES },
      { status: 200 }
    )
  }
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'

  // Token bucket rate limiting (20 tokens, 1 refill/sec)
  const rateLimit = checkRateLimit(`tts:${ip}`)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Too many voice generation requests. Please wait a moment.',
        retryAfter: rateLimit.retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfter ?? 1),
        },
      }
    )
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 })
  }

  const { text, voice, rate, pitch } = body || {}

  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'Text parameter is required.' }, { status: 400 })
  }

  const trimmed = text.trim()
  if (!trimmed) {
    return NextResponse.json({ error: 'Text cannot be empty.' }, { status: 400 })
  }

  // Max 800 characters limit per synthesis chunk
  if (trimmed.length > 800) {
    return NextResponse.json(
      { error: 'Text exceeds maximum length of 800 characters.' },
      { status: 400 }
    )
  }

  const env = getServerEnv()
  const provider = env.TTS_PROVIDER

  try {
    if (provider === 'openai') {
      const apiKey = env.OPENAI_API_KEY?.trim()
      if (!apiKey) {
        return NextResponse.json(
          { error: 'OPENAI_API_KEY is not configured for Cloud TTS.' },
          { status: 401 }
        )
      }

      const openAiUrl = `${env.OPENAI_BASE_URL.replace(/\/+$/, '')}/audio/speech`
      const speed = typeof rate === 'number' ? Math.max(0.25, Math.min(4.0, rate)) : 1.0
      const selectedVoice = voice || env.TTS_OPENAI_VOICE || env.OPENAI_TTS_VOICE || 'onyx'
      const jarvisInstructions =
        'Speak as a deep, warm, jolly British butler with dry sarcastic humor. Relaxed pace, smiling tone, natural pauses, land punchlines with a slight lift. Sound human and expressive, never robotic.'

      const payloadWithInstructions = {
        model: env.OPENAI_TTS_MODEL || 'tts-1',
        input: trimmed,
        voice: selectedVoice,
        instructions: jarvisInstructions,
        response_format: 'mp3',
        speed,
      }

      let openAiRes = await fetch(openAiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payloadWithInstructions),
      })

      // If the model or endpoint rejected the "instructions" parameter with 400, retry without it
      if (!openAiRes.ok && openAiRes.status === 400) {
        const payloadWithoutInstructions = {
          model: env.OPENAI_TTS_MODEL || 'tts-1',
          input: trimmed,
          voice: selectedVoice,
          response_format: 'mp3',
          speed,
        }
        openAiRes = await fetch(openAiUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payloadWithoutInstructions),
        })
      }

      if (!openAiRes.ok) {
        const errorText = await openAiRes.text().catch(() => 'Unknown error')
        return NextResponse.json(
          { error: `OpenAI TTS error (${openAiRes.status}): ${errorText}` },
          { status: openAiRes.status }
        )
      }

      return new Response(openAiRes.body, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      })
    }

    if (provider === 'elevenlabs') {
      const apiKey = env.ELEVENLABS_API_KEY?.trim()
      if (!apiKey) {
        return NextResponse.json(
          { error: 'ELEVENLABS_API_KEY is not configured.' },
          { status: 401 }
        )
      }

      const voiceId = voice || env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'
      const modelId = body.model_id || 'eleven_multilingual_v2'
      const stability = typeof body.stability === 'number' ? body.stability : 0.40
      const similarityBoost = typeof body.similarity_boost === 'number' ? body.similarity_boost : 0.75
      const style = typeof body.style === 'number' ? body.style : 0.35
      const elevenSpeed = typeof rate === 'number' ? rate : 0.98

      const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: trimmed,
          model_id: modelId,
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            style,
            use_speaker_boost: true,
            speed: elevenSpeed,
          },
        }),
      })

      if (!elevenRes.ok) {
        const errText = await elevenRes.text().catch(() => 'Unknown error')
        return NextResponse.json(
          { error: `ElevenLabs TTS error (${elevenRes.status}): ${errText}` },
          { status: elevenRes.status }
        )
      }

      return new Response(elevenRes.body, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      })
    }

    if (provider === 'azure') {
      const apiKey = env.AZURE_SPEECH_KEY?.trim()
      if (!apiKey) {
        return NextResponse.json(
          { error: 'AZURE_SPEECH_KEY is not configured.' },
          { status: 401 }
        )
      }

      const region = env.AZURE_SPEECH_REGION || 'eastus'
      const voiceName = voice || env.AZURE_SPEECH_VOICE || 'en-GB-RyanNeural'
      const ratePct = typeof rate === 'number' ? `${Math.round((rate - 1) * 100)}%` : '+0%'

      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-GB">
        <voice name="${voiceName}">
          <prosody rate="${ratePct}">${trimmed}</prosody>
        </voice>
      </speak>`

      const azureRes = await fetch(
        `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': apiKey,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
          },
          body: ssml,
        }
      )

      if (!azureRes.ok) {
        const err = await azureRes.text().catch(() => 'Unknown error')
        return NextResponse.json(
          { error: `Azure Speech error (${azureRes.status}): ${err}` },
          { status: azureRes.status }
        )
      }

      return new Response(azureRes.body, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      })
    }

    if (provider === 'google') {
      const apiKey = env.GOOGLE_TTS_API_KEY?.trim()
      if (!apiKey) {
        return NextResponse.json(
          { error: 'GOOGLE_TTS_API_KEY is not configured.' },
          { status: 401 }
        )
      }

      const voiceName = voice || env.GOOGLE_TTS_VOICE || 'en-GB-Neural2-B'
      const googleRes = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text: trimmed },
            voice: { languageCode: 'en-GB', name: voiceName },
            audioConfig: {
              audioEncoding: 'MP3',
              speakingRate: rate || 1.0,
              pitch: pitch ? (pitch - 1) * 10 : 0,
            },
          }),
        }
      )

      if (!googleRes.ok) {
        const err = await googleRes.text().catch(() => 'Unknown error')
        return NextResponse.json(
          { error: `Google TTS error (${googleRes.status}): ${err}` },
          { status: googleRes.status }
        )
      }

      const data = await googleRes.json()
      if (!data.audioContent) {
        return NextResponse.json({ error: 'No audioContent returned from Google TTS.' }, { status: 500 })
      }

      const binaryString = atob(data.audioContent)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      return new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      })
    }

    // Default: Fallback to browser notice
    return NextResponse.json(
      { error: `Provider "${provider}" is not handled for cloud audio streaming. Use browser TTS.` },
      { status: 400 }
    )
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal server error while generating audio.' },
      { status: 500 }
    )
  }
}
