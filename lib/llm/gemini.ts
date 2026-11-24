import type { LLMProvider, Message, StreamChunk, StreamOptions } from './types'
import { getServerEnv } from '../env'

export class GeminiProvider implements LLMProvider {
  name = 'gemini'
  supportsAttachments = true

  async *stream(messages: Message[], options: StreamOptions): AsyncIterable<StreamChunk> {
    const env = getServerEnv()
    const apiKey = env.GEMINI_API_KEY
    if (!apiKey) {
      yield {
        type: 'error',
        content: 'GEMINI_API_KEY is not configured in .env.local. Please add your key and restart the server.',
      }
      return
    }

    const model = options.model || env.GEMINI_MODEL || 'gemini-2.0-flash'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`

    // Separate system messages from chat messages
    const systemMessages = messages.filter(m => m.role === 'system')
    const chatMessages = messages.filter(m => m.role !== 'system')

    let systemInstruction: any = undefined
    if (systemMessages.length > 0) {
      systemInstruction = {
        parts: [{ text: systemMessages.map(m => m.content).join('\n\n') }],
      }
    }

    // Convert chat messages to Gemini contents format
    const contents = chatMessages.map(msg => {
      const role = msg.role === 'user' ? 'user' : 'model'
      const parts: any[] = []

      // If there are attachments (e.g. images)
      if (msg.attachments && msg.attachments.length > 0) {
        for (const att of msg.attachments) {
          if (att.type === 'image' && att.content) {
            // strip base64 prefix if present
            const base64Data = att.content.replace(/^data:[^;]+;base64,/, '')
            parts.push({
              inline_data: {
                mime_type: att.mimeType,
                data: base64Data,
              },
            })
          } else if (att.type === 'text' || att.type === 'pdf') {
            parts.push({
              text: `[Attached file: ${att.name}]\n${att.content}\n[End of attached file]\n\n`,
            })
          }
        }
      }

      if (msg.content) {
        parts.push({ text: msg.content })
      } else if (parts.length === 0) {
        parts.push({ text: ' ' })
      }

      return { role, parts }
    })

    const requestBody: any = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 8192,
      },
    }

    if (systemInstruction) {
      requestBody.systemInstruction = systemInstruction
    }

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
        content: `Could not reach Google Gemini: ${message}. Check your internet connection.`,
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
          content: 'Invalid Gemini API key (401). Please check GEMINI_API_KEY in .env.local.',
        }
      } else if (errorStatus === 403) {
        yield {
          type: 'error',
          content: `Gemini access forbidden (403): ${errorText}`,
        }
      } else if (errorStatus === 404) {
        yield {
          type: 'error',
          content: `Gemini model or endpoint not found (404): ${errorText}. Check GEMINI_MODEL in .env.local.`,
        }
      } else if (errorStatus === 429) {
        yield {
          type: 'error',
          content: `Gemini rate limit or quota exceeded (429): ${errorText}`,
        }
      } else if (errorStatus >= 500) {
        yield {
          type: 'error',
          content: `Google AI service is currently unavailable (${errorStatus}): ${errorText}`,
        }
      } else {
        yield {
          type: 'error',
          content: `Gemini error (${errorStatus}): ${errorText}`,
        }
      }
      return
    }

    if (!response.body) {
      yield { type: 'error', content: 'No response body received from Gemini.' }
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
              const data = JSON.parse(dataStr)
              const candidates = data.candidates || []
              if (candidates.length > 0) {
                const candidate = candidates[0]
                if (candidate.finishReason === 'SAFETY') {
                  yield {
                    type: 'error',
                    content: 'Response blocked by Gemini safety filters.',
                  }
                  return
                }
                const parts = candidate.content?.parts || []
                for (const part of parts) {
                  if (part.text) {
                    yield { type: 'text', content: part.text }
                  }
                }
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
