/**
 * Cloud TTS provider proxying audio generation to /api/tts.
 * Handles audio pre-fetching, in-memory caching, Web Audio DSP holographic chain,
 * and real-time RMS extraction for audio-reactive UI.
 */

import type { TTSOptions, TTSProvider, TTSVoice } from './types'
import { getAudioContext, createHolographicPipeline, type HolographicPipeline } from './audio-processor'

export class CloudTTS implements TTSProvider {
  public readonly name = 'cloud' as const
  private audioCache = new Map<string, ArrayBuffer>()
  private currentSource: AudioBufferSourceNode | null = null
  private currentPipeline: HolographicPipeline | null = null
  private animId: number | null = null
  private abortController: AbortController | null = null

  public isSupported(): boolean {
    return typeof window !== 'undefined' && typeof fetch !== 'undefined'
  }

  public async getVoices(): Promise<TTSVoice[]> {
    try {
      const res = await fetch('/api/tts?voices=1')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.voices)) {
          return data.voices.map((v: any) => ({
            id: v.id || v.name,
            name: v.name || v.id,
            lang: v.lang || 'en-GB',
            provider: 'cloud',
          }))
        }
      }
    } catch {}

    // Default cloud voice options
    return [
      { id: 'onyx', name: 'JARVIS Deep (Onyx)', lang: 'en-US', provider: 'cloud' },
      { id: 'echo', name: 'JARVIS Crisp (Echo)', lang: 'en-US', provider: 'cloud' },
      { id: 'fable', name: 'JARVIS British (Fable)', lang: 'en-GB', provider: 'cloud' },
    ]
  }

  /**
   * Pre-fetches audio data for a sentence and stores it in the memory cache.
   */
  public async prefetch(text: string, voice?: string): Promise<ArrayBuffer | null> {
    const key = `${voice || 'default'}:${text.trim()}`
    if (this.audioCache.has(key)) {
      return this.audioCache.get(key)!
    }

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice }),
      })

      if (!res.ok) {
        throw new Error(`TTS server error ${res.status}`)
      }

      const buffer = await res.arrayBuffer()
      this.audioCache.set(key, buffer)
      return buffer
    } catch (e) {
      console.warn('TTS prefetch failed:', e)
      return null
    }
  }

  public async speak(text: string, options?: TTSOptions): Promise<void> {
    const cleanText = text.trim()
    if (!cleanText) return

    this.cancel()

    const ctx = getAudioContext()
    if (!ctx) {
      throw new Error('Web Audio API not supported in this environment.')
    }

    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {})
    }

    const key = `${options?.voice || 'default'}:${cleanText}`
    let audioData = this.audioCache.get(key)

    if (!audioData) {
      const controller = new AbortController()
      this.abortController = controller

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
          voice: options?.voice,
          rate: options?.rate,
          pitch: options?.pitch,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        let errMessage = `TTS request failed with status ${res.status}`
        try {
          const errJson = await res.json()
          if (errJson.error) errMessage = errJson.error
        } catch {}
        throw new Error(errMessage)
      }

      audioData = await res.arrayBuffer()
      this.audioCache.set(key, audioData)
      this.abortController = null
    }

    // Decode audio data into AudioBuffer
    const audioBuffer = await ctx.decodeAudioData(audioData.slice(0))

    return new Promise((resolve, reject) => {
      try {
        const source = ctx.createBufferSource()
        source.buffer = audioBuffer
        if (options?.rate) {
          source.playbackRate.value = options.rate
        }

        const pipeline = createHolographicPipeline(
          ctx,
          options?.holographicEffect ?? true,
          options?.volume ?? 1.0
        )

        this.currentSource = source
        this.currentPipeline = pipeline

        source.connect(pipeline.input)

        // RMS polling loop for audio-reactive UI
        if (options?.onLevel) {
          const updateRMS = () => {
            if (!this.currentSource) return
            const level = pipeline.getRMS()
            options.onLevel?.(level)
            this.animId = requestAnimationFrame(updateRMS)
          }
          this.animId = requestAnimationFrame(updateRMS)
        }

        source.onended = () => {
          this.cleanupPlayback()
          options?.onLevel?.(0)
          resolve()
        }

        source.start(0)
      } catch (err) {
        this.cleanupPlayback()
        options?.onLevel?.(0)
        reject(err)
      }
    })
  }

  private cleanupPlayback(): void {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId)
      this.animId = null
    }
    if (this.currentPipeline) {
      this.currentPipeline.cleanup()
      this.currentPipeline = null
    }
    this.currentSource = null
  }

  public cancel(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    if (this.currentSource) {
      try {
        this.currentSource.stop()
        this.currentSource.disconnect()
      } catch {}
    }
    this.cleanupPlayback()
  }
}
