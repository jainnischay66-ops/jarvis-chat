/**
 * J.A.R.V.I.S. Cinematic Boot Film Web Audio Engine.
 *
 * Rules:
 * - Music plays through a single AudioBufferSourceNode at constant gain 1.0.
 *   No ducking, no pumping, no fade-out unless the user skips.
 * - Sweeteners (boom, shimmer, hum, ticks, heartbeat) are all ≤ 0.22 gain
 *   (≥ 12 dB below the music).
 * - Preload: call preloadBootTheme(ctx) during STANDBY (after first user gesture)
 *   so the buffer is ready before wake.
 * - Playback: source.start(ctx.currentTime + 0.05, offset). Never HTMLAudioElement.
 * - Skip: skipWithFade() immediately nulls source.onended, then ramps masterGain
 *   to 0 over 250 ms and stops the source.
 * - onEnded callback fires when the AudioBufferSourceNode naturally ends.
 */

/** Module-level pre-decoded buffer cache (survives React re-renders). */
let cachedThemeBuffer: AudioBuffer | null = null
let preloadPromise: Promise<AudioBuffer | null> | null = null

/**
 * Pre-fetch and decode the boot theme MP3 into the given AudioContext.
 * Call once during STANDBY after the first user gesture creates/resumes the ctx.
 * Subsequent calls return the cached buffer immediately.
 */
export async function preloadBootTheme(
  ctx: AudioContext,
  url = '/audio/jarvis-boot-theme.mp3'
): Promise<AudioBuffer | null> {
  if (cachedThemeBuffer) return cachedThemeBuffer
  if (preloadPromise) return preloadPromise

  preloadPromise = (async () => {
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      const arrayBuf = await res.arrayBuffer()
      const decoded = await ctx.decodeAudioData(arrayBuf)
      cachedThemeBuffer = decoded
      return decoded
    } catch {
      return null
    }
  })()

  return preloadPromise
}

/** Returns the cached AudioBuffer synchronously, or null if not yet decoded. */
export function getPreloadedBootTheme(): AudioBuffer | null {
  return cachedThemeBuffer
}

/** Clear the cache (used by tests). */
export function clearBootThemeCache(): void {
  cachedThemeBuffer = null
  preloadPromise = null
}

