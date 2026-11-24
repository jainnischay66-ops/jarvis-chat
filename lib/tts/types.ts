export interface TTSVoice {
  id: string
  name: string
  lang: string
  provider: 'browser' | 'cloud'
}

export interface TTSOptions {
  voice?: string
  rate?: number
  pitch?: number
  volume?: number
  holographicEffect?: boolean
  onBoundary?: (charIndex: number) => void
  onLevel?: (level: number) => void
}

export interface TTSProvider {
  readonly name: 'browser' | 'cloud'
  isSupported(): boolean
  getVoices(): Promise<TTSVoice[]>
  speak(text: string, options?: TTSOptions): Promise<void>
  cancel(): void
}
