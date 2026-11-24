'use client'

import React from 'react'
import { Play, Pause, RotateCcw, FastForward } from 'lucide-react'
import { FULL_CUES, QUICK_CUES, getCurrentAct } from '@/lib/boot/timeline'

interface DebugScrubberProps {
  time: number
  totalDuration: number
  isPlaying: boolean
  isQuick: boolean
  onSeek: (newTime: number) => void
  onTogglePlay: () => void
  onToggleQuick: () => void
  onRestart: () => void
}

export function DebugScrubber({
  time,
  totalDuration,
  isPlaying,
  isQuick,
  onSeek,
  onTogglePlay,
  onToggleQuick,
  onRestart,
}: DebugScrubberProps) {
  const cues = isQuick ? QUICK_CUES : FULL_CUES
  const currentAct = getCurrentAct(time, isQuick)

  React.useEffect(() => {
    ;(window as any).__seekBoot = onSeek
    return () => {
      delete (window as any).__seekBoot
    }
  }, [onSeek])

  return (
    <aside
      aria-label="Boot Film Debug Scrubber"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 pointer-events-auto select-none"
    >
      <div className="chamfer-card p-3 bg-[rgba(8,20,32,0.92)] border border-[var(--cyan)] shadow-[0_0_24px_rgba(92,203,245,0.4)] backdrop-blur-md text-[var(--text)]">
        {/* Header Readout */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--line)] font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--cyan)] animate-pulse" />
            <span className="text-[var(--cyan)] font-semibold">DEBUG TIMELINE SCRUBBER</span>
            <span className="text-[var(--gold)] font-bold">ACT {currentAct}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onToggleQuick}
              className={`px-2 py-0.5 border text-[10px] tracking-wider transition-colors cursor-pointer ${
                isQuick
                  ? 'border-[var(--gold)] text-[var(--gold)] bg-[var(--surface-hi)]'
                  : 'border-[var(--line)] text-[var(--text-3)] hover:text-[var(--text)]'
              }`}
            >
              {isQuick ? 'MODE: QUICK (2.4s)' : `MODE: CINEMATIC (${totalDuration.toFixed(1)}s)`}
            </button>
            <span className="text-[var(--text-2)]">
              {time.toFixed(2)}s / {totalDuration.toFixed(1)}s
            </span>
          </div>
        </div>

        {/* Timeline Slider with Cue Markers */}
        <div className="relative my-3">
          <input
            type="range"
            min={0}
            max={totalDuration}
            step={0.01}
            value={time}
            onChange={e => onSeek(parseFloat(e.target.value))}
            aria-label="Timeline progress"
            className="w-full accent-[var(--cyan)] cursor-pointer h-1.5 bg-[var(--surface-hi)] appearance-none rounded"
          />

          {/* Cue Markers Dots on Scrubber Track */}
          <div className="absolute top-3 inset-x-0 flex pointer-events-none">
            {cues.map(c => {
              const leftPercent = (c.time / totalDuration) * 100
              const isPassed = time >= c.time
              return (
                <div
                  key={c.name}
                  className="absolute -translate-x-1/2 flex flex-col items-center group pointer-events-auto cursor-pointer"
                  style={{ left: `${leftPercent}%` }}
                  onClick={() => onSeek(c.time)}
                  title={`${c.name} (${c.time}s): ${c.description}`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      isPassed ? 'bg-[var(--cyan)]' : 'bg-[var(--text-3)]'
                    }`}
                  />
                  <span className="hidden group-hover:block absolute bottom-4 font-mono text-[9px] bg-black/90 px-1 border border-[var(--line)] text-[var(--cyan)] whitespace-nowrap z-50">
                    {c.name} ({c.time}s)
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Controls Bar */}
        <div className="flex items-center justify-between pt-1 font-mono text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={onTogglePlay}
              className="px-3 py-1 flex items-center gap-1.5 bg-[var(--surface-hi)] border border-[var(--cyan)] text-[var(--cyan)] hover:bg-[var(--cyan-faint)] transition-colors cursor-pointer"
            >
              {isPlaying ? <Pause size={13} /> : <Play size={13} />}
              <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
            </button>

            <button
              onClick={onRestart}
              className="px-2.5 py-1 flex items-center gap-1 bg-[var(--surface-hi)] border border-[var(--line)] text-[var(--text-2)] hover:text-[var(--cyan)] transition-colors cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>RESTART</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1 overflow-x-auto max-w-xs text-[10px]">
            {cues.slice(0, 6).map(c => (
              <button
                key={c.name}
                onClick={() => onSeek(c.time)}
                className="px-1.5 py-0.5 border border-[var(--line)] bg-[var(--surface-hi)] text-[var(--text-3)] hover:text-[var(--cyan)] hover:border-[var(--cyan)] transition-colors cursor-pointer truncate"
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}
