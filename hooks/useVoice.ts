'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export function useVoice() {
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    const speechRecSupported =
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    const speechSynthSupported =
      typeof window !== 'undefined' && 'speechSynthesis' in window

    setIsSupported(Boolean(speechRecSupported || speechSynthSupported))
  }, [])

  const startListening = useCallback((onResult: (text: string) => void) => {
    if (typeof window === 'undefined') return

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRec) return

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }

      const recognition = new SpeechRec()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = navigator.language || 'en-US'

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
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }, [])

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()

    // Strip markdown formatting before reading aloud
    const plainText = text
      .replace(/```[\s\S]*?```/g, 'code block')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_#~]/g, '')
      .trim()

    if (!plainText) return

    const utterance = new SpeechSynthesisUtterance(plainText)
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }, [])

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }, [])

  return {
    isListening,
    isSpeaking,
    isSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  }
}
