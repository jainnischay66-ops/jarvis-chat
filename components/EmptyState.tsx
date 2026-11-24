'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import { getTimeOfDayGreeting } from '@/lib/utils'
import type { CoreState } from './JarvisCore'
import JarvisCore from './JarvisCore'

const JarvisOrb = dynamic(() => import('./JarvisOrb'), {
  ssr: false,
  loading: () => <JarvisCore size={440} state="idle" />,
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
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 text-center select-none relative z-10 w-full overflow-hidden min-h-full">
      {/* Orb container with shared layoutId for smooth shrink into TopBar ArcReactor */}
      <motion.div
        layoutId="jarvis-orb-reactor"
        transition={{ type: 'spring', stiffness: 220, damping: 26 }}
        className="relative w-[340px] h-[340px] sm:w-[440px] sm:h-[440px] flex items-center justify-center my-[-25px] z-0"
      >
        <JarvisOrb state={state} level={level} />
      </motion.div>

      {/* Greeting & Status Readout */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-xl w-full flex flex-col items-center z-10 mt-2"
      >
        <h1 className="font-hud text-3xl sm:text-4xl font-semibold tracking-wider text-[var(--text)] mb-1 uppercase">
          {greeting}
        </h1>
        <div className="font-mono text-xs sm:text-sm text-[var(--cyan-dim)] tracking-widest uppercase mb-8 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--cyan)] shadow-[var(--glow-cyan)] animate-pulse" />
          <span>SYSTEMS ONLINE · {clock}</span>
        </div>

        {/* 4 .holo suggestion chips with 60ms stagger using clip-path reveal from center line */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl text-left">
          {SUGGESTIONS.map((suggestion, idx) => (
            <motion.button
              key={suggestion}
              initial={{ clipPath: 'inset(50% 0 50% 0)', opacity: 0 }}
              animate={{ clipPath: 'inset(0% 0 0% 0)', opacity: 1 }}
              transition={{
                delay: 0.25 + idx * 0.06,
                duration: 0.45,
                ease: [0.16, 1, 0.3, 1],
              }}
              onClick={() => onSuggestionClick(suggestion)}
              className="holo p-4 flex flex-col justify-between min-h-[58px] bg-[var(--surface)] hover:bg-[var(--surface-hi)] border border-[var(--line)] hover:border-[var(--cyan)] active:scale-[0.98] transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="font-hud text-[11px] text-[var(--cyan-dim)] group-hover:text-[var(--cyan)] tracking-wider">
                  DIRECTIVE 0{idx + 1}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--cyan)] opacity-60 group-hover:opacity-100 group-hover:shadow-[var(--glow-cyan)]" />
              </div>
              <span className="font-sans text-sm text-[var(--text)] group-hover:text-white transition-colors leading-snug">
                {suggestion}
              </span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
