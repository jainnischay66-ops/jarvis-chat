'use client'

import React from 'react'

interface FlowFrameProps {
  children: React.ReactNode
  className?: string
  active?: boolean
  onClick?: () => void
}

/**
 * FlowFrame — Reusable container with signature iridescent rotating glow border
 * Cycles: cyan -> electric blue -> violet -> magenta -> gold -> cyan
 */
export function FlowFrame({
  children,
  className = '',
  active = false,
  onClick,
}: FlowFrameProps) {
  return (
    <div
      onClick={onClick}
      className={`flow-border ${active ? 'flow-active' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
