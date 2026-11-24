'use client'

import React, { useState, useEffect } from 'react'
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

function isWebGLAvailable() {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    )
  } catch {
    return false
  }
}

export default function JarvisPreviewPage() {
  const [state, setState] = useState<CoreState>('idle')
  const [level, setLevel] = useState<number>(0.4)
  const [useFallback, setUseFallback] = useState(false)

  const states: CoreState[] = ['idle', 'listening', 'thinking', 'speaking']

  useEffect(() => {
    // 1. WebGL support check
    if (!isWebGLAvailable()) {
      setUseFallback(true)
      return
    }

    // 2. Prefers-reduced-motion check
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setUseFallback(true)
      return
    }

    // 3. Low-end device check: ignore first 10 frames (shader compilation), then measure 30-frame average
    let frameCount = 0
    let frameTimes: number[] = []
    let lastTime = performance.now()
    let animId: number

    function checkLoop(now: number) {
      const dt = now - lastTime
      lastTime = now
      frameCount++

      // Ignore first 10 frames, record frames 11 to 40 (30 frames)
      if (frameCount > 10 && frameCount <= 40) {
        frameTimes.push(dt)
        if (frameTimes.length === 30) {
          const avg = frameTimes.reduce((a, b) => a + b, 0) / 30
          if (avg > 28) {
            setUseFallback(true)
            return
          }
        }
      }

      if (frameCount < 40) {
        animId = requestAnimationFrame(checkLoop)
      }
    }

    animId = requestAnimationFrame(checkLoop)
    return () => cancelAnimationFrame(animId)
  }, [])

  return (
    <div className="min-h-screen w-full bg-[var(--color-bg)] flex flex-col items-center justify-center p-6 select-none relative overflow-hidden">
      {/* 520px tall, full width container for the 3D particle orb or fallback */}
      <div className="w-full max-w-4xl h-[520px] relative flex items-center justify-center rounded-3xl overflow-hidden border border-[var(--color-separator)] bg-[#04060B]">
        {useFallback ? (
          <JarvisCore size={460} state={state} level={level} />
        ) : (
          <JarvisOrb state={state} level={level} className="w-full h-full" />
        )}
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
