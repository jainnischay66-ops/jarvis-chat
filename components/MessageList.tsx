'use client'

import React, { RefObject } from 'react'
import type { StoredMessage } from '@/lib/storage'
import type { CoreState } from './JarvisCore'
import { Message } from './Message'
import { EmptyState } from './EmptyState'

interface MessageListProps {
  messages: StoredMessage[]
  streamingContent: string
  isStreaming: boolean
  onCopy: (content: string) => void
  onRegenerate: (id: string) => void
  onEdit: (id: string, content: string) => void
  onReadAloud: (content: string) => void
  isReading: boolean
  onSuggestionClick: (prompt: string) => void
  scrollContainerRef?: RefObject<HTMLDivElement | null>
  state?: CoreState
  level?: number
  error?: string | null
  onRetry?: () => void
}

export function MessageList({
  messages,
  streamingContent,
  isStreaming,
  onCopy,
  onRegenerate,
  onEdit,
  onReadAloud,
  isReading,
  onSuggestionClick,
  state = 'idle',
  level = 0,
  error = null,
  onRetry,
}: MessageListProps) {
  if (messages.length === 0 && !isStreaming) {
    return (
      <EmptyState
        onSuggestionClick={onSuggestionClick}
        state={state}
        level={level}
      />
    )
  }

  return (
    <div className="w-full flex flex-col justify-start min-h-full pt-4 pb-24 space-y-6">
      {messages.map((message, idx) => (
        <Message
          key={message.id}
          message={message}
          onCopy={onCopy}
          onRegenerate={onRegenerate}
          onEdit={onEdit}
          onReadAloud={onReadAloud}
          isReading={isReading}
          isLatest={idx === messages.length - 1}
        />
      ))}

      {/* Live streaming message container if assistant is currently generating */}
      {isStreaming && (
        <Message
          key="streaming-live"
          message={{
            id: 'streaming-live',
            role: 'assistant',
            content: streamingContent,
            createdAt: Date.now(),
          }}
          isStreaming={true}
          streamingContent={streamingContent}
          onCopy={onCopy}
          isLatest={true}
        />
      )}

      {/* In-thread error panel (red node, message, retry button) if response failed */}
      {error && !isStreaming && (
        <div className="w-full relative pl-6 my-2">
          {/* 1px Left rail in var(--line) */}
          <div className="absolute left-2 top-0 bottom-0 w-[1px] bg-[var(--line)] overflow-hidden pointer-events-none" />
          
          {/* Red node on the left rail */}
          <div className="absolute left-[5px] top-[14px] w-[7px] h-[7px] rounded-full bg-[var(--red)] shadow-[0_0_10px_var(--red)] pointer-events-none z-10" />

          {/* Chamfered error container */}
          <div className="chamfer-card p-4 bg-[rgba(255,77,77,0.06)] border border-[rgba(255,77,77,0.5)] text-[var(--text)] select-text">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-[rgba(255,77,77,0.2)]">
              <div className="flex items-center gap-2">
                <span className="font-hud font-semibold text-xs tracking-widest text-[var(--red)]">
                  J.A.R.V.I.S. PROTOCOL ERROR
                </span>
                <span className="font-mono text-[10px] text-[var(--red)] tracking-wider animate-pulse">
                  TRANSMISSION FAILED
                </span>
              </div>
            </div>

            <p className="font-mono text-xs text-[var(--red)] mb-3 leading-relaxed break-words">
              {error}
            </p>

            {onRetry && (
              <button
                onClick={onRetry}
                className="font-hud text-xs tracking-wider uppercase px-3 py-1.5 bg-[var(--surface-hi)] border border-[var(--red)] text-[var(--red)] hover:bg-[var(--red)] hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>RETRY PROTOCOL</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
