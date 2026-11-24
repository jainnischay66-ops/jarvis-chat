'use client'

import React, { useRef, useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { CoreState } from './JarvisCore'
import { VoiceWaveform } from './VoiceWaveform'

// Persistent JarvisOrb Canvas
const JarvisOrb = dynamic(() => import('./JarvisOrb'), {
  ssr: false,
})

interface StageProps {
  powerState: 'STANDBY' | 'BOOTING' | 'ACTIVE' | 'SLEEPING'
  coreState?: CoreState
  coreLevel?: number
  hasMessages?: boolean
  isOnline?: boolean
  isListening?: boolean
  micRms?: number
  panOffset?: number
  reducedMotion?: boolean
}

const GLYPHS = [
  'MK-85', '0x7F4A', 'SYS.01', 'DIAG.99', 'DEF.ARRAY',
  '34.92°N', '84.12°W', 'ORBIT.TGT', '7A 3F B2', 'STARK.IND',
  'RAD.08', 'PWR.98', 'SUB.SYS', 'V-FLUX', 'TELEMETRY'
]

// Global canvas mount counter to verify single mount
let globalCanvasMounts = 0

export function Stage({
  powerState,
  coreState = 'idle',
  coreLevel = 0,
  hasMessages = false,
  isOnline = true,
  isListening = false,
  micRms = 0,
  panOffset = 0,
  reducedMotion = false,
}: StageProps) {
  const mountLoggedRef = useRef(false)
  const [containerSize, setContainerSize] = useState({ width: 1280, height: 800 })

  // Track window size for concentric ring scale
  useEffect(() => {
    if (typeof window === 'undefined') return
    const update = () => {
      setContainerSize({ width: window.innerWidth, height: window.innerHeight })
    }
    update()
    window.addEventListener('resize', update, { passive: true })
    return () => window.removeEventListener('resize', update)
  }, [])

  // Effective state for orb:
  // STANDBY -> dormant (ember breathing)
  // BOOTING -> speaking / igniting (gold & cyan)
  // SLEEPING -> dormant (cooling back to ember)
  // ACTIVE -> coreState
  const effectiveState: CoreState = useMemo(() => {
    if (powerState === 'STANDBY') return 'dormant'
    if (powerState === 'BOOTING') return 'speaking' // ignites with full energy
    if (powerState === 'SLEEPING') return 'dormant'
    return coreState
  }, [powerState, coreState])

  const effectiveLevel = useMemo(() => {
    if (powerState === 'BOOTING') return 0.85
    if (powerState === 'STANDBY') return isListening ? Math.max(0.6, micRms) : 0
    return coreLevel
  }, [powerState, isListening, micRms, coreLevel])

  // Scale concentric rings from viewport's shorter dimension
  const minSide = Math.min(containerSize.width, containerSize.height)
  const ringScale = Math.max(0.45, Math.min(1.4, minSide / 880))

  return (
    <div
      id="jarvis-persistent-stage"
      aria-hidden="true"
      className="fixed inset-0 w-screen h-[100dvh] overflow-hidden pointer-events-none select-none z-0 bg-[#02040A]"
    >
      {/* 1. Deep radial lighting haze */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
        style={{
          background: `
            radial-gradient(circle ${minSide * 0.55}px at 50% 50%, rgba(92, 203, 245, ${
            powerState === 'BOOTING' ? 0.16 : effectiveState === 'listening' ? 0.1 : 0.04
          }) 0%, transparent 70%),
            radial-gradient(circle ${minSide * 0.3}px at 50% 50%, rgba(242, 184, 75, ${
            powerState === 'BOOTING' ? 0.22 : effectiveState === 'speaking' ? 0.14 : 0.04
          }) 0%, transparent 60%),
            radial-gradient(ellipse at center, transparent 35%, rgba(2, 4, 10, 0.85) 100%)
          `,
        }}
      />

      {/* 2. Full-Width Voice Waveform & Flatline across center */}
      {(powerState === 'STANDBY' || powerState === 'BOOTING') && (
        <VoiceWaveform
          isListening={isListening || powerState === 'BOOTING'}
          level={effectiveLevel}
          reducedMotion={reducedMotion}
        />
      )}

      {/* 3. Perspective Holographic Grid Floor extending to screen edges */}
      <div
        id="hud-grid-floor"
        className="absolute bottom-0 inset-x-0 h-[42vh] pointer-events-none overflow-hidden"
        style={{
          perspective: '600px',
          maskImage: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 65%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 65%, transparent 100%)',
          transform: `translate3d(${panOffset * 0.4}px, 0, 0)`,
          transition: reducedMotion ? 'none' : 'transform 450ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div
          className="w-[200%] h-[200%] -ml-[50%]"
          style={{
            transform: 'rotateX(72deg) translateY(12%)',
            transformOrigin: 'bottom center',
            backgroundImage: `
              linear-gradient(to right, rgba(92, 203, 245, ${powerState === 'BOOTING' ? 0.25 : 0.14}) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(92, 203, 245, ${powerState === 'BOOTING' ? 0.25 : 0.14}) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      {/* 4. Giant Concentric Holographic HUD Rings (SVG) extending across viewport */}
      <div
        className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-1000 ${
          powerState === 'STANDBY'
            ? 'opacity-35'
            : powerState === 'BOOTING'
            ? 'opacity-95'
            : hasMessages
            ? 'opacity-20'
            : 'opacity-80'
        }`}
        style={{
          transform: `translate3d(${panOffset}px, 0, 0)`,
          transition: reducedMotion ? 'none' : 'transform 450ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <svg
          id="hud-rings-svg"
          viewBox="-600 -600 1200 1200"
          preserveAspectRatio="xMidYMid slice"
          className="w-full h-full transition-all duration-500"
          style={{
            filter:
              powerState === 'STANDBY'
                ? 'drop-shadow(0 0 8px rgba(242, 184, 75, 0.35))'
                : 'drop-shadow(0 0 14px rgba(92, 203, 245, 0.45))',
          }}
        >
          <g transform={`scale(${ringScale})`}>
            {/* Ring 1 (Inner ticks, R = 180) */}
            <circle r="180" fill="none" stroke="rgba(92, 203, 245, 0.25)" strokeWidth="1" strokeDasharray="4 6" />
            <line x1="-190" y1="0" x2="-170" y2="0" stroke="#5CCBF5" strokeWidth="1.5" />
            <line x1="170" y1="0" x2="190" y2="0" stroke="#5CCBF5" strokeWidth="1.5" />
            <line x1="0" y1="-190" x2="0" y2="-170" stroke="#5CCBF5" strokeWidth="1.5" />
            <line x1="0" y1="170" x2="0" y2="190" stroke="#5CCBF5" strokeWidth="1.5" />

            {/* Ring 2 (R = 260 segmented gold arc) */}
            <circle r="260" fill="none" stroke="rgba(242, 184, 75, 0.45)" strokeWidth="1.5" strokeDasharray="16 8 32 8" />

            {/* Ring 3 (R = 340 micro ticks) */}
            <circle r="340" fill="none" stroke="rgba(92, 203, 245, 0.28)" strokeWidth="1" strokeDasharray="2 6" />

            {/* Ring 4 (R = 430 dashed) */}
            <circle r="430" fill="none" stroke="rgba(92, 203, 245, 0.22)" strokeWidth="1.2" strokeDasharray="24 12 8 12" />

            {/* Ring 5 (R = 510 Glyphs) */}
            <g>
              <circle r="510" fill="none" stroke="rgba(92, 203, 245, 0.18)" strokeWidth="1" strokeDasharray="2 8" />
              {GLYPHS.map((glyph, i) => {
                const angle = (i * 360) / GLYPHS.length
                const rad = (angle * Math.PI) / 180
                const x = Math.cos(rad) * 510
                const y = Math.sin(rad) * 510
                return (
                  <text
                    key={`glyph-${i}`}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={`rotate(${angle + 90}, ${x}, ${y})`}
                    className="font-mono text-[9px] tracking-widest uppercase select-none"
                    style={{ fill: 'rgba(92, 203, 245, 0.22)' }}
                  >
                    {glyph}
                  </text>
                )
              })}
            </g>

            {/* Ring 6 & 7: Giant Outer Perimeters */}
            <circle r="580" fill="none" stroke="rgba(92, 203, 245, 0.16)" strokeWidth="1" strokeDasharray="8 8 32 8" />
            <circle r="680" fill="none" stroke="rgba(92, 203, 245, 0.12)" strokeWidth="1.5" strokeDasharray="40 12 120 16" />
          </g>
        </svg>
      </div>

      {/* 5. Persistent R3F Canvas 3D Orb: Full-bleed and centered:
          Diameter: min(72vh, 62vw) on desktop, 80vw on mobile. Centered via layout. */}
      <div
        id="hud-orb-canvas"
        className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-700 ${
          hasMessages && powerState === 'ACTIVE'
            ? 'opacity-25 translate-y-[-10vh] scale-75'
            : 'opacity-100 translate-y-0 scale-100'
        }`}
        style={{
          transform: `translate3d(${panOffset}px, ${hasMessages && powerState === 'ACTIVE' ? '-10vh' : '0'}, 0)`,
          transition: reducedMotion ? 'none' : 'transform 500ms cubic-bezier(0.16, 1, 0.3, 1), opacity 700ms ease',
        }}
      >
        <div
          className="relative flex items-center justify-center w-[min(72vh,62vw)] h-[min(72vh,62vw)] max-md:w-[80vw] max-md:h-[80vw]"
        >
          <JarvisOrb
            state={effectiveState}
            level={effectiveLevel}
            className="w-full h-full"
          />
        </div>
      </div>
    </div>
  )
}
