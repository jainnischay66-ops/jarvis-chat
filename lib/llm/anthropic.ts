import type { LLMProvider, Message, StreamChunk, StreamOptions } from './types'
import { getServerEnv } from '../env'

export class AnthropicProvider implements LLMProvider {
  name = 'anthropic'
  supportsAttachments = true

  async *stream(messages: Message[], options: StreamOptions): AsyncIterable<StreamChunk> {
    const env = getServerEnv()
    const apiKey = env.ANTHROPIC_API_KEY
    if (!apiKey) {
      yield {
        type: 'error',
        content: 'ANTHROPIC_API_KEY is not configured in .env.local. Please add your key and restart the server.',
      }
      return
    }

    const model = options.model || env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'
    const url = 'https://api.anthropic.com/v1/messages'

    const systemMessages = messages.filter(m => m.role === 'system')
    const chatMessages = messages.filter(m => m.role !== 'system')

    const system = systemMessages.map(m => m.content).join('\n\n')

    const formattedMessages = chatMessages.map(msg => {
      const contentParts: any[] = []

      if (msg.attachments && msg.attachments.length > 0) {
        for (const att of msg.attachments) {
          if (att.type === 'image' && att.content) {
            const base64Data = att.content.replace(/^data:[^;]+;base64,/, '')
            contentParts.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: att.mimeType,
                data: base64Data,
              },
            })
          } else if (att.type === 'text' || att.type === 'pdf') {
            contentParts.push({
              type: 'text',
              text: `[Attached file: ${att.name}]\n${att.content}\n[End of attached file]\n\n`,
            })
          }
        }
      }

      if (msg.content) {
        contentParts.push({ type: 'text', text: msg.content })
      } else if (contentParts.length === 0) {
        contentParts.push({ type: 'text', text: ' ' })
      }

      return {
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: contentParts,
      }
    })

    const requestBody: any = {
      model,
      max_tokens: options.maxTokens ?? 4096,
      stream: true,
      messages: formattedMessages,
      temperature: options.temperature ?? 0.7,
    }

    if (system) {
      requestBody.system = system
    }

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
        signal: options.signal,
      })
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        yield { type: 'done', content: '' }
        return
      }
      const message = err instanceof Error ? err.message : 'Network error'
      yield {
        type: 'error',
        content: `Could not reach Anthropic: ${message}. Check your internet connection.`,
      }
      return
    }

    if (!response.ok) {
      const errorStatus = response.status
      let errorText = ''
      try {
        const errJson = await response.json()
        errorText = errJson?.error?.message || response.statusText
      } catch {
        errorText = response.statusText
      }

      if (errorStatus === 401) {
        yield {
          type: 'error',
          content: 'Invalid Anthropic API key (401). Please check ANTHROPIC_API_KEY in .env.local.',
        }
      } else if (errorStatus === 403) {
        yield {
          type: 'error',
          content: `Anthropic access forbidden (403): ${errorText}`,
        }
      } else if (errorStatus === 404) {
        yield {
          type: 'error',
          content: `Anthropic model not found (404): ${errorText}. Check ANTHROPIC_MODEL in .env.local.`,
        }
      } else if (errorStatus === 429) {
        yield {
          type: 'error',
          content: `Anthropic rate limit exceeded (429): ${errorText}`,
        }
      } else if (errorStatus >= 500) {
        yield {
          type: 'error',
          content: `Anthropic service is currently unavailable (${errorStatus}): ${errorText}`,
        }
      } else {
        yield {
          type: 'error',
          content: `Anthropic error (${errorStatus}): ${errorText}`,
        }
      }
      return
    }

    if (!response.body) {
      yield { type: 'error', content: 'No response body received from Anthropic.' }
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith(':')) continue

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6)
            try {
              const event = JSON.parse(dataStr)
              if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                yield { type: 'text', content: event.delta.text }
              } else if (event.type === 'message_stop') {
                yield { type: 'done', content: '' }
                return
              } else if (event.type === 'error') {
                yield {
                  type: 'error',
                  content: event.error?.message || 'Anthropic streaming error.',
                }
                return
              }
            } catch {
              // ignore parse errors on partial chunks
            }
          }
        }
      }
      yield { type: 'done', content: '' }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        yield { type: 'done', content: '' }
      } else {
        yield {
          type: 'error',
          content: 'Connection interrupted while streaming response.',
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}
