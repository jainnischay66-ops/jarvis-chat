import type { LLMProvider, Message, StreamChunk, StreamOptions } from './types'
import { getServerEnv } from '../env'

const MAX_RETRIES = 2
const DEFAULT_TIMEOUT_MS = 30000

/**
 * Strips secret API keys or Bearer tokens from error strings so they are never
 * shown in UI errors or client-facing responses.
 */
function sanitizeErrorMessage(msg: string, apiKey?: string): string {
  let cleaned = msg
  if (apiKey && apiKey.length > 5) {
    cleaned = cleaned.replaceAll(apiKey, '[REDACTED_KEY]')
  }
  return cleaned.replace(/Bearer\s+[A-Za-z0-9_\-\.]{8,}/gi, 'Bearer [REDACTED]')
}

/**
 * Checks whether an error is a transient network error that can be retried.
 */
function isRetryableNetworkError(err: unknown): boolean {
  if (err instanceof Error) {
    if (err.name === 'AbortError') return false
    if (err.name === 'TimeoutError') return true
    if (err.message === 'fetch failed') return true
  }
  const cause = (err as any)?.cause
  const code = cause?.code || (err as any)?.code
  if (typeof code === 'string') {
    const upper = code.toUpperCase()
    const retryableCodes = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN',
      'ECONNREFUSED',
      'ENETUNREACH',
      'EHOSTUNREACH',
      'EPIPE',
      'UND_ERR_CONNECT_TIMEOUT',
      'UND_ERR_SOCKET',
      'UND_ERR_HEADERS_TIMEOUT',
    ]
    if (retryableCodes.includes(upper)) return true
    if (upper.startsWith('UND_ERR_')) return true
  }
  return false
}

/**
 * Extracts a diagnostic cause code (without any secrets) from thrown network errors.
 */
function extractCauseCode(err: unknown): string {
  const cause = (err as any)?.cause
  const code = cause?.code || (err as any)?.code
  if (code && typeof code === 'string') return code.toUpperCase()
  if (err instanceof Error && err.name === 'TimeoutError') return 'ETIMEDOUT'
  if (err instanceof Error && err.name === 'TypeError') return 'FETCH_FAILED'
  return 'NETWORK_ERROR'
}

/**
 * Sleeps for ms milliseconds, aborting early if signal aborts.
 * Returns true if slept full duration, false if aborted.
 */
