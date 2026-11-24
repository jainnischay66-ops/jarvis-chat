/**
 * Web Audio API DSP pipeline for JARVIS holographic voice-over.
 * Chain: source -> highpass (120Hz) -> peaking EQ (+3dB @ 3kHz) ->
 *        subtle chorus (two short modulated delays, mix 15%) ->
 *        ConvolverNode (synthetic impulse response, 0.4s tail, wet 12%) ->
 *        compressor -> gain -> AnalyserNode -> destination.
 */

let sharedAudioContext: AudioContext | null = null

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!sharedAudioContext) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (AudioCtx) {
      sharedAudioContext = new AudioCtx()
    }
  }
  if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().catch(() => {})
  }
  return sharedAudioContext
}

/**
 * Generates an in-memory stereo synthetic impulse response for the subtle holographic chamber reverb.
 */
function createSyntheticImpulse(ctx: AudioContext, duration = 0.4, decay = 0.1): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const length = Math.floor(sampleRate * duration)
  const impulse = ctx.createBuffer(2, length, sampleRate)

  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      const envelope = Math.exp(-i / (sampleRate * decay))
      // White noise decaying exponentially
      data[i] = (Math.random() * 2 - 1) * envelope
    }
  }

  return impulse
}

export interface HolographicPipeline {
  input: AudioNode
  analyser: AnalyserNode
  masterGain: GainNode
  getRMS: () => number
  cleanup: () => void
}

/**
 * Creates the JARVIS DSP chain connected to audio destination.
 * When enableHoloEffect is OFF (default), the voice passes cleanly through compression to remain human and natural.
 * When ON, a very subtle chain is applied: highpass 100Hz, +2dB @ 3kHz, short room reverb (~9% wet).
 */
export function createHolographicPipeline(
  ctx: AudioContext,
  enableHoloEffect = false,
  volume = 1.0
): HolographicPipeline {
  const input = ctx.createGain()
  const masterGain = ctx.createGain()
  masterGain.gain.value = Math.max(0, Math.min(1, volume))

  const analyser = ctx.createAnalyser()
  analyser.fftSize = 256
  analyser.smoothingTimeConstant = 0.75

  // Dynamics compressor for clean vocal punch
  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = -24
  compressor.knee.value = 30
  compressor.ratio.value = 12
  compressor.attack.value = 0.003
  compressor.release.value = 0.25

  let effectOutput: AudioNode = input

  if (enableHoloEffect) {
    // 1. Highpass filter at 100Hz
    const highpass = ctx.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = 100
    highpass.Q.value = 0.707

    // 2. Peaking EQ (+2dB at 3000Hz)
    const peakingEQ = ctx.createBiquadFilter()
    peakingEQ.type = 'peaking'
    peakingEQ.frequency.value = 3000
    peakingEQ.gain.value = 2.0
    peakingEQ.Q.value = 1.0

    // 3. Short subtle room reverb (~9% wet, 0.25s duration)
    const dryGain = ctx.createGain()
    dryGain.gain.value = 0.91

    const wetGain = ctx.createGain()
    wetGain.gain.value = 0.09

    const convolver = ctx.createConvolver()
    convolver.buffer = createSyntheticImpulse(ctx, 0.25, 0.06)

    input.connect(highpass)
    highpass.connect(peakingEQ)

    peakingEQ.connect(dryGain)
    peakingEQ.connect(convolver)
    convolver.connect(wetGain)

    const holoSum = ctx.createGain()
    dryGain.connect(holoSum)
    wetGain.connect(holoSum)

    effectOutput = holoSum
  }

  effectOutput.connect(compressor)
  compressor.connect(masterGain)
  masterGain.connect(analyser)
  analyser.connect(ctx.destination)

  // RMS calculation buffer
  const pcmData = new Uint8Array(analyser.fftSize)

  const getRMS = (): number => {
    analyser.getByteTimeDomainData(pcmData)
    let sum = 0
    for (let i = 0; i < pcmData.length; i++) {
      const val = (pcmData[i] - 128) / 128
      sum += val * val
    }
    const rms = Math.sqrt(sum / pcmData.length)
    return Math.min(1, rms * 3.5)
  }

  const cleanup = () => {
    try {
      input.disconnect()
      masterGain.disconnect()
      analyser.disconnect()
    } catch {}
  }

  return {
    input,
    analyser,
    masterGain,
    getRMS,
    cleanup,
  }
}

