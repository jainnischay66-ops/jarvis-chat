import { describe, it, expect, vi } from 'vitest'
import {
  detectVoiceSupport,
  getMicStatusLabel,
  queryMicPermission,
  mapSpeechError,
  UNSUPPORTED_BROWSER_MESSAGE,
} from './capabilities'

describe('detectVoiceSupport', () => {
  it('returns supported=true for Chrome in a secure context with SpeechRecognition', () => {
    const res = detectVoiceSupport({
      isSecureContext: true,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      hasBraveObject: false,
      hasSpeechRecognition: true,
    })
    expect(res).toEqual({ supported: true })
  })

  it('rejects Firefox desktop and iOS Firefox (FxiOS)', () => {
    const desktop = detectVoiceSupport({
      isSecureContext: true,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
      hasSpeechRecognition: true,
    })
    expect(desktop).toEqual({
      supported: false,
      reason: 'firefox',
      message: UNSUPPORTED_BROWSER_MESSAGE,
    })

    const ios = detectVoiceSupport({
      isSecureContext: true,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/130.0 Mobile/15E148 Safari/605.1.15',
      hasSpeechRecognition: true,
    })
    expect(ios.supported).toBe(false)
    expect(ios.reason).toBe('firefox')
  })

  it('rejects iOS Chrome (CriOS)', () => {
    const res = detectVoiceSupport({
      isSecureContext: true,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.0.0 Mobile/15E148 Safari/604.1',
      hasSpeechRecognition: true,
    })
    expect(res).toEqual({
      supported: false,
      reason: 'ios-chrome',
      message: UNSUPPORTED_BROWSER_MESSAGE,
    })
  })

  it('rejects Brave when navigator.brave is present', () => {
    const res = detectVoiceSupport({
      isSecureContext: true,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      hasBraveObject: true,
      hasSpeechRecognition: true,
    })
    expect(res).toEqual({
      supported: false,
      reason: 'brave',
      message: UNSUPPORTED_BROWSER_MESSAGE,
    })
  })

  it('rejects missing SpeechRecognition API', () => {
    const res = detectVoiceSupport({
      isSecureContext: true,
      userAgent: 'Mozilla/5.0 Chrome/131.0.0.0',
      hasBraveObject: false,
      hasSpeechRecognition: false,
    })
    expect(res).toEqual({
      supported: false,
      reason: 'no-api',
      message: UNSUPPORTED_BROWSER_MESSAGE,
    })
  })

  it('rejects insecure contexts', () => {
    const res = detectVoiceSupport({
      isSecureContext: false,
      userAgent: 'Mozilla/5.0 Chrome/131.0.0.0',
      hasSpeechRecognition: true,
    })
    expect(res).toEqual({
      supported: false,
      reason: 'insecure',
      message: UNSUPPORTED_BROWSER_MESSAGE,
    })
  })
})

describe('getMicStatusLabel', () => {
  it('maps each permission state to the exact honest HUD label', () => {
    expect(getMicStatusLabel('granted')).toBe('READY')
    expect(getMicStatusLabel('prompt')).toBe('TAP TO ALLOW')
    expect(getMicStatusLabel('denied')).toBe('BLOCKED')
    expect(getMicStatusLabel('unsupported')).toBe('UNSUPPORTED')
  })
})

describe('queryMicPermission', () => {
  const baseSupportedEnv = {
    isSecureContext: true,
    userAgent: 'Mozilla/5.0 Chrome/131.0.0.0',
    hasBraveObject: false,
    hasSpeechRecognition: true,
  }

  it('returns granted/READY only when permissions.query returns granted', async () => {
    const mockStatus = { state: 'granted' } as PermissionStatus
    const res = await queryMicPermission({
      ...baseSupportedEnv,
      permissions: { query: vi.fn().mockResolvedValue(mockStatus) },
    })
    expect(res.state).toBe('granted')
    expect(res.label).toBe('READY')
    expect(res.permissionStatus).toBe(mockStatus)
  })

  it('returns prompt/TAP TO ALLOW when permissions.query returns prompt', async () => {
    const mockStatus = { state: 'prompt' } as PermissionStatus
    const res = await queryMicPermission({
      ...baseSupportedEnv,
      permissions: { query: vi.fn().mockResolvedValue(mockStatus) },
    })
    expect(res.state).toBe('prompt')
    expect(res.label).toBe('TAP TO ALLOW')
  })

  it('returns denied/BLOCKED when permissions.query returns denied', async () => {
    const mockStatus = { state: 'denied' } as PermissionStatus
    const res = await queryMicPermission({
      ...baseSupportedEnv,
      permissions: { query: vi.fn().mockResolvedValue(mockStatus) },
    })
    expect(res.state).toBe('denied')
    expect(res.label).toBe('BLOCKED')
  })

  it('falls back to prompt/TAP TO ALLOW when permissions.query throws (Safari/WebKit)', async () => {
    const res = await queryMicPermission({
      ...baseSupportedEnv,
      permissions: {
        query: vi.fn().mockRejectedValue(new TypeError("Invalid value 'microphone'")),
      },
    })
    expect(res.state).toBe('prompt')
    expect(res.label).toBe('TAP TO ALLOW')
    expect(res.permissionStatus).toBeNull()
  })

  it('falls back to prompt/TAP TO ALLOW when permissions API is absent', async () => {
    const res = await queryMicPermission({
      ...baseSupportedEnv,
      permissions: undefined,
    })
    expect(res.state).toBe('prompt')
    expect(res.label).toBe('TAP TO ALLOW')
  })

  it('returns unsupported/UNSUPPORTED without querying permissions on unsupported browsers', async () => {
    const querySpy = vi.fn()
    const res = await queryMicPermission({
      ...baseSupportedEnv,
      userAgent: 'Mozilla/5.0 Firefox/132.0',
      permissions: { query: querySpy },
    })
    expect(res.state).toBe('unsupported')
    expect(res.label).toBe('UNSUPPORTED')
    expect(querySpy).not.toHaveBeenCalled()
  })
})

describe('mapSpeechError', () => {
  it('maps not-allowed and service-not-allowed to actionable unblock instructions', () => {
    const msg1 = mapSpeechError('not-allowed')
    const msg2 = mapSpeechError('service-not-allowed')
    expect(msg1).toContain('Microphone blocked')
    expect(msg1).toContain('Allow')
    expect(msg2).toBe(msg1)
  })

  it('maps no-speech, audio-capture, network, language-not-supported, and unknown errors', () => {
    expect(mapSpeechError('no-speech')).toContain('No speech detected')
    expect(mapSpeechError('audio-capture')).toBe('No microphone found')
    expect(mapSpeechError('network')).toContain('Speech service unreachable')
    expect(mapSpeechError('language-not-supported')).toContain('language not supported')
    expect(mapSpeechError('something-weird')).toContain('something-weird')
  })

  it('returns null for aborted so intentional stops do not show an error', () => {
    expect(mapSpeechError('aborted')).toBeNull()
  })
})
