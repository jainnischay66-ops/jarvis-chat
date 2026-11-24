'use client'

import React, { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Slider from '@radix-ui/react-slider'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download, Upload, Trash2, Eye, Sliders, Layers } from 'lucide-react'
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
  const [confirmClear, setConfirmClear] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Display Settings: Scanlines, Hologram effects, Reduce motion
  const [scanlines, setScanlines] = useState(true)
  const [holoEffects, setHoloEffects] = useState(true)
  const [reducedMotionSystem, setReducedMotionSystem] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const s = localStorage.getItem('jarvis-scanlines') !== 'false'
      const h = localStorage.getItem('jarvis-holo') !== 'false'
      setScanlines(s)
      setHoloEffects(h)
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      setReducedMotionSystem(mq.matches)
      const handler = (e: MediaQueryListEvent) => setReducedMotionSystem(e.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [])

  const handleToggleScanlines = (enabled: boolean) => {
    setScanlines(enabled)
    localStorage.setItem('jarvis-scanlines', enabled ? 'true' : 'false')
    document.documentElement.setAttribute('data-scanlines', enabled ? 'true' : 'false')
  }

  const handleToggleHolo = (enabled: boolean) => {
    setHoloEffects(enabled)
    localStorage.setItem('jarvis-holo', enabled ? 'true' : 'false')
    document.documentElement.setAttribute('data-holo', enabled ? 'true' : 'false')
  }

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
    a.download = `jarvis-protocols-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Export Markdown
  const handleExportMarkdown = () => {
    let md = `# J.A.R.V.I.S. Transcripts Export\n\n*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`
    for (const c of conversations) {
      md += `## ${c.title}\n\n*Created: ${new Date(c.createdAt).toLocaleString()}*\n\n`
      for (const m of c.messages) {
        const sender = m.role === 'user' ? '**You**' : '**J.A.R.V.I.S.**'
        md += `${sender}:\n\n${m.content}\n\n`
      }
      md += `---\n\n`
    }
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `jarvis-transcripts-${new Date().toISOString().slice(0, 10)}.md`
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
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 400, damping: 36 }}
                className="holo holo-chrome fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-[var(--surface)] border-l border-[var(--line)] shadow-float flex flex-col focus:outline-none select-none overflow-hidden text-[var(--text)]"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 h-14 border-b border-[var(--line)] safe-area-top">
                  <Dialog.Title className="font-hud text-base font-semibold tracking-wider text-[var(--text)] uppercase">
                    SYSTEM CONFIGURATION
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button
                      aria-label="Close settings"
                      className="w-9 h-9 rounded flex items-center justify-center text-[var(--text-2)] hover:text-[var(--cyan)] hover:bg-[var(--surface-hi)] transition-all cursor-pointer"
                    >
                      <X size={18} strokeWidth={1.5} />
                    </button>
                  </Dialog.Close>
                </div>

                {/* Body (scrollable) */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6 momentum-scroll text-xs">
                  {/* DISPLAY (Replaces Appearance) */}
                  <section className="space-y-2">
                    <h3 className="font-hud text-xs font-semibold uppercase tracking-wider text-[var(--cyan-dim)] px-1">
                      DISPLAY
                    </h3>
                    <div className="holo p-3 bg-[var(--surface-hi)] border border-[var(--line)] space-y-3">
                      {/* Scanlines toggle */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="font-hud tracking-wider text-[var(--text)]">
                            SCANLINES
                          </div>
                          <div className="font-mono text-[11px] text-[var(--text-3)]">
                            Overlay CRT raster lines on HUD chrome
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleScanlines(!scanlines)}
                          className={`holo px-3 py-1 font-hud tracking-widest text-xs border transition-all ${
                            scanlines
                              ? 'border-[var(--cyan)] text-[var(--cyan)] bg-[var(--cyan-faint)] shadow-[var(--glow-cyan)]'
                              : 'border-[var(--line)] text-[var(--text-3)] bg-[var(--surface)]'
                          }`}
                        >
                          {scanlines ? 'ENABLED' : 'DISABLED'}
                        </button>
                      </div>

                      {/* Hologram Effects toggle */}
                      <div className="flex items-center justify-between border-t border-[var(--line)] pt-3">
                        <div className="space-y-0.5">
                          <div className="font-hud tracking-wider text-[var(--text)]">
                            HOLOGRAM EFFECTS
                          </div>
                          <div className="font-mono text-[11px] text-[var(--text-3)]">
                            Sweep lines, flickers, corner brackets & glows
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleHolo(!holoEffects)}
                          className={`holo px-3 py-1 font-hud tracking-widest text-xs border transition-all ${
                            holoEffects
                              ? 'border-[var(--cyan)] text-[var(--cyan)] bg-[var(--cyan-faint)] shadow-[var(--glow-cyan)]'
                              : 'border-[var(--line)] text-[var(--text-3)] bg-[var(--surface)]'
                          }`}
                        >
                          {holoEffects ? 'ENABLED' : 'DISABLED'}
                        </button>
                      </div>

                      {/* Reduce Motion (Follows system) */}
                      <div className="flex items-center justify-between border-t border-[var(--line)] pt-3">
                        <div className="space-y-0.5">
                          <div className="font-hud tracking-wider text-[var(--text)]">
                            REDUCE MOTION
                          </div>
                          <div className="font-mono text-[11px] text-[var(--text-3)]">
                            Follows operating system accessibility preference
                          </div>
                        </div>
                        <span className="font-hud text-xs text-[var(--text-2)] tracking-widest">
                          {reducedMotionSystem ? 'ACTIVE (SYSTEM)' : 'INACTIVE'}
                        </span>
                      </div>
                    </div>
                  </section>

                  {/* MODEL */}
                  <section className="space-y-3">
                    <h3 className="font-hud text-xs font-semibold uppercase tracking-wider text-[var(--cyan-dim)] px-1">
                      CORE INTELLIGENCE ENGINE
                    </h3>
                    <div className="holo p-3.5 bg-[var(--surface-hi)] border border-[var(--line)] space-y-3.5">
                      {/* Provider */}
                      <div className="space-y-1.5">
                        <label className="font-hud text-xs tracking-wider text-[var(--text-2)]">
                          PROVIDER ARCHITECTURE
                        </label>
                        <div className="grid grid-cols-3 gap-1 bg-[var(--surface)] p-1 border border-[var(--line)] text-xs font-hud">
                          {(['openai-compatible', 'gemini', 'anthropic'] as ProviderName[]).map(p => (
                            <button
                              key={p}
                              onClick={() => handleProviderChange(p)}
                              className={`py-1.5 px-1 text-center truncate tracking-wider transition-all ${
                                preferences.provider === p
                                  ? 'border border-[var(--cyan)] bg-[var(--cyan-faint)] text-[var(--cyan)] font-medium'
                                  : 'text-[var(--text-2)] hover:text-[var(--text)]'
                              }`}
                            >
                              {p === 'openai-compatible' ? 'OPENAI' : p === 'gemini' ? 'GEMINI' : 'ANTHROPIC'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Model Identifier */}
                      <div className="space-y-1.5">
                        <label className="font-hud text-xs tracking-wider text-[var(--text-2)]">
                          MODEL IDENTIFIER
                        </label>
                        <input
                          type="text"
                          value={preferences.model || ''}
                          onChange={e => onUpdatePreferences({ model: e.target.value })}
                          placeholder="e.g. gemini-2.0-flash, claude-3-7-sonnet"
                          className="w-full px-3 py-2 bg-[var(--surface)] text-[var(--text)] font-mono text-xs border border-[var(--line)] focus:border-[var(--cyan)] outline-none"
                        />
                      </div>

                      {/* Temperature Slider */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-hud tracking-wider text-[var(--text-2)]">TEMPERATURE VARIANCE</span>
                          <span className="font-mono text-[var(--cyan)]">
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
                          <Slider.Track className="bg-[var(--surface)] border border-[var(--line)] relative grow rounded-full h-1.5">
                            <Slider.Range className="absolute bg-[var(--cyan)] rounded-full h-full shadow-[var(--glow-cyan)]" />
                          </Slider.Track>
                          <Slider.Thumb
                            className="block w-4 h-4 bg-[var(--cyan)] border border-[var(--line)] shadow-[var(--glow-cyan)] rounded-full focus:outline-none cursor-grab active:cursor-grabbing"
                            aria-label="Temperature"
                          />
                        </Slider.Root>
                        <div className="flex justify-between font-hud text-[11px] text-[var(--text-3)] tracking-wider select-none">
                          <span>DETERMINISTIC</span>
                          <span>CREATIVE</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* PERSONA */}
                  <section className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="font-hud text-xs font-semibold uppercase tracking-wider text-[var(--cyan-dim)]">
                        TACTICAL DIRECTIVE (PERSONA)
                      </h3>
                      <button
                        onClick={() => onUpdatePreferences({ systemPrompt: DEFAULT_SYSTEM_PROMPT })}
                        className="font-hud text-xs text-[var(--cyan)] hover:underline uppercase tracking-wider cursor-pointer"
                      >
                        Reset Directive
                      </button>
                    </div>
                    <textarea
                      rows={4}
                      value={preferences.systemPrompt ?? DEFAULT_SYSTEM_PROMPT}
                      onChange={e => onUpdatePreferences({ systemPrompt: e.target.value })}
                      placeholder="Enter directive instructions..."
                      className="w-full p-3 bg-[var(--surface-hi)] text-[var(--text)] font-mono text-xs border border-[var(--line)] focus:border-[var(--cyan)] outline-none resize-none leading-relaxed"
                    />
                  </section>

                  {/* CONTEXT */}
                  <section className="space-y-2">
                    <h3 className="font-hud text-xs font-semibold uppercase tracking-wider text-[var(--cyan-dim)] px-1">
                      CONTEXT CAPACITY
                    </h3>
                    <div className="holo p-3.5 bg-[var(--surface-hi)] border border-[var(--line)] flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="font-hud text-xs text-[var(--text)] tracking-wider">
                          ACTIVE CONTEXT WINDOW
                        </div>
                        <div className="font-mono text-[11px] text-[var(--text-3)]">
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
                        className="w-16 px-2 py-1 bg-[var(--surface)] text-[var(--text)] text-right font-mono border border-[var(--line)] focus:border-[var(--cyan)] outline-none"
                      />
                    </div>
                  </section>

                  {/* DATA & ARCHIVES */}
                  <section className="space-y-2">
                    <h3 className="font-hud text-xs font-semibold uppercase tracking-wider text-[var(--cyan-dim)] px-1">
                      ARCHIVAL DATA STORAGE
                    </h3>
                    <div className="holo p-2 bg-[var(--surface-hi)] border border-[var(--line)] space-y-1">
                      <button
                        onClick={handleExportJSON}
                        className="w-full flex items-center justify-between px-3 py-2 text-[var(--text)] hover:text-[var(--cyan)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2 font-hud tracking-wider">
                          <Download size={14} strokeWidth={1.5} />
                          EXPORT BACKUP ARCHIVE (JSON)
                        </span>
                        <span className="font-mono text-[11px] text-[var(--text-3)]">
                          {conversations.length} records
                        </span>
                      </button>

                      <button
                        onClick={handleExportMarkdown}
                        className="w-full flex items-center justify-between px-3 py-2 text-[var(--text)] hover:text-[var(--cyan)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2 font-hud tracking-wider">
                          <Download size={14} strokeWidth={1.5} />
                          EXPORT TRANSCRIPTS (MARKDOWN)
                        </span>
                        <span className="font-mono text-[11px] text-[var(--text-3)]">.md</span>
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
                        className="w-full flex items-center justify-between px-3 py-2 text-[var(--text)] hover:text-[var(--cyan)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2 font-hud tracking-wider">
                          <Upload size={14} strokeWidth={1.5} />
                          IMPORT ARCHIVE FILE
                        </span>
                        <span className="font-mono text-[11px] text-[var(--text-3)]">JSON</span>
                      </button>

                      <div className="border-t border-[var(--line)] pt-1 mt-1">
                        {confirmClear ? (
                          <div className="flex items-center justify-between p-2 bg-[var(--surface)] border border-[var(--red)]">
                            <span className="font-hud text-xs text-[var(--red)] tracking-wider">
                              PURGE ALL DATA?
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setConfirmClear(false)}
                                className="font-hud px-2 py-1 text-xs text-[var(--text-2)] hover:text-[var(--text)]"
                              >
                                ABORT
                              </button>
                              <button
                                onClick={async () => {
                                  await onClearAllData()
                                  setConfirmClear(false)
                                  onClose()
                                }}
                                className="font-hud px-2.5 py-1 text-xs bg-[var(--red)] text-white hover:opacity-90 font-medium tracking-wider"
                              >
                                CONFIRM PURGE
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmClear(true)}
                            className="w-full flex items-center justify-between px-3 py-2 text-[var(--red)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
                          >
                            <span className="flex items-center gap-2 font-hud tracking-wider">
                              <Trash2 size={14} strokeWidth={1.5} />
                              PURGE ALL ARCHIVES & PREFERENCES
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* KEYBOARD SHORTCUTS */}
                  <section className="space-y-2">
                    <h3 className="font-hud text-xs font-semibold uppercase tracking-wider text-[var(--cyan-dim)] px-1">
                      TACTICAL SHORTCUTS
                    </h3>
                    <div className="holo p-3 bg-[var(--surface-hi)] border border-[var(--line)] space-y-2">
                      {SHORTCUTS.map(sc => (
                        <div
                          key={sc.description}
                          className="flex items-center justify-between text-xs py-1"
                        >
                          <span className="font-sans text-[var(--text-2)]">{sc.description}</span>
                          <kbd className="font-mono text-[11px] px-2 py-0.5 bg-[var(--surface)] border border-[var(--line)] text-[var(--cyan)]">
                            {sc.keys.join(' ')}
                          </kbd>
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
