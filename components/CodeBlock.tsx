'use client'

import React, { useState, useCallback } from 'react'
import { Check, Copy } from 'lucide-react'

interface CodeBlockProps {
  code: string
  language?: string
}

export function CodeBlock({ code, language = 'text' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [code])

  return (
    <div className="holo relative my-3 overflow-hidden border border-[var(--line)] bg-[var(--surface-hi)] group">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--line)] bg-[var(--surface)] select-none">
        <span className="text-xs font-mono text-[var(--text-3)] uppercase tracking-wider">
          {language}
        </span>
        <button
          onClick={handleCopy}
          aria-label="Copy code to clipboard"
          className={`flex items-center gap-1.5 text-xs transition-colors p-1 rounded font-mono ${
            copied
              ? 'text-[var(--gold)] font-medium shadow-[var(--glow-gold)]'
              : 'text-[var(--text-2)] hover:text-[var(--cyan)]'
          }`}
        >
          {copied ? (
            <>
              <Check size={14} strokeWidth={1.5} className="text-[var(--gold)]" />
              <span>COPIED</span>
            </>
          ) : (
            <>
              <Copy size={14} strokeWidth={1.5} />
              <span>COPY</span>
            </>
          )}
        </button>
      </div>

      <div className="p-4 overflow-x-auto text-xs sm:text-sm font-mono leading-relaxed text-[var(--text)]">
        <pre className="m-0 p-0 font-mono">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  )
}
