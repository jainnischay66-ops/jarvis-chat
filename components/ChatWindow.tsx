'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useStorage } from '@/hooks/useStorage'
import { useChat } from '@/hooks/useChat'
import { useScrollAnchor } from '@/hooks/useScrollAnchor'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useVoice } from '@/hooks/useVoice'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useVisualViewport } from '@/hooks/useVisualViewport'
import { useToast } from './Toast'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import { MessageList } from './MessageList'
import { Composer } from './Composer'
import { ScrollToBottom } from './ScrollToBottom'
import { SetupScreen } from './SetupScreen'
import { SettingsSheet } from './SettingsSheet'
import { CommandPalette } from './CommandPalette'
import type { ConfigStatus } from '@/lib/env'

export default function ChatWindow() {
  const { toast } = useToast()
  const { isOnline } = useOnlineStatus()
  const { keyboardHeight } = useVisualViewport()

  const [hasScrolled, setHasScrolled] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isPaletteOpen, setIsPaletteOpen] = useState(false)
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null)
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null)

  // Storage hook
  const {
    conversations,
    currentConversation,
    preferences,
    isLoading: isStorageLoading,
    selectConversation,
    createConversation,
    updateConversation,
    deleteConversation,
    undoDelete,
    renameConversation,
    pinConversation,
    updatePreferences,
    saveDraft,
    getGroupedConversations,
    importData,
    clearAllData,
  } = useStorage()

  // Auto-generate title after the first exchange
  const handleAutoTitle = useCallback(
    async (firstUserMessage: string) => {
      if (!currentConversation) return

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              {
                id: 'title-gen',
                role: 'user',
                content: `Generate a short 3-5 word title for a conversation starting with this message: "${firstUserMessage}". Output only the title, no quotes or punctuation.`,
                createdAt: Date.now(),
              },
            ],
            generateTitle: true,
            provider: preferences.provider,
            model: preferences.model,
          }),
        })

        if (res.ok) {
          const data = await res.json()
          if (data.title) {
            renameConversation(currentConversation.id, data.title)
            return
          }
        }
      } catch (e) {
        console.warn('Failed to auto-generate title:', e)
      }

      // Fallback: first 30 chars of the message
      const fallback = firstUserMessage.slice(0, 30).trim()
      renameConversation(currentConversation.id, fallback)
    },
    [currentConversation, preferences, renameConversation]
  )

  // Chat hook
  const {
    isStreaming,
    streamingContent,
    error: chatError,
    sendMessage,
    stopStreaming,
    regenerate,
    editAndResend,
    retry,
  } = useChat({
    currentConversation,
    onUpdateConversation: updateConversation,
    preferences,
    onAutoTitle: handleAutoTitle,
  })

  // Voice hook
  const {
    isListening,
    isSpeaking,
    isSupported: voiceSupported,
    startListening,
    stopSpeaking,
    speak,
  } = useVoice()

  // Scroll anchor ref
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const { showScrollButton, scrollToBottom } = useScrollAnchor(scrollContainerRef)

  // Check scroll position for TopBar styling
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return

    const handleScroll = () => {
      setHasScrolled(el.scrollTop > 10)
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [currentConversation])

  // Check server configuration on mount
  useEffect(() => {
    fetch('/api/chat')
      .then(r => r.json())
      .then(status => {
        setConfigStatus(status)
        if (status.provider && status.model) {
          updatePreferences({
            provider: status.provider,
            model: status.model,
          })
        }
      })
      .catch(() => {
        setConfigStatus({
          configured: false,
          provider: 'gemini',
          model: 'gemini-2.0-flash',
          error: 'Could not connect to the backend server.',
        })
      })
  }, [])

  // Auto-collapse sidebar on small mobile screens initially
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false)
    }
  }, [])

  // Delete conversation with undo toast
  const handleDeleteConversation = useCallback(
    async (id: string) => {
      const { conversation: deleted } = await deleteConversation(id)
      if (deleted) {
        toast('Conversation deleted', {
          action: {
            label: 'Undo',
            onClick: () => undoDelete(deleted),
          },
        })
      }
    },
    [deleteConversation, undoDelete, toast]
  )

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewChat: () => createConversation(),
    onToggleSidebar: () => setSidebarOpen(prev => !prev),
    onOpenPalette: () => setIsPaletteOpen(true),
    onStopStreaming: () => {
      if (isStreaming) stopStreaming()
    },
    onEditLastMessage: () => {
      if (!currentConversation) return
      const userMsgs = currentConversation.messages.filter(m => m.role === 'user')
      if (userMsgs.length > 0) {
        const last = userMsgs[userMsgs.length - 1]
        setEditingMessage({ id: last.id, content: last.content })
      }
    },
  })

  // Open settings
  const handleOpenSettings = () => {
    setIsSettingsOpen(true)
  }

  // Copy handler
  const handleCopy = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text)
      toast('Copied to clipboard')
    },
    [toast]
  )

  // Voice start handler
  const handleVoiceStart = useCallback(() => {
    if (isListening) return
    startListening((transcript: string) => {
      if (transcript.trim()) {
        sendMessage(transcript)
      }
    })
  }, [isListening, startListening, sendMessage])

  // Show setup screen if server reports no API key
  if (configStatus && !configStatus.configured) {
    return <SetupScreen provider={configStatus.provider} error={configStatus.error} />
  }

  if (isStorageLoading) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-[var(--color-bg)]">
        <span className="text-ui-base text-[var(--color-text-secondary)]">Loading...</span>
      </div>
    )
  }

  const grouped = getGroupedConversations()
  const currentTitle = currentConversation?.title || 'New conversation'
  const modelName = preferences.model || configStatus?.model || 'gemini-2.0-flash'

  return (
    <div className="flex h-[100dvh] w-full bg-[var(--color-bg)] overflow-hidden">
      {/* Offline banner */}
      {!isOnline && (
        <div className="fixed top-0 inset-x-0 z-50 bg-[var(--color-destructive)] text-white text-center py-1 text-xs font-medium">
          You are currently offline. Responses will resume when your connection is restored.
        </div>
      )}

      {/* Left Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        groupedConversations={grouped}
        currentId={currentConversation?.id}
        onClose={() => setSidebarOpen(false)}
        onSelect={selectConversation}
        onNewChat={() => createConversation()}
        onRename={renameConversation}
        onPin={pinConversation}
        onDelete={handleDeleteConversation}
      />

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col h-full relative min-w-0 overflow-hidden">
        {/* Top Bar */}
        <TopBar
          title={currentTitle}
          modelName={modelName}
          hasScrolled={hasScrolled}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
          onOpenSettings={handleOpenSettings}
          onRenameTitle={newTitle => {
            if (currentConversation) {
              renameConversation(currentConversation.id, newTitle)
            }
          }}
        />

        {/* Inline error banner if any */}
        {chatError && (
          <div className="mx-auto max-w-[720px] w-full px-4 pt-2">
            <div className="flex items-center justify-between px-3 py-2 rounded-card bg-[var(--color-destructive)]/10 border border-[var(--color-destructive)]/30 text-ui-sm text-[var(--color-destructive)]">
              <span>{chatError}</span>
              <button
                onClick={retry}
                className="underline hover:opacity-80 font-medium ml-2"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Message List */}
        <MessageList
          messages={currentConversation?.messages || []}
          streamingContent={streamingContent}
          isStreaming={isStreaming}
          onCopy={handleCopy}
          onRegenerate={regenerate}
          onEdit={(id, content) => setEditingMessage({ id, content })}
          onReadAloud={content => {
            if (isSpeaking) {
              stopSpeaking()
            } else {
              speak(content)
            }
          }}
          isReading={isSpeaking}
          onSuggestionClick={prompt => sendMessage(prompt)}
          scrollContainerRef={scrollContainerRef}
        />

        {/* Scroll to Bottom Button */}
        <ScrollToBottom
          visible={showScrollButton}
          onClick={() => scrollToBottom('smooth')}
        />

        {/* Composer */}
        <Composer
          onSend={(content, attachments) => sendMessage(content, attachments)}
          onStop={stopStreaming}
          isStreaming={isStreaming}
          editingMessage={editingMessage}
          onCancelEdit={() => setEditingMessage(null)}
          onSaveEdit={(id, content) => {
            editAndResend(id, content)
            setEditingMessage(null)
          }}
          draft={currentConversation?.draft || ''}
          onDraftChange={draft => {
            if (currentConversation) {
              saveDraft(currentConversation.id, draft)
            }
          }}
          voiceSupported={voiceSupported}
          onVoiceStart={handleVoiceStart}
          isListening={isListening}
          keyboardHeight={keyboardHeight}
        />

        {/* Settings Sheet */}
        <SettingsSheet
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          preferences={preferences}
          onUpdatePreferences={updatePreferences}
          conversations={conversations}
          onImportData={importData}
          onClearAllData={clearAllData}
        />

        {/* Command Palette */}
        <CommandPalette
          isOpen={isPaletteOpen}
          onClose={() => setIsPaletteOpen(false)}
          onNewChat={() => createConversation()}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onSelectConversation={selectConversation}
          conversations={conversations}
          preferences={preferences}
          onUpdatePreferences={updatePreferences}
        />
      </main>
    </div>
  )
}
