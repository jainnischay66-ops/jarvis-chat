'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

interface ScrollToBottomProps {
  visible: boolean
  onClick: () => void
}

export function ScrollToBottom({ visible, onClick }: ScrollToBottomProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          onClick={onClick}
          aria-label="Scroll to latest messages"
          className="fixed bottom-28 right-8 z-30 w-9 h-9 rounded-full bg-[var(--color-surface)] border border-[var(--color-separator)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] shadow-float flex items-center justify-center transition-transform active:scale-95"
        >
          <ChevronDown size={18} strokeWidth={1.5} />
        </motion.button>
      )}
    </AnimatePresence>
  )
}
