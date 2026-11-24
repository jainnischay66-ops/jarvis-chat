'use client'

import React from 'react'
import { interpolate, clamp } from '@/lib/boot/timeline'

interface Act2IgnitionProps {
  time: number
}

const PULSES = [4.38, 5.34, 6.94, 7.86]
const ESCALATION_HITS = [9.92, 11.94, 14.02, 15.96, 17.00, 17.96]

export function Act2Ignition({ time }: Act2IgnitionProps) {
  // Act 2 active between 2.45s and 18.95s
  if (time < 2.45 || time > 18.95) return null

  // 1. Medium Energy Phase (2.50 - 8.40s)
  // Calculate pulse ring-snap flare for rises at 4.38, 5.34, 6.94, 7.86
  let pulseIntensity = 0
  for (const pt of PULSES) {
    if (time >= pt && time <= pt + 0.22) {
      const snap = 1.0 - (time - pt) / 0.22
      pulseIntensity = Math.max(pulseIntensity, snap)
    }
  }

  // 2. Breath Phase (8.50 - 9.70s)
  const isBreath = time >= 8.50 && time <= 9.70
  // Dips to quietest at ~9.0, heartbeat shows through
  const breathHeartbeat = isBreath
    ? clamp(1.0 - Math.abs(time - 9.0) / 0.35, 0, 1)
    : 0

  // 3. Escalation Phase (9.90 - 18.80s)
  let escalationIntensity = 0
  ESCALATION_HITS.forEach((hitTime, idx) => {
    if (time >= hitTime && time <= hitTime + 0.25) {
      const strength = 0.5 + (idx / (ESCALATION_HITS.length - 1)) * 0.5 // 0.5 up to 1.0
      const snap = (1.0 - (time - hitTime) / 0.25) * strength
      escalationIntensity = Math.max(escalationIntensity, snap)
    }
  })

  // Tunnel speed: slows during breath, ramps up aggressively in escalation
  let tunnelSpeed = 1.0
  if (isBreath) {
    tunnelSpeed = 0.3
  } else if (time >= 9.90) {
    tunnelSpeed = interpolate(time, 9.9, 18.8, 1.2, 4.8)
  }

  const combinedFlash = Math.max(pulseIntensity, escalationIntensity)

  return (
    <div className="absolute inset-0 z-15 flex items-center justify-center pointer-events-none select-none overflow-hidden">
      {/* Breath heartbeat ember glow at 9.0s */}
      {breathHeartbeat > 0.01 && (
        <div
          className="absolute w-4 h-4 rounded-full bg-[#E05A2B] transition-transform"
          style={{
            boxShadow: `0 0 ${20 + breathHeartbeat * 40}px rgba(224, 90, 43, ${0.4 + breathHeartbeat * 0.6})`,
            transform: `scale(${1.0 + breathHeartbeat * 1.2})`,
            opacity: breathHeartbeat,
          }}
        />
      )}

      {/* 2D HUD Overlays augmenting 3D tunnel */}
      <svg
        viewBox="0 0 800 800"
        className="w-[90vmin] h-[90vmin] max-w-[800px] max-h-[800px] absolute"
        style={{
          transform: `scale(${1.0 + combinedFlash * 0.12}) rotate(${time * 28 * tunnelSpeed}deg)`,
          opacity: isBreath ? 0.45 : 0.75 + combinedFlash * 0.25,
        }}
      >
        <circle
          cx="400"
          cy="400"
          r="160"
          fill="none"
          stroke={combinedFlash > 0.2 ? '#FFFFFF' : '#5CCBF5'}
          strokeWidth={1.2 + combinedFlash * 1.5}
          strokeDasharray="6 4"
          opacity="0.8"
        />
        <circle
          cx="400"
          cy="400"
          r="240"
          fill="none"
          stroke="#F2B84B"
          strokeWidth={1.5 + combinedFlash * 1.8}
          strokeDasharray="16 8 32 8"
          opacity="0.7"
        />
        <circle
          cx="400"
          cy="400"
          r="330"
          fill="none"
          stroke={combinedFlash > 0.4 ? '#FFFFFF' : '#5CCBF5'}
          strokeWidth={1.0 + combinedFlash * 1.2}
          strokeDasharray="4 8"
          opacity="0.55"
        />

        {/* Tactical Crosshair Notch Marks */}
        <line x1="390" y1="400" x2="410" y2="400" stroke="#5CCBF5" strokeWidth="1.5" />
        <line x1="400" y1="390" x2="400" y2="410" stroke="#5CCBF5" strokeWidth="1.5" />
      </svg>
    </div>
  )
}
