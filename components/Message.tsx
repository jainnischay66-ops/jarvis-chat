'use client'

import React, { memo, useState } from 'react'
import { motion } from 'framer-motion'
import type { StoredMessage } from '@/lib/storage'
import { MarkdownRenderer } from './MarkdownRenderer'
import { MessageActions } from './MessageActions'

interface MessageProps {
  message: StoredMessage
  isStreaming?: boolean
  streamingContent?: string
  onCopy: (content: string) => void
  onRegenerate?: (id: string) => void
  onEdit?: (id: string, content: string) => void
  onReadAloud?: (content: string) => void
  isReading?: boolean
  isLatest?: boolean
}

export const Message = memo(function Message({
  message,
  isStreaming = false,
  streamingContent = '',
  onCopy,
  onRegenerate,
  onEdit,
  onReadAloud,
  isReading = false,
}: MessageProps) {
  const [isHovered, setIsHovered] = useState(false)
  const isUser = message.role === 'user'

  const displayContent = isStreaming && streamingContent ? streamingContent : message.content

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 34 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative flex flex-col w-full ${isUser ? 'items-end' : 'items-start'} mb-6`}
    >
      {isUser ? (
        <div className="flex flex-col items-end max-w-[80%]">
          {/* Attachments preview if any */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 justify-end">
              {message.attachments.map(att => (
                <div
                  key={att.id}
                  className="rounded-card overflow-hidden border border-[var(--color-separator)] max-w-[200px]"
                >
                  {att.type === 'image' && att.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={att.preview}
                      alt={att.name}
                      className="max-h-32 object-cover rounded-card"
                    />
                  ) : (
                    <div className="px-3 py-1.5 text-xs font-mono bg-[var(--color-surface-secondary)] text-[var(--color-text)] truncate">
                      {att.name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* User Bubble */}
          <div
            style={{
              borderRadius: '20px 20px 4px 20px',
            }}
            className="px-4 py-2.5 bg-[var(--color-accent)] text-white text-body leading-relaxed select-text"
          >
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>

          <MessageActions
            messageRole="user"
            onCopy={() => onCopy(message.content)}
            onEdit={onEdit ? () => onEdit(message.id, message.content) : undefined}
            visible={isHovered}
          />
        </div>
      ) : (
        /* Assistant Message: No bubble, plain text on canvas, full column width */
        <div className="w-full flex flex-col items-start select-text">
          {/* Thinking state before first token */}
          {isStreaming && !displayContent ? (
            <div className="flex items-center gap-1.5 py-3 text-[var(--color-text-tertiary)]">
              <span className="w-2 h-2 rounded-full bg-current thinking-dot" />
              <span className="w-2 h-2 rounded-full bg-current thinking-dot" />
              <span className="w-2 h-2 rounded-full bg-current thinking-dot" />
            </div>
          ) : (
            <MarkdownRenderer
              content={displayContent}
              isStreaming={isStreaming}
            />
          )}

          {message.stopped && (
            <span className="text-xs text-[var(--color-text-tertiary)] mt-1 italic select-none">
              (stopped)
            </span>
          )}

          {!isStreaming && (
            <MessageActions
              messageRole="assistant"
              onCopy={() => onCopy(message.content)}
              onRegenerate={onRegenerate ? () => onRegenerate(message.id) : undefined}
              onReadAloud={onReadAloud ? () => onReadAloud(message.content) : undefined}
              isReading={isReading}
              visible={isHovered}
            />
          )}
        </div>
      )}
    </motion.div>
  )
})
