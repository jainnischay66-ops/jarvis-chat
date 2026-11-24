/**
 * JARVIS TTS Orchestration Manager.
 * Handles streaming sentence queues, audio pre-fetching, provider fallback,
 * audio-reactive level callbacks, boot chime, and acknowledgements.
 */

import { BrowserTTS } from './browser-tts'
import { CloudTTS } from './cloud-tts'
import { SentenceBuffer } from './sentence-splitter'
import { sanitizeForSpeech } from './sanitize'
import { playBootChime, getAudioContext } from './audio-processor'
import type { TTSOptions, TTSProvider, TTSVoice } from './types'

const ACKNOWLEDGEMENTS = [
  'Right away, sir.',
  'Accessing protocols, sir.',
  'Working on it, sir.',
  'Analyzing telemetry, sir.',
  'Immediately, sir.',
]

let currentAppPowerState: 'STANDBY' | 'BOOTING' | 'ACTIVE' | 'SLEEPING' = 'STANDBY'

export function setTTSPowerState(state: 'STANDBY' | 'BOOTING' | 'ACTIVE' | 'SLEEPING') {
  currentAppPowerState = state
  if (state === 'BOOTING') {
    getTTSManager().cancel()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }
}

export function getTTSPowerState(): 'STANDBY' | 'BOOTING' | 'ACTIVE' | 'SLEEPING' {
  return currentAppPowerState
}

export class TTSManager {
  private browserTTS: BrowserTTS
  private cloudTTS: CloudTTS
  private sentenceBuffer: SentenceBuffer
  private queue: string[] = []
  private isProcessingQueue = false
  private activeProvider: 'browser' | 'cloud' = 'browser'
  private onLevelCallback: ((level: number) => void) | null = null
  private onStateCallback: ((speaking: boolean) => void) | null = null
  private currentSpeakPromise: Promise<void> | null = null
  private isCancelled = false

  constructor() {
    this.browserTTS = new BrowserTTS()
    this.cloudTTS = new CloudTTS()
    this.sentenceBuffer = new SentenceBuffer()
  }

  public setCallbacks(
    onLevel?: (level: number) => void,
    onState?: (speaking: boolean) => void
  ) {
    if (onLevel) this.onLevelCallback = onLevel
    if (onState) this.onStateCallback = onState
  }

  public async getVoices(provider: 'browser' | 'cloud'): Promise<TTSVoice[]> {
    if (provider === 'cloud') {
      try {
        const cloudVoices = await this.cloudTTS.getVoices()
        if (cloudVoices.length > 0) return cloudVoices
      } catch {}
    }
    return this.browserTTS.getVoices()
  }

  /**
   * Pushes a streaming SSE text chunk into the sentence queue.
   * Immediately queues completed sentences.
   */
  public enqueueStreamChunk(chunk: string, options?: TTSOptions, preferredProvider: 'browser' | 'cloud' = 'browser') {
    if (this.isCancelled || currentAppPowerState === 'BOOTING') return

    const sentences = this.sentenceBuffer.push(chunk)
    for (const raw of sentences) {
      const sanitized = sanitizeForSpeech(raw)
      if (sanitized) {
        this.queue.push(sanitized)
        // If using CloudTTS, immediately prefetch in the background
        if (preferredProvider === 'cloud') {
          this.cloudTTS.prefetch(sanitized, options?.voice)
        }
      }
    }

    if (!this.isProcessingQueue && this.queue.length > 0) {
      this.processQueue(options, preferredProvider)
    }
  }

  /**
   * Finalizes the current stream and flushes any trailing sentence in the buffer.
   */
  public flushStream(options?: TTSOptions, preferredProvider: 'browser' | 'cloud' = 'browser') {
    if (this.isCancelled) return

    const remaining = this.sentenceBuffer.flush()
    for (const raw of remaining) {
      const sanitized = sanitizeForSpeech(raw)
      if (sanitized) {
        this.queue.push(sanitized)
      }
    }

    if (!this.isProcessingQueue && this.queue.length > 0) {
      this.processQueue(options, preferredProvider)
    }
  }

  private async processQueue(options?: TTSOptions, preferredProvider: 'browser' | 'cloud' = 'browser') {
    if (this.isProcessingQueue) return
    this.isProcessingQueue = true
    this.isCancelled = false
    this.onStateCallback?.(true)

    while (this.queue.length > 0 && !this.isCancelled) {
      const text = this.queue.shift()
      if (!text) continue

      // Prefetch the next item in line if cloud provider
      if (preferredProvider === 'cloud' && this.queue.length > 0) {
        this.cloudTTS.prefetch(this.queue[0], options?.voice)
      }

      await this.speakText(text, options, preferredProvider)
    }

    this.isProcessingQueue = false
    this.onStateCallback?.(false)
    this.onLevelCallback?.(0)
  }

  /**
   * Speaks a standalone text with automatic fallback from CloudTTS to BrowserTTS.
   */
  public async speakText(
    text: string,
    options?: TTSOptions,
    preferredProvider: 'browser' | 'cloud' = 'browser'
  ): Promise<void> {
    if (currentAppPowerState === 'BOOTING') return
    const sanitized = sanitizeForSpeech(text)
    if (!sanitized) return

    const mergedOptions: TTSOptions = {
      ...options,
      onLevel: (level: number) => {
        this.onLevelCallback?.(level)
      },
    }

    if (preferredProvider === 'cloud') {
      try {
        await this.cloudTTS.speak(sanitized, mergedOptions)
        return
      } catch (err) {
        console.warn('Cloud TTS failed, falling back to Browser TTS:', err)
      }
    }

    // BrowserTTS fallback or direct path
    await this.browserTTS.speak(sanitized, mergedOptions)
  }

  /**
   * Plays boot chime and speaks the startup greeting.
   */
  public async playStartupGreeting(
    greeting = "Good evening, sir. All systems online, and I'm only slightly sarcastic about it.",
    options?: TTSOptions
  ): Promise<void> {
    const ctx = getAudioContext()
    if (ctx) {
      await playBootChime(ctx, options?.volume ?? 0.8)
    }
    await this.speakText(greeting, options, 'browser')
  }

  /**
   * Gets a random Tony Stark acknowledgement line.
   */
  public getRandomAcknowledgement(): string {
    const idx = Math.floor(Math.random() * ACKNOWLEDGEMENTS.length)
    return ACKNOWLEDGEMENTS[idx]
  }

  /**
   * Immediately interrupts and cancels all in-flight TTS playback, clears queue and buffer.
   */
  public cancel() {
    this.isCancelled = true
    this.queue = []
    this.sentenceBuffer.reset()
    this.browserTTS.cancel()
    this.cloudTTS.cancel()
    this.isProcessingQueue = false
    this.onStateCallback?.(false)
    this.onLevelCallback?.(0)
  }
}

let sharedManager: TTSManager | null = null

export function getTTSManager(): TTSManager {
  if (!sharedManager) {
    sharedManager = new TTSManager()
  }
  return sharedManager
}
