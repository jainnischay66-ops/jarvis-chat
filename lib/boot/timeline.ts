/**
 * J.A.R.V.I.S. Cinematic Boot Film Timeline & Cue Definitions.
 *
 * The official music track (public/audio/jarvis-boot-theme.mp3) is 20.0s.
 * The film runs beyond the music track to FILM_DURATION = 23.5s.
 * Master clock runs from the Web Audio clock (audioCtx.currentTime) throughout.
 *
 * ZERO TTS during transition:
 * - No spoken greeting, wake line or acknowledgement during BOOTING.
 * - Wake line appears as a silent text caption under the title card.
 */

export const FILM_DURATION = 23.5
export const FULL_BOOT_DURATION = FILM_DURATION
export const QUICK_BOOT_DURATION = 2.4
export const QUICK_START_OFFSET = 17.8 // Climax hit at 19.0 lands at 1.2s in quick mode
export const MUSIC_DURATION = 20.04

// Flag: keep the wake line as a silent text caption (no TTS) under the title card
export const SHOW_WAKE_CAPTION = true

export const IGNITION_PULSES = [4.38, 5.34, 6.94, 7.86]
export const ESCALATION_HITS = [9.92, 11.94, 14.02, 15.96, 17.00, 17.96]
export const IMPACT_TIME = 19.00

export interface BootCue {
  name: string
  time: number // in seconds
  description: string
}

export const FULL_CUES: BootCue[] = [
  { name: 'ACT1_START', time: 0.0, description: 'Track quiet: ember dot, flatline, real mic waveform' },
  { name: 'ACT1_WAVEFORM', time: 0.8, description: 'Mic waveform erupts on flatline' },
  { name: 'ACT1_RING_MORPH', time: 1.8, description: 'Waveform bends into ring' },
  { name: 'ACT1_RING_FLASH', time: 2.40, description: 'Ring closes with flash as music swells' },
  { name: 'ACT2_IGNITION_START', time: 2.50, description: 'Ignition tunnel: steady medium energy' },
  { name: 'ACT2_PULSE_1', time: 4.38, description: 'Ring-snap pulse at loudness rise' },
  { name: 'ACT2_PULSE_2', time: 5.34, description: 'Speed-surge pulse' },
  { name: 'ACT2_PULSE_3', time: 6.94, description: 'Ring-snap pulse' },
  { name: 'ACT2_PULSE_4', time: 7.86, description: 'Speed-surge pulse' },
  { name: 'ACT2_BREATH_START', time: 8.50, description: 'Breath: music dips to quietest at ~9.0, tunnel slows' },
  { name: 'ACT2_BREATH_DEEP', time: 9.00, description: 'Heartbeat shows through, particles hang' },
  { name: 'ACT2_BREATH_END', time: 9.70, description: 'Breath completes' },
  { name: 'ACT2_ESCALATION', time: 9.90, description: 'Escalation: particles stream from edges, tunnel accelerates' },
  { name: 'ACT2_HIT_1', time: 9.92, description: 'Rising hit flash 1' },
  { name: 'ACT2_HIT_2', time: 11.94, description: 'Rising hit flash 2' },
  { name: 'ACT2_HIT_3', time: 14.02, description: 'Rising hit flash 3' },
  { name: 'ACT2_HIT_4', time: 15.96, description: 'Rising hit flash 4' },
  { name: 'ACT2_HIT_5', time: 17.00, description: 'Rising hit flash 5' },
  { name: 'ACT2_HIT_6', time: 17.96, description: 'Rising hit flash 6' },
  { name: 'ACT3_IMPACT', time: 19.00, description: 'IMPACT: orb snaps solid, 80ms white flash, shockwave, 6px shake' },
  { name: 'ACT4_DEPLOY_START', time: 19.20, description: 'Hologram deploy: wireframes draw, fill with glass, hex-grid' },
  { name: 'ACT4_TELEMETRY', time: 20.00, description: 'Boot telemetry types in with real checks' },
  { name: 'MUSIC_END', time: 20.04, description: 'Music track ends; synthesized boom, shimmer & ambient hum sustain' },
  { name: 'ACT5_TITLE_START', time: 21.00, description: 'Title card J.A.R.V.I.S. with tightening letter-spacing, gold scanline' },
  { name: 'ACT5_CAPTION', time: 21.50, description: 'Silent wake caption appears under title card' },
  { name: 'ACT5_BARS_RETRACT', time: 22.50, description: 'Letterbox retracts, orb glides to empty-state position' },
  { name: 'BOOT_COMPLETE', time: 23.50, description: 'Transition to ACTIVE' },
]

export const QUICK_CUES: BootCue[] = [
  { name: 'QUICK_START', time: 0.0, description: 'Quick boot initiation at offset 17.8' },
  { name: 'QUICK_RING', time: 0.4, description: 'Accelerating rings' },
  { name: 'QUICK_IMPACT', time: 1.2, description: 'Impact hit (19.0 in track) with boom and flash' },
  { name: 'QUICK_FADE', time: 2.1, description: 'Music fades over last 300ms' },
  { name: 'QUICK_COMPLETE', time: 2.4, description: 'Transition to ACTIVE' },
]

export type ActNumber = 1 | 2 | 3 | 4 | 5

export function getCurrentAct(time: number, isQuick = false): ActNumber {
  if (isQuick) {
    if (time < 1.1) return 2
    if (time < 1.6) return 3
    if (time < 2.0) return 4
    return 5
  }

  if (time < 2.50) return 1
  if (time < 18.90) return 2
  if (time < 19.50) return 3
  if (time < 21.00) return 4
  return 5
}

export function clamp(v: number, min = 0, max = 1): number {
  return Math.min(Math.max(v, min), max)
}

export function interpolate(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
  shouldClamp = true
): number {
  if (inMax === inMin) return outMin
  const t = (value - inMin) / (inMax - inMin)
  const result = outMin + t * (outMax - outMin)
  return shouldClamp
    ? outMin < outMax
      ? clamp(result, outMin, outMax)
      : clamp(result, outMax, outMin)
    : result
}

export function smoothstep(min: number, max: number, value: number): number {
  const x = clamp((value - min) / (max - min), 0, 1)
  return x * x * (3 - 2 * x)
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - clamp(t), 3)
}

export function easeInOutQuad(t: number): number {
  const x = clamp(t)
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2
}
