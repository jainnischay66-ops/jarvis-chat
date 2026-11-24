'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Terminal, HelpCircle, AlertCircle } from 'lucide-react'
import { VoiceCommandsModal } from './VoiceCommandsModal'
import { interpretCommand, type MatchResult } from '@/lib/commands'
import { getRandomStandbyQuip } from '@/lib/wakeLines'
import { recordMicRms, clearMicRms } from '@/lib/boot/waveform'
import { preloadBootTheme } from '@/lib/boot/audio'
import { getAudioContext } from '@/lib/tts'
import { setTTSPowerState } from '@/lib/tts/tts-manager'

interface StandbyScreenProps {
  onWake: () => void
  onQuip?: (text: string) => void
  speakText?: (text: string) => Promise<void>
  autoListen?: boolean
  onMicLevel?: (level: number) => void
}

export function StandbyScreen({
  onWake,
  onQuip,
  speakText,
  autoListen = false,
  onMicLevel,
}: StandbyScreenProps) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [typedInput, setTypedInput] = useState('')
  const [isCommandsOpen, setIsCommandsOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [standbyHint, setStandbyHint] = useState<string | null>(null)
  const [speechSupported, setSpeechSupported] = useState(true)
  const [clock, setClock] = useState('00:00:00')

  const recognitionRef = useRef<any>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastQuipTimeRef = useRef<number>(0)
  const autoListenRef = useRef(autoListen)
  const isMountedRef = useRef(true)

  // Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const pad = (n: number) => n.toString().padStart(2, '0')
      setClock(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`)
    }
    updateTime()
    const t = setInterval(updateTime, 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    autoListenRef.current = autoListen
  }, [autoListen])

  useEffect(() => {
    isMountedRef.current = true

    // Preload the boot theme while in STANDBY (after AudioContext is ready)
    // so there's zero fetch/decode delay when wake is accepted.
    const ctx = getAudioContext()
    if (ctx) {
      preloadBootTheme(ctx).catch(() => {})
    }

    return () => {
      isMountedRef.current = false
      stopAudioAnalysis()
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {}
      }
    }
  }, [])

  // Check speech recognition support
  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    setSpeechSupported(Boolean(supported))
  }, [])

  // Handle keyboard shortcut: Space or Enter focuses typed input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCommandsOpen) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.code === 'Space' || e.key === 'Enter') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isCommandsOpen])

  // Real-time Mic RMS monitoring using Web Audio Analyser
  const startAudioAnalysis = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      micStreamRef.current = stream

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      const ctx = new AudioCtx()
      audioContextRef.current = ctx

      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      const trackLevel = () => {
        if (!isMountedRef.current || !analyserRef.current) return
        analyserRef.current.getByteTimeDomainData(dataArray)

        let sumSquares = 0
        for (let i = 0; i < dataArray.length; i++) {
          const norm = (dataArray[i] - 128) / 128
          sumSquares += norm * norm
        }
        const rms = Math.min(1.0, Math.sqrt(sumSquares / dataArray.length) * 3.5)

        recordMicRms(rms)
        onMicLevel?.(rms)

        animFrameRef.current = requestAnimationFrame(trackLevel)
      }

      animFrameRef.current = requestAnimationFrame(trackLevel)
    } catch {
      // Permission denied or audio stream unavailable - fall back to synthetic
    }
  }

  const stopAudioAnalysis = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop())
      micStreamRef.current = null
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close()
      } catch {}
      audioContextRef.current = null
    }
    onMicLevel?.(0)
  }

  const triggerStandbyQuip = useCallback(async () => {
    const now = Date.now()
    setStandbyHint("Say 'Wake up, JARVIS' to begin")

    if (now - lastQuipTimeRef.current >= 60000) {
      lastQuipTimeRef.current = now
      const quip = getRandomStandbyQuip()
      onQuip?.(quip)
      if (speakText) {
        speakText(quip).catch(() => {})
      }
    }
  }, [onQuip, speakText])

  const processTranscript = useCallback(
    async (text: string) => {
      setErrorMessage(null)
      setStandbyHint(null)

      const result: MatchResult = await interpretCommand(text, { allowLayer2: true })

      if (result.intent === 'WAKE') {
        // ── Wake accepted: silence everything before transitioning ──────────
        // 1. Cancel any in-flight TTS immediately (rate-limited quips, etc.)
        setTTSPowerState('BOOTING')
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel()
        }

        // 2. Stop speech recognition so echo-cancellation AGC releases the mic
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort()
          } catch {}
          recognitionRef.current = null
        }

        // 3. Stop every getUserMedia track — open mic causes browser to duck
        //    AudioContext playback via echo-cancellation on macOS/WebKit/Blink.
        stopAudioAnalysis()

        // 4. Timestamp for latency measurement (dev only)
        if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
          ;(window as any).__WAKE_ACCEPTED_TIME__ = performance.now()
        }

        // 5. Hand off to parent — BootFilm will start music immediately after
        onWake()
      } else {
        triggerStandbyQuip()
      }
    },
    [onWake, triggerStandbyQuip]
  )

  // Start speech recognition
  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRec) {
      setErrorMessage('Speech recognition is not supported in this browser. Please type command below.')
      return
    }

    setErrorMessage(null)
    setTranscript('')
    startAudioAnalysis()

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }

      const rec = new SpeechRec()
      rec.lang = 'en-IN'
      rec.interimResults = true
      rec.continuous = false

      rec.onstart = () => {
        setIsListening(true)
      }

      rec.onresult = (event: any) => {
        let currentText = ''
        for (let i = 0; i < event.results.length; i++) {
          currentText += event.results[i][0].transcript
        }
        setTranscript(currentText)

        if (event.results[0].isFinal) {
          processTranscript(currentText)
        }
      }

      rec.onerror = (event: any) => {
        setIsListening(false)
        stopAudioAnalysis()
        if (event.error === 'not-allowed') {
          setErrorMessage('Microphone access denied — please allow mic permissions or type command below.')
        } else if (event.error === 'no-speech') {
          setErrorMessage('No speech detected. Try again or type the command.')
        } else if (event.error === 'network') {
          setErrorMessage('Network error connecting to speech recognition service.')
        } else {
          setErrorMessage(`Speech recognition error: ${event.error}`)
        }
      }

      rec.onend = () => {
        setIsListening(false)
        stopAudioAnalysis()
        if (autoListenRef.current && isMountedRef.current) {
          setTimeout(() => {
            if (autoListenRef.current && isMountedRef.current) {
              startListening()
            }
          }, 600)
        }
      }

      recognitionRef.current = rec
      rec.start()
    } catch (err: any) {
      setIsListening(false)
      stopAudioAnalysis()
      setErrorMessage(err?.message || 'Could not start microphone.')
    }
  }, [processTranscript])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
      stopAudioAnalysis()
    }
  }, [])

  // Auto-listen if preference is active
  useEffect(() => {
    if (autoListen && speechSupported) {
      startListening()
    }
  }, [autoListen, speechSupported, startListening])

  const handleTypedSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!typedInput.trim()) return
    processTranscript(typedInput.trim())
    setTypedInput('')
  }

  return (
    <div
      className="fixed inset-0 w-full h-[100dvh] z-20 pointer-events-auto select-none overflow-hidden flex flex-col justify-between"
      role="region"
      aria-label="JARVIS Standby Mode"
    >
      {/* 1. TOP HEADER: Status top-left (nowrap), Voice commands top-right, safe-area padding */}
      <header className="w-full flex items-center justify-between px-6 pt-[calc(14px+env(safe-area-inset-top,0px))] z-30">
        <div className="flex items-center gap-2 font-hud text-xs tracking-[0.2em] whitespace-nowrap text-[var(--gold)]">
          <span className="w-2 h-2 rounded-full bg-[var(--gold)] animate-pulse shrink-0" />
          <span className="hidden sm:inline">STANDBY PROTOCOL ENGAGED</span>
          <span className="sm:hidden">STANDBY</span>
        </div>

        <button
          onClick={() => setIsCommandsOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--line)] bg-[var(--surface-hi)] text-[var(--text-2)] hover:text-[var(--cyan)] hover:border-[var(--cyan)] text-xs font-hud tracking-wider whitespace-nowrap transition-colors cursor-pointer"
        >
          <HelpCircle size={14} className="shrink-0" />
          <span className="hidden sm:inline">VOICE COMMANDS</span>
          <span className="sm:hidden">COMMANDS</span>
        </button>
      </header>

      {/* 2. LOWER THIRD ACTIVATION PANEL: Center-aligned, completely below the orb core, with soft radial scrim */}
      <main className="w-full max-w-xl mx-auto px-4 pb-[calc(7vh+env(safe-area-inset-bottom,0px))] flex flex-col items-center text-center space-y-4 z-30">
        {/* Soft radial scrim behind text block only */}
        <div
          className="w-full rounded-2xl p-6 sm:p-8 flex flex-col items-center space-y-3"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(2, 4, 10, 0.88) 0%, rgba(2, 4, 10, 0.5) 65%, transparent 100%)',
          }}
        >
          {/* Eyebrow in Mono, 62% opacity */}
          <div className="font-mono text-xs text-[var(--text-3)] tracking-[0.25em] uppercase opacity-60">
            AWAITING ACTIVATION
          </div>

          {/* Large Rajdhani Wake Command Line: clamp(28px, 4.2vw, 64px) */}
          <div className="w-full">
            <h1 className="font-hud text-[clamp(28px,4.2vw,56px)] font-bold tracking-[0.12em] text-[var(--cyan)] drop-shadow-[0_0_16px_rgba(92,203,245,0.45)] leading-tight">
              <span className="hidden md:inline whitespace-nowrap">SAY: "WAKE UP, JARVIS"</span>
              <span className="md:hidden flex flex-col items-center leading-none">
                <span className="text-sm tracking-widest text-[var(--text-3)] font-mono">SAY:</span>
                <span className="text-2xl font-bold tracking-wider mt-1">"WAKE UP, JARVIS"</span>
              </span>
            </h1>
          </div>

          {/* Hint Line in Mono 14px with AA contrast */}
          <p className="font-mono text-sm text-[var(--text-2)] tracking-wider">
            or press Space / tap the mic / type it
          </p>

          {/* Pulsing Mic Button (>= 56px touch target) */}
          <div className="relative flex items-center justify-center pt-2">
            <button
              onClick={isListening ? stopListening : startListening}
              aria-label={isListening ? 'Stop listening' : 'Start listening for activation'}
              className={`w-16 h-16 rounded-full flex items-center justify-center border transition-all cursor-pointer relative z-10 ${
                isListening
                  ? 'border-[var(--cyan)] bg-[var(--cyan-faint)] text-[var(--cyan)] shadow-[0_0_24px_var(--cyan)] animate-pulse scale-105'
                  : 'border-[var(--line)] bg-[var(--surface-hi)] text-[var(--text-2)] hover:text-[var(--cyan)] hover:border-[var(--cyan)] hover:scale-105 active:scale-95'
              }`}
            >
              <Mic size={24} strokeWidth={1.5} />
            </button>

            {isListening && (
              <div className="absolute inset-0 rounded-full border border-[var(--cyan)] animate-ping pointer-events-none opacity-40" />
            )}
          </div>

          {/* Live speech feedback if hearing */}
          {transcript && (
            <div className="font-mono text-xs text-[var(--cyan)] bg-[var(--surface-hi)] px-3 py-1 border border-[var(--cyan-dim)] max-w-full truncate">
              HEARD: "{transcript}"
            </div>
          )}

          {/* Standby hint */}
          {standbyHint && (
            <div className="font-hud text-xs text-[var(--gold)] tracking-wider bg-[var(--surface-hi)] px-3 py-1.5 border border-[var(--gold)]">
              {standbyHint}
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="flex items-center gap-1.5 font-mono text-xs text-[var(--red)] bg-[var(--surface-hi)] px-3 py-1.5 border border-[var(--red)] max-w-md">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Centered Typed Command Input (max-width 520px, SEND inside plate) */}
          <form onSubmit={handleTypedSubmit} className="w-full max-w-[520px] pt-2">
            <div className="flex items-center border border-[var(--line)] bg-[var(--surface-hi)] focus-within:border-[var(--cyan)] shadow-[0_0_12px_rgba(2,4,10,0.6)] px-3 py-1.5 transition-colors">
              <Terminal size={14} className="text-[var(--cyan)] mr-2 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={typedInput}
                onChange={e => setTypedInput(e.target.value)}
                placeholder='Type "Wake up, JARVIS"...'
                className="w-full bg-transparent font-mono text-xs text-[var(--text)] placeholder-[var(--text-3)] outline-none"
              />
              <button
                type="submit"
                className="font-hud text-xs font-semibold tracking-wider text-[var(--cyan)] hover:brightness-125 px-2 py-0.5 ml-1 border border-[var(--cyan-faint)] bg-[var(--cyan-faint)] active:scale-95 transition-all cursor-pointer"
              >
                SEND
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* 3. BOTTOM TELEMETRY ROW: ONE row in two groups, nowrap with ellipsis, padded for safe area */}
      <footer className="w-full px-6 pb-[calc(12px+env(safe-area-inset-bottom,0px))] flex items-center justify-between font-mono text-[11px] text-[var(--text-3)] whitespace-nowrap overflow-hidden z-30">
        <div className="flex items-center gap-2 truncate">
          <span>REACTOR: DORMANT (0.02 Hz)</span>
          <span className="hidden sm:inline opacity-40">·</span>
          <span className="hidden sm:inline">PASSIVE SENSORS ONLINE</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline">HUD v7.4</span>
          <span className="hidden sm:inline opacity-40">·</span>
          <span>{clock}</span>
          <span className="opacity-40">·</span>
          <span className="text-[var(--cyan)]">SYS: NOMINAL</span>
        </div>
      </footer>

      {/* Voice Commands Modal */}
      <VoiceCommandsModal
        isOpen={isCommandsOpen}
        onClose={() => setIsCommandsOpen(false)}
        onSelectCommand={phrase => processTranscript(phrase)}
      />
    </div>
  )
}
