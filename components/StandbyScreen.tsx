'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, Terminal, HelpCircle, AlertCircle } from 'lucide-react'
import { VoiceCommandsModal } from './VoiceCommandsModal'
import { interpretCommand, type MatchResult } from '@/lib/commands'
import { getRandomStandbyQuip } from '@/lib/wakeLines'
import { preloadBootTheme } from '@/lib/boot/audio'
import { getAudioContext } from '@/lib/tts'
import { setTTSPowerState } from '@/lib/tts/tts-manager'
import {
  startRecognitionWithGesture,
  useMicStatus,
  type ManagedRecognitionHandle,
} from '@/lib/voice'

interface StandbyScreenProps {
  onWake: () => void
  onQuip?: (text: string) => void
  speakText?: (text: string) => Promise<void>
  onMicLevel?: (level: number) => void
}

export function StandbyScreen({
  onWake,
  onQuip,
  speakText,
  onMicLevel,
}: StandbyScreenProps) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [typedInput, setTypedInput] = useState('')
  const [isCommandsOpen, setIsCommandsOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [standbyHint, setStandbyHint] = useState<string | null>(null)
  const [clock, setClock] = useState('00:00:00')

  const {
    voiceSupported,
    permissionState,
    statusLabel,
    unsupportedMessage,
    markPermissionState,
  } = useMicStatus()

  const recognitionHandleRef = useRef<ManagedRecognitionHandle | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastQuipTimeRef = useRef<number>(0)
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
    isMountedRef.current = true

    // Preload the boot theme while in STANDBY (after AudioContext is ready)
    // so there's zero fetch/decode delay when wake is accepted.
    const ctx = getAudioContext()
    if (ctx) {
      preloadBootTheme(ctx).catch(() => {})
    }

    return () => {
      isMountedRef.current = false
      if (recognitionHandleRef.current) {
        recognitionHandleRef.current.abort()
        recognitionHandleRef.current = null
      }
      onMicLevel?.(0)
    }
  }, [onMicLevel])

  // Subtle ambient mic activity indicator while SpeechRecognition owns the mic
  useEffect(() => {
    if (!isListening) {
      onMicLevel?.(0)
      return
    }
    let rafId = 0
    const start = performance.now()
    const tick = (now: number) => {
      if (!isMountedRef.current) return
      const elapsed = (now - start) / 1000
      const level = 0.2 + 0.15 * Math.sin(elapsed * 5.2)
      onMicLevel?.(level)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafId)
      onMicLevel?.(0)
    }
  }, [isListening, onMicLevel])

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

        // 2. Stop speech recognition so the audio subsystem releases the mic
        if (recognitionHandleRef.current) {
          recognitionHandleRef.current.abort()
          recognitionHandleRef.current = null
        }

        // 3. Timestamp for latency measurement (dev only)
        if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
          ;(window as any).__WAKE_ACCEPTED_TIME__ = performance.now()
        }

        // 4. Hand off to parent — BootFilm will start music immediately after
        onWake()
      } else {
        triggerStandbyQuip()
      }
    },
    [onWake, triggerStandbyQuip]
  )

  // Start speech recognition synchronously inside the mic click/tap handler
  // before any await, so user activation is preserved and permission prompts appear.
  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return

    setErrorMessage(null)
    setStandbyHint(null)
    setTranscript('')

    if (recognitionHandleRef.current) {
      recognitionHandleRef.current.abort()
      recognitionHandleRef.current = null
    }

    const handle = startRecognitionWithGesture({
      interimResults: true,
      continuous: false,
      onPermissionChange: markPermissionState,
      onStart: () => {
        setIsListening(true)
      },
      onInterim: currentText => {
        setTranscript(currentText)
      },
      onFinal: finalText => {
        setTranscript(finalText)
        processTranscript(finalText)
      },
      onError: message => {
        setIsListening(false)
        if (message) {
          setErrorMessage(message)
        }
      },
      onEnd: () => {
        setIsListening(false)
        recognitionHandleRef.current = null
      },
    })

    recognitionHandleRef.current = handle
  }, [markPermissionState, processTranscript])

  const stopListening = useCallback(() => {
    if (recognitionHandleRef.current) {
      recognitionHandleRef.current.stop()
      recognitionHandleRef.current = null
    }
    setIsListening(false)
  }, [])

  const handleTypedSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!typedInput.trim()) return
    processTranscript(typedInput.trim())
    setTypedInput('')
  }

  const statusColorClass =
    permissionState === 'granted'
      ? 'text-[var(--cyan)] border-[var(--cyan-dim)]'
      : permissionState === 'denied'
        ? 'text-[var(--red)] border-[var(--red)]'
        : 'text-[var(--gold)] border-[var(--gold)]'

  return (
    <div
      className="fixed inset-0 w-full h-[100dvh] z-20 pointer-events-auto select-none overflow-hidden flex flex-col justify-between"
      role="region"
      aria-label="JARVIS Standby Mode"
    >
      {/* 1. TOP HEADER */}
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

      {/* 2. LOWER THIRD ACTIVATION PANEL */}
      <main className="w-full max-w-xl mx-auto px-4 pb-[calc(7vh+env(safe-area-inset-bottom,0px))] flex flex-col items-center text-center space-y-4 z-30">
        <div
          className="w-full rounded-2xl p-6 sm:p-8 flex flex-col items-center space-y-3"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(2, 4, 10, 0.88) 0%, rgba(2, 4, 10, 0.5) 65%, transparent 100%)',
          }}
        >
          <div className="font-mono text-xs text-[var(--text-3)] tracking-[0.25em] uppercase opacity-60">
            AWAITING ACTIVATION
          </div>

          <div className="w-full">
            <h1 className="font-hud text-[clamp(28px,4.2vw,56px)] font-bold tracking-[0.12em] text-[var(--cyan)] drop-shadow-[0_0_16px_rgba(92,203,245,0.45)] leading-tight">
              <span className="hidden md:inline whitespace-nowrap">SAY: "WAKE UP, JARVIS"</span>
              <span className="md:hidden flex flex-col items-center leading-none">
                <span className="text-sm tracking-widest text-[var(--text-3)] font-mono">SAY:</span>
                <span className="text-2xl font-bold tracking-wider mt-1">"WAKE UP, JARVIS"</span>
              </span>
            </h1>
          </div>

          <p className="font-mono text-sm text-[var(--text-2)] tracking-wider">
            {voiceSupported
              ? 'or press Space / tap the mic / type it'
              : 'press Space or type a command below'}
          </p>

          {/* Mic button (hidden when unsupported) + Honest Status */}
          {voiceSupported ? (
            <div className="flex flex-col items-center gap-2 pt-2">
              <div className="relative flex items-center justify-center">
                <button
                  type="button"
                  data-testid="standby-mic-button"
                  onClick={isListening ? stopListening : startListening}
                  aria-label={isListening ? 'Stop listening' : `Start listening (${statusLabel})`}
                  className={`w-16 h-16 rounded-full flex items-center justify-center border transition-all cursor-pointer relative z-10 ${
                    isListening
                      ? 'border-[var(--cyan)] bg-[var(--cyan-faint)] text-[var(--cyan)] shadow-[0_0_24px_var(--cyan)] animate-pulse scale-105'
                      : permissionState === 'denied'
                        ? 'border-[var(--red)] bg-[var(--surface-hi)] text-[var(--red)] hover:scale-105 active:scale-95'
                        : 'border-[var(--line)] bg-[var(--surface-hi)] text-[var(--text-2)] hover:text-[var(--cyan)] hover:border-[var(--cyan)] hover:scale-105 active:scale-95'
                  }`}
                >
                  <Mic size={24} strokeWidth={1.5} />
                </button>

                {isListening && (
                  <div className="absolute inset-0 rounded-full border border-[var(--cyan)] animate-ping pointer-events-none opacity-40" />
                )}
              </div>

              <span
                data-testid="standby-mic-status"
                className={`font-mono text-[10px] tracking-[0.2em] uppercase px-2 py-0.5 border bg-[var(--surface-hi)] ${statusColorClass}`}
              >
                {isListening ? 'LISTENING' : `MIC: ${statusLabel}`}
              </span>
            </div>
          ) : (
            <div
              data-testid="standby-voice-unsupported"
              className="flex flex-col items-center gap-1.5 pt-1"
            >
              <span
                data-testid="standby-mic-status"
                className="font-mono text-[10px] tracking-[0.2em] uppercase px-2 py-0.5 border border-[var(--gold)] text-[var(--gold)] bg-[var(--surface-hi)]"
              >
                MIC: UNSUPPORTED
              </span>
              <p className="font-mono text-xs text-[var(--text-2)]">
                {unsupportedMessage}
              </p>
            </div>
          )}

          {/* Live speech feedback */}
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
            <div
              role="alert"
              data-testid="standby-voice-error"
              className="flex items-center gap-2 font-mono text-xs text-[var(--red)] bg-[var(--surface-hi)] px-3 py-2 border border-[var(--red)] max-w-md text-left"
            >
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Centered Typed Command Input (always visible) */}
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

      {/* 3. BOTTOM TELEMETRY ROW */}
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
