'use client'

import React from 'react'

interface SetupScreenProps {
  provider: string
  error?: string
}

export function SetupScreen({ provider, error }: SetupScreenProps) {
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
    <div className="flex flex-col items-center justify-center min-h-[100dvh] p-6 text-center bg-[var(--color-bg)]">
      <div className="max-w-md w-full flex flex-col items-center text-left">
        <h1 className="text-3xl font-semibold text-[var(--color-text)] tracking-tight mb-2 text-center w-full">
          Jarvis
        </h1>
        <p className="text-ui-base text-[var(--color-text-secondary)] mb-8 text-center w-full">
          Your personal conversational assistant.
        </p>

        <div className="w-full bg-[var(--color-surface-secondary)] rounded-card p-6 border border-[var(--color-separator)] mb-6">
          <h2 className="text-ui-base font-semibold text-[var(--color-text)] mb-2">
            Configure your API key
          </h2>
          <p className="text-ui-sm text-[var(--color-text-secondary)] mb-4 leading-relaxed">
            Create a <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-separator)]">.env.local</code> file in your project directory and add your key:
          </p>

          <div className="bg-[var(--color-surface)] p-3 rounded-code border border-[var(--color-separator)] font-mono text-xs text-[var(--color-text)] select-all mb-4 overflow-x-auto">
            {keyName}=your_api_key_here
          </div>

          <div className="flex items-center justify-between text-ui-sm">
            <span className="text-[var(--color-text-secondary)]">Get an API key:</span>
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-accent)] hover:underline font-medium"
            >
              {portalName} &rarr;
            </a>
          </div>
        </div>

        <p className="text-ui-sm text-[var(--color-text-tertiary)] text-center w-full">
          After adding the key, restart the development server and reload this page.
        </p>
      </div>
    </div>
  )
}
