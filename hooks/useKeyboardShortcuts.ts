'use client'

import { useEffect } from 'react'

export interface ShortcutItem {
  keys: string[]
  description: string
}

export const SHORTCUTS: ShortcutItem[] = [
  { keys: ['⌘', 'K'], description: 'Open command palette' },
  { keys: ['⌘', '⇧', 'O'], description: 'New conversation' },
  { keys: ['⌘', 'B'], description: 'Toggle sidebar' },
  { keys: ['Esc'], description: 'Stop streaming response' },
  { keys: ['↑'], description: 'Edit last message (in empty composer)' },
  { keys: ['Return'], description: 'Send message' },
  { keys: ['⇧', 'Return'], description: 'New line in composer' },
]

interface KeyboardShortcutsHandlers {
  onNewChat: () => void
  onToggleSidebar: () => void
  onOpenPalette: () => void
  onStopStreaming: () => void
  onEditLastMessage: () => void
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutsHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey

      // Cmd+K -> open command palette
      if (isMeta && (e.key === 'k' || e.key === 'K') && !e.shiftKey) {
        e.preventDefault()
        handlers.onOpenPalette()
        return
      }

      // Cmd+Shift+O -> new chat
      if (isMeta && e.shiftKey && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault()
        handlers.onNewChat()
        return
      }

      // Cmd+B -> toggle sidebar
      if (isMeta && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault()
        handlers.onToggleSidebar()
        return
      }

      // Esc -> stop streaming
      if (e.key === 'Escape') {
        handlers.onStopStreaming()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlers])
}
