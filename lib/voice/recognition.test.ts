// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startRecognitionWithGesture } from './recognition'
import { UNSUPPORTED_BROWSER_MESSAGE } from './capabilities'

interface MockRecInstance {
  lang: string
  interimResults: boolean
  continuous: boolean
  onstart: (() => void) | null
  onresult: ((e: any) => void) | null
  onerror: ((e: any) => void) | null
  onend: (() => void) | null
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  abort: ReturnType<typeof vi.fn>
}

describe('startRecognitionWithGesture', () => {
  let instances: MockRecInstance[]
  let originalSpeechRec: any
  let originalWebkitSpeechRec: any
  let originalUA: string
  let originalSecure: boolean

  beforeEach(() => {
    instances = []
    originalSpeechRec = (window as any).SpeechRecognition
    originalWebkitSpeechRec = (window as any).webkitSpeechRecognition
    originalUA = navigator.userAgent
    originalSecure = window.isSecureContext

    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    })
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 Chrome/131.0.0.0 Safari/537.36',
    })

    class MockSpeechRecognition {
      lang = ''
      interimResults = false
      continuous = false
      onstart = null
      onresult = null
      onerror = null
      onend = null
      start = vi.fn()
      stop = vi.fn()
      abort = vi.fn()

      constructor() {
        instances.push(this)
      }
    }

    ;(window as any).SpeechRecognition = MockSpeechRecognition
  })

  afterEach(() => {
    ;(window as any).SpeechRecognition = originalSpeechRec
    ;(window as any).webkitSpeechRecognition = originalWebkitSpeechRec
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: originalUA,
    })
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: originalSecure,
    })
  })

  it('calls recognition.start() synchronously inside the gesture without any await', () => {
    const onStart = vi.fn()
    const handle = startRecognitionWithGesture({ onStart })

    expect(handle).not.toBeNull()
    expect(instances).toHaveLength(1)
    expect(instances[0].lang).toBe('en-IN')
    expect(instances[0].start).toHaveBeenCalledTimes(1)
  })

  it('falls back en-IN -> en-US -> en-GB on language-not-supported and suppresses intermediate onEnd', () => {
    const onError = vi.fn()
    const onEnd = vi.fn()
    const onFinal = vi.fn()

    startRecognitionWithGesture({ onError, onEnd, onFinal })
    expect(instances).toHaveLength(1)
    expect(instances[0].lang).toBe('en-IN')

    // First attempt fails with language-not-supported
    instances[0].onerror?.({ error: 'language-not-supported' })
    instances[0].onend?.()

    expect(instances).toHaveLength(2)
    expect(instances[1].lang).toBe('en-US')
    expect(instances[1].start).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()
    expect(onEnd).not.toHaveBeenCalled()

    // Second attempt fails with language-not-supported
    instances[1].onerror?.({ error: 'language-not-supported' })
    instances[1].onend?.()

    expect(instances).toHaveLength(3)
    expect(instances[2].lang).toBe('en-GB')
    expect(instances[2].start).toHaveBeenCalledTimes(1)
    expect(onError).not.toHaveBeenCalled()

    // Third attempt succeeds
    instances[2].onresult?.({
      results: [{ 0: { transcript: '  hello jarvis  ' }, isFinal: true }],
    })
    instances[2].onend?.()

    expect(onFinal).toHaveBeenCalledWith('hello jarvis')
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('reports language-not-supported error if all fallback languages fail', () => {
    const onError = vi.fn()
    startRecognitionWithGesture({ onError })

    instances[0].onerror?.({ error: 'language-not-supported' })
    instances[1].onerror?.({ error: 'language-not-supported' })
    instances[2].onerror?.({ error: 'language-not-supported' })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][1]).toBe('language-not-supported')
  })

  it('marks permission denied and shows actionable error on not-allowed', () => {
    const onError = vi.fn()
    const onPermissionChange = vi.fn()
    startRecognitionWithGesture({ onError, onPermissionChange })

    instances[0].onerror?.({ error: 'not-allowed' })

    expect(onPermissionChange).toHaveBeenCalledWith('denied')
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0]).toContain('Microphone blocked')
  })

  it('marks permission granted on start', () => {
    const onPermissionChange = vi.fn()
    const onStart = vi.fn()
    startRecognitionWithGesture({ onPermissionChange, onStart })

    instances[0].onstart?.()

    expect(onPermissionChange).toHaveBeenCalledWith('granted')
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('returns null and reports unsupported message when browser has no SpeechRecognition', () => {
    delete (window as any).SpeechRecognition
    delete (window as any).webkitSpeechRecognition

    const onError = vi.fn()
    const onPermissionChange = vi.fn()
    const handle = startRecognitionWithGesture({ onError, onPermissionChange })

    expect(handle).toBeNull()
    expect(onPermissionChange).toHaveBeenCalledWith('unsupported')
    expect(onError).toHaveBeenCalledWith(UNSUPPORTED_BROWSER_MESSAGE, 'no-api')
  })
})
