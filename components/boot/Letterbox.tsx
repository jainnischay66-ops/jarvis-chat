'use client'

import React from 'react'
import { interpolate, clamp } from '@/lib/boot/timeline'

interface LetterboxProps {
  time: number
  totalDuration: number
}

export function Letterbox({ time, totalDuration }: LetterboxProps) {
  // Slide in at start: 0.0s to 0.5s
  const slideIn = interpolate(time, 0.0, 0.5, 0.0, 1.0)
  // Slide out at end: (totalDuration - 1.0s) to totalDuration (22.50s to 23.50s on full boot)
  const slideOut = interpolate(time, totalDuration - 1.0, totalDuration, 1.0, 0.0)
  const barProgress = Math.min(slideIn, slideOut)

  // Standard cinematic letterbox height (approx 11% of screen height for 2.39:1 scope)
  const barHeight = clamp(barProgress * 11, 0, 11)

  if (barProgress <= 0.001) return null

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-45 overflow-hidden">
      {/* Top Black Bar */}
      <div
        className="absolute top-0 inset-x-0 bg-black transition-all"
        style={{
          height: `${barHeight}vh`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.9)',
        }}
      />

      {/* Bottom Black Bar */}
      <div
        className="absolute bottom-0 inset-x-0 bg-black transition-all"
        style={{
          height: `${barHeight}vh`,
          boxShadow: '0 -4px 20px rgba(0,0,0,0.9)',
        }}
      />
    </div>
  )
}
