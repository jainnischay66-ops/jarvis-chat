'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import { getTimeOfDayGreeting } from '@/lib/utils'
import type { CoreState } from './JarvisCore'
import JarvisCore from './JarvisCore'

const JarvisOrb = dynamic(() => import('./JarvisOrb'), {
  ssr: false,
  loading: () => <JarvisCore size={300} state="idle" />,
})

interface EmptyStateProps {
  onSuggestionClick: (prompt: string) => void
  state?: CoreState
  level?: number
}

const SUGGESTIONS = [
  'Help me think through a tough decision',
  'Draft a thoughtful reply to an important email',
  'Explain how LLM reasoning tokens work',
  'Summarize the core concepts of Apple HIG',
]

export function EmptyState({ onSuggestionClick, state = 'idle', level = 0 }: EmptyStateProps) {
  const [clock, setClock] = useState('00:00:00')

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

  const baseGreeting = getTimeOfDayGreeting()
  const greeting = `${baseGreeting}, sir.`

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-4 w-full select-none">
      {/* Orb stage: fades into page via radial-gradient mask */}
      <motion.div
        layoutId="jarvis-orb-reactor"
        transition={{ type: 'spring', stiffness: 220, damping: 26 }}
        className="relative flex items-center justify-center shrink-0"
        style={{
          height: 'clamp(180px, 36dvh, 340px)',
          aspectRatio: '1',
          width: 'auto',
          maxWidth: '100%',
          marginInline: 'auto',
          background: 'transparent',
          WebkitMaskImage: 'radial-gradient(closest-side, #000 62%, transparent 100%)',
          maskImage: 'radial-gradient(closest-side, #000 62%, transparent 100%)',
        }}
      >
        <JarvisOrb state={state} level={level} />
      </motion.div>

      {/* Greeting: sits BELOW orb stage with 16px gap, never overlaps */}
      <div className="flex flex-col items-center gap-2 w-full text-center">
        <h1
          style={{
            fontFamily: 'var(--font-rajdhani), sans-serif',
            fontWeight: 600,
            fontSize: 'clamp(24px, 3vw, 36px)',
            letterSpacing: '0.04em',
          }}
          className="text-[var(--text)] uppercase text-center m-0 leading-none"
        >
          {greeting}
        </h1>

        {/* Readout line: 12px mono, text-3, one line */}
        <div className="font-mono text-[12px] text-[var(--text-3)] text-center tracking-wider truncate">
          SYSTEMS ONLINE · {clock}
        </div>
      </div>

      {/* Suggestions: 2 columns, gap 12, width 100%, chamfer 10px, no brackets, no label, no dot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-[760px] mt-2">
        {SUGGESTIONS.map((suggestion, idx) => (
          <motion.button
            key={suggestion}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16, transition: { duration: 0.25, delay: idx * 0.04 } }}
            transition={{ duration: 0.35, delay: idx * 0.06, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -2 }}
            onClick={() => onSuggestionClick(suggestion)}
            style={{
              clipPath:
                'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
            }}
            className={`suggestion-chip flow-border min-h-[52px] px-4 py-3 bg-[var(--surface)] hover:bg-[var(--surface-hi)] border border-[var(--line)] hover:border-transparent active:scale-[0.98] transition-all text-left flex items-center cursor-pointer ${
              idx >= 2 ? 'max-h-[560px]:hidden' : ''
            }`}
          >
            <span className="font-sans text-[14px] leading-[1.35] text-[var(--text)] line-clamp-2">
              {suggestion}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
