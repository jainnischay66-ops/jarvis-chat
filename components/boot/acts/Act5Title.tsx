'use client'

import React from 'react'
import { interpolate, clamp } from '@/lib/boot/timeline'

interface Act5TitleProps {
  time: number
  wakeLine: string
}

export function Act5Title({ time, wakeLine }: Act5TitleProps) {
  // Active between 21.00s and 23.50s
  if (time < 21.00) return null

  // Title kerning & flicker: 21.00s to 21.75s
  const titleProgress = clamp(interpolate(time, 21.00, 21.75, 0.0, 1.0), 0, 1)
  const letterSpacingEm = interpolate(time, 21.00, 21.80, 0.35, 0.16)
  const titleFadeOut = interpolate(time, 22.80, 23.45, 1.0, 0.0)

  // Gold scanline sweep: sweeps across from left to right at 21.20s to 21.85s
  const scanSweep = interpolate(time, 21.20, 21.85, -10, 110)

  // Subtitle fade in: 21.25s to 21.75s
  const subOpacity = clamp(interpolate(time, 21.25, 21.75, 0.0, 1.0), 0, 1) * titleFadeOut

  // Wake-line caption fade in: 21.50s to 21.90s
  const captionOpacity = clamp(interpolate(time, 21.50, 21.90, 0.0, 1.0), 0, 1) * titleFadeOut

  return (
    <div
      className="absolute inset-0 z-30 pointer-events-none select-none overflow-hidden"
      style={{ opacity: titleFadeOut }}
    >
      {/* Rule 3: Soft radial scrim in bg color (0 to 75% opacity) behind the whole text block */}
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          top: '64%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(94vw, 780px)',
          height: 'min(55vh, 360px)',
          background:
            'radial-gradient(ellipse at center, rgba(2, 4, 10, 0.88) 0%, rgba(2, 4, 10, 0.72) 55%, transparent 100%)',
          zIndex: 1,
        }}
      />

      {/* Rule 2: Title layout under the orb, title centered at about 59-60% viewport height, min 16px between blocks */}
      <div className="absolute top-[59%] sm:top-[60%] left-1/2 -translate-x-1/2 -translate-y-[24px] flex flex-col items-center text-center w-full max-w-2xl px-4 space-y-4 z-10">
        {/* Block 1: J.A.R.V.I.S. in Orbitron, cyan color, dark text-shadow for AA contrast */}
        <div className="relative inline-block" data-testid="boot-title-wrapper">
          <h1
            data-testid="boot-title"
            className="font-title text-4xl sm:text-6xl font-bold text-[var(--cyan)] select-none transition-all"
            style={{
              letterSpacing: `${letterSpacingEm}em`,
              opacity: titleProgress,
              textShadow: '0 2px 14px rgba(0,0,0,0.95), 0 0 24px rgba(92,203,245,0.45)',
            }}
          >
            J.A.R.V.I.S.
          </h1>

          {/* Gold Scanline Sweep under the title */}
          <div
            className="absolute -bottom-1 h-[1.5px] bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent pointer-events-none"
            style={{
              left: `${scanSweep - 20}%`,
              width: '40%',
              opacity: time >= 21.20 && time <= 21.90 ? 1 : 0,
              boxShadow: '0 0 10px var(--gold)',
            }}
          />
        </div>

        {/* Block 2: Subtitle: at least 16px gap (space-y-4), uses --text (not gold) with gold accents */}
        <div
          data-testid="boot-subtitle"
          className="flex flex-col items-center gap-1.5 pt-1"
          style={{ opacity: subOpacity }}
        >
          <div
            className="font-hud text-xs sm:text-sm font-semibold text-[var(--text)] tracking-[0.25em]"
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.95)' }}
          >
            <span className="text-[var(--gold)] mr-2 tracking-normal">▸</span>
            WELCOME BACK, NISCHAY
            <span className="text-[var(--gold)] ml-2 tracking-normal">◂</span>
          </div>
          <div className="w-16 h-[1.5px] bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent opacity-75" />
        </div>

        {/* Block 3: Wake-line caption: at least 16px gap, centered, max-width 60ch, italic, --text-2 */}
        {wakeLine && (
          <div
            data-testid="boot-caption"
            className="max-w-[60ch] font-hud italic text-sm sm:text-base text-[var(--text-2)] tracking-wide line-clamp-2 px-6 pt-1"
            style={{
              opacity: captionOpacity,
              textShadow: '0 2px 8px rgba(0,0,0,0.95)',
            }}
          >
            &ldquo;{wakeLine}&rdquo;
          </div>
        )}
      </div>
    </div>
  )
}
