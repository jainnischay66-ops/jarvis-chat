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
    <aside className="holo holo-chrome w-[260px] h-full flex flex-col bg-[var(--surface)] border-r border-[var(--line)] select-none z-30">
      {/* Top Header: New Chat & Mobile Close */}
      <div className="p-3.5 flex items-center gap-2 border-b border-[var(--line)] safe-area-top">
        <button
          onClick={() => {
            onNewChat()
            if (window.innerWidth < 768) onClose()
          }}
          className="holo flex-1 flex items-center justify-center gap-2 h-11 px-3 bg-[var(--surface)] hover:bg-[var(--surface-hi)] active:scale-95 text-xs font-hud tracking-wider text-[var(--cyan)] border border-[var(--line)] hover:border-[var(--cyan)] transition-all cursor-pointer"
        >
          <Plus size={16} strokeWidth={1.5} className="text-[var(--cyan)]" />
          <span>NEW ARCHIVE</span>
        </button>

        {/* Mobile close button */}
        <button
          onClick={onClose}
          aria-label="Close sidebar"
          className="md:hidden w-11 h-11 rounded flex items-center justify-center text-[var(--text-2)] hover:text-[var(--cyan)] hover:bg-[var(--surface-hi)] transition-all"
        >
          <X size={18} strokeWidth={1.5} />
        </button>
      </div>

      {/* Search Input */}
      <div className="px-3.5 py-2.5">
        <div className="relative flex items-center w-full">
          <Search
            size={14}
            strokeWidth={1.5}
            className="absolute left-3 text-[var(--text-3)] pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search archives..."
            className="w-full h-9 pl-8 pr-3 text-xs font-sans bg-[var(--surface-hi)] text-[var(--text)] placeholder-[var(--text-3)] border border-[var(--line)] outline-none focus:border-[var(--cyan)] transition-colors rounded-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 text-[var(--text-3)] hover:text-[var(--text)]"
            >
              <X size={13} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 py-1 momentum-scroll space-y-4">
        {filteredGroups.length === 0 ? (
          <div className="py-8 text-center font-mono text-xs text-[var(--text-3)] tracking-wider">
            {searchQuery ? 'NO PROTOCOLS FOUND' : 'NO ACTIVE ARCHIVES'}
          </div>
        ) : (
          filteredGroups.map(group => (
            <div key={group.label} className="space-y-1">
              {/* Group labels in Rajdhani, uppercase, text-3 */}
              <div className="px-2 py-1 font-hud text-xs font-semibold uppercase tracking-widest text-[var(--text-3)]">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.conversations.map(c => {
                  const isActive = c.id === currentId
                  const isEditingThis = editingId === c.id

                  return (
                    <div
                      key={c.id}
                      className={`group relative flex items-center justify-between min-h-[44px] px-2.5 text-xs transition-all border-l-2 ${
                        isActive
                          ? 'border-[var(--gold)] text-[var(--gold)] bg-[var(--surface-hi)] font-medium shadow-[inset_0_0_8px_rgba(242,184,75,0.1)]'
                          : 'border-transparent text-[var(--text-2)] hover:border-[var(--line)] hover:bg-[var(--surface-hi)]/50 hover:text-[var(--text)]'
                      }`}
                    >
                      {/* Pinned row tick-mark pattern */}
                      {c.pinned && (
                        <div
                          className="mr-1.5 flex items-center gap-[2px] opacity-80"
                          title="Pinned"
                        >
                          <span className="w-[1px] h-3 bg-[var(--gold)]" />
                          <span className="w-[1px] h-3 bg-[var(--gold)]" />
                          <span className="w-[1px] h-3 bg-[var(--gold)]" />
                        </div>
                      )}

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
                          className="w-full bg-[var(--surface)] border border-[var(--cyan)] px-1.5 py-1 text-xs text-[var(--text)] outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => {
                            onSelect(c.id)
                            if (window.innerWidth < 768) onClose()
                          }}
                          className="flex-1 text-left truncate mr-2 py-2 font-sans"
                        >
                          {c.title}
                        </button>
                      )}

                      {/* Action buttons (hover on desktop, visible on active) */}
                      {!isEditingThis && (
                        <div className="hidden group-hover:flex items-center gap-1 text-[var(--text-3)]">
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              onPin(c.id)
                            }}
                            title={c.pinned ? 'Unpin' : 'Pin'}
                            className="w-7 h-7 flex items-center justify-center hover:text-[var(--gold)] hover:bg-[var(--surface)]"
                          >
                            {c.pinned ? (
                              <PinOff size={13} strokeWidth={1.5} className="text-[var(--gold)]" />
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
                            className="w-7 h-7 flex items-center justify-center hover:text-[var(--cyan)] hover:bg-[var(--surface)]"
                          >
                            <Pencil size={13} strokeWidth={1.5} />
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              onDelete(c.id)
                            }}
                            title="Delete"
                            className="w-7 h-7 flex items-center justify-center hover:text-[var(--red)] hover:bg-[var(--surface)]"
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
      {/* Desktop Sidebar */}
      <div
        className={`hidden md:block h-full transition-[width] duration-300 ease-in-out overflow-hidden flex-shrink-0 ${
          isOpen ? 'w-[260px]' : 'w-0'
        }`}
      >
        <div className="w-[260px] h-full">{sidebarContent}</div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isOpen && (
          <div className="md:hidden fixed inset-0 z-40 flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: 'spring', stiffness: 400, damping: 36 }}
              className="relative z-50 h-full w-[260px]"
            >
              {sidebarContent}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
