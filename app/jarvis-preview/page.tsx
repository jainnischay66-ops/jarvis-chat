'use client'

import React, { useState } from 'react'
import JarvisCore, { CoreState } from '@/components/JarvisCore'

export default function JarvisPreviewPage() {
  const [state, setState] = useState<CoreState>('idle')
  const [level, setLevel] = useState<number>(0.4)

  const states: CoreState[] = ['idle', 'listening', 'thinking', 'speaking']

  return (
    <div className="min-h-screen w-full bg-[var(--color-bg)] flex flex-col items-center justify-center p-6 select-none relative overflow-hidden">
      {/* Bloom background behind the core */}
      <div className="relative flex items-center justify-center">
        <div
          className="absolute rounded-full pointer-events-none transition-all duration-700"
          style={{
            width: 520,
            height: 520,
            background:
              state === 'thinking'
                ? 'radial-gradient(circle, rgba(255, 184, 51, 0.25) 0%, rgba(76, 230, 255, 0.15) 35%, transparent 70%)'
                : 'radial-gradient(circle, rgba(76, 230, 255, 0.28) 0%, rgba(76, 230, 255, 0.12) 38%, transparent 70%)',
            filter: 'blur(36px)',
          }}
        />

        <div className="relative z-10">
          <JarvisCore size={460} state={state} level={level} />
        </div>
      </div>

      {/* Control panel */}
      <div className="mt-8 z-20 flex flex-col items-center gap-5 bg-[var(--color-surface-secondary)] border border-[var(--color-separator)] p-5 rounded-2xl shadow-xl max-w-md w-full">
        {/* State buttons */}
        <div className="flex items-center gap-2 w-full justify-center">
          {states.map(s => (
            <button
              key={s}
              onClick={() => setState(s)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                state === s
                  ? 'bg-[#007AFF] text-white shadow-md'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border border-[var(--color-separator)]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Level range slider */}
        <div className="flex flex-col gap-1.5 w-full">
          <div className="flex justify-between text-xs text-[var(--color-text-secondary)] font-medium">
            <span>Audio Level (Waveform Scale)</span>
            <span className="font-mono text-[var(--color-text-primary)]">{level.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={level}
            onChange={e => setLevel(parseFloat(e.target.value))}
            className="w-full cursor-pointer accent-[#007AFF]"
          />
        </div>
      </div>
    </div>
  )
}
