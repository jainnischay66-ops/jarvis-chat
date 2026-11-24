/**
 * J.A.R.V.I.S. Command Registry and Two-Layer Intent Matcher.
 *
 * Single source of truth for voice and typed commands.
 * Layer 1: Instant local normalization and fuzzy matching (Levenshtein & token similarity).
 * Layer 2: LLM semantic interpretation (via /api/intent) when Layer 1 confidence < 0.75.
 */

export type IntentId =
  | 'WAKE'
  | 'SLEEP'
  | 'NEW_ARCHIVE'
  | 'OPEN_SETTINGS'
  | 'MUTE'
  | 'UNMUTE'
  | 'STOP'
  | 'CHAT'

export interface CommandDefinition {
  id: IntentId
  displayPhrase: string
  aliases: string[]
  description: string
  category: 'system' | 'navigation' | 'audio' | 'control'
}

export const COMMAND_REGISTRY: CommandDefinition[] = [
  {
    id: 'WAKE',
    displayPhrase: 'Wake up, JARVIS',
    aliases: [
      'wake up',
      'wake up jarvis',
      'wakeup jarvis',
      'wakeup',
      'systems online',
      'activate',
      'power up',
      'good morning jarvis',
      'hello jarvis',
      'turn on',
      'start systems',
      'bring systems online',
    ],
    description: 'Awakens JARVIS from dormant standby mode and initiates boot sequence',
    category: 'system',
  },
  {
    id: 'SLEEP',
    displayPhrase: 'Go to sleep',
    aliases: [
      'go to sleep',
      'power down',
      'standby',
      'sleep',
      'shut down',
      'deactivate',
      'rest',
      'enter standby',
      'turn off',
      'good night',
      'sleep mode',
    ],
    description: 'Puts JARVIS into dormant standby mode and cools reactor',
    category: 'system',
  },
  {
    id: 'NEW_ARCHIVE',
    displayPhrase: 'New archive',
    aliases: [
      'new archive',
      'new chat',
      'new conversation',
      'new protocol',
      'clear chat',
      'start new chat',
      'create new conversation',
      'reset conversation',
      'fresh start',
    ],
    description: 'Initializes a fresh conversation and archives current protocol',
    category: 'navigation',
  },
  {
    id: 'OPEN_SETTINGS',
    displayPhrase: 'Open settings',
    aliases: [
      'open settings',
      'settings',
      'open configuration',
      'preferences',
      'system configuration',
      'display settings',
      'voice settings',
      'show settings',
    ],
    description: 'Opens the holographic system configuration drawer',
    category: 'navigation',
  },
  {
    id: 'MUTE',
    displayPhrase: 'Mute',
    aliases: [
      'mute',
      'mute audio',
      'mute voice',
      'silent mode',
      'quiet mode',
      'silence',
      'turn off sound',
      'disable voice',
      'disable audio',
    ],
    description: 'Mutes automatic vocal synthesis and read-aloud playback',
    category: 'audio',
  },
  {
    id: 'UNMUTE',
    displayPhrase: 'Unmute',
    aliases: [
      'unmute',
      'unmute audio',
      'unmute voice',
      'enable voice',
      'sound on',
      'turn on sound',
      'voice on',
      'enable audio',
    ],
    description: 'Re-enables automatic vocal synthesis and telemetry audio',
    category: 'audio',
  },
  {
    id: 'STOP',
    displayPhrase: 'Stop',
    aliases: [
      'stop',
      'be quiet',
      'shut up',
      'hush',
      'pause',
      'halt',
      'stop talking',
      'stop speech',
      'cancel',
      'abort',
      'stop streaming',
    ],
    description: 'Immediately halts ongoing voice playback or text generation',
    category: 'control',
  },
]

const FILLER_WORDS = new Set([
  'hey',
  'hi',
  'hello',
  'please',
  'jarvis',
  'buddy',
  'mate',
  'boss',
  'sir',
  'can',
  'could',
  'you',
  'would',
  'now',
  'right',
  'just',
  'um',
  'uh',
  'yo',
  'okay',
  'ok',
])

/**
 * Normalizes speech or typed transcript by converting to lowercase,
 * stripping punctuation, removing common conversational filler words.
 */
export function normalizeTranscript(raw: string): string {
  if (!raw) return ''

  const cleaned = raw
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const words = cleaned.split(' ')
  const filtered = words.filter(w => !FILLER_WORDS.has(w) && w.length > 0)

  // If all words were filtered out (e.g. user literally said "Hey JARVIS"), fall back to cleaned
  return filtered.length > 0 ? filtered.join(' ') : cleaned
}

