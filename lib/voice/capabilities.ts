export type MicPermissionState = 'granted' | 'prompt' | 'denied' | 'unsupported'

export type MicStatusLabel = 'READY' | 'TAP TO ALLOW' | 'BLOCKED' | 'UNSUPPORTED'

export type UnsupportedReason =
  | 'no-api'
  | 'firefox'
  | 'brave'
  | 'ios-chrome'
  | 'insecure'

export interface VoiceSupportResult {
  supported: boolean
  reason?: UnsupportedReason
  message?: string
}

export interface MicPermissionQueryResult {
  state: MicPermissionState
  label: MicStatusLabel
  permissionStatus?: PermissionStatus | null
}

export const UNSUPPORTED_BROWSER_MESSAGE =
  'Voice commands need Chrome or Edge. You can type commands instead.'

export const SPEECH_LANG_FALLBACKS = ['en-IN', 'en-US', 'en-GB'] as const

export interface BrowserEnvLike {
  hasSpeechRecognition?: boolean
  isSecureContext?: boolean
  userAgent?: string
  hasBraveObject?: boolean
  permissions?: {
    query: (desc: { name: PermissionName }) => Promise<PermissionStatus>
  }
}

export function getSpeechRecognitionConstructor(
  win: any = typeof window !== 'undefined' ? window : undefined
): any {
  if (!win) return null
  return win.SpeechRecognition || win.webkitSpeechRecognition || null
}

/**
 * Synchronous detection of Web Speech Recognition support and known incompatible browsers
 * (missing API, Firefox, Brave, iOS Chrome, or non-secure context).
 */
export function detectVoiceSupport(env?: BrowserEnvLike): VoiceSupportResult {
  if (typeof window === 'undefined' && !env) {
    return { supported: false, reason: 'no-api', message: UNSUPPORTED_BROWSER_MESSAGE }
  }

  const isSecure =
    env?.isSecureContext !== undefined
      ? env.isSecureContext
      : typeof window !== 'undefined'
        ? window.isSecureContext !== false
        : false

  if (!isSecure) {
    return { supported: false, reason: 'insecure', message: UNSUPPORTED_BROWSER_MESSAGE }
  }

  const ua =
    env?.userAgent !== undefined
      ? env.userAgent
      : typeof navigator !== 'undefined'
        ? navigator.userAgent || ''
        : ''

  if (/firefox|fxios/i.test(ua)) {
    return { supported: false, reason: 'firefox', message: UNSUPPORTED_BROWSER_MESSAGE }
  }

  if (/crios/i.test(ua)) {
    return { supported: false, reason: 'ios-chrome', message: UNSUPPORTED_BROWSER_MESSAGE }
  }

  const hasBrave =
    env?.hasBraveObject !== undefined
      ? env.hasBraveObject
      : typeof navigator !== 'undefined' && Boolean((navigator as any).brave)

  if (hasBrave) {
    return { supported: false, reason: 'brave', message: UNSUPPORTED_BROWSER_MESSAGE }
  }

  const hasSpeechRec =
    env?.hasSpeechRecognition !== undefined
      ? env.hasSpeechRecognition
      : Boolean(getSpeechRecognitionConstructor())

  if (!hasSpeechRec) {
    return { supported: false, reason: 'no-api', message: UNSUPPORTED_BROWSER_MESSAGE }
  }

  return { supported: true }
}

/**
 * Maps a MicPermissionState to the exact user-facing HUD / telemetry status string.
 */
export function getMicStatusLabel(state: MicPermissionState): MicStatusLabel {
  switch (state) {
    case 'granted':
      return 'READY'
    case 'prompt':
      return 'TAP TO ALLOW'
    case 'denied':
      return 'BLOCKED'
    case 'unsupported':
    default:
      return 'UNSUPPORTED'
  }
}

/**
 * Queries real microphone permission status via navigator.permissions.query({ name: 'microphone' })
 * combined with browser voice support detection.
 *
 * Never reports 'READY' unless permission is explicitly 'granted'.
 * Browsers where permissions.query('microphone') throws (e.g. Safari) fall back to 'prompt' ('TAP TO ALLOW').
 */
export async function queryMicPermission(
  env?: BrowserEnvLike
): Promise<MicPermissionQueryResult> {
  const support = detectVoiceSupport(env)
  if (!support.supported) {
    return { state: 'unsupported', label: 'UNSUPPORTED', permissionStatus: null }
  }

  // Extra async Brave guard when navigator.brave.isBrave() exists
  if (!env && typeof navigator !== 'undefined' && typeof (navigator as any).brave?.isBrave === 'function') {
    try {
      const isBrave = await (navigator as any).brave.isBrave()
      if (isBrave) {
        return { state: 'unsupported', label: 'UNSUPPORTED', permissionStatus: null }
      }
    } catch {
      // Ignore error and continue to permissions check
    }
  }

  const permissionsApi =
    env?.permissions !== undefined
      ? env.permissions
      : typeof navigator !== 'undefined'
        ? navigator.permissions
        : undefined

  if (!permissionsApi || typeof permissionsApi.query !== 'function') {
    return { state: 'prompt', label: 'TAP TO ALLOW', permissionStatus: null }
  }

  try {
    const status = await permissionsApi.query({ name: 'microphone' as PermissionName })
    const rawState = status?.state
    if (rawState === 'granted' || rawState === 'denied' || rawState === 'prompt') {
      return {
        state: rawState,
        label: getMicStatusLabel(rawState),
        permissionStatus: status,
      }
    }
    return { state: 'prompt', label: 'TAP TO ALLOW', permissionStatus: status }
  } catch {
    // Safari / Firefox / WebKit variants where 'microphone' permission query is unsupported
    return { state: 'prompt', label: 'TAP TO ALLOW', permissionStatus: null }
  }
}

/**
 * Maps SpeechRecognition error codes into actionable one-line user-facing error messages.
 * Returns null for non-error/intentional abort codes.
 */
export function mapSpeechError(errorCode: string): string | null {
  switch (errorCode) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone blocked. Click the lock icon next to the address bar, set Microphone to Allow, and reload.'
    case 'no-speech':
      return 'No speech detected. Tap the mic and speak clearly, or type your command.'
    case 'audio-capture':
      return 'No microphone found'
    case 'network':
      return 'Speech service unreachable. Check your connection or type your command.'
    case 'language-not-supported':
      return 'Speech language not supported in this browser. Type your command instead.'
    case 'aborted':
      return null
    default:
      return `Voice input error (${errorCode || 'unknown'}). You can type your command instead.`
  }
}
