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

function formatTime(timestamp?: number) {
  if (!timestamp) return '00:00:00'
  const d = new Date(timestamp)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
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
      initial={{ opacity: 0, y: isUser ? 24 : 8, scale: isUser ? 0.98 : 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: isUser ? 0.28 : 0.4, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative flex flex-col w-full ${isUser ? 'items-end' : 'items-start'} mb-6`}
    >
      {isUser ? (
        /* User messages: right-aligned cyan chamfered panel with corner brackets, max 80% */
        <div className="flex flex-col items-end max-w-[80%]">
          {/* Attachments preview if any */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 justify-end">
              {message.attachments.map(att => (
                <div
                  key={att.id}
                  className="overflow-hidden border border-[var(--line)] max-w-[200px]"
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

          {/* User Bubble: chamfered with corner brackets, inner glow */}
          <div className="chamfer-card holo-brackets px-4 py-3 bg-[var(--cyan-faint)] border border-[rgba(92,203,245,0.35)] text-[var(--text)] select-text shadow-[inset_0_0_12px_rgba(92,203,245,0.06)]">
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
        /* Assistant messages: floating holo panel with gold node, thin vertical data line, header J.A.R.V.I.S. with tiny live timestamp in mono */
        <div className="w-full select-text relative pl-6 my-1">
          {/* 1px Left rail in var(--line) */}
          <div className="absolute left-2 top-0 bottom-0 w-[1px] bg-[var(--line)] overflow-hidden pointer-events-none">
            {isStreaming && (
              <div className="w-full h-12 bg-gradient-to-b from-transparent via-[var(--cyan)] to-transparent agent-rail-scanner" />
            )}
          </div>

          {/* Gold node on the first line */}
          <div className="absolute left-[5px] top-[14px] w-[7px] h-[7px] rounded-full bg-[var(--gold)] shadow-[var(--glow-gold)] pointer-events-none z-10">
            {isStreaming && (
              <div className="absolute inset-0 rounded-full bg-[var(--gold)] animate-ping opacity-75" />
            )}
          </div>

          {/* Floating holo panel container */}
          <div
            className={`holo-assistant-panel p-4 w-full transition-all duration-300 ${
              isStreaming
                ? 'flow-border flow-active'
                : 'holo-materialize holo-shimmer-settle'
            }`}
          >
            {/* Header: J.A.R.V.I.S. with live timestamp in mono */}
            <div className="flex items-center justify-between w-full mb-2.5 select-none border-b border-[var(--line)] pb-1.5">
              <div className="flex items-center gap-2.5">
                <span className="font-hud font-semibold text-xs tracking-widest text-[var(--cyan)]">
                  J.A.R.V.I.S.
                </span>
                {isStreaming ? (
                  <span className="font-mono text-[10px] text-[var(--gold)] tracking-widest animate-pulse">
                    TRANSMITTING
                  </span>
                ) : (
                  <span className="font-mono text-[10px] text-[var(--text-3)] tracking-wider">
                    {formatTime(message.createdAt)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 font-mono text-[10px] text-[var(--text-3)]">
                <span>SEC: NOMINAL</span>
              </div>
            </div>

            {/* Message body in Inter */}
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
              <span className="font-mono text-[11px] text-[var(--red)] mt-2 inline-block tracking-wider uppercase select-none">
                [SEQUENCE TERMINATED]
              </span>
            )}

            {/* Message Actions */}
            <MessageActions
              messageRole="assistant"
              onCopy={() => onCopy(displayContent)}
              onRegenerate={onRegenerate ? () => onRegenerate(message.id) : undefined}
              onReadAloud={onReadAloud ? () => onReadAloud(displayContent) : undefined}
              isReading={isReading}
              visible={isHovered || isStreaming}
            />
          </div>
        </div>
      )}
    </motion.div>
  )
})