/**
 * Computes standard Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  const matrix: number[][] = []
  for (let i = 0; i <= m; i++) matrix[i] = [i]
  for (let j = 0; j <= n; j++) matrix[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }

  return matrix[m][n]
}

/**
 * Computes string similarity score between 0 and 1 using Levenshtein distance.
 */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1.0
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1.0
  const dist = levenshteinDistance(a, b)
  return Math.max(0, 1 - dist / maxLen)
}

export interface MatchResult {
  intent: IntentId
  confidence: number
  matchedAlias?: string
  raw: string
  normalized: string
  source: 'layer1' | 'layer2'
}

/**
 * Known phonetic speech recognition misrecognitions mapped to standard commands.
 */
const PHONETIC_SLIPS: Record<string, IntentId> = {
  'wakeup service': 'WAKE',
  'wake of service': 'WAKE',
  'wake of': 'WAKE',
  'work on': 'WAKE',
  'wake up service': 'WAKE',
  'way cup': 'WAKE',
  'way cup jarvis': 'WAKE',
  'wake app': 'WAKE',
  'week up': 'WAKE',
  'sleep mode': 'SLEEP',
  'go to slip': 'SLEEP',
  'go slip': 'SLEEP',
  'power down': 'SLEEP',
  'shut up': 'STOP',
  'hold on': 'STOP',
  'mute': 'MUTE',
  'unmute': 'UNMUTE',
}

/**
 * Layer 1 Matcher: Fast local regex and fuzzy matching.
 */
export function matchIntentLayer1(rawTranscript: string): MatchResult {
  const raw = rawTranscript.trim()
  const normalized = normalizeTranscript(raw)

  if (!raw || !normalized) {
    return {
      intent: 'CHAT',
      confidence: 0,
      raw,
      normalized,
      source: 'layer1',
    }
  }

  // Check known phonetic STT slips
  if (PHONETIC_SLIPS[normalized]) {
    return {
      intent: PHONETIC_SLIPS[normalized],
      confidence: 0.9,
      matchedAlias: normalized,
      raw,
      normalized,
      source: 'layer1',
    }
  }

  let bestIntent: IntentId = 'CHAT'
  let bestConfidence = 0
  let bestAlias = ''

  for (const cmd of COMMAND_REGISTRY) {
    for (const alias of cmd.aliases) {
      const normAlias = normalizeTranscript(alias)

      // 1. Exact match after normalization
      if (normalized === normAlias) {
        return {
          intent: cmd.id,
          confidence: 1.0,
          matchedAlias: alias,
          raw,
          normalized,
          source: 'layer1',
        }
      }

      // 2. Substring match (starts with or includes exact alias)
      if (
        normalized.startsWith(normAlias + ' ') ||
        normalized.endsWith(' ' + normAlias) ||
        normalized.includes(' ' + normAlias + ' ')
      ) {
        if (0.92 > bestConfidence) {
          bestConfidence = 0.92
          bestIntent = cmd.id
          bestAlias = alias
        }
      }

      // 3. Fuzzy similarity
      const sim = stringSimilarity(normalized, normAlias)
      if (sim > bestConfidence) {
        bestConfidence = sim
        bestIntent = cmd.id
        bestAlias = alias
      }
    }
  }

  // Threshold: confidence >= 0.72 counts as a recognized Layer 1 intent
  if (bestConfidence >= 0.72) {
    return {
      intent: bestIntent,
      confidence: bestConfidence,
      matchedAlias: bestAlias,
      raw,
      normalized,
      source: 'layer1',
    }
  }

  return {
    intent: 'CHAT',
    confidence: bestConfidence,
    raw,
    normalized,
    source: 'layer1',
  }
}

/**
 * Interprets a transcript across both layers:
 * If Layer 1 is confident (>= 0.75), returns immediately.
 * Otherwise, queries /api/intent for LLM validation.
 */
export async function interpretCommand(
  rawTranscript: string,
  options?: { allowLayer2?: boolean }
): Promise<MatchResult> {
  const l1 = matchIntentLayer1(rawTranscript)
  if (l1.confidence >= 0.75 || options?.allowLayer2 === false) {
    return l1
  }

  // Layer 2: LLM semantic interpretation
  try {
    const res = await fetch('/api/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: rawTranscript }),
    })

    if (res.ok) {
      const data = await res.json()
      // Whitelist check: only accept valid registry IDs with confidence >= 0.7
      const validIntents = new Set<string>([...COMMAND_REGISTRY.map(c => c.id), 'CHAT'])
      if (validIntents.has(data.intent) && typeof data.confidence === 'number' && data.confidence >= 0.7) {
        return {
          intent: data.intent as IntentId,
          confidence: data.confidence,
          raw: rawTranscript,
          normalized: normalizeTranscript(rawTranscript),
          source: 'layer2',
        }
      }
    }
  } catch (err) {
    console.warn('Layer 2 intent interpretation failed:', err)
  }

  return l1
}
