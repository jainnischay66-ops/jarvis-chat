'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getTTSManager, getAudioContext, type TTSOptions } from '@/lib/tts'

export interface UseVoiceOptions {
  autoSpeak?: boolean
  voiceEnabled?: boolean
  voiceProvider?: 'browser' | 'cloud'
  voiceId?: string
  voiceRate?: number
  voicePitch?: number
  voiceVolume?: number
  voiceHolographicEffect?: boolean
  wakeWordEnabled?: boolean
  onWakeWord?: () => void
  onLevel?: (level: number) => void
}

export function useVoice(options?: UseVoiceOptions) {
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [isAudioBlocked, setIsAudioBlocked] = useState(false)
  const recognitionRef = useRef<any>(null)
  const wakeWordRecognitionRef = useRef<any>(null)

  const ttsManager = useRef(getTTSManager()).current

  const unlockAudio = useCallback(async () => {
    try {
      const ctx = getAudioContext()
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume()
      }
      setIsAudioBlocked(false)
    } catch {
      setIsAudioBlocked(true)
    }
  }, [])

  useEffect(() => {
    const speechRecSupported =
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    const speechSynthSupported =
      typeof window !== 'undefined' && 'speechSynthesis' in window

    setIsSupported(Boolean(speechRecSupported || speechSynthSupported))

    ttsManager.setCallbacks(
      level => options?.onLevel?.(level),
      speaking => setIsSpeaking(speaking)
    )
  }, [options, ttsManager])

  // Start active speech recognition for user prompt
  const startListening = useCallback(
    (onResult: (text: string) => void) => {
      if (typeof window === 'undefined') return

      // Stop speech playback immediately when user speaks or engages mic
      ttsManager.cancel()

      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!SpeechRec) return

      try {
        if (recognitionRef.current) {
          recognitionRef.current.abort()
        }

        const recognition = new SpeechRec()
        recognition.continuous = false
        recognition.interimResults = false
        recognition.lang = 'en-US'

        recognition.onstart = () => setIsListening(true)
        recognition.onend = () => setIsListening(false)
        recognition.onerror = () => setIsListening(false)

        recognition.onresult = (event: any) => {
          const transcript = event.results?.[0]?.[0]?.transcript
          if (transcript) {
            onResult(transcript)
          }
        }

        recognitionRef.current = recognition
        recognition.start()
      } catch {
        setIsListening(false)
      }
    },
    [ttsManager]
  )

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }, [])

  // Passive Wake Word listener ("Hey Jarvis" or "Jarvis")
  useEffect(() => {
    if (typeof window === 'undefined' || !options?.wakeWordEnabled) {
      if (wakeWordRecognitionRef.current) {
        wakeWordRecognitionRef.current.abort()
        wakeWordRecognitionRef.current = null
      }
      return
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRec) return

    let active = true
    const startWakeWord = () => {
      if (!active) return
      try {
        const wakeRec = new SpeechRec()
        wakeRec.continuous = true
        wakeRec.interimResults = true
        wakeRec.lang = 'en-US'

        wakeRec.onresult = (event: any) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript.toLowerCase()
            if (transcript.includes('hey jarvis') || transcript.includes('jarvis')) {
              wakeRec.abort()
              options?.onWakeWord?.()
              break
            }
          }
        }

        wakeRec.onend = () => {
          if (active && options?.wakeWordEnabled && !isListening) {
            setTimeout(startWakeWord, 500)
          }
        }

        wakeWordRecognitionRef.current = wakeRec
        wakeRec.start()
      } catch {}
    }

    startWakeWord()

    return () => {
      active = false
      if (wakeWordRecognitionRef.current) {
        wakeWordRecognitionRef.current.abort()
        wakeWordRecognitionRef.current = null
      }
    }
  }, [options?.wakeWordEnabled, options?.onWakeWord, isListening])

  const speak = useCallback(
    async (text: string) => {
      if (options?.voiceEnabled === false) return

      const ttsOptions: TTSOptions = {
        voice: options?.voiceId,
        rate: options?.voiceRate ?? 0.98,
        pitch: options?.voicePitch ?? 0.85,
        volume: options?.voiceVolume ?? 1.0,
        holographicEffect: options?.voiceHolographicEffect ?? false,
      }

      try {
        await ttsManager.speakText(text, ttsOptions, options?.voiceProvider || 'cloud')
      } catch {
        const ctx = getAudioContext()
        if (ctx && ctx.state === 'suspended') {
          setIsAudioBlocked(true)
        }
      }
    },
    [options, ttsManager]
  )

  const enqueueStreamChunk = useCallback(
    (chunk: string) => {
      if (options?.voiceEnabled === false || options?.autoSpeak === false) return

      const ttsOptions: TTSOptions = {
        voice: options?.voiceId,
        rate: options?.voiceRate ?? 0.98,
        pitch: options?.voicePitch ?? 0.85,
        volume: options?.voiceVolume ?? 1.0,
        holographicEffect: options?.voiceHolographicEffect ?? false,
      }

      ttsManager.enqueueStreamChunk(chunk, ttsOptions, options?.voiceProvider || 'cloud')
    },
    [options, ttsManager]
  )

  const flushStream = useCallback(() => {
    if (options?.voiceEnabled === false || options?.autoSpeak === false) return

    const ttsOptions: TTSOptions = {
      voice: options?.voiceId,
      rate: options?.voiceRate ?? 0.98,
      pitch: options?.voicePitch ?? 0.85,
      volume: options?.voiceVolume ?? 1.0,
      holographicEffect: options?.voiceHolographicEffect ?? false,
    }

    ttsManager.flushStream(ttsOptions, options?.voiceProvider || 'cloud')
  }, [options, ttsManager])

  const stopSpeaking = useCallback(() => {
    ttsManager.cancel()
    setIsSpeaking(false)
  }, [ttsManager])

  return {
    isListening,
    isSpeaking,
    isSupported,
    isAudioBlocked,
    unlockAudio,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    enqueueStreamChunk,
    flushStream,
    ttsManager,
  }
}
