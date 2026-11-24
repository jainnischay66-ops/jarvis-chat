import { describe, it, expect } from 'vitest'
import {
  FILM_DURATION,
  FULL_BOOT_DURATION,
  QUICK_BOOT_DURATION,
  FULL_CUES,
  QUICK_CUES,
  getCurrentAct,
  interpolate,
  clamp,
  smoothstep,
} from './timeline'
import { getWaveformSamples } from './waveform'
import { BootAudioEngine } from './audio'

describe('Cinematic Boot Film Timeline & Cues', () => {
  it('FILM_DURATION is 23.5 seconds and QUICK_BOOT_DURATION is 2.4 seconds', () => {
    expect(FILM_DURATION).toBe(23.5)
    expect(FULL_BOOT_DURATION).toBe(23.5)
    expect(QUICK_BOOT_DURATION).toBe(2.4)
  })

  it('FULL_CUES are strictly ordered chronologically', () => {
    expect(FULL_CUES.length).toBeGreaterThan(15)
    for (let i = 1; i < FULL_CUES.length; i++) {
      expect(FULL_CUES[i].time).toBeGreaterThanOrEqual(FULL_CUES[i - 1].time)
    }
    expect(FULL_CUES[0].time).toBe(0.0)
    expect(FULL_CUES[FULL_CUES.length - 1].time).toBe(FILM_DURATION)
  })

  it('QUICK_CUES are strictly ordered chronologically', () => {
    expect(QUICK_CUES.length).toBeGreaterThan(4)
    for (let i = 1; i < QUICK_CUES.length; i++) {
      expect(QUICK_CUES[i].time).toBeGreaterThanOrEqual(QUICK_CUES[i - 1].time)
    }
    expect(QUICK_CUES[0].time).toBe(0.0)
    expect(QUICK_CUES[QUICK_CUES.length - 1].time).toBe(QUICK_BOOT_DURATION)
  })

  it('getCurrentAct correctly identifies Acts 1 through 5 across full timeline', () => {
    expect(getCurrentAct(0.5)).toBe(1)
    expect(getCurrentAct(2.4)).toBe(1)
    expect(getCurrentAct(2.5)).toBe(2)
    expect(getCurrentAct(9.0)).toBe(2)
    expect(getCurrentAct(18.5)).toBe(2)
    expect(getCurrentAct(19.0)).toBe(3)
    expect(getCurrentAct(19.4)).toBe(3)
    expect(getCurrentAct(19.5)).toBe(4)
    expect(getCurrentAct(20.5)).toBe(4)
    expect(getCurrentAct(21.0)).toBe(5)
    expect(getCurrentAct(23.0)).toBe(5)
  })

  it('getCurrentAct works correctly for quick boot mode', () => {
    expect(getCurrentAct(0.5, true)).toBe(2)
    expect(getCurrentAct(1.2, true)).toBe(3)
    expect(getCurrentAct(1.8, true)).toBe(4)
    expect(getCurrentAct(2.2, true)).toBe(5)
  })

  it('interpolate and smoothstep clamp properly', () => {
    expect(clamp(1.5, 0, 1)).toBe(1)
    expect(clamp(-0.5, 0, 1)).toBe(0)
    expect(interpolate(5, 0, 10, 0, 100)).toBe(50)
    expect(interpolate(15, 0, 10, 0, 100)).toBe(100) // clamped
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 3)
  })
})

describe('Waveform Buffer & Synthesis', () => {
  it('returns normalized waveform samples with requested count', () => {
    const samples = getWaveformSamples(64)
    expect(samples).toHaveLength(64)
    samples.forEach(s => {
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(1.0)
    })
  })
})

describe('Boot Audio Engine API', () => {
  it('initializes and handles sound triggers gracefully without throwing in Node/JSDOM', async () => {
    const engine = new BootAudioEngine()
    expect(() => {
      engine.playHeartbeat(1.0)
      engine.playBoom(0.6)
      engine.playShimmerTail()
      engine.startAmbientHum(3.7)
      engine.playUiTick(2400)
      engine.setVolume(0.8)
      engine.setMuted(true)
      engine.stopAll()
    }).not.toThrow()

    // Test loadTheme handles failure gracefully without unhandled promise rejection
    const buffer = await engine.loadTheme('/invalid/path.mp3')
    expect(buffer).toBeNull()
  })
})
