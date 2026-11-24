'use client'

import React from 'react'
import { interpolate, clamp } from '@/lib/boot/timeline'

interface FallbackBootProps {
  time: number
  totalDuration: number
  wakeLine: string
}

export function FallbackBoot({ time, totalDuration, wakeLine }: FallbackBootProps) {
  const isQuick = totalDuration < 5
  const titleStart = isQuick ? 1.8 : 21.00
  const titleEnd = isQuick ? 2.2 : 21.80

  const ringDraw = isQuick
    ? interpolate(time, 0.1, 0.8, 800, 0)
    : interpolate(time, 0.2, 2.40, 800, 0)

  const coreGlow = isQuick
    ? interpolate(time, 0.8, 1.2, 0.3, 1.0)
    : interpolate(time, 2.40, 19.00, 0.3, 1.0)

  const deployOpacity = isQuick
    ? clamp(interpolate(time, 1.2, 1.7, 0.0, 1.0) * interpolate(time, 1.7, 1.9, 1.0, 0.0), 0, 1)
    : clamp(interpolate(time, 19.20, 20.20, 0.0, 1.0) * interpolate(time, 21.00, 21.65, 1.0, 0.0), 0, 1)

  const titleOpacity = clamp(interpolate(time, titleStart, titleEnd, 0.0, 1.0), 0, 1)

  // Orb recedes at title cue: scales to 45%, center moves up to 34% height
  const recedeProgress = clamp(interpolate(time, titleStart, titleStart + 0.60, 0, 1), 0, 1)
  const orbScale = THREE_lerp(1.0, 0.45, recedeProgress)
  const orbTranslateY = THREE_lerp(0, -18, recedeProgress) // -18vh puts center at ~34vh
  const orbDim = THREE_lerp(1.0, 0.55, recedeProgress)

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#02040A] text-[var(--text)] select-none pointer-events-none p-6 overflow-hidden">
      {/* Concentric SVG Rings Drawing (moves to 34% height, scales to 45%) */}
      <div
        className="w-64 h-64 max-w-[320px] transition-all duration-300 flex items-center justify-center"
        style={{
          transform: `translateY(${orbTranslateY}vh) scale(${orbScale})`,
          opacity: orbDim,
        }}
      >
        <svg viewBox="0 0 400 400" className="w-full h-full">
          <defs>
            <radialGradient id="fallbackCore" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFF8DC" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#F2B84B" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#F2B84B" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle
            cx="200"
            cy="200"
            r="120"
            fill="none"
            stroke="#5CCBF5"
            strokeWidth="1.5"
            strokeDasharray="16 6 8 6"
            strokeDashoffset={ringDraw}
          />
          <circle
            cx="200"
            cy="200"
            r="80"
            fill="none"
            stroke="#F2B84B"
            strokeWidth="1.5"
            strokeDasharray="12 4"
            strokeDashoffset={ringDraw * 0.8}
          />
          <circle
            cx="200"
            cy="200"
            r="44"
            fill="url(#fallbackCore)"
            stroke="#F2B84B"
            strokeWidth="1.5"
            style={{ opacity: coreGlow }}
          />
        </svg>
      </div>

      {/* Wireframe Deploy Outline Preview (Lower-Left) */}
      <div
        className="absolute bottom-6 left-6 max-w-xs border border-[var(--line)] bg-[var(--surface-hi)] p-2.5 transition-opacity z-20"
        style={{ opacity: deployOpacity }}
      >
        <div className="font-hud text-[11px] text-[var(--cyan)] tracking-widest pb-0.5 border-b border-[var(--line)]">
          TACTICAL INTERFACE DEPLOYED
        </div>
        <div className="font-mono text-[10px] text-[var(--text-3)] pt-0.5">
          FALLBACK RENDERER · TELEMETRY NOMINAL
        </div>
      </div>

      {/* Soft Radial Scrim behind Title Card */}
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          top: '60%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(94vw, 760px)',
          height: 'min(50vh, 320px)',
          background: 'radial-gradient(ellipse at center, rgba(2, 4, 10, 0.88) 0%, rgba(2, 4, 10, 0.72) 55%, transparent 100%)',
          opacity: titleOpacity,
          zIndex: 25,
        }}
      />

      {/* Title Card centered at about 60% viewport height */}
      <div
        className="absolute top-[60%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center text-center w-full max-w-2xl px-4 space-y-4 transition-opacity z-30"
        style={{ opacity: titleOpacity }}
      >
        <h1
          className="font-title text-4xl sm:text-6xl font-bold tracking-[0.2em] text-[var(--cyan)]"
          style={{ textShadow: '0 2px 12px rgba(0,0,0,0.95), 0 0 20px rgba(92,203,245,0.45)' }}
        >
          J.A.R.V.I.S.
        </h1>
        <div className="flex flex-col items-center gap-1.5 pt-1">
          <p
            className="font-hud text-xs sm:text-sm tracking-[0.25em] text-[var(--text)] font-semibold"
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.95)' }}
          >
            <span className="text-[var(--gold)] mr-2">▸</span>
            WELCOME BACK, NISCHAY
            <span className="text-[var(--gold)] ml-2">◂</span>
          </p>
          <div className="w-16 h-[1.5px] bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent opacity-80" />
        </div>
        {wakeLine && (
          <p
            className="max-w-[60ch] font-hud italic text-sm sm:text-base text-[var(--text-2)] tracking-wide line-clamp-2 px-6 pt-1"
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.95)' }}
          >
            &ldquo;{wakeLine}&rdquo;
          </p>
        )}
      </div>
    </div>
  )
}

function THREE_lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
