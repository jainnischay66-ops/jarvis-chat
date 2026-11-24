'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  FILM_DURATION,
  QUICK_BOOT_DURATION,
  QUICK_START_OFFSET,
  getCurrentAct,
  interpolate,
  clamp,
} from '@/lib/boot/timeline'
import { BootAudioEngine, preloadBootTheme, getPreloadedBootTheme } from '@/lib/boot/audio'
import { getAudioContext } from '@/lib/tts'
import { getRandomWakeLine } from '@/lib/wakeLines'
import { BootCanvas } from './boot/BootCanvas'
import { Act1Voice } from './boot/acts/Act1Voice'
import { Act2Ignition } from './boot/acts/Act2Ignition'
import { Act3Impact } from './boot/acts/Act3Impact'
import { Act4Deploy } from './boot/acts/Act4Deploy'
import { Act5Title } from './boot/acts/Act5Title'
import { Letterbox } from './boot/Letterbox'
import { DebugScrubber } from './boot/DebugScrubber'
import { FallbackBoot } from './boot/FallbackBoot'

// Unused imports kept to avoid type errors from unused destructures above
void getCurrentAct
void interpolate
void clamp

interface BootFilmProps {
  onComplete: () => void
  /** No longer used — kept only so existing JSX in ChatWindow doesn't break.
   *  Pass a no-op; it will never be called. */
  speakGreeting?: (line: string) => Promise<void>
  /**
   * Pass true only when this is a full cinematic boot (the first wake of a
   * power cycle, or an explicit "Replay intro" request).
   * Pass false (or omit) for every other wake so the film always plays in full.
   * ChatWindow is responsible for deciding when forceQuick is true.
   */
  forceQuick?: boolean
  initialDebug?: boolean
  volume?: number
  isMuted?: boolean
}

