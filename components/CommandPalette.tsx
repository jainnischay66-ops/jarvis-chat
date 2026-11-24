'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Plus,
  Settings,
  Sun,
  Moon,
  Monitor,
  Cpu,
  MessageSquare,
} from 'lucide-react'
import { useTheme } from './ThemeProvider'
import type { Conversation, UIPreferences } from '@/lib/storage'
import type { ProviderName } from '@/lib/llm/types'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onNewChat: () => void
  onOpenSettings: () => void
  onSelectConversation: (id: string) => void
  conversations: Conversation[]
  preferences: UIPreferences
  onUpdatePreferences: (prefs: Partial<UIPreferences>) => void
}

interface PaletteAction {
  id: string
  label: string
  sublabel?: string
  shortcut?: string
  icon: React.ReactNode
  perform: () => void
  group: 'Actions' | 'Theme' | 'Model' | 'Conversations'
}

export function CommandPalette({
  isOpen,
  onClose,
  onNewChat,
  onOpenSettings,
  onSelectConversation,
  conversations,
  preferences,
  onUpdatePreferences,
}: CommandPaletteProps) {
  const { setTheme } = useTheme()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Reset query and selected index whenever opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Build items list
  const allActions = useMemo(() => {
    const list: PaletteAction[] = [
      {
        id: 'new-chat',
        label: 'New conversation',
        shortcut: '⌘⇧O',
        icon: <Plus size={16} strokeWidth={1.5} className="text-[var(--color-accent)]" />,
        perform: () => {
          onNewChat()
          onClose()
        },
        group: 'Actions',
      },
      {
        id: 'open-settings',
        label: 'Open settings',
        icon: <Settings size={16} strokeWidth={1.5} />,
        perform: () => {
          onOpenSettings()
          onClose()
        },
        group: 'Actions',
      },
      {
        id: 'theme-light',
        label: 'Switch to light mode',
        icon: <Sun size={16} strokeWidth={1.5} />,
        perform: () => {
          setTheme('light')
          onClose()
        },
        group: 'Theme',
      },
      {
        id: 'theme-dark',
        label: 'Switch to dark mode',
        icon: <Moon size={16} strokeWidth={1.5} />,
        perform: () => {
          setTheme('dark')
          onClose()
        },
        group: 'Theme',
      },
      {
        id: 'theme-system',
        label: 'Switch to system theme',
        icon: <Monitor size={16} strokeWidth={1.5} />,
        perform: () => {
          setTheme('system')
          onClose()
        },
        group: 'Theme',
      },
      {
        id: 'provider-openai',
        label: 'Use OpenAI-compatible provider',
        sublabel: preferences.provider === 'openai-compatible' ? 'Active' : undefined,
        icon: <Cpu size={16} strokeWidth={1.5} />,
        perform: () => {
          onUpdatePreferences({ provider: 'openai-compatible' })
          onClose()
        },
        group: 'Model',
      },
      {
        id: 'provider-gemini',
        label: 'Use Google Gemini provider',
        sublabel: preferences.provider === 'gemini' ? 'Active' : undefined,
        icon: <Cpu size={16} strokeWidth={1.5} />,
        perform: () => {
          onUpdatePreferences({ provider: 'gemini', model: 'gemini-2.0-flash' })
          onClose()
        },
        group: 'Model',
      },
      {
        id: 'provider-anthropic',
        label: 'Use Anthropic Claude provider',
        sublabel: preferences.provider === 'anthropic' ? 'Active' : undefined,
        icon: <Cpu size={16} strokeWidth={1.5} />,
        perform: () => {
          onUpdatePreferences({ provider: 'anthropic', model: 'claude-sonnet-4-20250514' })
          onClose()
        },
        group: 'Model',
      },
    ]

    // Append matching conversations
    for (const c of conversations) {
      list.push({
        id: `conv-${c.id}`,
        label: c.title,
        sublabel: new Date(c.updatedAt).toLocaleDateString(),
        icon: <MessageSquare size={16} strokeWidth={1.5} />,
        perform: () => {
          onSelectConversation(c.id)
          onClose()
        },
        group: 'Conversations',
      })
    }

    return list
  }, [
    conversations,
    preferences.provider,
    onNewChat,
    onOpenSettings,
    onSelectConversation,
    setTheme,
    onUpdatePreferences,
    onClose,
  ])

  // Filter actions based on search query
  const filteredActions = useMemo(() => {
    if (!query.trim()) return allActions
    const q = query.toLowerCase()
    return allActions.filter(
      a =>
        a.label.toLowerCase().includes(q) ||
        (a.sublabel && a.sublabel.toLowerCase().includes(q)) ||
        a.group.toLowerCase().includes(q)
    )
  }, [allActions, query])

  // Group filtered items
  const groupedActions = useMemo(() => {
    const groups: { [key: string]: PaletteAction[] } = {}
    for (const a of filteredActions) {
      if (!groups[a.group]) groups[a.group] = []
      groups[a.group].push(a)
    }
    return groups
  }, [filteredActions])

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredActions])

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
    if (el) {
      el.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredActions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % filteredActions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + filteredActions.length) % filteredActions.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const current = filteredActions[selectedIndex]
      if (current) {
        current.perform()
      }
    }
  }

  // Linear index calculation for grouped list
  let runningIndex = 0

  return (
    <Dialog.Root open={isOpen} onOpenChange={open => !open && onClose()}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 pointer-events-none">
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -10 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  className="w-full max-w-[580px] bg-[var(--color-surface-translucent)] backdrop-blur-[20px] backdrop-saturate-[180%] border border-[var(--color-separator)] rounded-card shadow-float overflow-hidden pointer-events-auto flex flex-col focus:outline-none"
                >
                  {/* Spotlight Search Header */}
                  <div className="flex items-center px-4 h-13 border-b border-[var(--color-separator)]">
                    <Search
                      size={18}
                      strokeWidth={1.5}
                      className="text-[var(--color-text-tertiary)] mr-3 flex-shrink-0"
                    />
                    <input
                      autoFocus
                      type="text"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a command or search..."
                      className="w-full h-11 bg-transparent text-ui-base text-[var(--color-text)] placeholder-[var(--color-text-tertiary)] outline-none leading-relaxed"
                    />
                  </div>

                  {/* Results List */}
                  <div
                    ref={listRef}
                    className="max-h-[340px] overflow-y-auto p-2 space-y-3 momentum-scroll text-ui-sm select-none"
                  >
                    {filteredActions.length === 0 ? (
                      <div className="py-8 text-center text-[var(--color-text-tertiary)] text-ui-sm">
                        No results found for &ldquo;{query}&rdquo;
                      </div>
                    ) : (
                      Object.entries(groupedActions).map(([groupName, actions]) => (
                        <div key={groupName} className="space-y-0.5">
                          <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                            {groupName}
                          </div>
                          {actions.map(action => {
                            const thisIndex = runningIndex++
                            const isSelected = thisIndex === selectedIndex

                            return (
                              <button
                                key={action.id}
                                data-index={thisIndex}
                                onClick={action.perform}
                                onMouseEnter={() => setSelectedIndex(thisIndex)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-button text-ui-sm transition-all text-left ${
                                  isSelected
                                    ? 'bg-[var(--color-surface-secondary)] text-[var(--color-text)] font-medium'
                                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]/60 hover:text-[var(--color-text)]'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span
                                    className={`flex-shrink-0 ${
                                      isSelected
                                        ? 'text-[var(--color-accent)]'
                                        : 'text-[var(--color-text-tertiary)]'
                                    }`}
                                  >
                                    {action.icon}
                                  </span>
                                  <span className="truncate">{action.label}</span>
                                  {action.sublabel && (
                                    <span className="text-xs text-[var(--color-text-tertiary)] flex-shrink-0">
                                      {action.sublabel}
                                    </span>
                                  )}
                                </div>

                                {action.shortcut && (
                                  <kbd className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-separator)] text-[var(--color-text-secondary)]">
                                    {action.shortcut}
                                  </kbd>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Spotlight Footer */}
                  <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--color-separator)] bg-[var(--color-surface-secondary)]/50 text-[11px] text-[var(--color-text-tertiary)]">
                    <div className="flex items-center gap-3">
                      <span>
                        <kbd className="font-mono">↑↓</kbd> navigate
                      </span>
                      <span>
                        <kbd className="font-mono">↵</kbd> select
                      </span>
                      <span>
                        <kbd className="font-mono">esc</kbd> close
                      </span>
                    </div>
                    <span>Spotlight</span>
                  </div>
                </motion.div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
