/**
 * Sentence boundary detection and streaming buffer for JARVIS TTS.
 * Splits incoming text chunks into complete sentences as soon as they terminate,
 * while preserving numbers, abbreviations, and acronyms.
 */

const COMMON_ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr',
  'e.g', 'i.e', 'vs', 'etc', 'approx', 'est', 'dept',
  'gen', 'col', 'sgt', 'capt', 'lt',
])

export function isAbbreviation(word: string): boolean {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '')
  return COMMON_ABBREVIATIONS.has(clean)
}

/**
 * Splits a full text into discrete sentences.
 */
export function splitIntoSentences(text: string): string[] {
  if (!text || !text.trim()) return []

  const sentences: string[] = []
  let current = ''

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    current += char

    if (char === '.' || char === '!' || char === '?' || char === '\n' || char === ':' || char === ';') {
      // Check for ellipsis (...)
      if (char === '.' && text[i + 1] === '.') {
        continue
      }
      if (char === '.' && i > 0 && text[i - 1] === '.') {
        continue
      }

      // Check for decimals / version numbers like 3.14 or v7.4
      if (char === '.') {
        const prev = i > 0 ? text[i - 1] : ''
        const next = i + 1 < text.length ? text[i + 1] : ''
        if (/\d/.test(prev) && /\d/.test(next)) {
          continue
        }

        // Check for common abbreviations
        const words = current.trim().split(/\s+/)
        const lastWord = words[words.length - 1] || ''
        if (isAbbreviation(lastWord)) {
          continue
        }
      }

      // Sentence boundary found if followed by whitespace, quote, or end of string
      const nextChar = i + 1 < text.length ? text[i + 1] : ''
      if (!nextChar || /\s|["'`)\]}]/.test(nextChar)) {
        const trimmed = current.trim()
        if (trimmed.length > 0) {
          sentences.push(trimmed)
          current = ''
        }
      }
    }
  }

  const remainder = current.trim()
  if (remainder.length > 0) {
    sentences.push(remainder)
  }

  return sentences
}

/**
 * Stateful buffer for streaming SSE text chunks.
 * Emits complete sentences as they form.
 */
export class SentenceBuffer {
  private buffer = ''

  public push(chunk: string): string[] {
    this.buffer += chunk

    const sentences = splitIntoSentences(this.buffer)
    if (sentences.length === 0) return []

    // If buffer doesn't end with a sentence terminator, the last item is incomplete
    const lastChar = this.buffer.trim().slice(-1)
    const hasTerminator = ['.', '!', '?', '\n'].includes(lastChar)

    if (!hasTerminator && sentences.length > 1) {
      const completed = sentences.slice(0, -1)
      let lastEndIdx = 0
      for (const s of completed) {
        const idx = this.buffer.indexOf(s, lastEndIdx)
        if (idx !== -1) {
          lastEndIdx = idx + s.length
        }
      }
      this.buffer = this.buffer.slice(lastEndIdx).trimStart()
      return completed
    } else if (hasTerminator) {
      this.buffer = ''
      return sentences
    }

    return []
  }

  public flush(): string[] {
    const trimmed = this.buffer.trim()
    this.buffer = ''
    if (trimmed.length > 0) {
      return [trimmed]
    }
    return []
  }

  public reset(): void {
    this.buffer = ''
  }
}
