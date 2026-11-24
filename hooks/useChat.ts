'use client'

import { useState, useCallback, useRef } from 'react'
import type { Conversation, StoredAttachment, StoredMessage, UIPreferences } from '@/lib/storage'
import { generateId } from '@/lib/utils'

interface UseChatProps {
  currentConversation: Conversation | null
  onUpdateConversation: (conv: Conversation) => Promise<void>
  preferences: UIPreferences
  onAutoTitle?: (conversationId: string, firstUserMessage: string) => void
}

export function useChat({
  currentConversation,
  onUpdateConversation,
  preferences,
  onAutoTitle,
}: UseChatProps) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  const executeSend = useCallback(
    async (
      messagesToSend: StoredMessage[],
      activeConversation: Conversation,
      retryCount = 0
    ) => {
      stopStreaming()

      const controller = new AbortController()
      abortControllerRef.current = controller

      setIsStreaming(true)
      setStreamingContent('')
      setError(null)

      let accumulatedText = ''

      try {
        // Limit context according to preferences
        const maxContext = preferences.maxContextMessages || 50
        const contextMessages = messagesToSend.slice(-maxContext)

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: contextMessages,
            provider: preferences.provider,
            model: preferences.model,
            temperature: preferences.temperature,
            systemPrompt: preferences.systemPrompt,
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          if (response.status === 429 && retryCount < 2) {
            // Auto-retry on rate limit with backoff
            const delay = (retryCount + 1) * 2000
            await new Promise(r => setTimeout(r, delay))
            return executeSend(messagesToSend, activeConversation, retryCount + 1)
          }

          let errMsg = 'Failed to generate response.'
          try {
            const errData = await response.json()
            errMsg = errData.error || errMsg
          } catch {
            errMsg = response.statusText || errMsg
          }
          throw new Error(errMsg)
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No readable response stream.')

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data: ')) continue
            try {
              const chunk = JSON.parse(trimmed.slice(6))
              if (chunk.type === 'text') {
                accumulatedText += chunk.content
                setStreamingContent(accumulatedText)
              } else if (chunk.type === 'error') {
                throw new Error(chunk.content)
              }
            } catch (e: any) {
              if (e.message && !e.message.includes('JSON')) {
                throw e
              }
            }
          }
        }

        const assistantMsg: StoredMessage = {
          id: generateId(),
          role: 'assistant',
          content: accumulatedText,
          createdAt: Date.now(),
        }

        const finalConversation: Conversation = {
          ...activeConversation,
          messages: [...messagesToSend, assistantMsg],
          updatedAt: Date.now(),
        }

        await onUpdateConversation(finalConversation)

        // If this was the first exchange, trigger auto-titling
        if (
          messagesToSend.length === 1 &&
          (!activeConversation.title || activeConversation.title === 'New conversation') &&
          onAutoTitle
        ) {
          onAutoTitle(finalConversation.id, messagesToSend[0].content)
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          // User aborted: keep partial response marked as stopped
          if (accumulatedText) {
            const stoppedMsg: StoredMessage = {
              id: generateId(),
              role: 'assistant',
              content: accumulatedText,
              createdAt: Date.now(),
              stopped: true,
            }
            const stoppedConv: Conversation = {
              ...activeConversation,
              messages: [...messagesToSend, stoppedMsg],
              updatedAt: Date.now(),
            }
            await onUpdateConversation(stoppedConv)
          }
        } else {
          const message = err instanceof Error ? err.message : 'An error occurred.'
          setError(message)
        }
      } finally {
        setIsStreaming(false)
        setStreamingContent('')
        abortControllerRef.current = null
      }
    },
    [preferences, stopStreaming, onUpdateConversation, onAutoTitle]
  )

  const sendMessage = useCallback(
    async (content: string, attachments?: StoredAttachment[]) => {
      if (!currentConversation) return
      if (!content.trim() && (!attachments || attachments.length === 0)) return

      const userMsg: StoredMessage = {
        id: generateId(),
        role: 'user',
        content: content.trim(),
        createdAt: Date.now(),
        attachments,
      }

      const nextMessages = [...currentConversation.messages, userMsg]
      
      // Immediately set title from first user message (truncated to ~40 characters)
      const currentTitle = currentConversation.title
      const needsTitle = !currentTitle || currentTitle === 'New conversation' || currentTitle === 'NEW CONVERSATION' || currentTitle === 'NEW PROTOCOL'
      const derivedTitle = needsTitle
        ? (content.trim().slice(0, 40) || 'New conversation')
        : currentTitle

      const updatedConv = {
        ...currentConversation,
        title: derivedTitle,
        messages: nextMessages,
        draft: '',
      }

      await onUpdateConversation(updatedConv)
      await executeSend(nextMessages, updatedConv)
    },
    [currentConversation, onUpdateConversation, executeSend]
  )

  const regenerate = useCallback(
    async (messageId: string) => {
      if (!currentConversation) return
      const targetIndex = currentConversation.messages.findIndex(m => m.id === messageId)
      if (targetIndex === -1) return

      // Find the user message before this assistant message
      const targetMsg = currentConversation.messages[targetIndex]
      const prevMessages = currentConversation.messages.slice(0, targetIndex)

      if (targetMsg.role === 'assistant') {
        // Save current version
        const versions = targetMsg.versions || [targetMsg.content]
        const nextMessages = prevMessages
        await executeSend(nextMessages, {
          ...currentConversation,
          messages: nextMessages,
        })
      }
    },
    [currentConversation, executeSend]
  )

  const editAndResend = useCallback(
    async (messageId: string, newContent: string) => {
      if (!currentConversation) return
      const targetIndex = currentConversation.messages.findIndex(m => m.id === messageId)
      if (targetIndex === -1) return

      const targetMsg = currentConversation.messages[targetIndex]
      const editedUserMsg: StoredMessage = {
        ...targetMsg,
        content: newContent.trim(),
      }

      const truncatedMessages = [
        ...currentConversation.messages.slice(0, targetIndex),
        editedUserMsg,
      ]

      const updatedConv = {
        ...currentConversation,
        messages: truncatedMessages,
      }

      await onUpdateConversation(updatedConv)
      await executeSend(truncatedMessages, updatedConv)
    },
    [currentConversation, onUpdateConversation, executeSend]
  )

  const retry = useCallback(async () => {
    if (!currentConversation || currentConversation.messages.length === 0) return
    setError(null)
    await executeSend(currentConversation.messages, currentConversation)
  }, [currentConversation, executeSend])

  return {
    isStreaming,
    streamingContent,
    error,
    sendMessage,
    stopStreaming,
    regenerate,
    editAndResend,
    retry,
    clearError: () => setError(null),
  }
}
