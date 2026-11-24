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
  level?: number
  hasMessages?: boolean
  messageCount?: number
  lastLatencyMs?: number | null
  isOnline?: boolean
}

const GLYPHS = [
  'MK-85', '0x7F4A', 'SYS.01', 'DIAG.99', 'DEF.ARRAY',
  '34.92°N', '84.12°W', 'ORBIT.TGT', '7A 3F B2', 'STARK.IND',
  'RAD.08', 'PWR.98', 'SUB.SYS', 'V-FLUX', 'TELEMETRY'
]

export function HudBackdrop({
  state = 'idle',
  level = 0,
  hasMessages = false,
  messageCount = 0,
  lastLatencyMs = null,
  isOnline = true,
}: HudBackdropProps) {
  const [clock, setClock] = useState('00:00:00')
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [reducedMotion, setReducedMotion] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

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

  // Check prefers-reduced-motion and touch / mobile
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)

    setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window)

    const onResize = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window)
    }
    window.addEventListener('resize', onResize)

    return () => {
      mq.removeEventListener('change', handler)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // Mouse parallax tracking
  useEffect(() => {
    if (reducedMotion || isMobile) return

    let rafId: number
    let targetX = 0
    let targetY = 0
    let currentX = 0
    let currentY = 0

    const onMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window
      targetX = (e.clientX / innerWidth - 0.5) * 2 // -1 to 1
      targetY = (e.clientY / innerHeight - 0.5) * 2 // -1 to 1
    }

    const loop = () => {
      currentX += (targetX - currentX) * 0.05
      currentY += (targetY - currentY) * 0.05
      setMousePos({ x: currentX, y: currentY })
      rafId = requestAnimationFrame(loop)
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true })
    rafId = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      cancelAnimationFrame(rafId)
    }
  }, [reducedMotion, isMobile])

  // Canvas floating particle dust (lightweight 2D embers)
  useEffect(() => {
    if (reducedMotion || isMobile) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    // Generate 32 particles
    const count = 32
    const particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.5 + 0.8,
      speedY: -(Math.random() * 0.4 + 0.15),
      speedX: (Math.random() - 0.5) * 0.2,
      opacity: Math.random() * 0.4 + 0.1,
      gold: Math.random() > 0.7,
      pulse: Math.random() * Math.PI * 2,
    }))

    const render = () => {
      if (document.hidden) {
        animId = requestAnimationFrame(render)
        return
      }
      ctx.clearRect(0, 0, width, height)

      particles.forEach(p => {
        p.y += p.speedY
        p.x += p.speedX
        p.pulse += 0.02
        if (p.y < -10) {
          p.y = height + 10
          p.x = Math.random() * width
        }
        if (p.x < -10) p.x = width + 10
        if (p.x > width + 10) p.x = -10

        const currentOpacity = p.opacity * (0.7 + 0.3 * Math.sin(p.pulse))
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.gold
          ? `rgba(242, 184, 75, ${currentOpacity})`
          : `rgba(92, 203, 245, ${currentOpacity})`
        ctx.shadowBlur = 4
        ctx.shadowColor = p.gold ? '#F2B84B' : '#5CCBF5'
        ctx.fill()
      })

      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animId)
    }
  }, [reducedMotion, isMobile])

  // State-driven multipliers for ring animation speed & intensity
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

  // Parallax offsets
  const shiftP1 = { x: mousePos.x * 5, y: mousePos.y * 5 }
  const shiftP2 = { x: mousePos.x * 9, y: mousePos.y * 9 }
  const shiftP3 = { x: mousePos.x * 14, y: mousePos.y * 14 }

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none select-none overflow-hidden z-0 bg-[var(--bg)]"
    >
      {/* 1. Deep radial lighting haze: central cyan halo + core gold glow */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-700"
        style={{
          background: `
            radial-gradient(circle 420px at 50% 50%, rgba(92, 203, 245, ${state === 'listening' ? 0.08 : 0.045}) 0%, transparent 70%),
            radial-gradient(circle 240px at 50% 50%, rgba(242, 184, 75, ${state === 'thinking' ? 0.12 : state === 'speaking' ? 0.09 : 0.035}) 0%, transparent 60%),
            radial-gradient(ellipse at center, transparent 40%, rgba(2, 4, 10, 0.75) 100%)
          `,
        }}
      />

      {/* 2. Floating Particle Dust Layer */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none opacity-60"
      />

      {/* 3. Perspective Holographic Grid Floor at bottom */}
      <div
        className="absolute bottom-0 inset-x-0 h-[38vh] pointer-events-none overflow-hidden"
        style={{
          perspective: '600px',
          maskImage: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)',
          transform: `translate3d(${shiftP1.x}px, ${shiftP1.y}px, 0)`,
          transition: 'transform 80ms ease-out',
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

      {/* 4. Giant Concentric Holographic HUD Rings (SVG) */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{
          transform: `translate3d(${shiftP2.x}px, ${shiftP2.y}px, 0) scale(${state === 'listening' ? 0.97 : 1})`,
          transition: reducedMotion ? 'none' : 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <svg
          viewBox="-600 -600 1200 1200"
          className={`w-[1200px] h-[1200px] max-w-none transition-all duration-500 ${
            state === 'error' ? 'hud-error-flicker' : ''
          }`}
          style={{
            filter: 'drop-shadow(0 0 10px rgba(92, 203, 245, 0.35))',
          }}
        >
          <defs>
            {/* Outward pulse ripple gradient */}
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
              animationDuration: `${140 / stateSpeed}s`,
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
            {/* Glowing endpoint dots */}
            <circle cx="270" cy="0" r="2.5" fill="#5CCBF5" filter="url(#hudGlow)" />
            <circle cx="-270" cy="0" r="2.5" fill="#5CCBF5" filter="url(#hudGlow)" />
          </g>

          {/* Ring 3: Bezel dial tick marks (R = 360, 60 ticks), counter-clockwise */}
          <g
            className="hud-spin-counter"
            style={{
              animationDuration: `${200 / stateSpeed}s`,
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
              animationDuration: `${90 / stateSpeed}s`,
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

          {/* Ring 5: Rotating ring of technical glyphs / hex telemetry (R = 510) */}
          <g
            className="hud-spin-counter"
            style={{
              animationDuration: `${240 / stateSpeed}s`,
              animationPlayState: reducedMotion ? 'paused' : 'running',
            }}
          >
            <circle
              r="510"
              fill="none"
              stroke="rgba(92, 203, 245, 0.16)"
              strokeWidth="1"
              strokeDasharray="2 4"
            />
            {GLYPHS.map((glyph, idx) => {
              const angle = (idx * 360) / GLYPHS.length
              const rad = (angle * Math.PI) / 180
              const x = Math.cos(rad) * 510
              const y = Math.sin(rad) * 510

              return (
                <text
                  key={glyph}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={`rotate(${angle + 90}, ${x}, ${y})`}
                  className="font-mono text-[9px] fill-[var(--text-3)] tracking-widest uppercase select-none"
                  style={{ fill: 'rgba(92, 203, 245, 0.45)' }}
                >
                  {glyph}
                </text>
              )
            })}
          </g>

          {/* Ring 6: Concentric micro-dashed ring with precision clusters (R = 580) */}
          <circle
            r="580"
            fill="none"
            stroke="rgba(92, 203, 245, 0.2)"
            strokeWidth="1"
            strokeDasharray="8 8 32 8"
          />

          {/* Ring 7: Giant outer perimeter ring (R = 680), partly extending off-screen */}
          <circle
            r="680"
            fill="none"
            stroke="rgba(92, 203, 245, 0.12)"
            strokeWidth="1.5"
            strokeDasharray="40 12 120 16 300 30"
          />

          {/* Dynamic outward traveling pulse ripple */}
          <circle
            r="120"
            className="hud-pulse-ripple"
            fill="none"
            stroke="#5CCBF5"
            strokeWidth="1.5"
            opacity="0.3"
          />
        </svg>
      </div>

      {/* 5. Center 3D Background Orb (enlarged, dimmed behind messages) */}
      {hasMessages && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-700"
          style={{
            opacity: state === 'thinking' ? 0.4 : state === 'speaking' ? 0.35 : 0.28,
            transform: `translate3d(${shiftP3.x}px, ${shiftP3.y}px, 0) scale(1.4)`,
          }}
        >
          <div className="w-[480px] h-[480px] max-w-[90vw] max-h-[90vh]">
            <JarvisOrb state={state === 'error' ? 'idle' : state} level={level} />
          </div>
        </div>
      )}

      {/* 6. Slow Vertical Scan-Sweep Laser Line */}
      {!reducedMotion && (
        <div className="hud-scan-sweep pointer-events-none" />
      )}

      {/* 7. Subtle Corner HUD Telemetry (Real data only) */}
      <div className="absolute inset-0 p-3 pointer-events-none flex flex-col justify-between text-[11px] font-mono select-none text-[var(--text-3)] z-10">
        {/* Top telemetry line - positioned cleanly below TopBar (56px) and clearing desktop sidebar */}
        <div className="flex items-center justify-between w-full pl-4 md:pl-[276px] pr-4 pt-[64px] opacity-75">
          <div className="flex items-center gap-3">
            <span className="text-[var(--cyan)] font-semibold tracking-wider">HUD.v7.4</span>
            <span className="hidden sm:inline text-[var(--line)]">|</span>
            <span className="hidden sm:inline text-[var(--text-3)]">{clock}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">CORE_FREQ: 432.8 THz</span>
            <span className="hidden sm:inline text-[var(--line)]">|</span>
            <span className={isOnline ? 'text-[var(--cyan)]' : 'text-[var(--red)]'}>
              SYS: {isOnline ? 'NOMINAL' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Bottom telemetry line - positioned above bottom screen edge and clearing desktop sidebar */}
        <div className="flex items-center justify-between w-full pl-4 md:pl-[276px] pr-4 pb-2 opacity-75">
          <div className="flex items-center gap-3">
            <span>ARC_CORE: <span className="text-[var(--gold)]">98.4%</span></span>
            <span className="hidden sm:inline text-[var(--line)]">|</span>
            <span>MSGS: <span className="text-[var(--cyan)]">{messageCount}</span></span>
          </div>

          <div className="flex items-center gap-3">
            {lastLatencyMs !== null && (
              <>
                <span>LATENCY: <span className="text-[var(--cyan)]">{lastLatencyMs}ms</span></span>
                <span className="hidden sm:inline text-[var(--line)]">|</span>
              </>
            )}
            <span className="uppercase text-[var(--gold)] tracking-wider">PROTO: STARK-HUD</span>
          </div>
        </div>
      </div>
    </div>
  )
}
