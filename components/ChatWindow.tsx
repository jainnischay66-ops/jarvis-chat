'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
import { HudBackdrop } from './HudBackdrop'
import type { ConfigStatus } from '@/lib/env'
import type { CoreState } from './JarvisCore'

export default function ChatWindow() {
  const { toast } = useToast()
  const { isOnline } = useOnlineStatus()
  const { keyboardHeight } = useVisualViewport()

  const [hasScrolled, setHasScrolled] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null)
  const sendTimeRef = useRef<number | null>(null)

  const [panDirection, setPanDirection] = useState<number>(1)
  const [isPanning, setIsPanning] = useState<boolean>(false)
  const [reducedMotion, setReducedMotion] = useState<boolean>(false)
  const prevConversationIdRef = useRef<string | null>(null)

  // Track prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // On mobile screens, start with sidebar closed so chat is immediately visible
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setSidebarOpen(false)
    }
  }, [])
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

  // Track camera-pan direction when switching conversations
  useEffect(() => {
    const currentId = currentConversation?.id || null
    const prevId = prevConversationIdRef.current
    if (prevId !== currentId) {
      if (!currentId) {
        setPanDirection(1)
      } else if (prevId) {
        const prevIdx = conversations.findIndex(c => c.id === prevId)
        const currIdx = conversations.findIndex(c => c.id === currentId)
        if (prevIdx !== -1 && currIdx !== -1) {
          setPanDirection(currIdx > prevIdx ? -1 : 1)
        } else {
          setPanDirection(1)
        }
      } else {
        setPanDirection(1)
      }
      prevConversationIdRef.current = currentId
      setIsPanning(true)
      const timer = setTimeout(() => setIsPanning(false), 500)
      return () => clearTimeout(timer)
    }
  }, [currentConversation?.id, conversations])

  // Auto-generate title after the first exchange
  const handleAutoTitle = useCallback(
    async (conversationId: string, firstUserMessage: string) => {
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
            await renameConversation(conversationId, data.title)
            return
          }
        }
      } catch (e) {
        console.warn('Failed to auto-generate title:', e)
      }

      const fallback = firstUserMessage.slice(0, 30).trim()
      await renameConversation(conversationId, fallback)
    },
    [preferences.provider, preferences.model, renameConversation]
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
    preferences,
    onUpdateConversation: updateConversation,
    onAutoTitle: handleAutoTitle,
  })

  // Voice hook
  const {
    isListening,
    isSpeaking,
    isSupported: voiceSupported,
    startListening,
    speak,
    stopSpeaking,
  } = useVoice()

  // Core State & Streaming Token Rate Smoothing
  const [streamLevel, setStreamLevel] = useState(0)
  const lastTokenTimeRef = useRef<number>(Date.now())
  const lastCharCountRef = useRef<number>(0)
  const smoothedLevelRef = useRef<number>(0)

  useEffect(() => {
    if (!isStreaming) {
      lastCharCountRef.current = 0
      smoothedLevelRef.current = 0
      setStreamLevel(0)
      return
    }

    const interval = setInterval(() => {
      const now = Date.now()
      const dt = Math.max(0.05, (now - lastTokenTimeRef.current) / 1000)
      const currentChars = streamingContent.length
      const deltaChars = Math.max(0, currentChars - lastCharCountRef.current)

      lastCharCountRef.current = currentChars
      lastTokenTimeRef.current = now

      const tokensPerSecond = (deltaChars / 4) / dt
      const targetLevel = Math.min(1, Math.max(0, tokensPerSecond / 40))

      smoothedLevelRef.current += (targetLevel - smoothedLevelRef.current) * 0.3
      setStreamLevel(smoothedLevelRef.current)
    }, 100)

    return () => clearInterval(interval)
  }, [isStreaming, streamingContent])

  const coreState: CoreState = isListening
    ? 'listening'
    : isStreaming
    ? (streamingContent ? 'speaking' : 'thinking')
    : isSpeaking
    ? 'speaking'
    : 'idle'

  const coreLevel = isListening ? 0.6 : streamLevel

  // Track response latency
  useEffect(() => {
    if (isStreaming && streamingContent && sendTimeRef.current !== null) {
      const elapsed = Math.round(performance.now() - sendTimeRef.current)
      setLastLatencyMs(elapsed)
      sendTimeRef.current = null
    }
  }, [isStreaming, streamingContent])

  const handleSendMessage = useCallback(
    async (content: string, attachments?: any[]) => {
      sendTimeRef.current = performance.now()
      sendMessage(content, attachments)
    },
    [sendMessage]
  )

  // Check backend config and align active provider if configured on server
  useEffect(() => {
    fetch('/api/chat')
      .then(r => r.json())
      .then(data => {
        const status = data.status || data
        if (status) {
          setConfigStatus(status)
          if (status.provider && status.configured) {
            updatePreferences({
              provider: status.provider,
              model: status.model,
            })
          }
        }
      })
      .catch(() => {})
  }, [updatePreferences])

  // Scroll anchor ref
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const { showScrollButton, scrollToBottom } = useScrollAnchor(scrollContainerRef)

  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return

    const handleScroll = () => {
      setHasScrolled(el.scrollTop > 10)
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [currentConversation])

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      const conv = conversations.find(c => c.id === id)
      await deleteConversation(id)

      if (conv) {
        toast(`Archived "${conv.title}"`, {
          action: {
            label: 'UNDO',
            onClick: async () => {
              await undoDelete(conv)
            },
          },
        })
      }
    },
    [conversations, deleteConversation, undoDelete, toast]
  )

  useKeyboardShortcuts({
    onNewChat: () => createConversation(),
    onToggleSidebar: () => setSidebarOpen(prev => !prev),
    onOpenPalette: () => setIsPaletteOpen(prev => !prev),
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

  const handleOpenSettings = () => {
    setIsSettingsOpen(true)
  }

  const handleCopy = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text)
      toast('COPIED TO CLIPBOARD')
    },
    [toast]
  )

  const handleVoiceStart = useCallback(() => {
    if (isListening) return
    startListening((transcript: string) => {
      if (transcript.trim()) {
        sendMessage(transcript)
      }
    })
  }, [isListening, startListening, sendMessage])

  if (configStatus && !configStatus.configured) {
    return <SetupScreen provider={configStatus.provider} error={configStatus.error} />
  }

  if (isStorageLoading) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-[var(--bg)] font-hud text-sm tracking-wider text-[var(--cyan)]">
        SYSTEM BOOTING...
      </div>
    )
  }

  const grouped = getGroupedConversations()
  const currentTitle = currentConversation?.title || 'NEW CONVERSATION'
  const modelName = preferences.model || configStatus?.model || 'gemini-2.0-flash'
  const hasMessages = Boolean(
    (currentConversation?.messages && currentConversation.messages.length > 0) || isStreaming
  )

  return (
    <div
      className={`app h-[100dvh] w-full bg-[var(--bg)] text-[var(--text)] overflow-hidden relative ${
        sidebarOpen ? '' : 'sidebar-closed'
      }`}
    >
      {/* Offline banner */}
      {!isOnline && (
        <div className="fixed top-0 inset-x-0 z-50 bg-[var(--red)] text-white text-center py-1 font-hud text-xs tracking-wider">
          OFFLINE PROTOCOL ENGAGED · RECONNECTING...
        </div>
      )}

      {/* Left Sidebar (col 1 of .app grid) */}
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

      {/* Main Chat Area (col 2 of .app grid): 3 rows: TopBar (56px), Scroll (minmax(0, 1fr)), Composer (auto) */}
      <main className="main h-full min-h-0 min-w-0 relative z-10 overflow-hidden">
        {/* Living Holographic HUD Backdrop: placed INSIDE .main so center is chat center and bounds are clipped */}
        <HudBackdrop
          state={coreState}
          level={coreLevel}
          hasMessages={hasMessages}
          messageCount={currentConversation?.messages?.length || 0}
          lastLatencyMs={lastLatencyMs}
          isOnline={isOnline}
          panOffset={isPanning ? panDirection * -24 : 0}
          isPanning={isPanning}
          composerHeight={80}
        />

        {/* Row 1: Top Bar (56px) */}
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
          isOnline={isOnline}
          hasMessages={hasMessages}
          coreState={coreState}
        />

        {/* Row 2: Scroll area */}
        <div ref={scrollContainerRef} className="scroll overflow-y-auto min-h-0 w-full relative">
          {/* Inline error banner if any */}
          {chatError && (
            <div className="column w-full max-w-[760px] mx-auto px-4 pt-2 z-20">
              <div className="chamfer-card flex items-center justify-between px-3 py-2 bg-[var(--surface-hi)] border border-[var(--red)] text-xs font-mono text-[var(--red)]">
                <span>{chatError}</span>
                <button
                  onClick={retry}
                  className="underline hover:opacity-80 font-hud uppercase tracking-wider ml-2 cursor-pointer"
                >
                  RETRY
                </button>
              </div>
            </div>
          )}

          <AnimatePresence mode="popLayout" custom={panDirection} initial={false}>
            <motion.div
              key={currentConversation?.id || 'empty-stage'}
              custom={panDirection}
              variants={{
                enter: (dir: number) =>
                  reducedMotion
                    ? { opacity: 0, x: 0, scale: 1, filter: 'none' }
                    : {
                        x: dir > 0 ? '8%' : '-8%',
                        scale: 0.98,
                        opacity: 0,
                        filter: 'blur(4px)',
                      },
                center: reducedMotion
                  ? {
                      opacity: 1,
                      x: 0,
                      scale: 1,
                      filter: 'none',
                      transition: { duration: 0.15 },
                    }
                  : {
                      x: '0%',
                      scale: 1,
                      opacity: 1,
                      filter: 'blur(0px)',
                      transition: {
                        duration: 0.45,
                        ease: [0.22, 1, 0.36, 1],
                      },
                    },
                exit: (dir: number) =>
                  reducedMotion
                    ? {
                        opacity: 0,
                        x: 0,
                        scale: 1,
                        filter: 'none',
                        transition: { duration: 0.15 },
                      }
                    : {
                        x: dir > 0 ? '-8%' : '8%',
                        scale: 0.96,
                        opacity: 0,
                        filter: 'blur(4px)',
                        transition: {
                          duration: 0.45,
                          ease: [0.22, 1, 0.36, 1],
                        },
                      },
              }}
              initial="enter"
              animate="center"
              exit="exit"
              className={`column w-full max-w-[760px] mx-auto px-4 min-h-full flex flex-col relative z-10 ${
                hasMessages
                  ? 'justify-start backdrop-blur-[2px] bg-gradient-to-b from-transparent via-[rgba(2,4,10,0.55)] to-transparent'
                  : 'justify-center'
              }`}
            >
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
                onSuggestionClick={prompt => handleSendMessage(prompt)}
                scrollContainerRef={scrollContainerRef}
                state={coreState}
                level={coreLevel}
                error={chatError}
                onRetry={retry}
              />
            </motion.div>
          </AnimatePresence>

          {/* Scroll to Bottom Button */}
          <ScrollToBottom
            visible={showScrollButton}
            onClick={() => scrollToBottom('smooth')}
          />
        </div>

        {/* Row 3: Composer wrapper in flow (NOT fixed or absolute) */}
        <div className="composer-wrap w-full">
          <div className="column w-full max-w-[760px] mx-auto px-0">
            <Composer
              onSend={(content, attachments) => handleSendMessage(content, attachments)}
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
          </div>
        </div>

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
