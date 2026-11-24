'use client'

import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Slider from '@radix-ui/react-slider'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sun, Moon, Monitor, Download, Upload, Trash2 } from 'lucide-react'
import { useTheme } from './ThemeProvider'
import { SHORTCUTS } from '@/hooks/useKeyboardShortcuts'
import { DEFAULT_SYSTEM_PROMPT, type UIPreferences, type Conversation } from '@/lib/storage'
import type { ProviderName } from '@/lib/llm/types'

interface SettingsSheetProps {
  isOpen: boolean
  onClose: () => void
  preferences: UIPreferences
  onUpdatePreferences: (prefs: Partial<UIPreferences>) => void
  conversations: Conversation[]
  onImportData: (json: string) => Promise<void>
  onClearAllData: () => Promise<void>
}

export function SettingsSheet({
  isOpen,
  onClose,
  preferences,
  onUpdatePreferences,
  conversations,
  onImportData,
  onClearAllData,
}: SettingsSheetProps) {
  const { theme, setTheme } = useTheme()
  const [confirmClear, setConfirmClear] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Export JSON
  const handleExportJSON = () => {
    const data = JSON.stringify(
      { version: 1, exportedAt: new Date().toISOString(), conversations },
      null,
      2
    )
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `jarvis-conversations-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Export Markdown
  const handleExportMarkdown = () => {
    let md = `# Jarvis Conversations Export\n\n*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`
    for (const c of conversations) {
      md += `## ${c.title}\n\n*Created: ${new Date(c.createdAt).toLocaleString()}*\n\n`
      for (const m of c.messages) {
        const sender = m.role === 'user' ? '**You**' : '**Jarvis**'
        md += `${sender}:\n\n${m.content}\n\n`
      }
      md += `---\n\n`
    }
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `jarvis-conversations-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Handle file import
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async event => {
      const text = event.target?.result as string
      if (text) {
        try {
          await onImportData(text)
          onClose()
        } catch {
          alert('Failed to parse import file. Please ensure it is valid JSON.')
        }
      }
    }
    reader.readAsText(file)
  }

  const handleProviderChange = (newProvider: ProviderName) => {
    let defaultModel = preferences.model
    if (newProvider === 'gemini') defaultModel = 'gemini-2.0-flash'
    else if (newProvider === 'anthropic') defaultModel = 'claude-sonnet-4-20250514'
    else if (newProvider === 'openai-compatible') defaultModel = 'gpt-4o-mini'

    onUpdatePreferences({
      provider: newProvider,
      model: defaultModel,
    })
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
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 400, damping: 36 }}
                className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-[var(--color-surface)] border-l border-[var(--color-separator)] shadow-float flex flex-col focus:outline-none select-none overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 h-14 border-b border-[var(--color-separator)] safe-area-top">
                  <Dialog.Title className="text-base font-semibold text-[var(--color-text)]">
                    Settings
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      aria-label="Close settings"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-secondary)] transition-all"
                    >
                      <X size={18} strokeWidth={1.5} />
                    </button>
                  </Dialog.Close>
                </div>

                {/* Body (scrollable) */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6 momentum-scroll text-ui-sm">
                  {/* Appearance */}
                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] px-1">
                      Appearance
                    </h3>
                    <div className="grid grid-cols-3 gap-2 p-1 bg-[var(--color-surface-secondary)] rounded-card border border-[var(--color-separator)]">
                      <button
                        onClick={() => setTheme('light')}
                        className={`flex items-center justify-center gap-2 py-2 rounded-button text-ui-sm transition-all ${
                          theme === 'light'
                            ? 'bg-[var(--color-surface)] text-[var(--color-text)] font-medium shadow-sm'
                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                        }`}
                      >
                        <Sun size={15} strokeWidth={1.5} />
                        <span>Light</span>
                      </button>
                      <button
                        onClick={() => setTheme('dark')}
                        className={`flex items-center justify-center gap-2 py-2 rounded-button text-ui-sm transition-all ${
                          theme === 'dark'
                            ? 'bg-[var(--color-surface)] text-[var(--color-text)] font-medium shadow-sm'
                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                        }`}
                      >
                        <Moon size={15} strokeWidth={1.5} />
                        <span>Dark</span>
                      </button>
                      <button
                        onClick={() => setTheme('system')}
                        className={`flex items-center justify-center gap-2 py-2 rounded-button text-ui-sm transition-all ${
                          theme === 'system'
                            ? 'bg-[var(--color-surface)] text-[var(--color-text)] font-medium shadow-sm'
                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                        }`}
                      >
                        <Monitor size={15} strokeWidth={1.5} />
                        <span>System</span>
                      </button>
                    </div>
                  </section>

                  {/* Model */}
                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] px-1">
                      Model
                    </h3>
                    <div className="p-3.5 bg-[var(--color-surface-secondary)] rounded-card border border-[var(--color-separator)] space-y-3.5">
                      {/* Provider */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                          Provider
                        </label>
                        <div className="grid grid-cols-3 gap-1 bg-[var(--color-surface)] p-1 rounded-button border border-[var(--color-separator)] text-xs">
                          {(['openai-compatible', 'gemini', 'anthropic'] as ProviderName[]).map(p => (
                            <button
                              key={p}
                              onClick={() => handleProviderChange(p)}
                              className={`py-1.5 px-1 rounded text-center truncate transition-all ${
                                preferences.provider === p
                                  ? 'bg-[var(--color-surface-secondary)] text-[var(--color-text)] font-medium shadow-sm'
                                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
                              }`}
                            >
                              {p === 'openai-compatible' ? 'OpenAI' : p === 'gemini' ? 'Gemini' : 'Anthropic'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Model ID */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                          Model Identifier
                        </label>
                        <input
                          type="text"
                          value={preferences.model || ''}
                          onChange={e => onUpdatePreferences({ model: e.target.value })}
                          placeholder="e.g. gpt-4o-mini, llama-3.3-70b-versatile"
                          className="w-full px-3 py-2 bg-[var(--color-surface)] text-[var(--color-text)] text-ui-sm rounded-button border border-[var(--color-separator)] focus:border-[var(--color-accent)] outline-none font-mono"
                        />
                      </div>

                      {/* Temperature Slider */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-[var(--color-text-secondary)]">Temperature</span>
                          <span className="font-mono text-[var(--color-text)]">
                            {Number(preferences.temperature ?? 0.7).toFixed(2)}
                          </span>
                        </div>
                        <Slider.Root
                          className="relative flex items-center select-none touch-none w-full h-5"
                          value={[preferences.temperature ?? 0.7]}
                          onValueChange={([val]) => onUpdatePreferences({ temperature: val })}
                          max={1}
                          min={0}
                          step={0.05}
                        >
                          <Slider.Track className="bg-[var(--color-surface)] border border-[var(--color-separator)] relative grow rounded-full h-1.5">
                            <Slider.Range className="absolute bg-[var(--color-accent)] rounded-full h-full" />
                          </Slider.Track>
                          <Slider.Thumb
                            className="block w-4 h-4 bg-white border border-[var(--color-separator)] shadow-sm rounded-full focus:outline-none focus:scale-110 transition-transform cursor-grab active:cursor-grabbing"
                            aria-label="Temperature"
                          />
                        </Slider.Root>
                        <div className="flex justify-between text-[11px] text-[var(--color-text-tertiary)] select-none">
                          <span>Precise</span>
                          <span>Creative</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Persona */}
                  <section className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                        Persona
                      </h3>
                      <button
                        onClick={() => onUpdatePreferences({ systemPrompt: DEFAULT_SYSTEM_PROMPT })}
                        className="text-xs text-[var(--color-accent)] hover:underline"
                      >
                        Reset to default
                      </button>
                    </div>
                    <textarea
                      rows={4}
                      value={preferences.systemPrompt ?? DEFAULT_SYSTEM_PROMPT}
                      onChange={e => onUpdatePreferences({ systemPrompt: e.target.value })}
                      placeholder="Enter system prompt..."
                      className="w-full p-3 bg-[var(--color-surface-secondary)] text-[var(--color-text)] text-ui-sm rounded-card border border-[var(--color-separator)] focus:border-[var(--color-accent)] outline-none resize-none leading-relaxed font-mono"
                    />
                  </section>

                  {/* Context */}
                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] px-1">
                      Context
                    </h3>
                    <div className="p-3.5 bg-[var(--color-surface-secondary)] rounded-card border border-[var(--color-separator)] flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="text-ui-sm text-[var(--color-text)] font-medium">
                          Past messages to include
                        </div>
                        <div className="text-xs text-[var(--color-text-tertiary)]">
                          Older exchanges are quietly trimmed to preserve memory
                        </div>
                      </div>
                      <input
                        type="number"
                        min={5}
                        max={100}
                        step={5}
                        value={preferences.maxContextMessages ?? 50}
                        onChange={e =>
                          onUpdatePreferences({ maxContextMessages: parseInt(e.target.value) || 50 })
                        }
                        className="w-16 px-2 py-1 bg-[var(--color-surface)] text-[var(--color-text)] text-right font-mono rounded-button border border-[var(--color-separator)] outline-none"
                      />
                    </div>
                  </section>

                  {/* Data */}
                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] px-1">
                      Data
                    </h3>
                    <div className="p-2 bg-[var(--color-surface-secondary)] rounded-card border border-[var(--color-separator)] space-y-1">
                      <button
                        onClick={handleExportJSON}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-button text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <Download size={15} strokeWidth={1.5} />
                          <span>Export conversations (JSON)</span>
                        </span>
                      </button>

                      <button
                        onClick={handleExportMarkdown}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-button text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <Download size={15} strokeWidth={1.5} />
                          <span>Export conversations (Markdown)</span>
                        </span>
                      </button>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={handleFileImport}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-button text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <Upload size={15} strokeWidth={1.5} />
                          <span>Import conversations</span>
                        </span>
                      </button>

                      <div className="pt-2 border-t border-[var(--color-separator)]">
                        {confirmClear ? (
                          <div className="p-2 rounded bg-[var(--color-destructive)]/10 space-y-2">
                            <p className="text-xs text-[var(--color-destructive)] font-medium">
                              Are you sure? This will permanently delete all conversations from this device.
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
                                  await onClearAllData()
                                  setConfirmClear(false)
                                  onClose()
                                }}
                                className="flex-1 py-1.5 bg-[var(--color-destructive)] text-white text-xs font-medium rounded active:scale-95 transition-all"
                              >
                                Yes, clear all
                              </button>
                              <button
                                onClick={() => setConfirmClear(false)}
                                className="flex-1 py-1.5 bg-[var(--color-surface)] text-[var(--color-text)] text-xs font-medium rounded hover:bg-[var(--color-surface-secondary)] transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmClear(true)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-button text-[var(--color-destructive)] hover:bg-[var(--color-destructive)]/10 transition-colors"
                          >
                            <Trash2 size={15} strokeWidth={1.5} />
                            <span>Clear all conversations</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* Shortcuts List */}
                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] px-1">
                      Keyboard Shortcuts
                    </h3>
                    <div className="p-3 bg-[var(--color-surface-secondary)] rounded-card border border-[var(--color-separator)] space-y-2">
                      {SHORTCUTS.map(sc => (
                        <div
                          key={sc.description}
                          className="flex items-center justify-between text-xs py-1 border-b border-[var(--color-separator)] last:border-b-0"
                        >
                          <span className="text-[var(--color-text-secondary)]">{sc.description}</span>
                          <div className="flex items-center gap-1 font-mono">
                            {sc.keys.map((k, idx) => (
                              <kbd
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-separator)] text-[var(--color-text)] text-[11px]"
                              >
                                {k}
                              </kbd>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
