'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Search, Plus, Settings, MessageSquare } from 'lucide-react'
import type { Conversation, UIPreferences } from '@/lib/storage'
import { Overlay } from './Overlay'

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
    <Overlay
      isOpen={isOpen}
      onClose={onClose}
      variant="dialog"
      hideHeader
      title="Command Palette"
      ariaLabel="Command Palette"
      closeAriaLabel="Close command palette"
      errorFallbackLabel="command palette"
      panelTestId="command-palette"
      panelClassName="chamfer-card holo-brackets"
      onKeyDown={handleKeyDown}
    >
      {/* Search Bar */}
      <div className="flex items-center px-4 py-3 border-b border-[var(--line)] bg-[var(--surface-hi)] sticky top-0 z-10">
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
          className="flex-1 bg-transparent font-hud text-base sm:text-lg font-semibold tracking-wider text-[var(--text)] placeholder-[var(--text-3)] outline-none caret-[var(--cyan)] uppercase min-w-0"
        />
        <kbd className="font-mono text-[10px] text-[var(--cyan-dim)] px-2 py-0.5 border border-[var(--line)] flex-shrink-0 ml-2">
          ESC
        </kbd>
      </div>

      {/* Results List */}
      <div
        ref={listRef}
        className="p-2 space-y-1 text-xs"
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
                  <kbd className="font-mono text-[10px] text-[var(--text-3)] px-1.5 py-0.5 border border-[var(--line)] flex-shrink-0 ml-2">
                    {item.shortcut}
                  </kbd>
                )}
              </div>
            )
          })
        )}
      </div>
    </Overlay>
  )
}
