import { GeminiProvider } from './gemini'
import { AnthropicProvider } from './anthropic'
import { OpenAICompatibleProvider } from './openai-compatible'
import type { LLMProvider, ProviderName } from './types'

export * from './types'

const providers: Partial<Record<ProviderName, LLMProvider>> = {}

export function getProvider(name?: ProviderName): LLMProvider {
  const providerName = (name || (process.env.LLM_PROVIDER as ProviderName) || 'gemini') as ProviderName

  if (providers[providerName]) {
    return providers[providerName]!
  }

  switch (providerName) {
    case 'gemini': {
      const p = new GeminiProvider()
      providers['gemini'] = p
      return p
    }
    case 'anthropic': {
      const p = new AnthropicProvider()
      providers['anthropic'] = p
      return p
    }
    case 'openai-compatible': {
      const p = new OpenAICompatibleProvider()
      providers['openai-compatible'] = p
      return p
    }
    default:
      throw new Error(`Unknown LLM provider: "${providerName}". Supported: "gemini", "anthropic", "openai-compatible"`)
  }
}
