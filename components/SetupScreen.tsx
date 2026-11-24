'use client'

import React from 'react'

interface SetupScreenProps {
  provider: string
  error?: string
}

export function SetupScreen({ provider }: SetupScreenProps) {
  const isGemini = provider === 'gemini'
  const isAnthropic = provider === 'anthropic'
  const keyName = isGemini ? 'GEMINI_API_KEY' : isAnthropic ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'
  const portalUrl = isGemini
    ? 'https://aistudio.google.com/apikey'
    : isAnthropic
    ? 'https://console.anthropic.com/settings/keys'
    : 'https://platform.openai.com/api-keys'
  const portalName = isGemini ? 'Google AI Studio' : isAnthropic ? 'Anthropic Console' : 'OpenAI Platform'

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] p-6 text-center bg-[var(--bg)] relative overflow-hidden select-none">
      <div className="hud-grid-backdrop pointer-events-none" />

      <div className="max-w-md w-full flex flex-col items-center text-left z-10">
        <h1 className="font-wordmark text-3xl font-semibold text-[var(--cyan)] tracking-widest mb-1 text-center w-full filter drop-shadow-[0_0_12px_var(--cyan)]">
          J.A.R.V.I.S.
        </h1>
        <p className="font-hud text-xs text-[var(--cyan-dim)] tracking-widest uppercase mb-8 text-center w-full">
          STARK INDUSTRIES AI PROTOCOL · AUTH REQUIRED
        </p>

        <div className="holo w-full bg-[var(--surface)] p-6 border border-[var(--line)] mb-6 shadow-float">
          <h2 className="font-hud text-sm font-semibold tracking-wider text-[var(--text)] uppercase mb-2">
            INITIALIZE AUTHENTICATION KEY
          </h2>
          <p className="font-sans text-xs text-[var(--text-2)] mb-4 leading-relaxed">
            Create a <code className="font-mono text-xs px-1.5 py-0.5 bg-[var(--surface-hi)] border border-[var(--line)] text-[var(--cyan)]">.env.local</code> file in your project directory and add your key:
          </p>

          <div className="bg-[var(--surface-hi)] p-3 border border-[var(--line)] font-mono text-xs text-[var(--cyan)] select-all mb-4 overflow-x-auto">
            {keyName}=your_api_key_here
          </div>

          <div className="flex items-center justify-between text-xs font-hud tracking-wider">
            <span className="text-[var(--text-2)]">REQUEST ACCESS:</span>
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--cyan)] hover:underline font-semibold"
            >
              {portalName} &rarr;
            </a>
          </div>
        </div>

        <p className="font-mono text-xs text-[var(--text-3)] text-center w-full tracking-wider">
          AFTER UPDATING CREDENTIALS, RESTART SERVER AND RELOAD
        </p>
      </div>
    </div>
  )
}
