'use client'

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { motion } from 'framer-motion'
import { PanelLeft, Settings } from 'lucide-react'
import { ArcReactor } from './ArcReactor'
import type { CoreState } from './JarvisCore'

interface TopBarProps {
  title: string
  modelName: string
  hasScrolled: boolean
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onOpenSettings: () => void
  onRenameTitle: (newTitle: string) => void
  isOnline?: boolean
  hasMessages?: boolean
  coreState?: CoreState
}

export function TopBar({
  title,
  modelName,
  hasScrolled,
  sidebarOpen,
  onToggleSidebar,
  onOpenSettings,
  onRenameTitle,
  isOnline = true,
  hasMessages = false,
  coreState = 'idle',
}: TopBarProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setEditValue(title)
  }, [title])

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  const handleSave = () => {
    setIsEditing(false)
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== title) {
      onRenameTitle(trimmed)
    } else {
      setEditValue(title)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setEditValue(title)
    }
  }

  return (
    <header
      className={`holo holo-chrome sticky top-0 z-20 flex items-center justify-between h-[54px] px-3.5 border-b border-[var(--line)] bg-[var(--surface)] transition-all duration-200 safe-area-top select-none ${
        hasScrolled ? 'shadow-md shadow-black/40' : ''
      }`}
    >
      {/* Left: Sidebar Toggle + ArcReactor or Wordmark */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          title="Toggle sidebar (⌘B)"
          className="w-10 h-10 rounded flex items-center justify-center text-[var(--text-2)] hover:text-[var(--cyan)] hover:bg-[var(--surface-hi)] active:scale-95 transition-all"
        >
          <PanelLeft size={18} strokeWidth={1.5} />
        </button>

        {/* When conversation is active, the big orb shrinks into this 40px ArcReactor via shared layoutId */}
        {hasMessages && (
          <motion.div
            layoutId="jarvis-orb-reactor"
            transition={{ type: 'spring', stiffness: 220, damping: 26 }}
            className="w-10 h-10 flex items-center justify-center shrink-0"
          >
            <ArcReactor state={coreState} size={36} />
          </motion.div>
        )}

        {!hasMessages && (
          <span className="font-wordmark text-xs tracking-widest text-[var(--cyan)] hidden sm:inline-block">
            J.A.R.V.I.S.
          </span>
        )}
      </div>

      {/* Center: Title (Rajdhani Uppercase) + Model (Mono secondary) */}
      <div className="flex flex-col items-center justify-center max-w-[50%] min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="font-hud text-sm font-semibold tracking-wider text-[var(--text)] text-center bg-[var(--surface-hi)] border border-[var(--cyan)] rounded px-2 py-0.5 outline-none max-w-full uppercase"
          />
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            title="Click to rename"
            className="font-hud text-sm sm:text-base font-semibold tracking-wider text-[var(--text)] hover:text-[var(--cyan)] transition-colors truncate max-w-full cursor-text uppercase px-1 py-0.5"
          >
            {title || 'NEW PROTOCOL'}
          </button>
        )}
        <span className="font-mono text-[11px] text-[var(--text-2)] tracking-normal truncate">
          {modelName}
        </span>
      </div>

      {/* Right: Status chip ("ONLINE" / "OFFLINE" with dot) + Settings button */}
      <div className="flex items-center gap-2">
        <div
          className={`holo px-2 py-0.5 border text-[11px] font-hud tracking-widest flex items-center gap-1.5 ${
            isOnline
              ? 'border-[var(--line)] text-[var(--cyan)] bg-[var(--surface)]'
              : 'border-[var(--red)] text-[var(--red)] bg-[var(--surface)]'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isOnline ? 'bg-[var(--cyan)] shadow-[var(--glow-cyan)]' : 'bg-[var(--red)]'
            }`}
          />
          <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
        </div>

        <button
          onClick={onOpenSettings}
          aria-label="Open settings"
          title="Settings (⌘,)"
          className="w-10 h-10 rounded flex items-center justify-center text-[var(--text-2)] hover:text-[var(--cyan)] hover:bg-[var(--surface-hi)] active:scale-95 transition-all"
        >
          <Settings size={18} strokeWidth={1.5} />
        </button>
      </div>
    </header>
  )
}
