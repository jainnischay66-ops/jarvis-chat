'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Pin, PinOff, Pencil, Trash2, X } from 'lucide-react'
import type { Conversation } from '@/lib/storage'
import type { GroupedConversations } from '@/hooks/useStorage'

interface SidebarProps {
  isOpen: boolean
  groupedConversations: GroupedConversations[]
  currentId?: string
  onClose: () => void
  onSelect: (id: string) => void
  onNewChat: () => void
  onRename: (id: string, title: string) => void
  onPin: (id: string) => void
  onDelete: (id: string) => void
}

export function Sidebar({
  isOpen,
  groupedConversations,
  currentId,
  onClose,
  onSelect,
  onNewChat,
  onRename,
  onPin,
  onDelete,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')

  // Filter conversations by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedConversations
    const q = searchQuery.toLowerCase()

    return groupedConversations
      .map(group => ({
        ...group,
        conversations: group.conversations.filter(c =>
          c.title.toLowerCase().includes(q)
        ),
      }))
      .filter(group => group.conversations.length > 0)
  }, [groupedConversations, searchQuery])

  const handleStartRename = (c: Conversation) => {
    setEditingId(c.id)
    setEditingTitle(c.title)
  }

  const handleSaveRename = (id: string) => {
    setEditingId(null)
    const trimmed = editingTitle.trim()
    if (trimmed) {
      onRename(id, trimmed)
    }
  }

  const sidebarContent = (
    <aside className="w-[260px] h-full flex flex-col bg-[var(--color-surface-translucent)] backdrop-blur-[20px] backdrop-saturate-[180%] border-r border-[var(--color-separator)] select-none">
      {/* Top Header: New Chat & Mobile Close */}
      <div className="p-3.5 flex items-center gap-2 border-b border-[var(--color-separator)] safe-area-top">
        <button
          onClick={() => {
            onNewChat()
            if (window.innerWidth < 768) onClose()
          }}
          className="flex-1 flex items-center justify-center gap-2 h-9 px-3 rounded-button bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-tertiary)] active:scale-95 text-ui-sm font-medium text-[var(--color-text)] border border-[var(--color-separator)] transition-all"
        >
          <Plus size={18} strokeWidth={1.5} className="text-[var(--color-accent)]" />
          <span>New chat</span>
        </button>

        {/* Mobile close button */}
        <button
          onClick={onClose}
          aria-label="Close sidebar"
          className="md:hidden w-9 h-9 rounded-button flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-secondary)] transition-all"
        >
          <X size={18} strokeWidth={1.5} />
        </button>
      </div>

      {/* Search Input */}
      <div className="px-3.5 py-2.5">
        <div className="relative flex items-center w-full">
          <Search
            size={15}
            strokeWidth={1.5}
            className="absolute left-3 text-[var(--color-text-tertiary)] pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search conversations"
            className="w-full h-8 pl-8 pr-3 text-ui-sm bg-[var(--color-surface-secondary)] text-[var(--color-text)] placeholder-[var(--color-text-tertiary)] rounded-card border border-[var(--color-separator)] outline-none focus:border-[var(--color-accent)] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]"
            >
              <X size={13} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 py-1 momentum-scroll space-y-4">
        {filteredGroups.length === 0 ? (
          <div className="py-8 text-center text-ui-sm text-[var(--color-text-tertiary)]">
            {searchQuery ? 'No conversations found' : 'No conversations yet'}
          </div>
        ) : (
          filteredGroups.map(group => (
            <div key={group.label} className="space-y-1">
              <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.conversations.map(c => {
                  const isActive = c.id === currentId
                  const isEditingThis = editingId === c.id

                  return (
                    <div
                      key={c.id}
                      className={`group relative flex items-center justify-between h-9 px-2.5 rounded-button text-ui-sm transition-all ${
                        isActive
                          ? 'bg-[var(--color-surface-secondary)] text-[var(--color-text)] font-medium shadow-sm'
                          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]/60 hover:text-[var(--color-text)]'
                      }`}
                    >
                      {isEditingThis ? (
                        <input
                          type="text"
                          autoFocus
                          value={editingTitle}
                          onChange={e => setEditingTitle(e.target.value)}
                          onBlur={() => handleSaveRename(c.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveRename(c.id)
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                          className="w-full bg-[var(--color-surface)] border border-[var(--color-accent)] rounded px-1.5 py-0.5 text-xs text-[var(--color-text)] outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => {
                            onSelect(c.id)
                            if (window.innerWidth < 768) onClose()
                          }}
                          className="flex-1 text-left truncate mr-2"
                        >
                          {c.title}
                        </button>
                      )}

                      {/* Action buttons (hover on desktop, visible on active) */}
                      {!isEditingThis && (
                        <div className="hidden group-hover:flex items-center gap-0.5 text-[var(--color-text-tertiary)]">
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              onPin(c.id)
                            }}
                            title={c.pinned ? 'Unpin' : 'Pin'}
                            className="w-6 h-6 rounded flex items-center justify-center hover:text-[var(--color-text)] hover:bg-[var(--color-surface-tertiary)]"
                          >
                            {c.pinned ? (
                              <PinOff size={13} strokeWidth={1.5} className="text-[var(--color-accent)]" />
                            ) : (
                              <Pin size={13} strokeWidth={1.5} />
                            )}
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              handleStartRename(c)
                            }}
                            title="Rename"
                            className="w-6 h-6 rounded flex items-center justify-center hover:text-[var(--color-text)] hover:bg-[var(--color-surface-tertiary)]"
                          >
                            <Pencil size={13} strokeWidth={1.5} />
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              onDelete(c.id)
                            }}
                            title="Delete"
                            className="w-6 h-6 rounded flex items-center justify-center hover:text-[var(--color-destructive)] hover:bg-[var(--color-surface-tertiary)]"
                          >
                            <Trash2 size={13} strokeWidth={1.5} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop view (inline) */}
      <div
        className={`hidden md:block h-full transition-[width,opacity] duration-300 ease-out overflow-hidden flex-shrink-0 ${
          isOpen ? 'w-[260px] opacity-100' : 'w-0 opacity-0 pointer-events-none'
        }`}
      >
        {sidebarContent}
      </div>

      {/* Mobile view (slide-over sheet with backdrop) */}
      <AnimatePresence>
        {isOpen && (
          <div className="md:hidden fixed inset-0 z-40 flex">
            {/* Dimmed backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            />

            {/* Slide-over panel */}
            <motion.div
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: 'spring', stiffness: 400, damping: 34 }}
              className="relative z-50 h-full shadow-float"
            >
              {sidebarContent}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
