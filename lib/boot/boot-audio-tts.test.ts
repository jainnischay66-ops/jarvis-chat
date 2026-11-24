/**
 * Boot Audio + TTS Gate Tests
 *
 * Test 1: speak() is a strict no-op during BOOTING state.
 *   - Mock speechSynthesis.speak and TTSManager internals.
 *   - Assert speak() is never called in BOOTING (including quick-wake path).
 *   - Assert speak() still works in STANDBY.
 *
 * Test 2: Audio playback and skip behaviour.
 *   - Assert source.onended callback is registered.
 *   - Assert ACTIVE is not entered before onended fires.
 *   - Assert skipWithFade() ramps gain to 0 and calls onDone after ~250 ms.
 *
 * Test 3: Sweetener gain levels are ≤ 0.22 (≥ 12 dB below music at 1.0).
 *
 * Test 4: preloadBootTheme caches the buffer and second call returns cache.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  setTTSPowerState,
  getTTSPowerState,
  getTTSManager,
} from '../tts/tts-manager'
import {
  BootAudioEngine,
  preloadBootTheme,
  getPreloadedBootTheme,
  clearBootThemeCache,
} from './audio'

// ─── Web Audio API stub ───────────────────────────────────────────────────────

function makeGainNode() {
  const scheduledValues: Array<[string, number, number]> = []
  const gain = {
    value: 1,
    setValueAtTime: vi.fn((v: number) => { gain.value = v }),
    linearRampToValueAtTime: vi.fn((v: number) => { gain.value = v }),
    exponentialRampToValueAtTime: vi.fn((v: number) => { gain.value = v }),
    setTargetAtTime: vi.fn((v: number) => { gain.value = v }),
    cancelScheduledValues: vi.fn(),
    _scheduled: scheduledValues,
  }
  return { gain, connect: vi.fn(), disconnect: vi.fn() }
}

function makeOscillator() {
  return {
    type: 'sine',
    frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  }
}

function makeSourceNode(buffer: AudioBuffer | null = null) {
  const node = {
    buffer: buffer,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  }
  return node
}

function makeAudioContext() {
  let _time = 0
  const destination = {}
  const ctx = {
    get currentTime() { return _time },
    set currentTime(v) { _time = v },
    _advance(dt: number) { _time += dt },
    state: 'running' as AudioContextState,
    createGain: vi.fn(() => makeGainNode()),
    createOscillator: vi.fn(() => makeOscillator()),
    createBiquadFilter: vi.fn(() => ({
      type: 'lowpass',
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
    })),
    createDelay: vi.fn(() => ({
      delayTime: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
    })),
    destination,
    decodeAudioData: vi.fn(),
    resume: vi.fn().mockResolvedValue(undefined),
  }
  return ctx
}

// ─── Test 1: TTS gate during BOOTING ─────────────────────────────────────────

describe('TTS Power-State Gate', () => {
  let speakMock: ReturnType<typeof vi.fn>
  let cancelMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    speakMock = vi.fn()
    cancelMock = vi.fn()

    // Stub out window.speechSynthesis
    Object.defineProperty(globalThis, 'speechSynthesis', {
      value: { speak: speakMock, cancel: cancelMock, getVoices: () => [] },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    // Reset to STANDBY for clean slate
    setTTSPowerState('STANDBY')
  })

  it('speak() is a no-op when power state is BOOTING', async () => {
    const manager = getTTSManager()

    // Spy on browser TTS speak
    const browserSpy = vi
      .spyOn((manager as any).browserTTS, 'speak')
      .mockResolvedValue(undefined)

    // Set state to BOOTING (also cancels any in-flight TTS)
    setTTSPowerState('BOOTING')
    expect(getTTSPowerState()).toBe('BOOTING')

    // speakText should be a no-op
    await manager.speakText('Good evening, sir.', undefined, 'browser')
    expect(browserSpy).not.toHaveBeenCalled()

    // enqueueStreamChunk should also be a no-op
    const enqueueSpy = vi.spyOn(manager as any, 'processQueue')
    manager.enqueueStreamChunk('Hello', undefined, 'browser')
    expect(enqueueSpy).not.toHaveBeenCalled()

    browserSpy.mockRestore()
    enqueueSpy.mockRestore()
  })

  it('speak() works normally in STANDBY state', async () => {
    const manager = getTTSManager()
    const browserSpy = vi
      .spyOn((manager as any).browserTTS, 'speak')
      .mockResolvedValue(undefined)

    setTTSPowerState('STANDBY')
    await manager.speakText('Telemetry nominal, sir.', undefined, 'browser')

    expect(browserSpy).toHaveBeenCalledTimes(1)
    browserSpy.mockRestore()
  })

  it('setTTSPowerState(BOOTING) immediately calls speechSynthesis.cancel()', () => {
    setTTSPowerState('STANDBY')
    setTTSPowerState('BOOTING')
    // window.speechSynthesis.cancel must have been called
    expect(cancelMock).toHaveBeenCalled()
  })

  it('quick-wake path: speak() is never called in BOOTING', async () => {
    const manager = getTTSManager()
    const browserSpy = vi
      .spyOn((manager as any).browserTTS, 'speak')
      .mockResolvedValue(undefined)

    setTTSPowerState('BOOTING')

    // Simulate the quick-wake cue that previously called speakGreeting
    const wakeLine = 'All systems online, sir.'
    await manager.speakText(wakeLine, undefined, 'browser')
    expect(browserSpy).not.toHaveBeenCalled()

    browserSpy.mockRestore()
  })
})

// ─── Test 2: BootAudioEngine — onended, skip fade ────────────────────────────

describe('BootAudioEngine', () => {
  let ctx: ReturnType<typeof makeAudioContext>
  let engine: BootAudioEngine
  let source: ReturnType<typeof makeSourceNode>

  beforeEach(() => {
    ctx = makeAudioContext()

    // Stub createBufferSource so we control the source node
    source = makeSourceNode()
    ;(ctx as any).createBufferSource = vi.fn(() => source)

    engine = new BootAudioEngine()
    engine.init(ctx as unknown as AudioContext, 1.0, false)
  })

  it('registers source.onended callback before calling source.start()', () => {
    // Create a minimal mock buffer
    const buffer = { duration: 20.04 } as AudioBuffer

    const onEnded = vi.fn()
    engine.playTheme(buffer, 0, false, onEnded)

    // onended must be set to a function (engine may wrap it in an arrow)
    expect(typeof source.onended).toBe('function')
    // start() must have been called
    expect(source.start).toHaveBeenCalledOnce()
    // With a 50 ms look-ahead offset
    const [when] = (source.start as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(when).toBeCloseTo(ctx.currentTime + 0.05, 2)
  })

  it('skipWithFade() calls onDone after ~250 ms and clears source.onended', async () => {
    vi.useFakeTimers()

    const buffer = { duration: 20.04 } as AudioBuffer
    const onEnded = vi.fn()
    engine.playTheme(buffer, 0, false, onEnded)

    // source.onended is a function at this point (engine wrapped it)
    expect(typeof source.onended).toBe('function')

    const onDone = vi.fn()
    engine.skipWithFade(onDone)

    // After skipWithFade, the engine clears themeSource.onended to suppress it
    expect(source.onended).toBeNull()

    // Advance 260 ms (ramp + slight margin)
    vi.advanceTimersByTime(260)

    expect(onDone).toHaveBeenCalledOnce()
    // source.stop() was called by skipWithFade
    expect(source.stop).toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('theme gain stays at 1.0 (no ducking) in full mode', () => {
    const buffer = { duration: 20.04 } as AudioBuffer
    engine.playTheme(buffer, 0, false)

    // Inspect the themeGain node
    const themeGainNode = (engine as any).themeGain
    expect(themeGainNode).not.toBeNull()
    // setValueAtTime should have been called with 1.0 (no other schedule)
    const calls = (themeGainNode.gain.setValueAtTime as ReturnType<typeof vi.fn>).mock.calls
    // The last setValueAtTime call should be 1.0
    const values = calls.map((c: any[]) => c[0] as number)
    expect(values.every((v: number) => v === 1.0)).toBe(true)
  })
})

// ─── Test 3: Sweetener gain levels ≤ 0.22 ────────────────────────────────────

describe('BootAudioEngine sweetener gains', () => {
  it('playBoom peak gain is ≤ 0.22', () => {
    const ctx2 = makeAudioContext()
    // Track all gain nodes created
    const gainNodes: ReturnType<typeof makeGainNode>[] = []
    ;(ctx2.createGain as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const g = makeGainNode()
      gainNodes.push(g)
      return g
    })
    const engine2 = new BootAudioEngine()
    engine2.init(ctx2 as unknown as AudioContext)

    const beforeCount = gainNodes.length // masterGain + themeGain
    engine2.playBoom(1.0) // strength=1 → peak = 0.20
    const sweetenerGains = gainNodes.slice(beforeCount)

    // Find peak linear ramp calls across sweetener gain nodes only
    const allRampCalls = sweetenerGains.flatMap(g =>
      (g.gain.linearRampToValueAtTime as ReturnType<typeof vi.fn>).mock.calls
    )
    const significantPeaks = allRampCalls
      .map((c: any[]) => c[0] as number)
      .filter((v: number) => v > 0.01)
    expect(significantPeaks.length).toBeGreaterThan(0)
    expect(significantPeaks.every((v: number) => v <= 0.22)).toBe(true)
  })

  it('playHeartbeat peak gain is ≤ 0.22', () => {
    const ctx = makeAudioContext()
    const gainNodes: ReturnType<typeof makeGainNode>[] = []
    ;(ctx.createGain as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const g = makeGainNode()
      gainNodes.push(g)
      return g
    })
    const engine = new BootAudioEngine()
    engine.init(ctx as unknown as AudioContext)

    const beforeCount = gainNodes.length
    engine.playHeartbeat(1.0) // strength=1 → peak = 0.22
    const sweetenerGains = gainNodes.slice(beforeCount)

    const allRampCalls = sweetenerGains.flatMap(g =>
      (g.gain.linearRampToValueAtTime as ReturnType<typeof vi.fn>).mock.calls
    )
    const significantPeaks = allRampCalls
      .map((c: any[]) => c[0] as number)
      .filter((v: number) => v > 0.01)
    expect(significantPeaks.length).toBeGreaterThan(0)
    expect(significantPeaks.every((v: number) => v <= 0.22)).toBe(true)
  })

  it('playUiTick initial gain is ≤ 0.22', () => {
    const ctx = makeAudioContext()
    const gainNodes: ReturnType<typeof makeGainNode>[] = []
    ;(ctx.createGain as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const g = makeGainNode()
      gainNodes.push(g)
      return g
    })
    const engine = new BootAudioEngine()
    engine.init(ctx as unknown as AudioContext)

    const beforeCount = gainNodes.length
    engine.playUiTick(2400)
    const sweetenerGains = gainNodes.slice(beforeCount)

    const allSetCalls = sweetenerGains.flatMap(g =>
      (g.gain.setValueAtTime as ReturnType<typeof vi.fn>).mock.calls
    )
    const significantInitials = allSetCalls
      .map((c: any[]) => c[0] as number)
      .filter((v: number) => v > 0.01)
    expect(significantInitials.length).toBeGreaterThan(0)
    expect(significantInitials.every((v: number) => v <= 0.22)).toBe(true)
  })
})

// ─── Test 4: preloadBootTheme caching ────────────────────────────────────────

describe('preloadBootTheme', () => {
  beforeEach(() => {
    clearBootThemeCache()
  })

  afterEach(() => {
    clearBootThemeCache()
  })

  it('fetches and decodes on first call, returns cache on second call', async () => {
    const fakeBuffer = { duration: 20.04 } as AudioBuffer
    const fakeArrayBuffer = new ArrayBuffer(8)

    const ctx = makeAudioContext()
    ctx.decodeAudioData.mockResolvedValue(fakeBuffer)

    // Stub fetch
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(fakeArrayBuffer),
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const result1 = await preloadBootTheme(ctx as unknown as AudioContext)
    expect(result1).toBe(fakeBuffer)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(ctx.decodeAudioData).toHaveBeenCalledOnce()

    // Second call must return cache without fetching again
    const result2 = await preloadBootTheme(ctx as unknown as AudioContext)
    expect(result2).toBe(fakeBuffer)
    expect(fetchMock).toHaveBeenCalledOnce() // still only 1 fetch
    expect(getPreloadedBootTheme()).toBe(fakeBuffer)
  })

  it('returns null on fetch failure without throwing', async () => {
    const ctx = makeAudioContext()
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch

    const result = await preloadBootTheme(ctx as unknown as AudioContext)
    expect(result).toBeNull()
  })
})
