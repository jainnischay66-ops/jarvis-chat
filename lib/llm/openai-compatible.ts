import type { LLMProvider, Message, StreamChunk, StreamOptions } from './types'
import { getServerEnv } from '../env'

export class OpenAICompatibleProvider implements LLMProvider {
  name = 'openai-compatible'
  supportsAttachments = true

  async *stream(messages: Message[], options: StreamOptions): AsyncIterable<StreamChunk> {
    const env = getServerEnv()
    const apiKey = env.OPENAI_API_KEY || ''
    const baseUrl = (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '')
    const model = options.model || env.OPENAI_MODEL || 'gpt-4o-mini'
    const url = `${baseUrl}/chat/completions`

    const formattedMessages: any[] = []

    for (const msg of messages) {
      if (msg.role === 'system') {
        formattedMessages.push({ role: 'system', content: msg.content })
        continue
      }

      const role = msg.role === 'assistant' ? 'assistant' : 'user'

      if (msg.attachments && msg.attachments.length > 0) {
        const contentParts: any[] = []
        if (msg.content) {
          contentParts.push({ type: 'text', text: msg.content })
        }

        for (const att of msg.attachments) {
          if (att.type === 'image' && att.content) {
            contentParts.push({
              type: 'image_url',
              image_url: {
                url: att.content.startsWith('data:') ? att.content : `data:${att.mimeType};base64,${att.content}`,
              },
            })
          } else if (att.type === 'text' || att.type === 'pdf') {
            contentParts.push({
              type: 'text',
              text: `[Attached file: ${att.name}]\n${att.content}\n[End of attached file]\n\n`,
            })
          }
        }

        formattedMessages.push({ role, content: contentParts })
      } else {
        formattedMessages.push({ role, content: msg.content || ' ' })
      }
    }

    const requestBody: any = {
      model,
      stream: true,
      messages: formattedMessages,
      temperature: options.temperature ?? 0.7,
    }

    if (options.maxTokens) {
      requestBody.max_tokens = options.maxTokens
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
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
        content: `Could not reach OpenAI-compatible endpoint (${baseUrl}): ${message}. Check your network and OPENAI_BASE_URL.`,
      }
      return
    }

    if (!response.ok) {
      const errorStatus = response.status
      let errorText = ''
      try {
        const errJson = await response.json()
        errorText = errJson?.error?.message || errJson?.error || response.statusText
      } catch {
        errorText = response.statusText
      }

      if (errorStatus === 401) {
        yield {
          type: 'error',
          content: 'Invalid API key (401). Please check OPENAI_API_KEY in .env.local.',
        }
      } else if (errorStatus === 403) {
        yield {
          type: 'error',
          content: `Access forbidden (403): ${errorText}`,
        }
      } else if (errorStatus === 404) {
        yield {
          type: 'error',
          content: `Endpoint or model not found (404): ${errorText}. Please verify OPENAI_BASE_URL and OPENAI_MODEL.`,
        }
      } else if (errorStatus === 429) {
        yield {
          type: 'error',
          content: `Rate limit or quota exceeded (429): ${errorText}`,
        }
      } else if (errorStatus >= 500) {
        yield {
          type: 'error',
          content: `OpenAI-compatible service error (${errorStatus}): ${errorText}`,
        }
      } else {
        yield {
          type: 'error',
          content: `API error (${errorStatus}): ${errorText}`,
        }
      }
      return
    }

    if (!response.body) {
      yield { type: 'error', content: 'No response body received from OpenAI-compatible provider.' }
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
            const dataStr = trimmed.slice(6).trim()
            if (dataStr === '[DONE]') {
              yield { type: 'done', content: '' }
              return
            }

            try {
              const event = JSON.parse(dataStr)
              const contentDelta = event.choices?.[0]?.delta?.content
              if (contentDelta) {
                yield { type: 'text', content: contentDelta }
              }
              if (event.error) {
                yield {
                  type: 'error',
                  content: event.error.message || 'Streaming error from provider.',
                }
                return
              }
            } catch {
              // ignore partial chunk parse errors
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
