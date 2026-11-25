'use client'

import React, { useState, useEffect } from 'react'
import { interpolate, clamp } from '@/lib/boot/timeline'
import { queryMicPermission, type MicStatusLabel } from '@/lib/voice/capabilities'

interface Act4DeployProps {
  time: number
  onPlayTick?: (pitch: number) => void
}

type TelemetryStatus = 'READY' | 'WARN' | 'FAIL' | MicStatusLabel

interface RealSystemCheck {
  id: string
  label: string
  status: TelemetryStatus
  detail?: string
}

export function Act4Deploy({ time }: Act4DeployProps) {
  // Real system checks — never default MIC INTERFACE to READY before querying permission
  const [checks, setChecks] = useState<RealSystemCheck[]>([
    { id: 'mic', label: 'MIC INTERFACE', status: 'TAP TO ALLOW' },
    { id: 'llm', label: 'NEURAL MODEL LINK', status: 'READY' },
    { id: 'idb', label: 'INDEXEDDB STORAGE', status: 'READY' },
    { id: 'tts', label: 'VOICE SYNTHESIS ENGINE', status: 'READY' },
  ])
  const [warningMessage, setWarningMessage] = useState<string | null>(null)

  // Run real checks once on mount
  useEffect(() => {
    let active = true

    async function performRealChecks() {
      let micStatus: MicStatusLabel = 'TAP TO ALLOW'
      try {
        const perm = await queryMicPermission()
        micStatus = perm.label
      } catch {
        micStatus = 'TAP TO ALLOW'
      }

      let llmStatus: 'READY' | 'WARN' | 'FAIL' = 'READY'
      let failDetail = ''
      try {
        const res = await fetch('/api/chat', { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          if (!data.configured && !data.status?.configured) {
            llmStatus = 'WARN'
            failDetail = 'API key missing in environment'
          }
        } else {
          llmStatus = 'FAIL'
          failDetail = `HTTP ${res.status} upstream error`
        }
      } catch {
        llmStatus = 'FAIL'
        failDetail = 'Server unreachable'
      }

      let storageStatus: 'READY' | 'WARN' = 'READY'
      try {
        if (typeof window === 'undefined' || !('indexedDB' in window)) {
          storageStatus = 'WARN'
        }
      } catch {
        storageStatus = 'WARN'
      }

      let ttsStatus: 'READY' | 'WARN' = 'READY'
      try {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
          ttsStatus = 'WARN'
        }
      } catch {
        ttsStatus = 'WARN'
      }

      if (active) {
        setChecks([
          { id: 'mic', label: 'MIC INTERFACE', status: micStatus },
          { id: 'llm', label: 'NEURAL MODEL LINK', status: llmStatus },
          { id: 'idb', label: 'INDEXEDDB STORAGE', status: storageStatus },
          { id: 'tts', label: 'VOICE SYNTHESIS ENGINE', status: ttsStatus },
        ])
        if (failDetail) {
          setWarningMessage(failDetail)
        }
      }
    }

    performRealChecks()
    return () => {
      active = false
    }
  }, [])

  // Active from 19.15s to 21.75s (fades out as title card reaches full opacity)
  if (time < 19.15 || time > 21.75) return null

  // Telemetry finishes fading out cleanly between 21.00s and 21.70s
  const act4Opacity = clamp(interpolate(time, 21.00, 21.70, 1.0, 0.0), 0, 1)

  // Wireframe staggered drawing (19.20s, 19.27s, 19.34s)
  const wire1 = clamp(interpolate(time, 19.20, 19.35, 0, 1), 0, 1)
  const wire2 = clamp(interpolate(time, 19.27, 19.42, 0, 1), 0, 1)
  const wire3 = clamp(interpolate(time, 19.34, 19.49, 0, 1), 0, 1)
  const glassFill = clamp(interpolate(time, 19.45, 19.80, 0, 1), 0, 1)

  return (
    <div
      className="absolute inset-0 z-20 pointer-events-none select-none"
      style={{ opacity: act4Opacity }}
    >
      {/* Ghost wireframe HUD layout outlines showing deployment */}
      <div className="absolute inset-x-6 top-8 bottom-28 border border-[var(--cyan-faint)] pointer-events-none opacity-15">
        <div
          className="h-14 border-b border-[var(--cyan-dim)] transition-all"
          style={{ opacity: wire1, background: glassFill > 0 ? 'rgba(8, 20, 32, 0.25)' : 'transparent' }}
        />
        <div className="flex h-full">
          <div
            className="w-64 border-r border-[var(--cyan-dim)] transition-all"
            style={{ opacity: wire2, background: glassFill > 0 ? 'rgba(8, 20, 32, 0.25)' : 'transparent' }}
          />
          <div className="flex-1 transition-all" style={{ opacity: wire3 }} />
        </div>
      </div>

      {/* Rule 7 Declutter: Compact Telemetry Column at Lower-Left edge */}
      <div className="absolute bottom-[calc(20px+env(safe-area-inset-bottom,0px))] left-6 z-25 max-w-[270px] sm:max-w-[310px] w-full space-y-1.5 opacity-80">
        <div className="font-hud text-[11px] sm:text-xs font-semibold tracking-[0.2em] text-[var(--cyan)] whitespace-nowrap drop-shadow-[0_0_8px_rgba(92,203,245,0.4)]">
          SYSTEM TELEMETRY
        </div>

        <div className="space-y-1 font-mono text-[10px] sm:text-[11px] w-full">
          {checks.map((chk, idx) => {
            const isVisible = time >= 19.6 + idx * 0.25
            if (!isVisible) return null

            const isFail = chk.status === 'FAIL' || chk.status === 'BLOCKED'
            const isWarn =
              chk.status === 'WARN' ||
              chk.status === 'TAP TO ALLOW' ||
              chk.status === 'UNSUPPORTED'
            const statusColor = isFail
              ? 'text-[var(--red)]'
              : isWarn
              ? 'text-[var(--gold)]'
              : 'text-[var(--cyan)]'

            return (
              <div key={chk.id} className="flex items-center gap-1.5 w-full whitespace-nowrap">
                <span className="text-[var(--text-3)] tracking-wider shrink-0 text-[10px]">
                  {chk.label}
                </span>
                <div className="flex-1 border-b border-dotted border-[var(--line)] opacity-40 h-2" />
                <span className={`font-semibold tracking-widest text-right min-w-[48px] shrink-0 text-[10px] ${statusColor}`}>
                  {chk.status}
                </span>
              </div>
            )
          })}
        </div>

        {warningMessage && (
          <div className="font-mono text-[10px] text-[var(--gold)] tracking-wide pt-0.5">
            ⚠ {warningMessage}
          </div>
        )}
      </div>
    </div>
  )
}
