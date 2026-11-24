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
      // Validate file size: 10MB limit
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

  return (
    <div
      style={{
        bottom: `${Math.max(16, keyboardHeight + 16)}px`,
      }}
      className="fixed left-0 right-0 z-20 px-4 pointer-events-none transition-[bottom] duration-100 ease-out"
    >
      <div className="max-w-[720px] mx-auto pointer-events-auto">
        {/* Drag and drop overlay */}
        {isDragging && (
          <div className="mb-2 p-6 rounded-card drop-overlay flex items-center justify-center text-ui-sm font-medium text-[var(--color-accent)] select-none">
            Drop files here to attach
          </div>
        )}

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
          className="relative bg-[var(--color-surface-translucent)] backdrop-blur-[20px] rounded-composer border border-[var(--color-separator)] shadow-float p-2.5 transition-all"
        >
          {/* Editing Banner */}
          {editingMessage && (
            <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-[var(--color-separator)] text-xs text-[var(--color-text-secondary)]">
              <span>Editing message</span>
              <button
                onClick={onCancelEdit}
                className="hover:text-[var(--color-text)] underline"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Attachment Chips */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-2 pb-2 mb-1 border-b border-[var(--color-separator)]">
              {attachments.map(att => (
                <div
                  key={att.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-card bg-[var(--color-surface-secondary)] border border-[var(--color-separator)] text-xs text-[var(--color-text)] select-none"
                >
                  <span className="truncate max-w-[120px]">{att.name}</span>
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text)] ml-1"
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
              className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-secondary)] active:scale-95 disabled:opacity-40 transition-all flex-shrink-0"
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
              placeholder="Message Jarvis"
              rows={1}
              className="flex-1 bg-transparent text-body text-[var(--color-text)] placeholder-[var(--color-text-tertiary)] resize-none outline-none py-1.5 max-h-[200px] overflow-y-auto leading-relaxed"
            />

            {/* Voice button */}
            {voiceSupported && !isStreaming && (
              <button
                onClick={onVoiceStart}
                aria-label={isListening ? 'Listening...' : 'Voice input'}
                title="Voice input"
                className={`w-9 h-9 rounded-full flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-secondary)] active:scale-95 transition-all flex-shrink-0 ${
                  isListening ? 'text-[var(--color-accent)] voice-pulse' : ''
                }`}
              >
                <Mic size={18} strokeWidth={1.5} />
              </button>
            )}

            {/* Send or Stop button */}
            {isStreaming ? (
              <button
                onClick={onStop}
                aria-label="Stop generating response"
                title="Stop (Esc)"
                className="w-9 h-9 rounded-button bg-[var(--color-destructive)] text-white flex items-center justify-center active:scale-95 transition-all flex-shrink-0 shadow-sm"
              >
                <Square size={14} fill="currentColor" strokeWidth={1.5} />
              </button>
            ) : (
              <button
                onClick={handleAction}
                disabled={!hasContent}
                aria-label="Send message"
                title="Send (Enter)"
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                  hasContent
                    ? 'bg-[var(--color-accent)] text-white shadow-sm hover:opacity-90 active:scale-95'
                    : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)] opacity-50 cursor-not-allowed'
                }`}
              >
                <ArrowUp size={18} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
