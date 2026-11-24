'use client'

import React, { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { ArrowUp, Square, Paperclip, Mic, X } from 'lucide-react'
import type { StoredAttachment } from '@/lib/storage'
import { generateId } from '@/lib/utils'

interface ComposerProps {
  onSend: (content: string, attachments?: StoredAttachment[]) => void
  onStop: () => void
  isStreaming: boolean
  editingMessage?: { id: string; content: string } | null
  onCancelEdit: () => void
  onSaveEdit: (id: string, content: string) => void
  draft?: string
  onDraftChange?: (draft: string) => void
  voiceSupported: boolean
  onVoiceStart: () => void
  isListening: boolean
  keyboardHeight?: number
}

export function Composer({
  onSend,
  onStop,
  isStreaming,
  editingMessage,
  onCancelEdit,
  onSaveEdit,
  draft = '',
  onDraftChange,
  voiceSupported,
  onVoiceStart,
  isListening,
  keyboardHeight = 0,
}: ComposerProps) {
  const [text, setText] = useState(draft)
  const [attachments, setAttachments] = useState<StoredAttachment[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync draft or editing content
  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.content)
      textareaRef.current?.focus()
    } else {
      setText(draft)
    }
  }, [editingMessage, draft])

  // Auto-grow textarea up to 8 lines
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const newHeight = Math.min(el.scrollHeight, 200)
    el.style.height = `${Math.max(newHeight, 36)}px`
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [text, adjustHeight])

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setText(val)
    if (!editingMessage && onDraftChange) {
      onDraftChange(val)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAction()
    }
  }

  const handleAction = () => {
    if (isStreaming) {
      onStop()
      return
    }

    if (editingMessage) {
      if (text.trim()) {
        onSaveEdit(editingMessage.id, text.trim())
        setText('')
      }
      return
    }

    if (text.trim() || attachments.length > 0) {
      onSend(text.trim(), attachments.length > 0 ? attachments : undefined)
      setText('')
      setAttachments([])
      if (onDraftChange) onDraftChange('')
      if (textareaRef.current) {
        textareaRef.current.style.height = '36px'
      }
    }
  }

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return

    Array.from(files).forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        alert('File size exceeds the 10MB limit.')
        return
      }

      const isImg = file.type.startsWith('image/')
      const reader = new FileReader()

      if (isImg) {
        reader.onload = e => {
          const base64 = e.target?.result as string
          setAttachments(prev => [
            ...prev,
            {
              id: generateId(),
              type: 'image',
              name: file.name,
              mimeType: file.type,
              size: file.size,
              preview: base64,
              content: base64,
            },
          ])
        }
        reader.readAsDataURL(file)
      } else {
        reader.onload = e => {
          const content = e.target?.result as string
          setAttachments(prev => [
            ...prev,
            {
              id: generateId(),
              type: file.type === 'application/pdf' ? 'pdf' : 'text',
              name: file.name,
              mimeType: file.type,
              size: file.size,
              content,
            },
          ])
        }
        reader.readAsText(file)
      }
    })
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items
    const files: File[] = []
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile()
        if (file) files.push(file)
      }
    }
    if (files.length > 0) {
      const dt = new DataTransfer()
      files.forEach(f => dt.items.add(f))
      handleFileSelect(dt.files)
    }
  }

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  const hasContent = Boolean(text.trim() || attachments.length > 0)

  // Mono status line above composer: "LISTENING", "THINKING", "READY"
  const statusLabel = isListening
    ? 'LISTENING'
    : isStreaming
    ? 'THINKING'
    : 'READY'

  return (
    <div
      style={{
        bottom: `${Math.max(16, keyboardHeight + 16)}px`,
      }}
      className="fixed left-0 right-0 z-20 px-4 pointer-events-none transition-[bottom] duration-100 ease-out"
    >
      <div className="max-w-[720px] mx-auto pointer-events-auto">
        {/* Status Line above composer */}
        <div className="flex items-center justify-between px-2 pb-1.5 font-mono text-[11px] tracking-widest uppercase select-none">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isListening
                  ? 'bg-[var(--cyan)] shadow-[var(--glow-cyan)] animate-pulse'
                  : isStreaming
                  ? 'bg-[var(--gold)] shadow-[var(--glow-gold)] animate-pulse'
                  : 'bg-[var(--cyan-dim)]'
              }`}
            />
            <span
              className={
                isListening
                  ? 'text-[var(--cyan)]'
                  : isStreaming
                  ? 'text-[var(--gold)]'
                  : 'text-[var(--text-3)]'
              }
            >
              {statusLabel}
            </span>
          </div>
          <span className="text-[var(--text-3)] text-[10px]">PROTOCOL MK-VII</span>
        </div>

        {/* Drag and drop overlay */}
        {isDragging && (
          <div className="holo mb-2 p-6 flex items-center justify-center font-hud text-sm tracking-wider text-[var(--cyan)] select-none">
            DROP ARCHIVES TO TRANSMIT
          </div>
        )}

        {/* Chamfered .holo Composer Bar */}
        <div
          onDragOver={e => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => {
            e.preventDefault()
            setIsDragging(false)
            handleFileSelect(e.dataTransfer.files)
          }}
          className="holo holo-chrome relative bg-[var(--surface)] border border-[var(--line)] p-2.5 transition-all shadow-float"
        >
          {/* Editing Banner */}
          {editingMessage && (
            <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-[var(--line)] font-mono text-xs text-[var(--text-2)]">
              <span>EDITING MESSAGE DIRECTIVE</span>
              <button
                onClick={onCancelEdit}
                className="text-[var(--cyan)] hover:underline uppercase tracking-wider"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Attachment Chips */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-2 pb-2 mb-1 border-b border-[var(--line)]">
              {attachments.map(att => (
                <div
                  key={att.id}
                  className="holo flex items-center gap-1.5 px-2.5 py-1 bg-[var(--surface-hi)] border border-[var(--line)] text-xs text-[var(--text)] select-none"
                >
                  <span className="truncate max-w-[140px] font-mono text-[11px]">{att.name}</span>
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="text-[var(--text-3)] hover:text-[var(--cyan)] ml-1"
                  >
                    <X size={12} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 px-1">
            {/* Attach button */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,text/*,application/pdf"
              className="hidden"
              onChange={e => handleFileSelect(e.target.files)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              aria-label="Attach file or image"
              title="Attach"
              className="w-11 h-11 flex items-center justify-center text-[var(--text-2)] hover:text-[var(--cyan)] hover:bg-[var(--surface-hi)] active:scale-95 disabled:opacity-30 transition-all flex-shrink-0 cursor-pointer"
            >
              <Paperclip size={18} strokeWidth={1.5} />
            </button>

            {/* Input textarea */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Message J.A.R.V.I.S."
              rows={1}
              className="flex-1 bg-transparent font-sans text-body text-[var(--text)] placeholder-[var(--text-3)] resize-none outline-none py-2 max-h-[200px] overflow-y-auto leading-relaxed"
            />

            {/* Voice button */}
            {voiceSupported && !isStreaming && (
              <button
                onClick={onVoiceStart}
                aria-label={isListening ? 'Listening...' : 'Voice input'}
                title="Voice input"
                className={`w-11 h-11 flex items-center justify-center text-[var(--text-2)] hover:text-[var(--cyan)] hover:bg-[var(--surface-hi)] active:scale-95 transition-all flex-shrink-0 cursor-pointer ${
                  isListening ? 'text-[var(--cyan)] shadow-[var(--glow-cyan)] animate-pulse' : ''
                }`}
              >
                <Mic size={18} strokeWidth={1.5} />
              </button>
            )}

            {/* 44px circular reactor send button */}
            <button
              onClick={handleAction}
              disabled={!isStreaming && !hasContent}
              aria-label={isStreaming ? 'Stop generating' : 'Send message'}
              title={isStreaming ? 'Stop (Esc)' : 'Send (Enter)'}
              className={`relative w-11 h-11 flex items-center justify-center flex-shrink-0 transition-transform active:scale-95 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed group`}
            >
              {/* Concentric rings */}
              <svg
                viewBox="0 0 44 44"
                className={`absolute inset-0 w-full h-full pointer-events-none ${
                  isStreaming ? 'text-[var(--red)]' : 'text-[var(--cyan)]'
                }`}
              >
                {/* Outer ring */}
                <circle
                  cx="22"
                  cy="22"
                  r="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray={isStreaming ? '18 6 12 6' : '36 6 12 6'}
                  className={isStreaming ? 'reactor-spin-fast' : 'group-hover:opacity-100'}
                  opacity={isStreaming ? '1' : hasContent ? '0.9' : '0.4'}
                />
                {/* Inner ring */}
                <circle
                  cx="22"
                  cy="22"
                  r="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeDasharray="10 4"
                  opacity={isStreaming ? '1' : hasContent ? '0.8' : '0.3'}
                />
              </svg>

              {/* Center icon */}
              {isStreaming ? (
                <Square size={13} className="fill-[var(--red)] text-[var(--red)] relative z-10" />
              ) : (
                <ArrowUp
                  size={16}
                  strokeWidth={2}
                  className={`relative z-10 transition-colors ${
                    hasContent
                      ? 'text-[var(--cyan)] filter drop-shadow-[0_0_6px_var(--cyan)]'
                      : 'text-[var(--text-3)]'
                  }`}
                />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
