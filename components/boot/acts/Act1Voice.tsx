'use client'

import React, { useMemo } from 'react'
import { getWaveformSamples } from '@/lib/boot/waveform'
import { interpolate, clamp } from '@/lib/boot/timeline'

interface Act1VoiceProps {
  time: number // current timestamp in seconds
}

export function Act1Voice({ time }: Act1VoiceProps) {
  // Waveform samples (64 points)
  const samples = useMemo(() => getWaveformSamples(64), [])

  // Heartbeat pulse times during initial quiet intro: 0.5s and 1.2s
  const hb1 = clamp(1.0 - Math.abs(time - 0.5) / 0.25, 0, 1)
  const hb2 = clamp(1.0 - Math.abs(time - 1.2) / 0.25, 0, 1)
  const heartGlow = Math.max(hb1, hb2)

  // Waveform erupts on flatline from t = 0.80 to 1.80s
  const waveErupt = interpolate(time, 0.8, 1.6, 0.0, 1.0)
  // Waveform bends into circle from t = 1.80 to 2.40s
  const circleMorph = interpolate(time, 1.8, 2.4, 0.0, 1.0)
  // Flash on ring closing at t = 2.40s as music swells
  const closeFlash = clamp(interpolate(time, 2.38, 2.48, 1.0, 0.0), 0, 1)

  const svgWidth = 800
  const svgHeight = 400
  const cx = svgWidth / 2
  const cy = svgHeight / 2
  const circleRadius = 82

  const pathD = useMemo(() => {
    const points: [number, number][] = []
    const count = samples.length

    for (let i = 0; i < count; i++) {
      const frac = i / (count - 1)
      const sample = samples[i] * waveErupt

      // Linear coords (flatline across center)
      const lx = (frac - 0.5) * 640 + cx
      const ly = cy - sample * 48 * Math.sin(frac * Math.PI)

      // Circular coords
      const theta = frac * Math.PI * 2 - Math.PI / 2
      const r = circleRadius + sample * 16 * (1.0 - circleMorph * 0.7)
      const cxPos = cx + Math.cos(theta) * r
      const cyPos = cy + Math.sin(theta) * r

      // Interpolate between line and circle
      const px = lx * (1 - circleMorph) + cxPos * circleMorph
      const py = ly * (1 - circleMorph) + cyPos * circleMorph
      points.push([px, py])
    }

    let d = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i][0].toFixed(2)} ${points[i][1].toFixed(2)}`
    }
    if (circleMorph > 0.95) {
      d += ' Z'
    }
    return d
  }, [samples, waveErupt, circleMorph, cx, cy])

  if (time > 2.50) return null

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none select-none overflow-hidden bg-[#02040A]">
      {/* Center Ember Dot */}
      <div
        className="absolute w-3 h-3 rounded-full bg-[#E05A2B] transition-transform"
        style={{
          boxShadow: `0 0 ${12 + heartGlow * 24}px rgba(224, 90, 43, ${0.4 + heartGlow * 0.6})`,
          transform: `scale(${1.0 + heartGlow * 0.8})`,
          opacity: 1.0 - circleMorph,
        }}
      />

      {/* SVG Waveform Line that bends into first JARVIS ring */}
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-full max-w-4xl max-h-[500px]"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="wave-cyan-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Backdrop faint flatline */}
        <line
          x1={cx - 320}
          y1={cy}
          x2={cx + 320}
          y2={cy}
          stroke="rgba(92, 203, 245, 0.15)"
          strokeWidth="1"
          strokeDasharray="4 6"
        />

        {/* Living glowing voice waveform path */}
        <path
          d={pathD}
          fill={circleMorph > 0.95 ? 'rgba(92, 203, 245, 0.08)' : 'none'}
          stroke="#5CCBF5"
          strokeWidth={1.8 + circleMorph * 0.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#wave-cyan-glow)"
          style={{
            opacity: clamp(1.0 - circleMorph * 0.2 + closeFlash * 0.6, 0, 1),
          }}
        />

        {/* Ring Close Flash Flare at 2.40s */}
        {closeFlash > 0.01 && (
          <circle
            cx={cx}
            cy={cy}
            r={circleRadius + 4}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={4 * closeFlash}
            filter="url(#wave-cyan-glow)"
            style={{ opacity: closeFlash }}
          />
        )}
      </svg>
    </div>
  )
}
