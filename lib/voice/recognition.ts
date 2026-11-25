import {
  detectVoiceSupport,
  getSpeechRecognitionConstructor,
  mapSpeechError,
  SPEECH_LANG_FALLBACKS,
  UNSUPPORTED_BROWSER_MESSAGE,
  type MicPermissionState,
} from './capabilities'

export interface ManagedRecognitionOptions {
  interimResults?: boolean
  continuous?: boolean
  onStart?: () => void
  onInterim?: (transcript: string) => void
  onFinal?: (transcript: string) => void
  onError?: (message: string | null, code: string) => void
  onEnd?: () => void
  onPermissionChange?: (state: MicPermissionState) => void
}

export interface ManagedRecognitionHandle {
  stop: () => void
  abort: () => void
}

/**
 * Starts Web Speech Recognition synchronously inside a user gesture handler
 * (no awaits before recognition.start()), with automatic language fallback
 * (en-IN -> en-US -> en-GB) on `language-not-supported`.
 */
export function startRecognitionWithGesture(
  options: ManagedRecognitionOptions
): ManagedRecognitionHandle | null {
  const support = detectVoiceSupport()
  if (!support.supported) {
    options.onError?.(UNSUPPORTED_BROWSER_MESSAGE, support.reason || 'unsupported')
    options.onPermissionChange?.('unsupported')
    return null
  }

  const SpeechRec = getSpeechRecognitionConstructor()
  if (!SpeechRec) {
    options.onError?.(UNSUPPORTED_BROWSER_MESSAGE, 'no-api')
    options.onPermissionChange?.('unsupported')
    return null
  }

  let currentRec: any = null
  let stopped = false

  const startAttempt = (langIdx: number) => {
    if (stopped) return

    try {
      if (currentRec) {
        try {
          currentRec.abort()
        } catch {}
      }

      const rec = new SpeechRec()
      rec.lang = SPEECH_LANG_FALLBACKS[langIdx]
      rec.interimResults = options.interimResults ?? false
      rec.continuous = options.continuous ?? false

      let handedOffToFallback = false

      rec.onstart = () => {
        options.onPermissionChange?.('granted')
        options.onStart?.()
      }

      rec.onresult = (event: any) => {
        let fullTranscript = ''
        let isFinal = false
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0]?.transcript || ''
          if (event.results[i].isFinal) {
            isFinal = true
          }
        }

        if (fullTranscript && options.interimResults) {
          options.onInterim?.(fullTranscript)
        }

        if (isFinal && fullTranscript.trim()) {
          options.onFinal?.(fullTranscript.trim())
        }
      }

      rec.onerror = (event: any) => {
        const code = String(event?.error || 'unknown')

        // Fallback chain: en-IN -> en-US -> en-GB on language-not-supported
        if (
          code === 'language-not-supported' &&
          langIdx + 1 < SPEECH_LANG_FALLBACKS.length
        ) {
          handedOffToFallback = true
          startAttempt(langIdx + 1)
          return
        }

        if (code === 'not-allowed' || code === 'service-not-allowed') {
          options.onPermissionChange?.('denied')
        }

        const friendlyMsg = mapSpeechError(code)
        options.onError?.(friendlyMsg, code)
      }

      rec.onend = () => {
        if (!handedOffToFallback) {
          options.onEnd?.()
        }
      }

      currentRec = rec
      // Synchronous start before any await preserves user activation
      rec.start()
    } catch (err: any) {
      const msg = err?.message || 'Could not start microphone.'
      options.onError?.(msg, err?.name || 'start-failed')
      options.onEnd?.()
    }
  }

  startAttempt(0)

  return {
    stop: () => {
      stopped = true
      try {
        currentRec?.stop()
      } catch {}
    },
    abort: () => {
      stopped = true
      try {
        currentRec?.abort()
      } catch {}
    },
  }
}