/**
 * Plays the cinematic activation sequence: Web Audio ascending harmonic chimes
 * layered with a deep, low resonant reactor hum.
 */
export function playActivationSound(ctx: AudioContext, volume = 0.8): Promise<void> {
  return new Promise(resolve => {
    try {
      const now = ctx.currentTime

      // 1. Low reactor hum
      const humGain = ctx.createGain()
      humGain.gain.setValueAtTime(0, now)
      humGain.gain.linearRampToValueAtTime(0.3 * volume, now + 0.3)
      humGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0)
      humGain.connect(ctx.destination)

      const humOsc = ctx.createOscillator()
      humOsc.type = 'sawtooth'
      humOsc.frequency.setValueAtTime(65, now)
      humOsc.frequency.exponentialRampToValueAtTime(130, now + 1.2)

      const humFilter = ctx.createBiquadFilter()
      humFilter.type = 'lowpass'
      humFilter.frequency.setValueAtTime(180, now)
      humFilter.frequency.exponentialRampToValueAtTime(400, now + 1.0)
      humOsc.connect(humFilter)
      humFilter.connect(humGain)
      humOsc.start(now)
      humOsc.stop(now + 2.1)

      // 2. Ascending cyber chimes (C5, E5, G5, C6)
      const chimeGain = ctx.createGain()
      chimeGain.gain.setValueAtTime(0, now)
      chimeGain.gain.linearRampToValueAtTime(0.25 * volume, now + 0.05)
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2)
      chimeGain.connect(ctx.destination)

      const freqs = [523.25, 659.25, 783.99, 1046.5]
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        const startTime = now + idx * 0.12
        osc.frequency.setValueAtTime(freq, startTime)
        osc.connect(chimeGain)
        osc.start(startTime)
        osc.stop(startTime + 1.2)
      })

      setTimeout(resolve, 2000)
    } catch {
      resolve()
    }
  })
}

/**
 * Plays the power-down sequence sound: descending tones with a gentle decay.
 */
export function playPowerDownSound(ctx: AudioContext, volume = 0.7): Promise<void> {
  return new Promise(resolve => {
    try {
      const now = ctx.currentTime
      const gainNode = ctx.createGain()
      gainNode.gain.setValueAtTime(0, now)
      gainNode.gain.linearRampToValueAtTime(0.25 * volume, now + 0.05)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.2)
      gainNode.connect(ctx.destination)

      const freqs = [1046.5, 783.99, 523.25, 261.63]
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        const startTime = now + idx * 0.1
        osc.frequency.setValueAtTime(freq, startTime)
        osc.connect(gainNode)
        osc.start(startTime)
        osc.stop(startTime + 0.9)
      })

      setTimeout(resolve, 1200)
    } catch {
      resolve()
    }
  })
}

/**
 * Plays a short, elegant twin-tone boot chime at 520Hz & 1040Hz.
 */
export function playBootChime(ctx: AudioContext, volume = 0.7): Promise<void> {
  return new Promise(resolve => {
    try {
      const now = ctx.currentTime
      const gainNode = ctx.createGain()
      gainNode.gain.setValueAtTime(0, now)
      gainNode.gain.linearRampToValueAtTime(0.25 * volume, now + 0.05)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.75)
      gainNode.connect(ctx.destination)

      const osc1 = ctx.createOscillator()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(523.25, now) // C5
      osc1.connect(gainNode)
      osc1.start(now)
      osc1.stop(now + 0.8)

      const osc2 = ctx.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(1046.5, now) // C6
      osc2.connect(gainNode)
      osc2.start(now + 0.08)
      osc2.stop(now + 0.8)

      setTimeout(resolve, 800)
    } catch {
      resolve()
    }
  })
}
