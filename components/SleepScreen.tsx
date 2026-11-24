'use client'

import React from 'react'

interface SleepScreenProps {
  sleepLine?: string
}

export function SleepScreen({ sleepLine }: SleepScreenProps) {
  return (
    <div
      className="fixed inset-0 w-full h-[100dvh] z-25 pointer-events-none select-none flex flex-col items-center justify-end pb-[calc(14vh+env(safe-area-inset-bottom,0px))] px-6 transition-opacity duration-1000"
      role="alert"
      aria-live="assertive"
    >
      {/* Centered Caption for Power-Down Line */}
      {sleepLine && (
        <div className="max-w-[60ch] text-center font-hud italic text-lg sm:text-xl text-[var(--gold)] tracking-wider drop-shadow-[0_0_12px_rgba(242,184,75,0.4)] animate-pulse">
          "{sleepLine}"
        </div>
      )}

      {/* Power Down Eyebrow */}
      <div className="font-mono text-xs text-[var(--text-3)] tracking-[0.25em] uppercase pt-2">
        DEACTIVATING SYSTEMS · RETURNING TO STANDBY
      </div>
    </div>
  )
}
