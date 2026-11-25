'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getAudioContext, playActivationSound } from '@/lib/tts'
import { getRandomWakeLine } from '@/lib/wakeLines'
import { detectVoiceSupport } from '@/lib/voice/capabilities'

interface ActivationSequenceProps {
  onComplete: () => void
  speakGreeting: (text: string) => Promise<void>
}

interface TelemetryCheck {
  label: string
  status: 'pending' | 'ok' | 'warn'
  detail?: string
}

export function ActivationSequence({ onComplete, speakGreeting }: ActivationSequenceProps) {
  const [telemetry, setTelemetry] = useState<TelemetryCheck[]>([
    { label: 'VOICE LINK', status: 'pending' },
    { label: 'LANGUAGE MODEL', status: 'pending' },
    { label: 'STORAGE', status: 'pending' },
  ])
  const [wakeLine, setWakeLine] = useState('')
  const [reducedMotion, setReducedMotion] = useState(false)
  const isFinishedRef = useRef(false)

  // Track prefers-reduced-motion
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      setReducedMotion(mq.matches)
    }
  }, [])

  // Allow skipping via Escape key or click
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        finishSequence()
      }
    }

    const handleClick = () => {
      finishSequence()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('click', handleClick)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('click', handleClick)
    }
  }, [])

  const finishSequence = () => {
    if (isFinishedRef.current) return
    isFinishedRef.current = true
    onComplete()
  }

  useEffect(() => {
    let active = true

    const runSequence = async () => {
      // Pick time-of-day aware wake line
      try {
        sessionStorage.setItem('jarvis-boot-chime', 'true')
      } catch {}
      const greeting = getRandomWakeLine()
      setWakeLine(greeting)

      // 1. Web Audio ascending harmonic chimes + low reactor hum
      const ctx = getAudioContext()
      if (ctx) {
        playActivationSound(ctx, 0.8).catch(() => {})
      }

      // 2. Real Telemetry Diagnostics
      // Step A: Voice link check
      const voiceSupport = detectVoiceSupport()
      const hasSpeechSynth = typeof window !== 'undefined' && 'speechSynthesis' in window
      const voiceOk = voiceSupport.supported
      await new Promise(r => setTimeout(r, reducedMotion ? 50 : 350))
      if (!active) return
      setTelemetry(prev => [
        {
          label: 'VOICE LINK',
          status: voiceOk ? 'ok' : 'warn',
          detail: voiceOk ? 'OK' : hasSpeechSynth ? 'SYNTH ONLY' : 'UNSUPPORTED',
        },
        prev[1],
        prev[2],
      ])

      // Step B: Language model check (cheap ping to /api/chat)
      let modelOk = false
      let modelDetail = 'READY'
      try {
        const res = await fetch('/api/chat', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          modelOk = Boolean(data.configured ?? data.status?.configured ?? true)
          if (!modelOk) modelDetail = 'CHECK KEYS'
        } else {
          modelDetail = 'HTTP ' + res.status
        }
      } catch {
        modelDetail = 'UNREACHABLE'
      }

      await new Promise(r => setTimeout(r, reducedMotion ? 50 : 350))
      if (!active) return
      setTelemetry(prev => [
        prev[0],
        { label: 'LANGUAGE MODEL', status: modelOk ? 'ok' : 'warn', detail: modelDetail },
        prev[2],
      ])

      // Step C: Storage check (IndexedDB)
      let storageOk = false
      try {
        if (typeof window !== 'undefined' && 'indexedDB' in window) {
          storageOk = true
        }
      } catch {}

      await new Promise(r => setTimeout(r, reducedMotion ? 50 : 350))
      if (!active) return
      setTelemetry(prev => [
        prev[0],
        prev[1],
        { label: 'STORAGE', status: storageOk ? 'ok' : 'warn', detail: storageOk ? 'OK' : 'MEM ONLY' },
      ])

      // 3. Spoken wake line with personality
      speakGreeting(greeting).catch(() => {})

      // Stagger completion transition
      await new Promise(r => setTimeout(r, reducedMotion ? 100 : 800))
      if (active) {
        finishSequence()
      }
    }

    runSequence()

    return () => {
      active = false
    }
  }, [reducedMotion])

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col items-center justify-center p-6 select-none pointer-events-auto bg-black/40 backdrop-blur-[2px]"
      role="alert"
      aria-live="assertive"
    >
      {/* Vertical Scan Sweep (skipped if prefers-reduced-motion) */}
      {!reducedMotion && (
        <motion.div
          initial={{ top: '-10%' }}
          animate={{ top: '110%' }}
          transition={{ duration: 1.8, ease: 'linear' }}
          className="absolute inset-x-0 h-2 bg-gradient-to-b from-transparent via-[var(--cyan)] to-transparent opacity-30 pointer-events-none shadow-[0_0_20px_var(--cyan)]"
        />
      )}

      {/* Center Cinematic Ignition Card */}
      <motion.div
        initial={reducedMotion ? { opacity: 0 } : { scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reducedMotion ? 0.2 : 0.4 }}
        className="chamfer-card p-6 bg-[var(--surface-hi)] border border-[var(--cyan)] shadow-[0_0_30px_rgba(92,203,245,0.3)] max-w-md w-full text-center space-y-4 relative"
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
          <span className="font-hud text-xs tracking-widest text-[var(--cyan)] uppercase">
            SYSTEM BOOT INITIATED
          </span>
          <span className="font-mono text-[10px] text-[var(--text-3)]">
            ESC TO SKIP
          </span>
        </div>

        {/* Real Hardware Diagnostics */}
        <div className="space-y-1.5 text-left font-mono text-xs py-2 bg-[var(--surface)] p-3 border border-[var(--line)]">
          {telemetry.map(t => (
            <div key={t.label} className="flex items-center justify-between">
              <span className="text-[var(--text-2)]">{t.label} ................</span>
              <span
                className={`font-semibold tracking-wider ${
                  t.status === 'ok'
                    ? 'text-[var(--cyan)]'
                    : t.status === 'warn'
                    ? 'text-[var(--gold)]'
                    : 'text-[var(--text-3)] animate-pulse'
                }`}
              >
                {t.status === 'pending' ? 'TESTING...' : t.detail || 'OK'}
              </span>
            </div>
          ))}
        </div>

        {/* Wake Greeting Spoken by JARVIS */}
        {wakeLine && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-hud text-sm tracking-wider text-[var(--text)] italic pt-1"
          >
            "{wakeLine}"
          </motion.div>
        )}

        {/* Progress pulse bar */}
        <div className="w-full h-1 bg-[var(--surface)] overflow-hidden">
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: reducedMotion ? 0.3 : 2.2, ease: 'easeInOut' }}
            className="h-full bg-gradient-to-r from-[var(--cyan)] to-[var(--gold)]"
          />
        </div>
      </motion.div>
    </div>
  )
}
