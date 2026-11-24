'use client'

import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import JarvisCore, { CoreState } from '@/components/JarvisCore'

const JarvisOrb = dynamic(() => import('@/components/JarvisOrb'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[520px] flex items-center justify-center">
      <JarvisCore size={460} state="idle" />
    </div>
  ),
})

export default function JarvisPreviewPage() {
  const [state, setState] = useState<CoreState>('idle')
  const [level, setLevel] = useState<number>(0.4)

  const states: CoreState[] = ['idle', 'listening', 'thinking', 'speaking']

  return (
    <div className="min-h-screen w-full bg-[var(--color-bg)] flex flex-col items-center justify-center p-6 select-none relative overflow-hidden">
      {/* 520px tall, full width container for the 3D particle orb */}
      <div className="w-full max-w-4xl h-[520px] relative flex items-center justify-center rounded-3xl overflow-hidden border border-[var(--color-separator)] bg-[#04060B]">
        <JarvisOrb state={state} level={level} className="w-full h-full" />
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
