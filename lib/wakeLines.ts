/**
 * Time-of-day aware wake lines, sleep lines, and standby quips
 * written in JARVIS's sarcastic persona.
 */

export interface WakeLine {
  text: string
  period: 'morning' | 'afternoon' | 'evening' | 'any'
}

export const WAKE_LINES: WakeLine[] = [
  // Morning (05:00 - 11:59)
  {
    text: "Good morning, sir. All systems online. I trust you've had your coffee, or should I brace for impact?",
    period: 'morning',
  },
  {
    text: "Morning, boss. Telemetry initialized and ready to conquer the world, or at least your inbox.",
    period: 'morning',
  },
  // Afternoon (12:00 - 16:59)
  {
    text: "Good afternoon, sir. All systems nominal, and I've only judged your morning productivity a little.",
    period: 'afternoon',
  },
  {
    text: "Core online, sir. Mark eighty-five protocols standing by for your next brilliant impulse.",
    period: 'afternoon',
  },
  // Evening / Night (17:00 - 04:59)
  {
    text: "Good evening, sir. All systems online, and I only judged you a little.",
    period: 'evening',
  },
  {
    text: "Good evening, sir. All systems online, and I'm only slightly sarcastic about it.",
    period: 'evening',
  },
  {
    text: "Power restored, sir. Did you miss me, or did you actually manage on your own?",
    period: 'evening',
  },
  {
    text: "Burning the midnight oil again, sir? Typical. All systems operational.",
    period: 'evening',
  },
]

export const SLEEP_LINES = [
  "Powering down. Try not to miss me, sir.",
  "Entering standby mode. Do try to get some sleep, sir.",
  "Systems dormant. Call me if the workshop catches fire.",
  "Shutting down core telemetry. Standing by on passive sensors, boss.",
]

export const STANDBY_QUIPS = [
  "I'm in standby, sir. Say 'Wake up, JARVIS' if you need my assistance.",
  "Still sleeping, sir. A simple 'Wake up, JARVIS' will bring me back to life.",
  "Passive sensors only, boss. Say 'Wake up, JARVIS' to bring the workshop online.",
]

/**
 * Returns a time-of-day appropriate wake line.
 */
export function getRandomWakeLine(date: Date = new Date()): string {
  const hour = date.getHours()
  let targetPeriod: 'morning' | 'afternoon' | 'evening' = 'evening'
  if (hour >= 5 && hour < 12) targetPeriod = 'morning'
  else if (hour >= 12 && hour < 17) targetPeriod = 'afternoon'

  const candidates = WAKE_LINES.filter(l => l.period === targetPeriod || l.period === 'any')
  const pool = candidates.length > 0 ? candidates : WAKE_LINES
  const choice = pool[Math.floor(Math.random() * pool.length)]
  return choice.text
}

/**
 * Returns a random power-down line.
 */
export function getRandomSleepLine(): string {
  return SLEEP_LINES[Math.floor(Math.random() * SLEEP_LINES.length)]
}

/**
 * Returns a random standby quip for unrecognized speech while in standby.
 */
export function getRandomStandbyQuip(): string {
  return STANDBY_QUIPS[Math.floor(Math.random() * STANDBY_QUIPS.length)]
}
