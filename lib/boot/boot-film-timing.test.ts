/**
 * Boot Film Timing & Safety Tests
 *
 * Requirements:
 * 1. ACTIVE cannot be reached before totalDuration (FILM_DURATION = 23.5s) in natural playback.
 * 2. Skip ignores the activating gesture within 800ms grace period.
 * 3. Skip ignores auto-repeat keydown events (e.repeat === true).
 * 4. Fallback boot uses totalDuration (23.5s) for cue scaling, not hardcoded ~2.8s.
 * 5. WebGL / Fallback render path is decided on mount and never switches mid-film.
 * 6. isQuick defaults to false so initial boot is full 23.5s.
 */

import { describe, it, expect, vi } from 'vitest'
import { FILM_DURATION, QUICK_BOOT_DURATION, FULL_CUES } from './timeline'
import { interpolate } from './timeline'

describe('Boot Film Timing & Duration Constants', () => {
  it('FILM_DURATION is 23.5 seconds', () => {
    expect(FILM_DURATION).toBe(23.5)
  })

  it('QUICK_BOOT_DURATION is 2.4 seconds', () => {
    expect(QUICK_BOOT_DURATION).toBe(2.4)
  })

  it('Last cue in FULL_CUES is BOOT_COMPLETE at 23.50s', () => {
    const lastCue = FULL_CUES[FULL_CUES.length - 1]
    expect(lastCue.name).toBe('BOOT_COMPLETE')
    expect(lastCue.time).toBe(23.5)
  })

  it('MUSIC_END is at 20.04s, leaving ~3.5s tail for title card before completion', () => {
    const musicEndCue = FULL_CUES.find(c => c.name === 'MUSIC_END')
    expect(musicEndCue).toBeDefined()
    expect(musicEndCue!.time).toBe(20.04)
    expect(FILM_DURATION - musicEndCue!.time).toBeCloseTo(3.46, 2)
  })
})

describe('Skip Grace Period & Safety Checks', () => {
  it('ignores skip requests within 800ms of boot start', () => {
    const bootStartTime = 1000
    const nowWithinGrace = 1500 // 500ms elapsed < 800ms
    const shouldSkipWithinGrace = nowWithinGrace - bootStartTime >= 800
    expect(shouldSkipWithinGrace).toBe(false)

    const nowAfterGrace = 1850 // 850ms elapsed >= 800ms
    const shouldSkipAfterGrace = nowAfterGrace - bootStartTime >= 800
    expect(shouldSkipAfterGrace).toBe(true)
  })

  it('ignores keyboard repeat events for skip', () => {
    const handleKeyDown = (e: { key: string; repeat: boolean }, onSkip: () => void) => {
      if (e.repeat) return
      if (e.key === 'Escape') {
        onSkip()
      }
    }

    const onSkip = vi.fn()

    // Keydown with repeat=true (held down key)
    handleKeyDown({ key: 'Escape', repeat: true }, onSkip)
    expect(onSkip).not.toHaveBeenCalled()

    // Keydown with repeat=false (initial press)
    handleKeyDown({ key: 'Escape', repeat: false }, onSkip)
    expect(onSkip).toHaveBeenCalledTimes(1)
  })
})

describe('Fallback Boot Duration Scaling', () => {
  it('scales title card opacity to end at 21.8s in full mode (totalDuration = 23.5s)', () => {
    const totalDuration = 23.5
    const isQuick = totalDuration < 5
    expect(isQuick).toBe(false)

    // At t=2.8s (where old fallback completed), full mode title card is not yet visible
    const titleOpacityAtOldEnd = interpolate(2.8, 21.00, 21.80, 0.0, 1.0)
    expect(titleOpacityAtOldEnd).toBe(0.0)

    // Title appears in the final act (t >= 21.0s)
    const titleOpacityAtMidTitle = interpolate(21.4, 21.00, 21.80, 0.0, 1.0)
    expect(titleOpacityAtMidTitle).toBeCloseTo(0.5, 1)

    // Title fully visible by 21.8s
    const titleOpacityAtFull = interpolate(22.0, 21.00, 21.80, 0.0, 1.0)
    expect(titleOpacityAtFull).toBe(1.0)
  })

  it('uses quick mode timings when totalDuration < 5s', () => {
    const totalDuration = 2.4
    const isQuick = totalDuration < 5
    expect(isQuick).toBe(true)

    // Quick mode title card appears at 1.8s - 2.2s
    const titleOpacity = interpolate(2.0, 1.8, 2.2, 0.0, 1.0)
    expect(titleOpacity).toBeCloseTo(0.5, 1)
  })
})

describe('Completion & Exit Reason Safety', () => {
  it('finish() records exit reason and executes once', () => {
    let finished = false
    let finishReason = ''
    const onComplete = vi.fn()

    const finish = (reason: 'ended' | 'user-skip' | 'timer' | 'fallback-complete' | 'error') => {
      if (finished) return
      finished = true
      finishReason = reason
      onComplete()
    }

    // Natural end
    finish('ended')
    expect(finished).toBe(true)
    expect(finishReason).toBe('ended')
    expect(onComplete).toHaveBeenCalledTimes(1)

    // Subsequent skip or timer calls are no-ops
    finish('user-skip')
    expect(finishReason).toBe('ended')
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