function abortableSleep(ms: number, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false)
  return new Promise(resolve => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const onAbort = () => {
      if (timer) clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      resolve(false)
    }
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve(true)
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

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

    const timeoutDuration = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    let tokensStreamed = 0

    // Retry loop: initial attempt (0) + up to MAX_RETRIES (2) = 3 attempts total.
    // Retries are ONLY executed if tokensStreamed === 0.
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (options.signal?.aborted) {
        yield { type: 'done', content: '' }
        return
      }

      const attemptController = new AbortController()
      let isAttemptTimeout = false

      const timeoutTimer = setTimeout(() => {
        isAttemptTimeout = true
        attemptController.abort(new DOMException('Request timed out', 'TimeoutError'))
      }, timeoutDuration)

      const onClientAbort = () => {
        attemptController.abort(new DOMException('Client aborted', 'AbortError'))
      }
      options.signal?.addEventListener('abort', onClientAbort, { once: true })

      let response: Response
      try {
        response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          signal: attemptController.signal,
        })
      } catch (err: unknown) {
        clearTimeout(timeoutTimer)
        options.signal?.removeEventListener('abort', onClientAbort)

        if (options.signal?.aborted || (err instanceof Error && err.name === 'AbortError' && !isAttemptTimeout)) {
          yield { type: 'done', content: '' }
          return
        }

        const causeCode = extractCauseCode(err)
        const causeMsg = (err as any)?.cause?.message || (err instanceof Error ? err.message : 'Unknown network failure')

        // Log diagnostics WITHOUT any secrets or user message content
        console.error(
          `[OpenAICompatible] Connection failure: code=${causeCode} message=${causeMsg} url=${baseUrl} (attempt ${attempt + 1}/${MAX_RETRIES + 1})`
        )

        // If timed out:
        if (isAttemptTimeout) {
          if (tokensStreamed === 0 && attempt < MAX_RETRIES && !options.signal?.aborted) {
            const delay = (options.retryDelayMs ?? (500 * Math.pow(2, attempt))) + Math.random() * 200
            console.warn(`[OpenAICompatible] Request timed out on attempt ${attempt + 1}. Retrying in ${Math.round(delay)}ms...`)
            const ok = await abortableSleep(delay, options.signal)
            if (!ok) {
              yield { type: 'done', content: '' }
              return
            }
            continue
          }
          yield {
            type: 'error',
            content: `Request to OpenAI-compatible endpoint (${baseUrl}) timed out after ${Math.round(timeoutDuration / 1000)}s. The provider did not respond in time.`,
          }
          return
        }

        // Retryable network errors (ECONNRESET, ETIMEDOUT, ENOTFOUND, fetch failed, etc.)
        if (isRetryableNetworkError(err) && tokensStreamed === 0 && attempt < MAX_RETRIES && !options.signal?.aborted) {
          const delay = (options.retryDelayMs ?? (500 * Math.pow(2, attempt))) + Math.random() * 200
          console.warn(`[OpenAICompatible] Network error (${causeCode}) on attempt ${attempt + 1}. Retrying in ${Math.round(delay)}ms...`)
          const ok = await abortableSleep(delay, options.signal)
          if (!ok) {
            yield { type: 'done', content: '' }
            return
          }
          continue
        }

        // Final error after retries exhausted (or non-retryable)
        const isDns = causeCode === 'ENOTFOUND' || causeCode === 'EAI_AGAIN'
        yield {
          type: 'error',
          content: isDns
            ? `Could not reach OpenAI-compatible endpoint (${baseUrl}): DNS lookup failed (${causeCode}). Check your internet connection and OPENAI_BASE_URL in .env.local.`
            : `Could not reach OpenAI-compatible endpoint (${baseUrl}): Network connection failed (${causeCode}). Check your network connection and OPENAI_BASE_URL in .env.local.`
        }
        return
      } finally {
        clearTimeout(timeoutTimer)
        options.signal?.removeEventListener('abort', onClientAbort)
      }

      // ── Handle HTTP responses ──────────────────────────────────────────────
      if (!response.ok) {
        const errorStatus = response.status
        let errorText = ''
        try {
          const errJson = await response.json()
          errorText = errJson?.error?.message || errJson?.error || response.statusText
        } catch {
          errorText = response.statusText
        }
        errorText = sanitizeErrorMessage(errorText, apiKey)

        // Content blocked by provider safety policy check
        const lower = errorText.toLowerCase()
        if (
          lower.includes('content filter') ||
          lower.includes('safety policy') ||
          lower.includes('moderation') ||
          lower.includes('content blocked')
        ) {
          yield {
            type: 'error',
            content: `Content blocked by provider safety policy: ${errorText}`,
          }
          return
        }

        // 429 and 5xx are retryable if no tokens streamed yet
        const isRetryableStatus = errorStatus === 429 || errorStatus >= 500
        if (isRetryableStatus && tokensStreamed === 0 && attempt < MAX_RETRIES && !options.signal?.aborted) {
          const retryAfterHeader = response.headers.get('retry-after')
          let delay = (options.retryDelayMs ?? (500 * Math.pow(2, attempt))) + Math.random() * 200
          if (retryAfterHeader) {
            const parsed = parseInt(retryAfterHeader, 10)
            if (!isNaN(parsed) && parsed > 0 && parsed <= 10) {
              delay = parsed * 1000
            }
          }
          console.warn(`[OpenAICompatible] HTTP ${errorStatus} on attempt ${attempt + 1}. Retrying in ${Math.round(delay)}ms...`)
          const ok = await abortableSleep(delay, options.signal)
          if (!ok) {
            yield { type: 'done', content: '' }
            return
          }
          continue
        }

        // Distinct friendly error responses
        if (errorStatus === 401) {
          yield {
            type: 'error',
            content: 'Invalid API key (401). Please check OPENAI_API_KEY in .env.local.',
          }
        } else if (errorStatus === 403) {
          yield {
            type: 'error',
            content: `Access forbidden (403): ${errorText}. Please verify permissions and OPENAI_API_KEY in .env.local.`,
          }
        } else if (errorStatus === 404) {
          yield {
            type: 'error',
            content: `Endpoint or model not found (404): ${errorText}. Please verify OPENAI_BASE_URL and OPENAI_MODEL in .env.local.`,
          }
        } else if (errorStatus === 429) {
          const retryAfter = response.headers.get('retry-after')
          yield {
            type: 'error',
            content: `Rate limit or quota exceeded (429)${retryAfter ? ` (retry after ${retryAfter}s)` : ''}: ${errorText}`,
          }
        } else if (errorStatus >= 500) {
          yield {
            type: 'error',
            content: `OpenAI-compatible service temporarily unavailable (${errorStatus}): ${errorText || 'Server error'}. Please try again shortly.`,
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

      // ── Process SSE Stream ────────────────────────────────────────────────
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
                  tokensStreamed++
                  yield { type: 'text', content: contentDelta }
                }
                if (event.error) {
                  yield {
                    type: 'error',
                    content: sanitizeErrorMessage(event.error.message || 'Streaming error from provider.', apiKey),
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
        return
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          yield { type: 'done', content: '' }
          return
        }
        // If no tokens were streamed yet and retries remain, retry
        if (tokensStreamed === 0 && attempt < MAX_RETRIES && !options.signal?.aborted) {
          const delay = (options.retryDelayMs ?? (500 * Math.pow(2, attempt))) + Math.random() * 200
          const ok = await abortableSleep(delay, options.signal)
          if (!ok) {
            yield { type: 'done', content: '' }
            return
          }
          continue
        }
        yield {
          type: 'error',
          content: 'Connection interrupted while streaming response.',
        }
        return
      } finally {
        reader.releaseLock()
      }
    }
  }
}
