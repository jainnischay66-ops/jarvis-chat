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
  scrollContainerRef: RefObject<HTMLDivElement | null>
  state?: CoreState
  level?: number
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
  scrollContainerRef,
  state = 'idle',
  level = 0,
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
    <div
      ref={scrollContainerRef}
      className="flex-1 w-full overflow-y-auto px-4 pt-8 pb-36 momentum-scroll z-10"
    >
      <div className="max-w-[720px] mx-auto w-full flex flex-col justify-end min-h-full">
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
      </div>
    </div>
  )
}