export function BootFilm({
  onComplete,
  // speakGreeting is intentionally ignored — zero TTS during BOOTING
  forceQuick = false,
  initialDebug = false,
  volume = 1.0,
  isMuted = false,
}: BootFilmProps) {
  // isQuick is determined solely by the forceQuick prop — ChatWindow owns the logic.
  // We NO LONGER read sessionStorage here; that caused every wake after the first
  // to run the 2.4 s quick-mode film because sessionStorage was set on mount.
  const [isQuick, setIsQuick] = useState<boolean>(forceQuick)

  const totalDuration = isQuick ? QUICK_BOOT_DURATION : FILM_DURATION

  // Clock & State
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isDebug, setIsDebug] = useState(initialDebug)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [webGlSupported, setWebGlSupported] = useState(true)
  const [wakeLine, setWakeLine] = useState<string>(() => getRandomWakeLine())
  const [audioBlocked, setAudioBlocked] = useState(false)

  const timeRef = useRef(0)
  const isPlayingRef = useRef(true)
  const isFinishedRef = useRef(false)
  const audioRef = useRef<BootAudioEngine | null>(null)
  const audioBufferRef = useRef<AudioBuffer | null>(null)
  const audioStartTimeRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  // musicEndedRef: true once source.onended fires (natural end) or skip
  const musicEndedRef = useRef(false)
  // titleTailDoneRef: true once the visual tail after music is complete
  const titleTailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cuedAudioRef = useRef<Record<string, boolean>>({})
  // Boot-start time (performance.now()) — used for skip grace period
  const bootStartTimeRef = useRef<number>(performance.now())
  // Track render path for dev overlay
  const [renderPath, setRenderPath] = useState<'webgl' | 'fallback'>('webgl')
  const [finishReason, setFinishReason] = useState<string>('')

  // Track prefers-reduced-motion and WebGL support
  useEffect(() => {
    if (typeof window === 'undefined') return

    if (window.location.search.includes('debug=boot')) {
      setIsDebug(true)
    }

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)

    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      const supported = Boolean(gl)
      setWebGlSupported(supported)
      setRenderPath(supported ? 'webgl' : 'fallback')
    } catch {
      setWebGlSupported(false)
      setRenderPath('fallback')
    }

    const line = getRandomWakeLine()
    setWakeLine(line)

    // Reset boot-start time when the film mounts (for skip grace period)
    bootStartTimeRef.current = performance.now()
  }, [])

  // Master finish handler — single point of exit, logs reason for debugging
  const finish = useCallback(
    (reason: 'ended' | 'user-skip' | 'timer' | 'fallback-complete' | 'error') => {
      if (isFinishedRef.current) return
      isFinishedRef.current = true
      if (process.env.NODE_ENV !== 'production') {
        console.log(
          `[BootFilm] finish(${reason}) at t=${timeRef.current.toFixed(2)}s` +
            ` isQuick=${isQuick} totalDuration=${totalDuration} path=${renderPath}`
        )
      }
      setFinishReason(reason)
      if (titleTailTimerRef.current) {
        clearTimeout(titleTailTimerRef.current)
        titleTailTimerRef.current = null
      }
      audioRef.current?.stopAll()
      // Mark session booted ONLY after a completed film (not on mount).
      // This ensures the NEXT wake is quick, not the current one.
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('jarvis-has-booted', 'true')
        } catch {}
      }
      onComplete()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onComplete, isQuick, totalDuration, renderPath]
  )

  // Convenience alias kept for internal use (rAF loop uses 'ended')
  const finishBoot = useCallback(() => finish('ended'), [finish])

  /**
   * Called when the music's AudioBufferSourceNode fires its natural `ended` event.
   * In full mode, we let the visual tail continue to FILM_DURATION naturally via rAF.
   * In quick mode (2.4 s), the music ends at 2.4 s and we finish immediately.
   */
  const onMusicEnded = useCallback(() => {
    musicEndedRef.current = true
    // In quick mode: audio was scheduled to end at ~2.4 s; finishBoot from rAF loop
    // In full mode: rAF loop continues from 20.04 s to 23.5 s, then finishBoot
    // No timer needed — the rAF progress threshold handles the rest.
  }, [])

  // Fast-forward skip (Escape or Click) — fades over 250 ms
  // 800 ms grace window: ignores the click/tap that woke JARVIS (prevents click-leak)
  const handleSkip = useCallback(() => {
    if (isFinishedRef.current) return
    // Skip-lock: ignore activating gesture (the same click that woke JARVIS)
    if (performance.now() - bootStartTimeRef.current < 800) return
    // Suppress the music's onended callback so it doesn't double-fire finish
    if (audioRef.current) {
      audioRef.current.skipWithFade(() => {
        finish('user-skip')
      })
    } else {
      finish('user-skip')
    }
  }, [finish])

  // Tap-to-enable audio when AudioContext is blocked
  const handleUnblockAudio = useCallback(async () => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    try {
      await ctx.resume()
      setAudioBlocked(false)

      const buffer = getPreloadedBootTheme()
      if (buffer && audioRef.current) {
        const offset = isQuick ? QUICK_START_OFFSET + timeRef.current : timeRef.current
        const playRes = audioRef.current.playTheme(buffer, offset, isQuick, onMusicEnded)
        if (playRes) {
          // Rebase audio clock from current visual time
          audioStartTimeRef.current = ctx.currentTime - timeRef.current
        }
      }
    } catch {}
  }, [isQuick, onMusicEnded])

  // Initialize Web Audio Engine & Load/Play Theme
  useEffect(() => {
    const audioEngine = new BootAudioEngine()
    const ctx = getAudioContext()
    audioCtxRef.current = ctx

    if (ctx) {
      audioEngine.init(ctx, volume, isMuted)
      audioRef.current = audioEngine

      // Prefer pre-decoded buffer; fall back to loading now
      const cached = getPreloadedBootTheme()
      const bufferPromise: Promise<AudioBuffer | null> = cached
        ? Promise.resolve(cached)
        : audioEngine.loadTheme('/audio/jarvis-boot-theme.mp3')

      bufferPromise.then(buffer => {
        if (!buffer || isFinishedRef.current) return
        audioBufferRef.current = buffer

        const offset = isQuick ? QUICK_START_OFFSET : 0.0
        const playRes = audioEngine.playTheme(buffer, offset, isQuick, onMusicEnded)
        if (playRes) {
          audioStartTimeRef.current = playRes.startAudioTime

          if (ctx.state === 'suspended') {
            setAudioBlocked(true)
          }
        }
      })
    }

    return () => {
      audioEngine.stopAll()
      audioRef.current = null
      audioBufferRef.current = null
      audioStartTimeRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume, isMuted, isQuick])

  // Handle keyboard shortcut: Escape skips
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore auto-repeat (held-down key) — only act on first keypress
      if (e.repeat) return
      if (e.key === 'Escape') {
        handleSkip()
      } else if (e.code === 'Space' && isDebug) {
        e.preventDefault()
        setIsPlaying(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSkip, isDebug])

  // Synchronized Master requestAnimationFrame Loop driven by Audio Clock
  useEffect(() => {
    let animId: number
    let lastTimestamp: number | null = null

    isPlayingRef.current = isPlaying

    const loop = (timestamp: number) => {
      if (!lastTimestamp) lastTimestamp = timestamp
      const dt = (timestamp - lastTimestamp) / 1000
      lastTimestamp = timestamp

      if (isPlayingRef.current && !isFinishedRef.current) {
        const ctx = audioCtxRef.current
        let newTime: number

        // Use Audio Clock if audio has started (master clock)
        if (ctx && ctx.state === 'running' && audioStartTimeRef.current !== null) {
          const elapsed = ctx.currentTime - audioStartTimeRef.current
          newTime = Math.min(totalDuration, elapsed)
        } else {
          // Fallback: performance.now() if AudioContext is blocked or not started yet
          newTime = Math.min(totalDuration, timeRef.current + dt)
        }

        timeRef.current = newTime
        setCurrentTime(newTime)

        // Audio Cue Triggers based on master clock
        const audioEngine = audioRef.current
        if (audioEngine) {
          if (!isQuick) {
            // Full 23.5s cues — ZERO TTS, sweeteners only
            if (newTime >= 0.5 && !cuedAudioRef.current['hb1']) {
              cuedAudioRef.current['hb1'] = true
              audioEngine.playHeartbeat(1.0)
            }
            if (newTime >= 1.2 && !cuedAudioRef.current['hb2']) {
              cuedAudioRef.current['hb2'] = true
              audioEngine.playHeartbeat(0.85)
            }
            if (newTime >= 9.0 && !cuedAudioRef.current['breath_hb']) {
              cuedAudioRef.current['breath_hb'] = true
              audioEngine.playHeartbeat(0.65)
            }
            // Impact Boom at 19.00 s (behind music)
            if (newTime >= 19.00 && !cuedAudioRef.current['impact_boom']) {
              cuedAudioRef.current['impact_boom'] = true
              audioEngine.playBoom(0.6)
            }
            // Shimmer tail 19.10 s to 21.50 s
            if (newTime >= 19.10 && !cuedAudioRef.current['shimmer']) {
              cuedAudioRef.current['shimmer'] = true
              audioEngine.playShimmerTail()
            }
            // UI ticks during wireframe deploy
            if (newTime >= 19.25 && !cuedAudioRef.current['tick1']) {
              cuedAudioRef.current['tick1'] = true
              audioEngine.playUiTick(2600)
            }
            // Low ambient hum 19.30 s fading by 23.00 s
            if (newTime >= 19.30 && !cuedAudioRef.current['ambient_hum']) {
              cuedAudioRef.current['ambient_hum'] = true
              audioEngine.startAmbientHum(3.7)
            }
            if (newTime >= 19.35 && !cuedAudioRef.current['tick2']) {
              cuedAudioRef.current['tick2'] = true
              audioEngine.playUiTick(2200)
            }
            if (newTime >= 19.45 && !cuedAudioRef.current['tick3']) {
              cuedAudioRef.current['tick3'] = true
              audioEngine.playUiTick(2400)
            }
            // NOTE: NO speakGreeting call — wake line is silent text in Act5Title.
          } else {
            // Quick 2.4 s mode: Impact hit at 1.20 s (19.0 in track)
            if (newTime >= 1.20 && !cuedAudioRef.current['q_impact']) {
              cuedAudioRef.current['q_impact'] = true
              audioEngine.playBoom(0.6)
              audioEngine.playShimmerTail()
            }
            // NOTE: NO speakGreeting call in quick mode either.
          }
        }

        // Transition to ACTIVE only after reaching FILM_DURATION
        // The AudioBufferSourceNode's onended event already set musicEndedRef=true
        // for natural playback; for blocked ctx, we rely on totalDuration threshold.
        if (newTime >= totalDuration) {
          finish('ended')
          return
        }
      }

      animId = requestAnimationFrame(loop)
    }

    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [isPlaying, totalDuration, isQuick, finish])

  // Seek handler for Scrubber
  const handleSeek = useCallback(
    (t: number) => {
      timeRef.current = t
      setCurrentTime(t)

      const ctx = audioCtxRef.current
      const audioEngine = audioRef.current
      const buffer = audioBufferRef.current

      if (ctx && audioEngine && buffer) {
        if (!isQuick) {
          if (t < 20.0) {
            audioEngine.playTheme(buffer, t, false, onMusicEnded)
            audioStartTimeRef.current = ctx.currentTime - t
          } else {
            audioEngine.stopAll()
            audioStartTimeRef.current = ctx.currentTime - t
          }
        } else {
          const quickOffset = QUICK_START_OFFSET + t
          if (quickOffset < 20.0) {
            audioEngine.playTheme(buffer, quickOffset, true, onMusicEnded)
            audioStartTimeRef.current = ctx.currentTime - t
          } else {
            audioEngine.stopAll()
            audioStartTimeRef.current = ctx.currentTime - t
          }
        }
      }
    },
    [isQuick, onMusicEnded]
  )

  useEffect(() => {
    ;(window as any).__seekBoot = handleSeek
    return () => {
      delete (window as any).__seekBoot
    }
  }, [handleSeek])

  // Reduced motion: clean title card only
  if (reducedMotion) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#02040A] text-white p-6"
        role="alert"
        aria-live="assertive"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35 }}
          className="text-center space-y-3"
        >
          <h1 className="font-title text-4xl tracking-[0.2em] text-[var(--cyan)]">
            J.A.R.V.I.S.
          </h1>
          <p className="font-hud text-xs tracking-widest text-[var(--gold)]">
            SYSTEM BOOT COMPLETE
          </p>
        </motion.div>
        <button
          onClick={handleSkip}
          className="mt-6 px-4 py-1.5 border border-[var(--cyan)] bg-[var(--surface-hi)] text-[var(--cyan)] font-hud text-xs tracking-wider cursor-pointer"
        >
          ENTER HUD
        </button>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[#02040A] overflow-hidden select-none"
      onClick={handleSkip}
      role="region"
      aria-label="JARVIS Cinematic Boot Film"
    >
      {/* 2.39:1 Cinematic Letterbox Bars */}
      <Letterbox time={currentTime} totalDuration={totalDuration} />

      {/* Dev Diagnostics Overlay */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="absolute top-2 left-2 z-50 text-[10px] font-mono text-[var(--text-3)] bg-black/70 px-2 py-1 rounded border border-[var(--line)] pointer-events-none select-none">
          PATH: {webGlSupported ? 'WebGL' : 'SVG Fallback'} | DURATION: {totalDuration.toFixed(1)}s{finishReason ? ` | FINISHED: ${finishReason}` : ''}
        </div>
      )}

      {/* Thin full-width Progress Bar at the very bottom */}
      <div className="absolute bottom-[env(safe-area-inset-bottom,0px)] inset-x-0 h-[2px] bg-[rgba(92,203,245,0.12)] z-40">
        <div
          className="h-full bg-[var(--cyan)] shadow-[0_0_8px_var(--cyan)] transition-all duration-75"
          style={{ width: `${Math.min(100, (currentTime / totalDuration) * 100)}%` }}
        />
      </div>

      {/* Bottom Right Skip Chip */}
      <div className="absolute bottom-[calc(14px+env(safe-area-inset-bottom,0px))] right-6 z-50 pointer-events-auto">
        <button
          onClick={e => {
            e.stopPropagation()
            handleSkip()
          }}
          className="flex items-center gap-2 px-3.5 py-2 min-h-[44px] bg-[rgba(8,20,32,0.8)] border border-[var(--line)] hover:border-[var(--cyan)] hover:text-[var(--cyan)] text-[var(--text-2)] font-mono text-xs tracking-widest backdrop-blur-md transition-all active:scale-95 cursor-pointer"
        >
          <span>ESC TO SKIP</span>
        </button>
      </div>

      {/* AudioContext blocked chip — tap to enable sound */}
      {audioBlocked && (
        <div className="absolute top-[calc(14px+env(safe-area-inset-top,0px))] left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
          <button
            onClick={e => {
              e.stopPropagation()
              handleUnblockAudio()
            }}
            className="flex items-center gap-2 px-4 py-2 min-h-[44px] bg-[rgba(8,20,32,0.9)] border border-[var(--gold)] text-[var(--gold)] font-mono text-xs tracking-widest backdrop-blur-md animate-pulse cursor-pointer"
          >
            🔊 TAP TO ENABLE SOUND
          </button>
        </div>
      )}

      {/* Primary 3D WebGL Canvas or SVG Fallback */}
      {webGlSupported ? (
        <BootCanvas timeRef={timeRef} isQuick={isQuick} />
      ) : (
        <FallbackBoot time={currentTime} totalDuration={totalDuration} wakeLine={wakeLine} />
      )}

      {/* 2D Motion Design Overlay Acts */}
      {!isQuick && (
        <>
          <Act1Voice time={currentTime} />
          <Act2Ignition time={currentTime} />
          <Act3Impact time={currentTime} isQuick={false} />
          <Act4Deploy time={currentTime} />
          <Act5Title time={currentTime} wakeLine={wakeLine} />
        </>
      )}

      {isQuick && (
        <>
          <Act3Impact time={currentTime} isQuick={true} />
        </>
      )}

      {/* Optional Debug Scrubber for tuning cue points (?debug=boot) */}
      {isDebug && (
        <div onClick={e => e.stopPropagation()}>
          <DebugScrubber
            time={currentTime}
            totalDuration={totalDuration}
            isPlaying={isPlaying}
            isQuick={isQuick}
            onSeek={handleSeek}
            onTogglePlay={() => setIsPlaying(prev => !prev)}
            onToggleQuick={() => {
              const nextQuick = !isQuick
              setIsQuick(nextQuick)
              handleSeek(0)
              cuedAudioRef.current = {}
            }}
            onRestart={() => {
              handleSeek(0)
              cuedAudioRef.current = {}
              musicEndedRef.current = false
            }}
          />
        </div>
      )}
    </div>
  )
}
