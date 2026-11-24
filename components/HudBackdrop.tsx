'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { CoreState } from './JarvisCore'

// Dynamic import for background 3D orb
const JarvisOrb = dynamic(() => import('./JarvisOrb'), {
  ssr: false,
})

interface HudBackdropProps {
  state?: CoreState | 'error'
  powerState?: 'STANDBY' | 'BOOTING' | 'ACTIVE' | 'SLEEPING'
  level?: number
  hasMessages?: boolean
  messageCount?: number
  lastLatencyMs?: number | null
  isOnline?: boolean
  panOffset?: number
  isPanning?: boolean
  composerHeight?: number
}

const GLYPHS = [
  'MK-85', '0x7F4A', 'SYS.01', 'DIAG.99', 'DEF.ARRAY',
  '34.92°N', '84.12°W', 'ORBIT.TGT', '7A 3F B2', 'STARK.IND',
  'RAD.08', 'PWR.98', 'SUB.SYS', 'V-FLUX', 'TELEMETRY'
]

export function HudBackdrop({
  state = 'idle',
  powerState = 'ACTIVE',
  level = 0,
  hasMessages = false,
  messageCount = 0,
  lastLatencyMs = null,
  isOnline = true,
  panOffset = 0,
  isPanning = false,
  composerHeight = 76,
}: HudBackdropProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 800 })
  const [clock, setClock] = useState('00:00:00')
  const [reducedMotion, setReducedMotion] = useState(false)
  const [isDebug, setIsDebug] = useState(false)

  // Measure container dimensions using ResizeObserver
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setContainerSize({ width, height })
        }
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Check ?debug=1 in query params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      setIsDebug(params.get('debug') === '1')
    }
  }, [])

  // Live telemetry clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const pad = (n: number) => n.toString().padStart(2, '0')
      setClock(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`)
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Ring speed multiplier
  const stateSpeed = useMemo(() => {
    switch (state) {
      case 'thinking':
        return 2.5
      case 'speaking':
        return 1.4
      case 'listening':
        return 0.85
      default:
        return 1.0
    }
  }, [state])

  const panSpinMultiplier = isPanning && !reducedMotion ? 3.0 : 1.0
  const effectiveStateSpeed = stateSpeed * panSpinMultiplier

  // Size rings from container's shorter side
  const minSide = Math.min(containerSize.width, containerSize.height)
  const ringScale = Math.min(1.0, Math.max(0.38, minSide / 850))

  return (
    <div
      id="hud-backdrop-root"
      ref={containerRef}
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden z-0 pointer-events-none select-none bg-[var(--bg)]"
    >
      {/* 1. Deep radial lighting haze: central cyan halo + core gold glow */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-700"
        style={{
          background: `
            radial-gradient(circle ${minSide * 0.45}px at 50% 50%, rgba(92, 203, 245, ${state === 'listening' ? 0.08 : 0.045}) 0%, transparent 70%),
            radial-gradient(circle ${minSide * 0.25}px at 50% 50%, rgba(242, 184, 75, ${state === 'thinking' ? 0.12 : state === 'speaking' ? 0.09 : 0.035}) 0%, transparent 60%),
            radial-gradient(ellipse at center, transparent 40%, rgba(2, 4, 10, 0.75) 100%)
          `,
        }}
      />

      {/* 2. Perspective Holographic Grid Floor at bottom */}
      <div
        id="hud-grid-floor"
        className="absolute bottom-0 inset-x-0 h-[38vh] pointer-events-none overflow-hidden"
        style={{
          perspective: '600px',
          maskImage: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)',
          transform: `translate3d(${panOffset * 0.4}px, 0, 0)`,
          transition: reducedMotion ? 'none' : 'transform 450ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div
          className="w-[200%] h-[200%] -ml-[50%]"
          style={{
            transform: 'rotateX(72deg) translateY(10%)',
            transformOrigin: 'bottom center',
            backgroundImage: `
              linear-gradient(to right, rgba(92, 203, 245, 0.14) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(92, 203, 245, 0.14) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      {/* 3. Giant Concentric Holographic HUD Rings (SVG) */}
      <div
        className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-700 ${
          powerState === 'STANDBY'
            ? 'opacity-25'
            : hasMessages
            ? 'opacity-25'
            : 'opacity-85'
        }`}
        style={{
          transform: `translate3d(${panOffset}px, 0, 0) scale(${state === 'listening' ? 0.97 : 1})`,
          transition: reducedMotion ? 'none' : 'transform 450ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <svg
          id="hud-rings-svg"
          viewBox="-600 -600 1200 1200"
          preserveAspectRatio="xMidYMid slice"
          className={`w-full h-full transition-all duration-500 ${
            state === 'error' ? 'hud-error-flicker' : ''
          }`}
          style={{
            filter:
              powerState === 'STANDBY'
                ? 'drop-shadow(0 0 6px rgba(242, 184, 75, 0.25))'
                : 'drop-shadow(0 0 10px rgba(92, 203, 245, 0.35))',
          }}
        >
          <defs>
            <radialGradient id="hudRippleGrad" cx="50%" cy="50%" r="50%">
              <stop offset="70%" stopColor="#5CCBF5" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#5CCBF5" stopOpacity="0" />
            </radialGradient>

            <linearGradient id="hudGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F2B84B" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#F2B84B" stopOpacity="0.1" />
            </linearGradient>

            <filter id="hudGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Group scaled from container's shorter side */}
          <g transform={`scale(${ringScale})`}>
            {/* Ring 1 (Inner continuous circle with 4 crosshair ticks, R = 180) */}
            <circle
              r="180"
              fill="none"
              stroke="rgba(92, 203, 245, 0.22)"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
            <line x1="-190" y1="0" x2="-170" y2="0" stroke="#5CCBF5" strokeWidth="1.5" />
            <line x1="170" y1="0" x2="190" y2="0" stroke="#5CCBF5" strokeWidth="1.5" />
            <line x1="0" y1="-190" x2="0" y2="-170" stroke="#5CCBF5" strokeWidth="1.5" />
            <line x1="0" y1="170" x2="0" y2="190" stroke="#5CCBF5" strokeWidth="1.5" />

            {/* Ring 2: Segmented arcs with gaps (R = 270), rotates clockwise */}
            <g
              className="hud-spin-clockwise"
              style={{
                animationDuration: `${140 / effectiveStateSpeed}s`,
                animationPlayState: reducedMotion ? 'paused' : 'running',
              }}
            >
              <circle
                r="270"
                fill="none"
                stroke="#5CCBF5"
                strokeWidth="1.5"
                strokeDasharray="180 40 90 50 240 60"
                opacity="0.45"
              />
              <circle cx="270" cy="0" r="2.5" fill="#5CCBF5" filter="url(#hudGlow)" />
              <circle cx="-270" cy="0" r="2.5" fill="#5CCBF5" filter="url(#hudGlow)" />
            </g>

            {/* Ring 3: Bezel dial tick marks (R = 360, 48 ticks), counter-clockwise */}
            <g
              className="hud-spin-counter"
              style={{
                animationDuration: `${200 / effectiveStateSpeed}s`,
                animationPlayState: reducedMotion ? 'paused' : 'running',
              }}
            >
              {Array.from({ length: 48 }).map((_, i) => {
                const angle = (i * 360) / 48
                const isMajor = i % 4 === 0
                const isCardinal = i % 12 === 0
                const r1 = 356
                const r2 = isCardinal ? 372 : isMajor ? 368 : 362
                const rad = (angle * Math.PI) / 180
                const x1 = Math.cos(rad) * r1
                const y1 = Math.sin(rad) * r1
                const x2 = Math.cos(rad) * r2
                const y2 = Math.sin(rad) * r2

                return (
                  <line
                    key={`tick-${i}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isCardinal ? '#F2B84B' : '#5CCBF5'}
                    strokeWidth={isCardinal ? 2 : isMajor ? 1.5 : 1}
                    opacity={isCardinal ? 0.75 : isMajor ? 0.5 : 0.25}
                  />
                )
              })}
            </g>

            {/* Ring 4: Thick broken gold arc (R = 440), clockwise with smooth glow */}
            <g
              className="hud-spin-clockwise"
              style={{
                animationDuration: `${90 / effectiveStateSpeed}s`,
                animationPlayState: reducedMotion ? 'paused' : 'running',
              }}
            >
              <circle
                r="440"
                fill="none"
                stroke="url(#hudGoldGrad)"
                strokeWidth="2.5"
                strokeDasharray="220 500 120 400"
                strokeLinecap="round"
                opacity={state === 'thinking' || state === 'speaking' ? 0.85 : 0.55}
                filter="url(#hudGlow)"
              />
            </g>

            {/* Ring 5: Rotating ring of technical glyphs / hex telemetry (R = 510) - Opacity reduced to 16% */}
            <g
              className="hud-spin-counter"
              style={{
                animationDuration: `${240 / effectiveStateSpeed}s`,
                animationPlayState: reducedMotion ? 'paused' : 'running',
              }}
            >
              <circle
                r="510"
                fill="none"
                stroke="rgba(92, 203, 245, 0.16)"
                strokeWidth="1"
                strokeDasharray="2 8"
              />
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
                    style={{ fill: 'rgba(92, 203, 245, 0.16)' }}
                  >
                    {glyph}
                  </text>
                )
              })}
            </g>

            {/* Ring 6: Concentric micro-dashed ring (R = 580) */}
            <circle
              r="580"
              fill="none"
              stroke="rgba(92, 203, 245, 0.16)"
              strokeWidth="1"
              strokeDasharray="8 8 32 8"
            />

            {/* Ring 7: Giant outer perimeter ring (R = 680) */}
            <circle
              r="680"
              fill="none"
              stroke="rgba(92, 203, 245, 0.12)"
              strokeWidth="1.5"
              strokeDasharray="40 12 120 16 300 30"
            />

            {/* Outward pulse ripple */}
            <circle
              r="120"
              className="hud-pulse-ripple"
              fill="none"
              stroke="#5CCBF5"
              strokeWidth="1.5"
              opacity="0.25"
            />
          </g>
        </svg>
      </div>

      {/* 4. R3F Canvas 3D Orb (Concentric at Center, supporting opacity in chat mode) */}
      <div
        id="hud-orb-canvas"
        className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-700 ${
          hasMessages ? 'opacity-25' : 'opacity-100'
        }`}
        style={{
          transform: `translate3d(${panOffset}px, 0, 0)`,
          transition: reducedMotion ? 'none' : 'transform 450ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div
          className="relative flex items-center justify-center"
          style={{
            width: Math.min(containerSize.width, containerSize.height * 0.9, 720),
            height: Math.min(containerSize.width, containerSize.height * 0.9, 720),
            maxWidth: '100%',
            maxHeight: '100%',
          }}
        >
          <JarvisOrb
            state={powerState === 'STANDBY' ? 'dormant' : state === 'error' ? 'idle' : state}
            level={powerState === 'STANDBY' ? 0 : level}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* 5. Telemetry Safe Zones: strictly inside chat area, above composer, 40% opacity */}
      {/* Bottom-Left Safe Zone */}
      <div
        id="hud-telemetry-left"
        className="absolute left-4 font-mono text-[10px] tracking-wider text-[var(--text-3)] opacity-40 select-none flex items-center gap-2 pointer-events-none z-10"
        style={{ bottom: `calc(${composerHeight}px + 12px)` }}
      >
        <span className="font-semibold text-[var(--cyan)]">HUD.v7.4</span>
        <span>·</span>
        <span>{clock}</span>
        <span>·</span>
        <span className={isOnline ? 'text-[var(--cyan)]' : 'text-[var(--red)]'}>
          SYS: {isOnline ? 'NOMINAL' : 'OFFLINE'}
        </span>
      </div>

      {/* Bottom-Right Safe Zone */}
      <div
        id="hud-telemetry-right"
        className="absolute right-4 font-mono text-[10px] tracking-wider text-[var(--text-3)] opacity-40 select-none flex items-center gap-2 pointer-events-none z-10"
        style={{ bottom: `calc(${composerHeight}px + 12px)` }}
      >
        <span>MSGS: {messageCount}</span>
        {lastLatencyMs !== null && (
          <>
            <span>·</span>
            <span>LAT: {lastLatencyMs}ms</span>
          </>
        )}
      </div>

      {/* 6. Debug Overlay (?debug=1) */}
      {isDebug && (
        <div
          id="hud-debug-overlay"
          className="absolute inset-0 border-2 border-magenta-500 pointer-events-none z-50 text-[10px] font-mono text-magenta-400 select-none"
        >
          {/* Main center crosshairs */}
          <div className="absolute left-0 right-0 top-1/2 h-[1px] bg-yellow-400/60 pointer-events-none" />
          <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-yellow-400/60 pointer-events-none" />
          
          {/* Center marker circle */}
          <div className="absolute left-1/2 top-1/2 w-6 h-6 -ml-3 -mt-3 rounded-full border border-yellow-400 pointer-events-none flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
          </div>

          {/* Safe zone visual outlines */}
          <div
            className="absolute left-3 p-1 border border-dashed border-cyan-400/80 bg-cyan-950/40 text-cyan-300 pointer-events-none"
            style={{ bottom: `calc(${composerHeight}px + 8px)` }}
          >
            SAFE ZONE (LEFT TELEMETRY)
          </div>

          <div
            className="absolute right-3 p-1 border border-dashed border-cyan-400/80 bg-cyan-950/40 text-cyan-300 pointer-events-none"
            style={{ bottom: `calc(${composerHeight}px + 8px)` }}
          >
            SAFE ZONE (RIGHT TELEMETRY)
          </div>

          {/* Diagnostic badge */}
          <div className="absolute top-[60px] left-3 bg-black/85 border border-magenta-500/80 p-2 text-white max-w-[260px] z-50">
            <div className="font-bold text-magenta-300">HUD DIAGNOSTICS (?debug=1)</div>
            <div>Chat Area: {containerSize.width} × {containerSize.height} px</div>
            <div>Center Point: ({Math.round(containerSize.width / 2)}, {Math.round(containerSize.height / 2)})</div>
            <div>Ring Scale: {ringScale.toFixed(3)} (Shorter Side: {minSide}px)</div>
            <div>Composer Safe Offset: {composerHeight + 12}px</div>
          </div>
        </div>
      )}
    </div>
  )
}
