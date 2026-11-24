'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { getTimeOfDayGreeting } from '@/lib/utils'

interface EmptyStateProps {
  onSuggestionClick: (prompt: string) => void
}

const SUGGESTIONS = [
  'Help me think through a tough decision',
  'Draft a thoughtful reply to an important email',
  'Explain how LLM reasoning tokens work',
  'Summarize the core concepts of Apple HIG',
]

export function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  const greeting = getTimeOfDayGreeting()

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center select-none">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className="max-w-lg w-full flex flex-col items-center"
      >
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-text)] mb-1">
          {greeting}.
        </h1>
        <p className="text-ui-base text-[var(--color-text-secondary)] mb-10 font-normal">
          Jarvis
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
          {SUGGESTIONS.map((suggestion, idx) => (
            <motion.button
              key={suggestion}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                type: 'spring',
                stiffness: 350,
                damping: 30,
                delay: 0.05 * (idx + 1),
              }}
              onClick={() => onSuggestionClick(suggestion)}
              className="text-left p-3.5 rounded-card bg-[var(--color-surface-secondary)] border border-[var(--color-separator)] hover:bg-[var(--color-surface-tertiary)] active:scale-[0.98] transition-all text-ui-sm text-[var(--color-text)] text-balance"
            >
              {suggestion}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
