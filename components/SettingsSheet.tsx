'use client'

import React, { useState, useEffect } from 'react'
import * as Slider from '@radix-ui/react-slider'
import { Download, Upload, Trash2, Eye, Sliders, Layers, Volume2, VolumeX, Mic, Play, RefreshCw, Film } from 'lucide-react'
import { SHORTCUTS } from '@/hooks/useKeyboardShortcuts'
import { DEFAULT_SYSTEM_PROMPT, type UIPreferences, type Conversation } from '@/lib/storage'
import { getTTSManager, type TTSVoice } from '@/lib/tts'
import type { ProviderName } from '@/lib/llm/types'
import { Overlay } from './Overlay'
import { ConfirmDialog } from './ConfirmDialog'

interface SettingsSheetProps {
  isOpen: boolean
  onClose: () => void
  preferences: UIPreferences
  onUpdatePreferences: (prefs: Partial<UIPreferences>) => void
  conversations: Conversation[]
  onImportData: (json: string) => Promise<void>
  onClearAllData: () => Promise<void>
  onReplayIntro?: () => void
}

export function SettingsSheet({
  isOpen,
  onClose,
  preferences,
  onUpdatePreferences,
  conversations,
  onImportData,
  onClearAllData,
  onReplayIntro,
}: SettingsSheetProps) {
  const [confirmClear, setConfirmClear] = useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Display Settings: Scanlines, Hologram effects, Reduce motion
  const [scanlines, setScanlines] = useState(true)
  const [holoEffects, setHoloEffects] = useState(true)
  const [reducedMotionSystem, setReducedMotionSystem] = useState(false)

  // Voice Settings & Voice List
  const [voices, setVoices] = useState<TTSVoice[]>([])
  const [isTestingVoice, setIsTestingVoice] = useState(false)

  useEffect(() => {
    const tts = getTTSManager()
    tts.getVoices(preferences.voiceProvider || 'browser')
      .then(list => setVoices(list))
      .catch(() => {})
  }, [preferences.voiceProvider])

  const handleTestVoice = async () => {
    if (isTestingVoice) return
    setIsTestingVoice(true)
    try {
      const tts = getTTSManager()
      await tts.speakText(
        'All systems nominal, sir. Standing by.',
        {
          voice: preferences.voiceId,
          rate: preferences.voiceRate ?? 0.95,
          pitch: preferences.voicePitch ?? 0.9,
          volume: preferences.voiceVolume ?? 1.0,
          holographicEffect: preferences.voiceHolographicEffect ?? true,
        },
        preferences.voiceProvider || 'browser'
      )
    } catch (e) {
      console.warn('Voice test failed:', e)
    } finally {
      setIsTestingVoice(false)
    }
  }

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
    <>
      <Overlay
        isOpen={isOpen}
        onClose={onClose}
        variant="sheet-right"
        title="SYSTEM CONFIGURATION"
        closeAriaLabel="Close settings"
        errorFallbackLabel="settings"
        panelTestId="settings-sheet"
        bodyClassName="p-5 space-y-6 text-xs"
      >
                  {/* DISPLAY (Replaces Appearance) */}
                  <section className="space-y-2">
                    <h3 className="font-hud text-xs font-semibold uppercase tracking-wider text-[var(--cyan-dim)] px-1">
                      DISPLAY
                    </h3>
                    <div className="p-3 bg-[var(--surface-hi)] border border-[var(--line)] space-y-3">
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
                          className={`px-3 py-1 font-hud tracking-widest text-xs border transition-all ${
                            scanlines
                              ? 'border-[var(--cyan)] text-[var(--cyan)] bg-[var(--cyan-faint)]'
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
                          className={`px-3 py-1 font-hud tracking-widest text-xs border transition-all ${
                            holoEffects
                              ? 'border-[var(--cyan)] text-[var(--cyan)] bg-[var(--cyan-faint)]'
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
                    <div className="p-3.5 bg-[var(--surface-hi)] border border-[var(--line)] space-y-3.5">
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
                    <div className="p-3.5 bg-[var(--surface-hi)] border border-[var(--line)] flex items-center justify-between">
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

                  {/* VOICE & AUDIO PROTOCOLS */}
                  <section className="space-y-3">
                    <h3 className="font-hud text-xs font-semibold uppercase tracking-wider text-[var(--cyan-dim)] px-1">
                      VOICE & ACOUSTIC TELEMETRY
                    </h3>
                    <div className="p-3.5 bg-[var(--surface-hi)] border border-[var(--line)] space-y-3.5">
                      {/* Master Voice Toggle */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="font-hud tracking-wider text-[var(--text)]">
                            JARVIS VOCAL RESPONSE
                          </div>
                          <div className="font-mono text-[11px] text-[var(--text-3)]">
                            Vocalizes responses via streaming audio synthesis
                          </div>
                        </div>
                        <button
                          onClick={() => onUpdatePreferences({ voiceEnabled: !(preferences.voiceEnabled ?? true) })}
                          className={`px-3 py-1 font-hud tracking-widest text-xs border transition-all ${
                            (preferences.voiceEnabled ?? true)
                              ? 'border-[var(--cyan)] text-[var(--cyan)] bg-[var(--cyan-faint)]'
                              : 'border-[var(--line)] text-[var(--text-3)] bg-[var(--surface)]'
                          }`}
                        >
                          {(preferences.voiceEnabled ?? true) ? 'ACTIVE' : 'MUTED'}
                        </button>
                      </div>

                      {/* Auto-Read Replies Toggle */}
                      <div className="flex items-center justify-between border-t border-[var(--line)] pt-3">
                        <div className="space-y-0.5">
                          <div className="font-hud tracking-wider text-[var(--text)]">
                            AUTOMATIC VOICE REPLIES
                          </div>
                          <div className="font-mono text-[11px] text-[var(--text-3)]">
                            Automatically speaks incoming assistant responses sentence-by-sentence
                          </div>
                        </div>
                        <button
                          onClick={() => onUpdatePreferences({ autoSpeak: !(preferences.autoSpeak ?? true) })}
                          className={`px-3 py-1 font-hud tracking-widest text-xs border transition-all ${
                            (preferences.autoSpeak ?? true)
                              ? 'border-[var(--cyan)] text-[var(--cyan)] bg-[var(--cyan-faint)]'
                              : 'border-[var(--line)] text-[var(--text-3)] bg-[var(--surface)]'
                          }`}
                        >
                          {(preferences.autoSpeak ?? true) ? 'ENABLED' : 'MUTED'}
                        </button>
                      </div>

                      {/* Synthesis Provider Selector */}
                      <div className="space-y-1.5 border-t border-[var(--line)] pt-3">
                        <label className="font-hud text-xs tracking-wider text-[var(--text-2)]">
                          ACOUSTIC SYNTHESIZER
                        </label>
                        <div className="grid grid-cols-2 gap-1 bg-[var(--surface)] p-1 border border-[var(--line)] text-xs font-hud">
                          <button
                            type="button"
                            onClick={() => onUpdatePreferences({ voiceProvider: 'browser' })}
                            className={`py-1.5 px-2 tracking-wider transition-all cursor-pointer text-center ${
                              (preferences.voiceProvider || 'browser') === 'browser'
                                ? 'bg-[var(--surface-hi)] text-[var(--cyan)] border border-[var(--cyan)] font-semibold shadow-[0_0_8px_rgba(92,203,245,0.2)]'
                                : 'text-[var(--text-3)] hover:text-[var(--text)]'
                            }`}
                          >
                            BROWSER (NATIVE)
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdatePreferences({ voiceProvider: 'cloud' })}
                            className={`py-1.5 px-2 tracking-wider transition-all cursor-pointer text-center ${
                              preferences.voiceProvider === 'cloud'
                                ? 'bg-[var(--surface-hi)] text-[var(--cyan)] border border-[var(--cyan)] font-semibold shadow-[0_0_8px_rgba(92,203,245,0.2)]'
                                : 'text-[var(--text-3)] hover:text-[var(--text)]'
                            }`}
                          >
                            CLOUD (HI-FI)
                          </button>
                        </div>
                      </div>

                      {/* Voice Selection */}
                      <div className="space-y-1.5 border-t border-[var(--line)] pt-3">
                        <label className="font-hud text-xs tracking-wider text-[var(--text-2)]">
                          VOCAL PROFILE MATRIX
                        </label>
                        <select
                          value={preferences.voiceId || ''}
                          onChange={e => onUpdatePreferences({ voiceId: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-[var(--surface)] text-[var(--text)] font-mono text-xs border border-[var(--line)] focus:border-[var(--cyan)] outline-none"
                        >
                          <option value="">Default (Auto-Selected British Male)</option>
                          {voices.map(v => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.lang})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Rate / Speed Slider */}
                      <div className="space-y-1.5 border-t border-[var(--line)] pt-3">
                        <div className="flex items-center justify-between font-hud text-xs">
                          <span className="tracking-wider text-[var(--text-2)]">SYNTHESIS PACE (RATE)</span>
                          <span className="font-mono text-[var(--cyan)]">
                            {(preferences.voiceRate ?? 0.95).toFixed(2)}x
                          </span>
                        </div>
                        <Slider.Root
                          className="relative flex items-center select-none touch-none w-full h-5"
                          value={[preferences.voiceRate ?? 0.95]}
                          onValueChange={([val]) => onUpdatePreferences({ voiceRate: val })}
                          min={0.5}
                          max={1.8}
                          step={0.05}
                        >
                          <Slider.Track className="bg-[var(--surface)] relative grow h-1 border border-[var(--line)]">
                            <Slider.Range className="absolute bg-[var(--cyan)] h-full" />
                          </Slider.Track>
                          <Slider.Thumb
                            className="block w-3.5 h-3.5 bg-[var(--cyan)] shadow-[0_0_8px_var(--cyan)] focus:outline-none cursor-grab active:cursor-grabbing"
                            aria-label="Voice rate"
                          />
                        </Slider.Root>
                      </div>

                      {/* Pitch Slider */}
                      <div className="space-y-1.5 border-t border-[var(--line)] pt-3">
                        <div className="flex items-center justify-between font-hud text-xs">
                          <span className="tracking-wider text-[var(--text-2)]">RESONANCE (PITCH)</span>
                          <span className="font-mono text-[var(--cyan)]">
                            {(preferences.voicePitch ?? 0.9).toFixed(2)}
                          </span>
                        </div>
                        <Slider.Root
                          className="relative flex items-center select-none touch-none w-full h-5"
                          value={[preferences.voicePitch ?? 0.9]}
                          onValueChange={([val]) => onUpdatePreferences({ voicePitch: val })}
                          min={0.5}
                          max={1.5}
                          step={0.05}
                        >
                          <Slider.Track className="bg-[var(--surface)] relative grow h-1 border border-[var(--line)]">
                            <Slider.Range className="absolute bg-[var(--cyan)] h-full" />
                          </Slider.Track>
                          <Slider.Thumb
                            className="block w-3.5 h-3.5 bg-[var(--cyan)] shadow-[0_0_8px_var(--cyan)] focus:outline-none cursor-grab active:cursor-grabbing"
                            aria-label="Voice pitch"
                          />
                        </Slider.Root>
                      </div>

                      {/* Volume Slider */}
                      <div className="space-y-1.5 border-t border-[var(--line)] pt-3">
                        <div className="flex items-center justify-between font-hud text-xs">
                          <span className="tracking-wider text-[var(--text-2)]">OUTPUT AMPLITUDE</span>
                          <span className="font-mono text-[var(--cyan)]">
                            {Math.round((preferences.voiceVolume ?? 1.0) * 100)}%
                          </span>
                        </div>
                        <Slider.Root
                          className="relative flex items-center select-none touch-none w-full h-5"
                          value={[preferences.voiceVolume ?? 1.0]}
                          onValueChange={([val]) => onUpdatePreferences({ voiceVolume: val })}
                          min={0.1}
                          max={1.0}
                          step={0.05}
                        >
                          <Slider.Track className="bg-[var(--surface)] relative grow h-1 border border-[var(--line)]">
                            <Slider.Range className="absolute bg-[var(--cyan)] h-full" />
                          </Slider.Track>
                          <Slider.Thumb
                            className="block w-3.5 h-3.5 bg-[var(--cyan)] shadow-[0_0_8px_var(--cyan)] focus:outline-none cursor-grab active:cursor-grabbing"
                            aria-label="Voice volume"
                          />
                        </Slider.Root>
                      </div>

                      {/* DSP Holographic Effects Toggle */}
                      <div className="flex items-center justify-between border-t border-[var(--line)] pt-3">
                        <div className="space-y-0.5">
                          <div className="font-hud tracking-wider text-[var(--text)]">
                            HOLOGRAPHIC ACOUSTIC DSP
                          </div>
                          <div className="font-mono text-[11px] text-[var(--text-3)]">
                            Subtle highpass 100Hz, +2dB @ 3kHz and short room reverb (default OFF for human tone)
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            onUpdatePreferences({
                              voiceHolographicEffect: !(preferences.voiceHolographicEffect ?? false),
                            })
                          }
                          className={`px-3 py-1 font-hud tracking-widest text-xs border transition-all ${
                            (preferences.voiceHolographicEffect ?? false)
                              ? 'border-[var(--cyan)] text-[var(--cyan)] bg-[var(--cyan-faint)]'
                              : 'border-[var(--line)] text-[var(--text-3)] bg-[var(--surface)]'
                          }`}
                        >
                          {(preferences.voiceHolographicEffect ?? false) ? 'ACTIVE' : 'OFF'}
                        </button>
                      </div>

                      {/* Boot Chime Toggle */}
                      <div className="flex items-center justify-between border-t border-[var(--line)] pt-3">
                        <div className="space-y-0.5">
                          <div className="font-hud tracking-wider text-[var(--text)]">
                            STARTUP BOOT CHIME
                          </div>
                          <div className="font-mono text-[11px] text-[var(--text-3)]">
                            Plays Mark III boot chord & greeting on initial protocol engagement
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            onUpdatePreferences({
                              bootChimeEnabled: !(preferences.bootChimeEnabled ?? true),
                            })
                          }
                          className={`px-3 py-1 font-hud tracking-widest text-xs border transition-all ${
                            (preferences.bootChimeEnabled ?? true)
                              ? 'border-[var(--cyan)] text-[var(--cyan)] bg-[var(--cyan-faint)]'
                              : 'border-[var(--line)] text-[var(--text-3)] bg-[var(--surface)]'
                          }`}
                        >
                          {(preferences.bootChimeEnabled ?? true) ? 'ACTIVE' : 'OFF'}
                        </button>
                      </div>

                      {/* Stark Acknowledgements Toggle */}
                      <div className="flex items-center justify-between border-t border-[var(--line)] pt-3">
                        <div className="space-y-0.5">
                          <div className="font-hud tracking-wider text-[var(--text)]">
                            TACTICAL ACKNOWLEDGEMENTS
                          </div>
                          <div className="font-mono text-[11px] text-[var(--text-3)]">
                            Vocal affirmations ("Right away, sir.") when dispatching queries
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            onUpdatePreferences({
                              voiceAcknowledgements: !(preferences.voiceAcknowledgements ?? true),
                            })
                          }
                          className={`px-3 py-1 font-hud tracking-widest text-xs border transition-all ${
                            (preferences.voiceAcknowledgements ?? true)
                              ? 'border-[var(--cyan)] text-[var(--cyan)] bg-[var(--cyan-faint)]'
                              : 'border-[var(--line)] text-[var(--text-3)] bg-[var(--surface)]'
                          }`}
                        >
                          {(preferences.voiceAcknowledgements ?? true) ? 'ACTIVE' : 'OFF'}
                        </button>
                      </div>

                      {/* Wake Word ("Hey Jarvis") */}
                      <div className="flex items-center justify-between border-t border-[var(--line)] pt-3">
                        <div className="space-y-0.5">
                          <div className="font-hud tracking-wider text-[var(--text)]">
                            LISTEN FOR WAKE PHRASE WHILE OPEN
                          </div>
                          <div className="font-mono text-[11px] text-[var(--text-3)]">
                            Auto-listens for "Wake up, JARVIS" while this browser tab remains active
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            onUpdatePreferences({
                              listenWakePhraseWhileTabOpen: !(preferences.listenWakePhraseWhileTabOpen ?? false),
                            })
                          }
                          className={`px-3 py-1 font-hud tracking-widest text-xs border transition-all ${
                            (preferences.listenWakePhraseWhileTabOpen ?? false)
                              ? 'border-[var(--cyan)] text-[var(--cyan)] bg-[var(--cyan-faint)]'
                              : 'border-[var(--line)] text-[var(--text-3)] bg-[var(--surface)]'
                          }`}
                        >
                          {(preferences.listenWakePhraseWhileTabOpen ?? false) ? 'STANDBY' : 'OFF'}
                        </button>
                      </div>

                      {/* Remember Wake State */}
                      <div className="flex items-center justify-between border-t border-[var(--line)] pt-3">
                        <div className="space-y-0.5">
                          <div className="font-hud tracking-wider text-[var(--text)]">
                            REMEMBER WAKE STATE
                          </div>
                          <div className="font-mono text-[11px] text-[var(--text-3)]">
                            Preserve active workshop state on reload (default OFF opens in Standby)
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            onUpdatePreferences({
                              rememberWakeState: !(preferences.rememberWakeState ?? false),
                            })
                          }
                          className={`px-3 py-1 font-hud tracking-widest text-xs border transition-all ${
                            (preferences.rememberWakeState ?? false)
                              ? 'border-[var(--cyan)] text-[var(--cyan)] bg-[var(--cyan-faint)]'
                              : 'border-[var(--line)] text-[var(--text-3)] bg-[var(--surface)]'
                          }`}
                        >
                          {(preferences.rememberWakeState ?? false) ? 'ACTIVE' : 'OFF'}
                        </button>
                      </div>

                      {/* Test Voice Button */}
                      <div className="border-t border-[var(--line)] pt-3 space-y-2">
                        <button
                          onClick={handleTestVoice}
                          disabled={isTestingVoice}
                          className="w-full flex items-center justify-center gap-2 py-2 px-3 border border-[var(--cyan)] bg-[var(--cyan-faint)] text-[var(--cyan)] font-hud text-xs tracking-widest hover:bg-[var(--cyan)] hover:text-black active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Play size={13} fill="currentColor" />
                          {isTestingVoice ? 'TESTING PROTOCOL...' : 'TEST ACOUSTIC SYNTHESIS'}
                        </button>

                        {/* Replay Cinematic Boot Film Intro */}
                        {onReplayIntro && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose()
                              onReplayIntro()
                            }}
                            className="w-full flex items-center justify-center gap-2 py-2 px-3 border border-[var(--gold)] bg-[rgba(242,184,75,0.12)] text-[var(--gold)] font-hud text-xs tracking-widest hover:bg-[var(--gold)] hover:text-black active:scale-[0.98] transition-all cursor-pointer"
                          >
                            <Film size={13} />
                            REPLAY INTRO (CINEMATIC BOOT FILM)
                          </button>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* DATA & ARCHIVES */}
                  <section className="space-y-2">
                    <h3 className="font-hud text-xs font-semibold uppercase tracking-wider text-[var(--cyan-dim)] px-1">
                      ARCHIVAL DATA STORAGE
                    </h3>
                    <div className="p-2 bg-[var(--surface-hi)] border border-[var(--line)] space-y-1">
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
                        <button
                          onClick={() => setConfirmClear(true)}
                          className="w-full flex items-center justify-between px-3 py-2 text-[var(--red)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
                        >
                          <span className="flex items-center gap-2 font-hud tracking-wider">
                            <Trash2 size={14} strokeWidth={1.5} />
                            PURGE ALL ARCHIVES & PREFERENCES
                          </span>
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* KEYBOARD SHORTCUTS */}
                  <section className="space-y-2">
                    <h3 className="font-hud text-xs font-semibold uppercase tracking-wider text-[var(--cyan-dim)] px-1">
                      TACTICAL SHORTCUTS
                    </h3>
                    <div className="p-3 bg-[var(--surface-hi)] border border-[var(--line)] space-y-2">
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
      </Overlay>

      <ConfirmDialog
        isOpen={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={async () => {
          await onClearAllData()
          onClose()
        }}
        title="PURGE ALL ARCHIVES & PREFERENCES"
        description="This will permanently erase all saved conversations, tactical archives, and custom preferences on this device. This action cannot be undone."
        confirmLabel="CONFIRM PURGE"
        cancelLabel="ABORT"
        destructive
        panelTestId="confirm-purge-dialog"
      />
    </>
  )
}