export class BootAudioEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private themeGain: GainNode | null = null
  private themeSource: AudioBufferSourceNode | null = null
  private humOsc: OscillatorNode | null = null
  private humGain: GainNode | null = null
  private shimmerNodes: { stop: () => void } | null = null
  private isMuted: boolean = false
  private volume: number = 1.0
  private skipFadeTimeout: ReturnType<typeof setTimeout> | null = null

  constructor() {}

  public init(ctx: AudioContext, volume = 1.0, isMuted = false): void {
    this.ctx = ctx
    this.volume = volume
    this.isMuted = isMuted

    try {
      this.masterGain = ctx.createGain()
      this.masterGain.gain.setValueAtTime(isMuted ? 0 : volume, ctx.currentTime)
      this.masterGain.connect(ctx.destination)

      this.themeGain = ctx.createGain()
      this.themeGain.gain.setValueAtTime(1.0, ctx.currentTime)
      this.themeGain.connect(this.masterGain)
    } catch {
      // AudioContext might be in suspended state
    }
  }

  public setVolume(vol: number): void {
    this.volume = vol
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05)
    }
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.05)
    }
  }

  /**
   * @deprecated Use the module-level preloadBootTheme() instead.
   * Kept for compatibility; delegates to the module-level function.
   */
  public async loadTheme(url = '/audio/jarvis-boot-theme.mp3'): Promise<AudioBuffer | null> {
    if (cachedThemeBuffer) return cachedThemeBuffer
    if (!this.ctx) return null
    return preloadBootTheme(this.ctx, url)
  }

  /**
   * Starts playing the boot theme soundtrack at the given offset.
   *
   * @param buffer   Pre-decoded AudioBuffer.
   * @param offset   Seconds into the buffer to start from.
   * @param isQuick  If true, fades out over last 300 ms of the 2.4 s quick boot.
   * @param onEnded  Callback fired when the source node's natural `ended` event fires.
   *
   * Returns startAudioTime and a debug-only stop() function.
   */
  public playTheme(
    buffer: AudioBuffer,
    offset = 0,
    isQuick = false,
    onEnded?: () => void
  ): { startAudioTime: number; stop: () => void } | null {
    if (!this.ctx || !this.themeGain) return null

    // Stop any existing theme source cleanly
    if (this.themeSource) {
      try {
        this.themeSource.onended = null
        this.themeSource.stop()
      } catch {}
      this.themeSource = null
    }

    const now = this.ctx.currentTime
    const source = this.ctx.createBufferSource()
    source.buffer = buffer

    // Theme gain: constant 1.0 — never duck or pump
    this.themeGain.gain.cancelScheduledValues(now)
    this.themeGain.gain.setValueAtTime(1.0, now)

    if (isQuick) {
      // Quick mode: 2.4 s total. Fade out over last 300 ms (2.1 s → 2.4 s)
      this.themeGain.gain.setValueAtTime(1.0, now + 2.1)
      this.themeGain.gain.linearRampToValueAtTime(0.0001, now + 2.4)
    }

    source.connect(this.themeGain)

    // Wire the natural ended event directly (assigned before start())
    if (onEnded) {
      source.onended = onEnded
    }

    try {
      // 50 ms look-ahead prevents click/pop at start
      source.start(now + 0.05, offset)
    } catch {
      return null
    }

    this.themeSource = source

    const stop = () => {
      try {
        source.onended = null
        source.stop()
      } catch {}
    }

    return { startAudioTime: now + 0.05, stop }
  }

  /**
   * User-skip: immediately nulls source.onended to suppress it, then ramps
   * masterGain to 0 over 250 ms and stops the source.
   * Calls onDone when the ramp is complete (~260 ms).
   */
  public skipWithFade(onDone?: () => void): void {
    if (!this.ctx || !this.masterGain) {
      onDone?.()
      return
    }

    if (this.skipFadeTimeout) {
      clearTimeout(this.skipFadeTimeout)
    }

    // Immediately suppress the natural onended callback so it won't fire
    // after the source is stopped by this skip operation.
    if (this.themeSource) {
      this.themeSource.onended = null
    }

    const now = this.ctx.currentTime
    this.masterGain.gain.cancelScheduledValues(now)
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now)
    this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.25)

    this.skipFadeTimeout = setTimeout(() => {
      if (this.themeSource) {
        try {
          this.themeSource.stop()
        } catch {}
        this.themeSource = null
      }
      this.stopAll()
      onDone?.()
    }, 260) // slightly longer than 250 ms ramp
  }

  // ─── Sweeteners (all ≤ 0.22 gain = ≥ 12 dB below music at 1.0) ───────────

  /**
   * Synthesized Boom at 19.00 s (sine 90 → 30 Hz, behind the music).
   * Peak gain: 0.20 (−14 dB relative to music).
   */
  public playBoom(strength = 0.5): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return
    const now = this.ctx.currentTime

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(90, now)
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.45)

    // Peak 0.20 × strength ≤ 0.20 (−14 dB)
    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(0.20 * strength, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9)

    osc.connect(gain)
    gain.connect(this.masterGain)

    osc.start(now)
    osc.stop(now + 1.0)
  }

  /**
   * High Shimmer Tail through delay (19.10 s to 21.50 s).
   * Peak gain: 0.10 (−20 dB).
   */
  public playShimmerTail(): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return
    const now = this.ctx.currentTime

    const osc = this.ctx.createOscillator()
    const oscGain = this.ctx.createGain()
    const delay = this.ctx.createDelay()
    const feedback = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(2200, now)
    osc.frequency.exponentialRampToValueAtTime(1100, now + 1.4)

    // Peak 0.10 (−20 dB)
    oscGain.gain.setValueAtTime(0.10, now)
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8)

    delay.delayTime.setValueAtTime(0.18, now)
    feedback.gain.setValueAtTime(0.42, now)

    filter.type = 'highpass'
    filter.frequency.setValueAtTime(1200, now)

    osc.connect(oscGain)
    oscGain.connect(filter)
    filter.connect(delay)
    delay.connect(feedback)
    feedback.connect(delay)

    filter.connect(this.masterGain)
    delay.connect(this.masterGain)

    osc.start(now)
    osc.stop(now + 2.4)

    this.shimmerNodes = {
      stop: () => {
        try {
          osc.stop()
        } catch {}
      },
    }
  }

  /**
   * Low Ambient Hum (19.30 s, fades out by 23.00 s).
   * Peak gain: 0.08 (−22 dB).
   */
  public startAmbientHum(duration = 3.7): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return
    const now = this.ctx.currentTime

    if (this.humOsc) {
      try {
        this.humOsc.stop()
      } catch {}
      this.humOsc = null
    }

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(52, now)

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(80, now)

    // Peak 0.08 (−22 dB)
    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(0.08, now + 0.6)
    gain.gain.setValueAtTime(0.08, now + Math.max(0.6, duration - 0.8))
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    osc.start(now)
    osc.stop(now + duration + 0.1)

    this.humOsc = osc
    this.humGain = gain
  }

  /**
   * Heartbeat sub-bass thump (Act 1 and Breath at 9.0 s).
   * Peak gain: 0.22 × strength (−13 dB at strength=1).
   */
  public playHeartbeat(strength = 1.0): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return
    const now = this.ctx.currentTime

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const filter = this.ctx.createBiquadFilter()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(58, now)
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.24)

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(110, now)

    // Peak 0.22 (−13 dB)
    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(0.22 * strength, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)

    osc.start(now)
    osc.stop(now + 0.4)
  }

  /**
   * Tactical UI Tick (wireframe layout reveal).
   * Peak gain: 0.08 (−22 dB).
   */
  public playUiTick(pitch = 2400): void {
    if (!this.ctx || !this.masterGain || this.isMuted) return
    const now = this.ctx.currentTime

    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(pitch, now)
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, now + 0.02)

    // Peak 0.08 (−22 dB)
    gain.gain.setValueAtTime(0.08, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035)

    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + 0.04)
  }

  public stopAll(): void {
    if (this.skipFadeTimeout) {
      clearTimeout(this.skipFadeTimeout)
      this.skipFadeTimeout = null
    }
    if (this.themeSource) {
      try {
        this.themeSource.onended = null
        this.themeSource.stop()
      } catch {}
      this.themeSource = null
    }
    if (this.shimmerNodes) {
      this.shimmerNodes.stop()
      this.shimmerNodes = null
    }
    if (this.humOsc) {
      try {
        this.humOsc.stop()
      } catch {}
      this.humOsc = null
    }
  }
}
