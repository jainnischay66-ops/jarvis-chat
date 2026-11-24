import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TTSManager } from './tts-manager'

describe('TTSManager Provider Fallback & Orchestration', () => {
  let manager: TTSManager

  beforeEach(() => {
    manager = new TTSManager()
  })

  it('automatically falls back to BrowserTTS when CloudTTS fails', async () => {
    const cloudSpy = vi
      .spyOn((manager as any).cloudTTS, 'speak')
      .mockRejectedValue(new Error('500 Internal Server Error'))

    const browserSpy = vi
      .spyOn((manager as any).browserTTS, 'speak')
      .mockResolvedValue(undefined)

    await manager.speakText('Telemetry online, sir.', undefined, 'cloud')

    expect(cloudSpy).toHaveBeenCalledTimes(1)
    expect(browserSpy).toHaveBeenCalledTimes(1)
  })

  it('uses BrowserTTS directly when requested', async () => {
    const cloudSpy = vi.spyOn((manager as any).cloudTTS, 'speak')
    const browserSpy = vi
      .spyOn((manager as any).browserTTS, 'speak')
      .mockResolvedValue(undefined)

    await manager.speakText('Reactor output steady.', undefined, 'browser')

    expect(cloudSpy).not.toHaveBeenCalled()
    expect(browserSpy).toHaveBeenCalledTimes(1)
  })

  it('cancels playback and clears speech queue when cancel() is invoked', () => {
    const browserCancelSpy = vi
      .spyOn((manager as any).browserTTS, 'cancel')
      .mockReturnValue(undefined)
    const cloudCancelSpy = vi
      .spyOn((manager as any).cloudTTS, 'cancel')
      .mockReturnValue(undefined)

    manager.cancel()

    expect(browserCancelSpy).toHaveBeenCalled()
    expect(cloudCancelSpy).toHaveBeenCalled()
  })

  it('returns a Tony Stark acknowledgement line', () => {
    const ack = manager.getRandomAcknowledgement()
    expect(typeof ack).toBe('string')
    expect(ack.length).toBeGreaterThan(0)
    expect(ack).toContain('sir')
  })
})
