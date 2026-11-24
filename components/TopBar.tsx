'use client'

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { PanelLeft, Settings } from 'lucide-react'

interface TopBarProps {
  title: string
  modelName: string
  hasScrolled: boolean
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onOpenSettings: () => void
  onRenameTitle: (newTitle: string) => void
}

export function TopBar({
  title,
  modelName,
  hasScrolled,
  sidebarOpen,
  onToggleSidebar,
  onOpenSettings,
  onRenameTitle,
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
      className={`sticky top-0 z-20 flex items-center justify-between h-[52px] px-3.5 transition-all duration-200 safe-area-top select-none ${
        hasScrolled
          ? 'bg-[var(--color-surface-translucent)] backdrop-blur-[20px] backdrop-saturate-[180%] border-b border-[var(--color-separator)]'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      {/* Left: Sidebar Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          title="Toggle sidebar (⌘B)"
          className="w-8 h-8 rounded-button flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-secondary)] active:scale-95 transition-all"
        >
          <PanelLeft size={18} strokeWidth={1.5} />
        </button>
      </div>

      {/* Center: Title (Editable) + Model */}
      <div className="flex flex-col items-center justify-center max-w-[50%] min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="text-ui-base font-semibold text-[var(--color-text)] text-center bg-[var(--color-surface-secondary)] border border-[var(--color-accent)] rounded-button px-2 py-0.5 outline-none max-w-full"
          />
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            title="Click to rename"
            className="text-ui-base font-semibold text-[var(--color-text)] hover:opacity-80 transition-opacity truncate max-w-full cursor-text tracking-tight px-1 py-0.5 rounded"
          >
            {title || 'New conversation'}
          </button>
        )}
        <span className="text-xs text-[var(--color-text-secondary)] font-normal tracking-normal truncate">
          {modelName}
        </span>
      </div>

      {/* Right: Settings button */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
          className="w-8 h-8 rounded-button flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-secondary)] active:scale-95 transition-all"
        >
          <Settings size={18} strokeWidth={1.5} />
        </button>
      </div>
    </header>
  )
}
