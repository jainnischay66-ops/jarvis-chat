import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  normalizeTranscript,
  levenshteinDistance,
  stringSimilarity,
  matchIntentLayer1,
  interpretCommand,
  COMMAND_REGISTRY,
} from './commands'

describe('Command Registry & Normalizer', () => {
  it('COMMAND_REGISTRY contains all expected system intents', () => {
    const ids = COMMAND_REGISTRY.map(c => c.id)
    expect(ids).toContain('WAKE')
    expect(ids).toContain('SLEEP')
    expect(ids).toContain('NEW_ARCHIVE')
    expect(ids).toContain('OPEN_SETTINGS')
    expect(ids).toContain('MUTE')
    expect(ids).toContain('UNMUTE')
    expect(ids).toContain('STOP')
  })

  it('normalizes transcript by stripping punctuation, extra spaces, and filler words', () => {
    expect(normalizeTranscript('Hey JARVIS, wake up please!')).toBe('wake up')
    expect(normalizeTranscript('Could you please power down, buddy?')).toBe('power down')
    expect(normalizeTranscript('Sir, open settings right now.')).toBe('open settings')
  })

  it('preserves input if transcript consists entirely of filler words', () => {
    expect(normalizeTranscript('Hey JARVIS')).toBe('hey jarvis')
    expect(normalizeTranscript('   ')).toBe('')
  })
})

describe('Levenshtein Distance & String Similarity', () => {
  it('returns 0 distance and 1.0 similarity for identical strings', () => {
    expect(levenshteinDistance('jarvis', 'jarvis')).toBe(0)
    expect(stringSimilarity('jarvis', 'jarvis')).toBe(1.0)
  })

  it('calculates distance correctly for insertions, deletions, substitutions', () => {
    expect(levenshteinDistance('wake', 'rake')).toBe(1)
    expect(levenshteinDistance('wake', 'wakes')).toBe(1)
    expect(levenshteinDistance('wake', 'wak')).toBe(1)
  })

  it('calculates similarity score normalized between 0 and 1', () => {
    const sim = stringSimilarity('wake up', 'wake ip')
    expect(sim).toBeGreaterThan(0.8)
    expect(sim).toBeLessThan(1.0)
  })
})

describe('Layer 1 Intent Matcher (matchIntentLayer1)', () => {
  it('matches exact wake aliases', () => {
    expect(matchIntentLayer1('Wake up, JARVIS').intent).toBe('WAKE')
    expect(matchIntentLayer1('wakeup').intent).toBe('WAKE')
    expect(matchIntentLayer1('bring systems online').intent).toBe('WAKE')
  })

  it('matches sloppy wake variants with filler words', () => {
    expect(matchIntentLayer1('hey jarvis wake up buddy').intent).toBe('WAKE')
    expect(matchIntentLayer1('please bring systems online sir').intent).toBe('WAKE')
  })

  it('matches known phonetic speech recognition slips', () => {
    expect(matchIntentLayer1('wakeup service').intent).toBe('WAKE')
    expect(matchIntentLayer1('wake of service').intent).toBe('WAKE')
    expect(matchIntentLayer1('way cup jarvis').intent).toBe('WAKE')
    expect(matchIntentLayer1('go to slip').intent).toBe('SLEEP')
    expect(matchIntentLayer1('sleep mode').intent).toBe('SLEEP')
  })

  it('matches sleep and power down commands', () => {
    expect(matchIntentLayer1('go to sleep').intent).toBe('SLEEP')
    expect(matchIntentLayer1('power down').intent).toBe('SLEEP')
    expect(matchIntentLayer1('enter standby').intent).toBe('SLEEP')
  })

  it('matches navigation commands (new archive, settings)', () => {
    expect(matchIntentLayer1('new archive').intent).toBe('NEW_ARCHIVE')
    expect(matchIntentLayer1('start new chat').intent).toBe('NEW_ARCHIVE')
    expect(matchIntentLayer1('open settings').intent).toBe('OPEN_SETTINGS')
    expect(matchIntentLayer1('system configuration').intent).toBe('OPEN_SETTINGS')
  })

  it('matches audio and playback control commands (mute, unmute, stop)', () => {
    expect(matchIntentLayer1('mute voice').intent).toBe('MUTE')
    expect(matchIntentLayer1('unmute audio').intent).toBe('UNMUTE')
    expect(matchIntentLayer1('shut up').intent).toBe('STOP')
    expect(matchIntentLayer1('be quiet').intent).toBe('STOP')
    expect(matchIntentLayer1('stop streaming').intent).toBe('STOP')
  })

  it('falls back to CHAT for general conversational or knowledge queries', () => {
    expect(matchIntentLayer1('What is the circumference of Jupiter?').intent).toBe('CHAT')
    expect(matchIntentLayer1('Write a Python function to compute fibonacci numbers').intent).toBe('CHAT')
    expect(matchIntentLayer1('Explain the arc reactor physics').intent).toBe('CHAT')
  })
})

describe('Two-Layer Intent Matcher (interpretCommand)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves directly via Layer 1 when confidence is high without calling /api/intent', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const result = await interpretCommand('Wake up, JARVIS')

    expect(result.intent).toBe('WAKE')
    expect(result.source).toBe('layer1')
    expect(result.confidence).toBeGreaterThanOrEqual(0.75)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('calls Layer 2 /api/intent when Layer 1 confidence is low', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ intent: 'SLEEP', confidence: 0.95 }),
    } as Response)

    const result = await interpretCommand('I would like to retire to my quarters until morning')
    expect(fetchSpy).toHaveBeenCalledWith('/api/intent', expect.anything())
    expect(result.intent).toBe('SLEEP')
    expect(result.source).toBe('layer2')
  })

  it('enforces whitelist on Layer 2 and rejects unauthorized intents from LLM', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ intent: 'UNAUTHORIZED_ACTION', confidence: 0.99 }),
    } as Response)

    const result = await interpretCommand('Can you destroy all records?')
    // Should reject UNAUTHORIZED_ACTION and fall back to CHAT
    expect(result.intent).toBe('CHAT')
  })

  it('falls back to Layer 1 result if /api/intent fails or returns non-200', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))

    const result = await interpretCommand('Could you turn the lights down')
    expect(result.source).toBe('layer1')
  })
})
