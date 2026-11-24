'use client'

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react'
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

  const displayTitle = title && title !== 'NEW PROTOCOL' && title !== 'New conversation'
    ? title
    : 'NEW CONVERSATION'

  return (
    <header
      className={`holo-scanlines sticky top-0 z-20 flex items-center justify-between h-[56px] px-4 border-b border-[var(--line)] bg-[var(--surface)] select-none transition-shadow ${
        hasScrolled ? 'shadow-md shadow-black/40' : ''
      }`}
    >
      {/* Left: sidebar toggle, 28px arc reactor, "J.A.R.V.I.S." in Orbitron 13px */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          title="Toggle sidebar (⌘B)"
          className="w-11 h-11 flex items-center justify-center text-[var(--text-2)] hover:text-[var(--cyan)] hover:bg-[var(--surface-hi)] active:scale-95 transition-all cursor-pointer"
        >
          <PanelLeft size={18} strokeWidth={1.5} />
        </button>

        <div className="w-7 h-7 flex items-center justify-center shrink-0">
          <ArcReactor state={coreState} size={28} />
        </div>

        <span className="font-wordmark text-[13px] text-[var(--cyan)] tracking-wider shrink-0 hidden sm:inline-block">
          J.A.R.V.I.S.
        </span>
      </div>

      {/* Center: title in Rajdhani 14px uppercase, tracking .12em, one line, ellipsis; model in 11px mono text-3 */}
      <div className="flex flex-col items-center justify-center max-w-[45%] sm:max-w-[55%] min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="font-hud text-[14px] font-semibold tracking-[0.12em] text-[var(--text)] text-center bg-[var(--surface-hi)] border border-[var(--cyan)] px-2 py-0.5 outline-none max-w-full uppercase"
          />
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            title="Click to rename"
            className="font-hud text-[14px] font-semibold tracking-[0.12em] text-[var(--text)] hover:text-[var(--cyan)] transition-colors truncate max-w-full cursor-text uppercase px-1 leading-tight text-center"
          >
            {displayTitle}
          </button>
        )}
        <span className="font-mono text-[11px] text-[var(--text-3)] truncate leading-tight text-center">
          {modelName}
        </span>
      </div>

      {/* Right: ONLINE chip (11px) and settings button (44px touch target) */}
      <div className="flex items-center gap-2">
        <div
          className={`px-2 py-0.5 border text-[11px] font-hud tracking-widest flex items-center gap-1.5 ${
            isOnline
              ? 'border-[var(--line)] text-[var(--cyan)] bg-[var(--surface)]'
              : 'border-[var(--red)] text-[var(--red)] bg-[var(--surface)]'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isOnline ? 'bg-[var(--cyan)]' : 'bg-[var(--red)]'
            }`}
          />
          <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
        </div>

        <button
          onClick={onOpenSettings}
          aria-label="Open settings"
          title="Settings (⌘,)"
          className="w-11 h-11 flex items-center justify-center text-[var(--text-2)] hover:text-[var(--cyan)] hover:bg-[var(--surface-hi)] active:scale-95 transition-all cursor-pointer"
        >
          <Settings size={18} strokeWidth={1.5} />
        </button>
      </div>
    </header>
  )
}
