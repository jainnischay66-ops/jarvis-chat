'use client'

import React, { useMemo, useEffect, useState } from 'react'
import { getWaveformSamples } from '@/lib/boot/waveform'

interface VoiceWaveformProps {
  isListening: boolean
  level?: number // live RMS 0..1
  reducedMotion?: boolean
}

export function VoiceWaveform({ isListening, level = 0, reducedMotion = false }: VoiceWaveformProps) {
  const [samples, setSamples] = useState<number[]>([])

  useEffect(() => {
    if (!isListening) {
      setSamples([])
      return
    }

    const interval = setInterval(() => {
      setSamples(getWaveformSamples(96))
    }, 40)

    return () => clearInterval(interval)
  }, [isListening])

  const pathD = useMemo(() => {
    if (!isListening || samples.length === 0) return ''
    const count = samples.length
    const width = 1200
    const height = 400
    const cy = height / 2

    let d = `M 0 ${cy}`
    for (let i = 0; i < count; i++) {
      const frac = i / (count - 1)
      const x = frac * width
      // Center modulation envelope (peaks near center, tapers at extreme edges)
      const env = Math.sin(frac * Math.PI)
      const amp = (samples[i] * 0.7 + level * 0.3) * 64 * env
      const y = cy + (i % 2 === 0 ? amp : -amp)
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`
    }
    d += ` L ${width} ${cy}`
    return d
  }, [isListening, samples, level])

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none select-none z-10 overflow-hidden flex items-center justify-center">
      {/* 1. Idle Faint Full-Width Flatline (When not listening or level is zero) */}
      {!isListening && (
        <svg
          viewBox="0 0 1000 100"
          className="w-full h-12 absolute top-1/2 -translate-y-1/2"
          preserveAspectRatio="none"
        >
          <line
            x1="0"
            y1="50"
            x2="1000"
            y2="50"
            stroke="rgba(92, 203, 245, 0.18)"
            strokeWidth="1.2"
            strokeDasharray="6 8"
          />
        </svg>
      )}

      {/* 2. Live Full-Width Waveform when Mic is active */}
      {isListening && pathD && (
        <svg
          viewBox="0 0 1200 400"
          className="w-full h-48 absolute top-1/2 -translate-y-1/2 transition-opacity duration-300"
          preserveAspectRatio="none"
          style={{
            filter: 'drop-shadow(0 0 8px rgba(92, 203, 245, 0.6))',
          }}
        >
          <defs>
            <linearGradient id="waveCyanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#5CCBF5" stopOpacity="0.1" />
              <stop offset="25%" stopColor="#5CCBF5" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#E6F7FF" stopOpacity="1" />
              <stop offset="75%" stopColor="#5CCBF5" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#5CCBF5" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          <path
            d={pathD}
            fill="none"
            stroke="url(#waveCyanGrad)"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  )
}
