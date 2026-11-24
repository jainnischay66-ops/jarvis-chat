/**
 * Text sanitization for JARVIS TTS voice-over.
 * - Replaces code blocks with "Code's on screen, sir."
 * - Strips URLs, markdown syntax, tables, and emoji.
 * - Preserves natural pacing punctuation (commas, dashes, ellipses, questions).
 */

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}\u{FE00}-\u{FE0F}\u{1F1E0}-\u{1F1FF}]/gu

export interface SanitizeOptions {
  allowExpressiveTags?: boolean
}

export function sanitizeForSpeech(rawText: string, options?: SanitizeOptions): string {
  if (!rawText || !rawText.trim()) return ''

  let text = rawText

  // 1. Replace multiline code blocks (```...```) with natural JARVIS response
  text = text.replace(/```[\s\S]*?```/g, " Code's on screen, sir. ")

  // 2. Strip markdown tables (lines starting and ending with | or separator rows)
  text = text.replace(/^\s*\|.*\|\s*$/gm, '')
  text = text.replace(/\|[-:\s|]+\|/g, '')
  text = text.replace(/\|/g, ' ')

  // 3. Replace markdown images ![alt](url) -> ""
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '')

  // 4. Replace markdown links [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

  // 5. Replace standalone URLs with "the link"
  text = text.replace(/https?:\/\/[^\s)]+/gi, 'the link')

  // 6. Replace inline code `code` -> code
  text = text.replace(/`([^`]+)`/g, '$1')

  // 7. Strip markdown header prefixes (#, ##, ###, etc.)
  text = text.replace(/^#{1,6}\s+/gm, '')

  // 8. Strip bold, italic, strikethrough markers (*, **, _, __, ~~)
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2')
  text = text.replace(/(\*|_)(.*?)\1/g, '$2')
  text = text.replace(/~~(.*?)~~/g, '$1')

  // 9. Strip blockquote prefixes
  text = text.replace(/^\s*>\s+/gm, '')

  // 10. Strip bullet points or numbered lists at start of lines
  text = text.replace(/^\s*[-*+]\s+/gm, '')
  text = text.replace(/^\s*\d+\.\s+/gm, '')

  // 11. Remove emojis
  text = text.replace(EMOJI_REGEX, '')

  // 12. Strip horizontal rules
  text = text.replace(/^(?:---|\*\*\*|___)\s*$/gm, '')

  // 13. Expressive tags handling (e.g. [chuckle], [sigh]): strip by default unless explicitly allowed
  if (!options?.allowExpressiveTags) {
    text = text.replace(/\[(chuckle|chuckles|sigh|sighs|laugh|laughs|pause|cough)\]/gi, '')
  }

  // 14. Preserve comic timing punctuation: normalize dashes, ellipses and clean excess whitespace
  text = text
    .replace(/--/g, ' — ')
    .replace(/\.{3}/g, '…')
    .replace(/\s*([,;:?!—])\s*/g, '$1 ')
    .replace(/\s*(\.)\s*(?!\.)/g, '$1 ')
    .replace(/…/g, '...')
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()

  return text
}
