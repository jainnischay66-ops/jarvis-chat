/**
 * Browser-native Web Speech API TTS provider.
 * Prioritizes British English male voices and drives audio-reactive UI from boundary events.
 */

import type { TTSOptions, TTSProvider, TTSVoice } from './types'

const MALE_UK_NAMES = ['google uk english male', 'daniel', 'arthur', 'ryan', 'george', 'oliver', 'male']

export class BrowserTTS implements TTSProvider {
  public readonly name = 'browser' as const
  private voices: SpeechSynthesisVoice[] = []
  private currentUtterance: SpeechSynthesisUtterance | null = null
  private levelTimer: any = null

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.initVoices()
      window.speechSynthesis.onvoiceschanged = () => {
        this.initVoices()
      }
    }
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window
  }

  private initVoices(): SpeechSynthesisVoice[] {
    if (!this.isSupported()) return []
    this.voices = window.speechSynthesis.getVoices()
    return this.voices
  }

  public async getVoices(): Promise<TTSVoice[]> {
    if (!this.isSupported()) return []
    if (this.voices.length === 0) {
      this.initVoices()
    }

    // If still empty, wait briefly for voiceschanged
    if (this.voices.length === 0) {
      await new Promise<void>(resolve => {
        const handler = () => {
          this.initVoices()
          window.speechSynthesis.removeEventListener('voiceschanged', handler)
          resolve()
        }
        window.speechSynthesis.addEventListener('voiceschanged', handler)
        setTimeout(resolve, 500)
      })
    }

    return this.voices.map(v => ({
      id: v.name,
      name: `${v.name} (${v.lang})`,
      lang: v.lang,
      provider: 'browser',
    }))
  }

  public findBestBritishMaleVoice(): SpeechSynthesisVoice | null {
    const list = this.voices.length > 0 ? this.voices : this.initVoices()
    if (list.length === 0) return null

    // 1. UK English with male name keyword
    const ukMale = list.find(v => {
      const langMatch = v.lang.toLowerCase().replace('_', '-').startsWith('en-gb')
      const nameLower = v.name.toLowerCase()
      return langMatch && MALE_UK_NAMES.some(n => nameLower.includes(n))
    })
    if (ukMale) return ukMale

    // 2. Any UK English voice
    const anyUK = list.find(v => v.lang.toLowerCase().replace('_', '-').startsWith('en-gb'))
    if (anyUK) return anyUK

    // 3. Any English voice with male keyword
    const anyEnglishMale = list.find(v => {
      const langMatch = v.lang.toLowerCase().startsWith('en')
      const nameLower = v.name.toLowerCase()
      return langMatch && MALE_UK_NAMES.some(n => nameLower.includes(n))
    })
    if (anyEnglishMale) return anyEnglishMale

    // 4. Any English voice
    const anyEnglish = list.find(v => v.lang.toLowerCase().startsWith('en'))
    if (anyEnglish) return anyEnglish

    // 5. Default voice
    return list[0] || null
  }

  public speak(text: string, options?: TTSOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isSupported()) {
        resolve()
        return
      }

      this.cancel()

      const cleanText = text.trim()
      if (!cleanText) {
        resolve()
        return
      }

      const utterance = new SpeechSynthesisUtterance(cleanText)
      this.currentUtterance = utterance

      // Voice selection
      if (options?.voice) {
        const selected = this.voices.find(v => v.name === options.voice)
        if (selected) {
          utterance.voice = selected
        }
      }

      if (!utterance.voice) {
        const best = this.findBestBritishMaleVoice()
        if (best) utterance.voice = best
      }

      // Default JARVIS parameters: rate 0.95, pitch 0.85
      utterance.rate = options?.rate ?? 0.95
      utterance.pitch = options?.pitch ?? 0.85
      utterance.volume = options?.volume ?? 1.0

      // Drive audio-reactive level simulation on boundary events
      utterance.onboundary = (e) => {
        options?.onBoundary?.(e.charIndex)
        if (options?.onLevel) {
          // Trigger smoothed speech energy pulse
          const baseEnergy = 0.4 + Math.random() * 0.4
          options.onLevel(baseEnergy)

          // Gradually decay
          clearTimeout(this.levelTimer)
          this.levelTimer = setTimeout(() => {
            options.onLevel?.(0.08)
          }, 120)
        }
      }

      utterance.onstart = () => {
        options?.onLevel?.(0.3)
      }

      utterance.onend = () => {
        clearTimeout(this.levelTimer)
        options?.onLevel?.(0)
        this.currentUtterance = null
        resolve()
      }

      utterance.onerror = (e) => {
        clearTimeout(this.levelTimer)
        options?.onLevel?.(0)
        this.currentUtterance = null
        if (e.error === 'canceled' || e.error === 'interrupted') {
          resolve()
        } else {
          reject(new Error(`Browser TTS error: ${e.error}`))
        }
      }

      window.speechSynthesis.speak(utterance)
    })
  }

  public cancel(): void {
    if (!this.isSupported()) return
    clearTimeout(this.levelTimer)
    window.speechSynthesis.cancel()
    this.currentUtterance = null
  }
}
