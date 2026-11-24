'use client'

import React, { useState } from 'react'
import { Copy, Check, RotateCw, Pencil, Volume2, VolumeX } from 'lucide-react'

interface MessageActionsProps {
  messageRole: 'user' | 'assistant'
  onCopy: () => void
  onRegenerate?: () => void
  onEdit?: () => void
  onReadAloud?: () => void
  isReading?: boolean
  visible?: boolean
}

export function MessageActions({
  messageRole,
  onCopy,
  onRegenerate,
  onEdit,
  onReadAloud,
  isReading = false,
  visible = true,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    onCopy()
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      className={`flex items-center gap-1 mt-1.5 text-[var(--color-text-tertiary)] select-none transition-opacity duration-150 ${
        visible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
      }`}
    >
      <button
        onClick={handleCopy}
        aria-label="Copy message"
        title="Copy"
        className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text)] active:scale-95 transition-all"
      >
        {copied ? (
          <Check size={14} strokeWidth={1.5} className="text-[var(--color-accent)]" />
        ) : (
          <Copy size={14} strokeWidth={1.5} />
        )}
      </button>

      {messageRole === 'assistant' && onRegenerate && (
        <button
          onClick={onRegenerate}
          aria-label="Regenerate response"
          title="Regenerate"
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text)] active:scale-95 transition-all"
        >
          <RotateCw size={14} strokeWidth={1.5} />
        </button>
      )}

      {messageRole === 'assistant' && onReadAloud && (
        <button
          onClick={onReadAloud}
          aria-label={isReading ? 'Stop speaking' : 'Read aloud'}
          title={isReading ? 'Stop speaking' : 'Read aloud'}
          className={`w-7 h-7 rounded-full flex items-center justify-center hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text)] active:scale-95 transition-all ${
            isReading ? 'text-[var(--color-accent)]' : ''
          }`}
        >
          {isReading ? <VolumeX size={14} strokeWidth={1.5} /> : <Volume2 size={14} strokeWidth={1.5} />}
        </button>
      )}

      {messageRole === 'user' && onEdit && (
        <button
          onClick={onEdit}
          aria-label="Edit message"
          title="Edit"
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text)] active:scale-95 transition-all"
        >
          <Pencil size={14} strokeWidth={1.5} />
        </button>
      )}
    </div>
  )
}
