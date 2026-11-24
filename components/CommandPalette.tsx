'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Settings, MessageSquare } from 'lucide-react'
import type { Conversation, UIPreferences } from '@/lib/storage'

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
  group: 'Actions' | 'Conversations'
}

export function CommandPalette({
  isOpen,
  onClose,
  onNewChat,
  onOpenSettings,
  onSelectConversation,
  conversations,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  const allActions = useMemo(() => {
    const list: PaletteAction[] = [
      {
        id: 'new-chat',
        label: 'INITIALIZE NEW PROTOCOL',
        shortcut: '⌘⇧O',
        icon: <Plus size={16} strokeWidth={1.5} className="text-[var(--cyan)]" />,
        perform: () => {
          onNewChat()
          onClose()
        },
        group: 'Actions',
      },
      {
        id: 'open-settings',
        label: 'OPEN SYSTEM CONFIGURATION',
        shortcut: '⌘,',
        icon: <Settings size={16} strokeWidth={1.5} className="text-[var(--cyan)]" />,
        perform: () => {
          onOpenSettings()
          onClose()
        },
        group: 'Actions',
      },
    ]

    // Add recent conversations
    conversations.slice(0, 15).forEach(c => {
      list.push({
        id: `conv-${c.id}`,
        label: c.title,
        sublabel: new Date(c.updatedAt).toLocaleDateString(),
        icon: <MessageSquare size={16} strokeWidth={1.5} className="text-[var(--text-3)]" />,
        perform: () => {
          onSelectConversation(c.id)
          onClose()
        },
        group: 'Conversations',
      })
    })

    return list
  }, [onNewChat, onOpenSettings, onSelectConversation, conversations, onClose])

  const filtered = useMemo(() => {
    if (!query.trim()) return allActions
    const q = query.toLowerCase()
    return allActions.filter(
      item =>
        item.label.toLowerCase().includes(q) ||
        item.sublabel?.toLowerCase().includes(q)
    )
  }, [allActions, query])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % Math.max(1, filtered.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + filtered.length) % Math.max(1, filtered.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].perform()
      }
    }
  }

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
                className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md"
              />
            </Dialog.Overlay>

            <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 pointer-events-none">
              <Dialog.Content asChild>
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -10 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  className="chamfer-card holo-brackets pointer-events-auto w-full max-w-xl bg-[var(--surface)] border border-[var(--cyan)] overflow-hidden flex flex-col focus:outline-none select-none"
                  onKeyDown={handleKeyDown}
                >
                  {/* Search Bar with large Rajdhani input and cyan caret */}
                  <div className="flex items-center px-4 py-3 border-b border-[var(--line)] bg-[var(--surface-hi)]">
                    <Search
                      size={20}
                      strokeWidth={1.5}
                      className="text-[var(--cyan)] mr-3 flex-shrink-0"
                    />
                    <input
                      autoFocus
                      type="text"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="ENTER TACTICAL COMMAND OR PROTOCOL..."
                      className="flex-1 bg-transparent font-hud text-lg sm:text-xl font-semibold tracking-wider text-[var(--text)] placeholder-[var(--text-3)] outline-none caret-[var(--cyan)] uppercase"
                    />
                    <kbd className="font-mono text-[10px] text-[var(--cyan-dim)] px-2 py-0.5 border border-[var(--line)]">
                      ESC
                    </kbd>
                  </div>

                  {/* Results List */}
                  <div
                    ref={listRef}
                    className="max-h-[340px] overflow-y-auto p-2 space-y-1 momentum-scroll text-xs"
                  >
                    {filtered.length === 0 ? (
                      <div className="py-8 text-center font-mono text-xs text-[var(--text-3)] tracking-wider">
                        NO PROTOCOLS MATCH COMMAND QUERY
                      </div>
                    ) : (
                      filtered.map((item, idx) => {
                        const isSelected = idx === selectedIndex
                        return (
                          <div
                            key={item.id}
                            onClick={() => item.perform()}
                            onMouseEnter={() => setSelectedIndex(idx)}
                            className={`flex items-center justify-between px-3 py-2.5 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[var(--surface-hi)] text-[var(--cyan)] border-l-2 border-[var(--cyan)] shadow-[inset_0_0_10px_rgba(92,203,245,0.1)]'
                                : 'text-[var(--text)] hover:bg-[var(--surface-hi)]/50 border-l-2 border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="flex-shrink-0">{item.icon}</span>
                              <div className="flex flex-col truncate">
                                <span className="font-hud tracking-wider text-xs truncate">
                                  {item.label}
                                </span>
                                {item.sublabel && (
                                  <span className="font-mono text-[10px] text-[var(--text-3)] truncate">
                                    {item.sublabel}
                                  </span>
                                )}
                              </div>
                            </div>

                            {item.shortcut && (
                              <kbd className="font-mono text-[10px] text-[var(--text-3)] px-1.5 py-0.5 border border-[var(--line)]">
                                {item.shortcut}
                              </kbd>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
