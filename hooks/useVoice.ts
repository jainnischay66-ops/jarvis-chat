'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getTTSManager, getAudioContext, type TTSOptions } from '@/lib/tts'
import {
  startRecognitionWithGesture,
  useMicStatus,
  type ManagedRecognitionHandle,
} from '@/lib/voice'

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
  const [isAudioBlocked, setIsAudioBlocked] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const recognitionHandleRef = useRef<ManagedRecognitionHandle | null>(null)

  const {
    voiceSupported,
    permissionState,
    statusLabel,
    unsupportedMessage,
    refreshPermission,
    markPermissionState,
  } = useMicStatus()

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
    ttsManager.setCallbacks(
      level => options?.onLevel?.(level),
      speaking => setIsSpeaking(speaking)
    )
  }, [options, ttsManager])

  const clearVoiceError = useCallback(() => {
    setVoiceError(null)
  }, [])

  // Start active speech recognition synchronously inside a user click/tap handler
  const startListening = useCallback(
    (onResult: (text: string) => void) => {
      if (typeof window === 'undefined') return

      // Cancel TTS immediately before starting recognition
      ttsManager.cancel()
      setVoiceError(null)

      if (recognitionHandleRef.current) {
        recognitionHandleRef.current.abort()
        recognitionHandleRef.current = null
      }

      const handle = startRecognitionWithGesture({
        interimResults: false,
        continuous: false,
        onPermissionChange: markPermissionState,
        onStart: () => setIsListening(true),
        onFinal: transcript => {
          onResult(transcript)
        },
        onError: message => {
          setIsListening(false)
          if (message) {
            setVoiceError(message)
          }
        },
        onEnd: () => {
          setIsListening(false)
          recognitionHandleRef.current = null
        },
      })

      recognitionHandleRef.current = handle
    },
    [markPermissionState, ttsManager]
  )

  const stopListening = useCallback(() => {
    if (recognitionHandleRef.current) {
      recognitionHandleRef.current.stop()
      recognitionHandleRef.current = null
    }
    setIsListening(false)
  }, [])

  useEffect(() => {
    return () => {
      recognitionHandleRef.current?.abort()
    }
  }, [])

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
    isSupported: voiceSupported,
    permissionState,
    statusLabel,
    unsupportedMessage,
    voiceError,
    clearVoiceError,
    refreshPermission,
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
