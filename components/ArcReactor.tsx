'use client'

import React from 'react'
import type { CoreState } from './JarvisCore'

interface ArcReactorProps {
  state?: CoreState
  size?: number
  className?: string
  onClick?: () => void
}

export function ArcReactor({
  state = 'idle',
  size = 40,
  className = '',
  onClick,
}: ArcReactorProps) {
  const isThinking = state === 'thinking'
  const isSpeaking = state === 'speaking'
  const isListening = state === 'listening'

  const strokeColor = isThinking || isSpeaking ? 'var(--gold)' : 'var(--cyan)'
  const glowStyle = isThinking || isSpeaking ? 'var(--glow-gold)' : 'var(--glow-cyan)'

  return (
    <div
      onClick={onClick}
      role="img"
      aria-label={`J.A.R.V.I.S. Reactor Core, state: ${state}`}
      className={`relative flex items-center justify-center select-none cursor-pointer ${className}`}
      style={{
        width: size,
        height: size,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className={`w-full h-full transition-all duration-300 ${
          isSpeaking ? 'reactor-pulse' : isListening ? 'reactor-breathe' : ''
        }`}
        style={{ filter: `drop-shadow(${glowStyle})` }}
      >
        {/* Outer Ring with Segments */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeDasharray="60 12 18 12"
          className={isThinking ? 'reactor-spin-fast' : 'reactor-spin-slow'}
          opacity="0.9"
        />

        {/* Outer Ticks Ring */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeDasharray="3 5"
          className="reactor-spin-rev"
          opacity="0.6"
        />

        {/* Middle Band */}
        <circle
          cx="50"
          cy="50"
          r="30"
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeDasharray="35 15 20 10"
          className={isThinking ? 'reactor-spin-fast' : 'reactor-spin-slow'}
          opacity="0.85"
        />

        {/* Inner Ring */}
        <circle
          cx="50"
          cy="50"
          r="20"
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeDasharray="8 6"
          className="reactor-spin-rev"
          opacity="0.75"
        />

        {/* Core Node */}
        <circle
          cx="50"
          cy="50"
          r="10"
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          opacity="0.95"
        />
        <circle
          cx="50"
          cy="50"
          r="5"
          fill={strokeColor}
          opacity="0.9"
        />

        {/* Triangular or 3-point alignment markers */}
        <line x1="50" y1="12" x2="50" y2="18" stroke={strokeColor} strokeWidth="1.5" />
        <line x1="50" y1="82" x2="50" y2="88" stroke={strokeColor} strokeWidth="1.5" />
        <line x1="12" y1="50" x2="18" y2="50" stroke={strokeColor} strokeWidth="1.5" />
        <line x1="82" y1="50" x2="88" y2="50" stroke={strokeColor} strokeWidth="1.5" />
      </svg>
    </div>
  )
}
