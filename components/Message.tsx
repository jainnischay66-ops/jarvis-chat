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
        /* User messages: right-aligned .holo panel with chamfered corners, cyan border, background var(--cyan-faint), text var(--text), max 80% */
        <div className="flex flex-col items-end max-w-[80%]">
          {/* Attachments preview if any */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 justify-end">
              {message.attachments.map(att => (
                <div
                  key={att.id}
                  className="holo overflow-hidden border border-[var(--cyan)] max-w-[200px]"
                >
                  {att.type === 'image' && att.preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={att.preview}
                      alt={att.name}
                      className="max-h-32 object-cover"
                    />
                  ) : (
                    <div className="px-3 py-1.5 text-xs font-mono bg-[var(--surface-hi)] text-[var(--text)] truncate">
                      {att.name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* User Holo Bubble */}
          <div className="holo px-4 py-3 bg-[var(--cyan-faint)] border border-[var(--cyan)] text-[var(--text)] select-text shadow-[0_0_12px_rgba(92,203,245,0.15)] message-user">
            <p className="font-body-inter whitespace-pre-wrap break-words text-[var(--text)]">
              {message.content}
            </p>
          </div>

          <MessageActions
            messageRole="user"
            onCopy={() => onCopy(message.content)}
            onEdit={onEdit ? () => onEdit(message.id, message.content) : undefined}
            visible={isHovered}
          />
        </div>
      ) : (
        /* Agent messages: no box. Full column width, a 1px left rail in var(--line) with a gold node on the first line, a mono label "J.A.R.V.I.S." in text-3, body in Inter. While streaming, the rail's gold node pulses and a thin cyan progress scan line runs along the rail. No jitter, no layout shift. */
        <div className="w-full flex flex-col items-start select-text relative pl-6 my-1">
          {/* 1px Left rail in var(--line) */}
          <div className="absolute left-2 top-0 bottom-0 w-[1px] bg-[var(--line)] overflow-hidden pointer-events-none">
            {/* Thin cyan progress scan line during streaming */}
            {isStreaming && (
              <div className="w-full h-12 bg-gradient-to-b from-transparent via-[var(--cyan)] to-transparent agent-rail-scanner" />
            )}
          </div>

          {/* Gold node on the first line */}
          <div className="absolute left-[5px] top-[7px] w-[7px] h-[7px] rounded-full bg-[var(--gold)] shadow-[var(--glow-gold)] pointer-events-none">
            {isStreaming && (
              <div className="absolute inset-0 rounded-full bg-[var(--gold)] animate-ping opacity-75" />
            )}
          </div>

          {/* Mono label "J.A.R.V.I.S." in text-3 */}
          <div className="flex items-center gap-2 mb-1.5 select-none">
            <span className="font-mono text-xs tracking-widest text-[var(--text-3)] font-medium">
              J.A.R.V.I.S.
            </span>
            {isStreaming && (
              <span className="font-hud text-[10px] text-[var(--gold)] tracking-widest animate-pulse">
                TRANSMITTING
              </span>
            )}
          </div>

          {/* Message body in Inter (never uppercase) */}
          <div className="w-full font-body-inter text-[var(--text)]">
            {isStreaming && !displayContent ? (
              <div className="flex items-center gap-2 py-2 text-[var(--gold)]">
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse delay-150" />
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse delay-300" />
                <span className="font-mono text-xs text-[var(--text-3)] ml-2 tracking-wider">
                  INITIALIZING ARCHIVE...
                </span>
              </div>
            ) : (
              <MarkdownRenderer
                content={displayContent}
                isStreaming={isStreaming}
              />
            )}
          </div>

          {message.stopped && (
            <span className="font-mono text-[11px] text-[var(--red)] mt-1 tracking-wider uppercase select-none">
              [SEQUENCE TERMINATED]
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
