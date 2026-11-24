import { z } from 'zod'

export const serverEnvSchema = z.object({
  LLM_PROVIDER: z.enum(['gemini', 'anthropic', 'openai-compatible']).default('gemini'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-20250514'),
  OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  MAX_CONTEXT_MESSAGES: z.coerce.number().default(50),
  MAX_MESSAGE_LENGTH: z.coerce.number().default(12000),
  MAX_ATTACHMENT_SIZE: z.coerce.number().default(10485760),
  TTS_PROVIDER: z.enum(['browser', 'openai', 'elevenlabs', 'azure', 'google']).default('openai'),
  OPENAI_TTS_MODEL: z.string().default('tts-1'),
  OPENAI_TTS_VOICE: z.string().default('onyx'),
  TTS_OPENAI_VOICE: z.string().default('onyx'),
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().default('pNInz6obpgDQGcFmaJgB'),
  AZURE_SPEECH_KEY: z.string().optional(),
  AZURE_SPEECH_REGION: z.string().default('eastus'),
  AZURE_SPEECH_VOICE: z.string().default('en-GB-RyanNeural'),
  GOOGLE_TTS_API_KEY: z.string().optional(),
  GOOGLE_TTS_VOICE: z.string().default('en-GB-Neural2-B'),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

export interface KeyValidationResult {
  valid: boolean
  error?: string
}

export interface ConfigStatus {
  configured: boolean
  provider: string
  model: string
  error?: string
}

/**
 * Redacts any potential API keys from error messages or logs.
 */
function redactKey(message: string): string {
  let result = message
  const geminiKey = process.env.GEMINI_API_KEY
  if (geminiKey && geminiKey.trim()) {
    result = result.split(geminiKey.trim()).join('[REDACTED]')
  }
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (anthropicKey && anthropicKey.trim()) {
    result = result.split(anthropicKey.trim()).join('[REDACTED]')
  }
  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey && openaiKey.trim()) {
    result = result.split(openaiKey.trim()).join('[REDACTED]')
  }
  const elevenKey = process.env.ELEVENLABS_API_KEY
  if (elevenKey && elevenKey.trim()) {
    result = result.split(elevenKey.trim()).join('[REDACTED]')
  }
  const azureKey = process.env.AZURE_SPEECH_KEY
  if (azureKey && azureKey.trim()) {
    result = result.split(azureKey.trim()).join('[REDACTED]')
  }
  const googleKey = process.env.GOOGLE_TTS_API_KEY
  if (googleKey && googleKey.trim()) {
    result = result.split(googleKey.trim()).join('[REDACTED]')
  }
  // Redact common API key patterns (Google AI Studio, Anthropic, OpenAI)
  result = result
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED]')
    .replace(/sk-ant-[a-zA-Z0-9_\-]{20,}/g, '[REDACTED]')
    .replace(/sk-[a-zA-Z0-9_\-]{20,}/g, '[REDACTED]')
  return result
}

/**
 * Parses and validates server-side environment variables from process.env.
 * Fails fast with clear error messages if validation fails.
 */
export function getServerEnv(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  const result = serverEnvSchema.safeParse(env)
  if (!result.success) {
    const formattedErrors = result.error.errors
      .map(err => `  - ${err.path.join('.') || 'root'}: ${err.message}`)
      .join('\n')
    throw new Error(
      `Failed to validate server environment variables:\n${redactKey(formattedErrors)}`
    )
  }
  return result.data
}

/**
 * Checks whether the required API key exists for the selected provider.
 * If provider is omitted, checks the key for the provider configured in env.
 */
export function validateApiKey(
  provider?: string,
  env?: ServerEnv
): KeyValidationResult {
  let resolvedEnv: ServerEnv
  try {
    resolvedEnv = env ?? getServerEnv()
  } catch (err) {
    return {
      valid: false,
      error: redactKey(err instanceof Error ? err.message : 'Environment validation error'),
    }
  }

  const activeProvider = provider ?? resolvedEnv.LLM_PROVIDER

  if (activeProvider === 'gemini') {
    const key = resolvedEnv.GEMINI_API_KEY?.trim()
    if (!key) {
      return {
        valid: false,
        error: 'GEMINI_API_KEY is not set. Please set GEMINI_API_KEY in your environment variables.',
      }
    }
    return { valid: true }
  }

  if (activeProvider === 'anthropic') {
    const key = resolvedEnv.ANTHROPIC_API_KEY?.trim()
    if (!key) {
      return {
        valid: false,
        error: 'ANTHROPIC_API_KEY is not set. Please set ANTHROPIC_API_KEY in your environment variables.',
      }
    }
    return { valid: true }
  }

  if (activeProvider === 'openai-compatible') {
    const key = resolvedEnv.OPENAI_API_KEY?.trim()
    const baseUrl = resolvedEnv.OPENAI_BASE_URL?.trim() || ''
    const isStandardOpenAI = !baseUrl || baseUrl.includes('api.openai.com')
    if (isStandardOpenAI && !key) {
      return {
        valid: false,
        error: 'OPENAI_API_KEY is not set. Please set OPENAI_API_KEY in your environment variables.',
      }
    }
    return { valid: true }
  }

  return {
    valid: false,
    error: `Unsupported LLM provider: "${redactKey(String(activeProvider))}". Supported providers are "gemini", "anthropic", and "openai-compatible".`,
  }
}

/**
 * Returns configuration status for the server-side LLM setup.
 */
export function getConfigStatus(): ConfigStatus {
  try {
    const env = getServerEnv()
    const provider = env.LLM_PROVIDER
    let model = env.GEMINI_MODEL
    if (provider === 'anthropic') model = env.ANTHROPIC_MODEL
    else if (provider === 'openai-compatible') model = env.OPENAI_MODEL
    const keyValidation = validateApiKey(provider, env)

    if (!keyValidation.valid) {
      return {
        configured: false,
        provider,
        model,
        error: keyValidation.error,
      }
    }

    return {
      configured: true,
      provider,
      model,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Configuration error'
    const fallbackProvider = (process.env.LLM_PROVIDER as string) || 'gemini'
    const fallbackModel =
      fallbackProvider === 'anthropic'
        ? process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'
        : process.env.GEMINI_MODEL || 'gemini-2.0-flash'

    return {
      configured: false,
      provider: fallbackProvider,
      model: fallbackModel,
      error: redactKey(message),
    }
  }
}
