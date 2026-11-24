/**
 * J.A.R.V.I.S. Audio Waveform Buffer.
 *
 * Stores rolling RMS samples collected during mic recognition,
 * or generates realistic speech envelopes for typed commands.
 */

let recordedRmsBuffer: number[] = []

export function recordMicRms(rms: number): void {
  recordedRmsBuffer.push(Math.max(0, Math.min(1, rms)))
  if (recordedRmsBuffer.length > 120) {
    recordedRmsBuffer.shift()
  }
}

export function clearMicRms(): void {
  recordedRmsBuffer = []
}

/**
 * Returns a normalized float array of samples (0..1) of specified length.
 * If insufficient real samples exist, synthesizes a dynamic speech envelope.
 */
export function getWaveformSamples(count = 64): number[] {
  if (recordedRmsBuffer.length >= 8) {
    // Interpolate recorded buffer to target count
    const result: number[] = []
    const step = (recordedRmsBuffer.length - 1) / (count - 1)
    for (let i = 0; i < count; i++) {
      const idx = i * step
      const i0 = Math.floor(idx)
      const i1 = Math.min(recordedRmsBuffer.length - 1, i0 + 1)
      const frac = idx - i0
      const val = recordedRmsBuffer[i0] * (1 - frac) + recordedRmsBuffer[i1] * frac
      result.push(val)
    }
    return result
  }

  // Synthesize realistic speech envelope for "WAKE UP, JARVIS"
  // Two bursts ("wake up" and "jarvis") separated by a dip
  const samples: number[] = []
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    // Syllables: peak around t=0.25 (wake), t=0.45 (up), dip t=0.55, peak t=0.75 (jarvis)
    const envelope =
      Math.sin(t * Math.PI) *
      (0.4 +
        0.5 * Math.exp(-Math.pow((t - 0.28) / 0.12, 2)) +
        0.6 * Math.exp(-Math.pow((t - 0.72) / 0.14, 2)))
    const noise = (Math.sin(i * 12.7) * 0.5 + 0.5) * 0.2
    samples.push(Math.max(0.05, Math.min(1.0, envelope + noise)))
  }
  return samples
}
