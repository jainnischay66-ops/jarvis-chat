import { describe, it, expect } from 'vitest'
import { sanitizeForSpeech } from './sanitize'

describe('sanitizeForSpeech', () => {
  it('replaces code blocks with natural speech notification', () => {
    const markdown = 'Here is the function:\n```typescript\nfunction fly() { return true }\n```\nIt is compiled and ready.'
    const result = sanitizeForSpeech(markdown)
    expect(result).toContain("Code's on screen, sir.")
    expect(result).not.toContain('function fly')
  })

  it('preserves natural punctuation and pauses for comic timing', () => {
    const text = 'Well, sir... that was unexpected, wasn’t it?'
    const result = sanitizeForSpeech(text)
    expect(result).toContain('...')
    expect(result).toContain(',')
    expect(result).toContain('?')
  })

  it('strips bold, italic, and inline code formatting markers', () => {
    const markdown = 'The **Mark VII** armor is *ready*, using `repulsor` beams.'
    const result = sanitizeForSpeech(markdown)
    expect(result).toBe('The Mark VII armor is ready, using repulsor beams.')
  })

  it('converts markdown links to natural spoken text and replaces raw URLs', () => {
    const markdown = 'Check [Stark Industries](https://stark.com) or visit https://avengers.org directly.'
    const result = sanitizeForSpeech(markdown)
    expect(result).toBe('Check Stark Industries or visit the link directly.')
  })

  it('removes emojis and decorative symbols', () => {
    const text = 'Thrusters active! 🚀 Power at 100% ⚡ Ready to engage. 👍'
    const result = sanitizeForSpeech(text)
    expect(result).toBe('Thrusters active! Power at 100% Ready to engage.')
  })

  it('strips markdown headers and bullet markers', () => {
    const markdown = '### Diagnostics\n- Check repulsors\n- Check HUD\n1. Run telemetry'
    const result = sanitizeForSpeech(markdown)
    expect(result).toBe('Diagnostics Check repulsors Check HUD Run telemetry')
  })

  it('strips markdown tables completely while preserving surrounding text', () => {
    const markdown = 'Telemetry report:\n| System | Status |\n|---|---|\n| Reactor | Nominal |\nReady for flight.'
    const result = sanitizeForSpeech(markdown)
    expect(result).not.toContain('|')
    expect(result).not.toContain('Status')
    expect(result).toBe('Telemetry report: Ready for flight.')
  })

  it('returns empty string for null, empty or whitespace-only inputs', () => {
    expect(sanitizeForSpeech('')).toBe('')
    expect(sanitizeForSpeech('   \n  ')).toBe('')
  })
})
