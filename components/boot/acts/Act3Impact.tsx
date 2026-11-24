'use client'

import React from 'react'
import { interpolate, clamp } from '@/lib/boot/timeline'

interface Act3ImpactProps {
  time: number
  isQuick?: boolean
}

export function Act3Impact({ time, isQuick = false }: Act3ImpactProps) {
  const impactTime = isQuick ? 1.20 : 19.00
  const impactEndTime = impactTime + 1.20

  // Active during impact climax
  if (time < impactTime || time > impactEndTime) return null

  // 80ms white flash at t = impactTime to impactTime + 0.08s
  const flashOpacity = clamp(interpolate(time, impactTime, impactTime + 0.08, 0.95, 0.0), 0, 1)

  // Shockwave ripple expanding outward
  const rippleProgress = interpolate(time, impactTime, impactTime + 0.7, 0.0, 1.0)
  const rippleRadius = rippleProgress * 540
  const rippleOpacity = (1.0 - rippleProgress) * 0.85

  // Anamorphic horizontal lens flare streak across the core
  const flareProgress = interpolate(time, impactTime, impactTime + 0.65, 0.0, 1.0)
  const flareWidth = interpolate(time, impactTime, impactTime + 0.15, 20, 960)
  const flareOpacity = clamp((1.0 - flareProgress) * 1.3, 0, 1)

  return (
    <div className="absolute inset-0 z-25 pointer-events-none select-none flex items-center justify-center overflow-hidden">
      {/* 80ms Fullscreen White Flash */}
      {flashOpacity > 0.01 && (
        <div
          className="absolute inset-0 bg-white transition-opacity"
          style={{ opacity: flashOpacity }}
        />
      )}

      {/* Shockwave Expanding Ring */}
      {rippleProgress > 0 && rippleProgress < 1 && (
        <div
          className="absolute rounded-full border-2 border-[#5CCBF5]"
          style={{
            width: `${rippleRadius * 2}px`,
            height: `${rippleRadius * 2}px`,
            opacity: rippleOpacity,
            boxShadow: `0 0 28px rgba(92, 203, 245, ${rippleOpacity})`,
          }}
        />
      )}

      {/* Horizontal Anamorphic Lens Flare Streak */}
      {flareOpacity > 0.01 && (
        <div className="absolute flex items-center justify-center w-full pointer-events-none">
          <div
            className="h-[2.5px] bg-gradient-to-r from-transparent via-[#5CCBF5] to-transparent"
            style={{
              width: `${flareWidth}px`,
              opacity: flareOpacity,
              boxShadow: '0 0 18px #5CCBF5, 0 0 36px #5CCBF5',
            }}
          />
          <div
            className="absolute w-14 h-14 rounded-full bg-white blur-md"
            style={{ opacity: flareOpacity * 0.9 }}
          />
        </div>
      )}
    </div>
  )
}
