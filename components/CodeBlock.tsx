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
    <div className="relative my-3 rounded-code overflow-hidden border border-[var(--color-separator)] bg-[var(--color-surface-secondary)] group">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-separator)] bg-[var(--color-surface-tertiary)]/50 select-none">
        <span className="text-xs font-mono text-[var(--color-text-tertiary)] uppercase tracking-wider">
          {language}
        </span>
        <button
          onClick={handleCopy}
          aria-label="Copy code to clipboard"
          className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors p-1 rounded"
        >
          {copied ? (
            <>
              <Check size={14} strokeWidth={1.5} className="text-[var(--color-accent)]" />
              <span className="text-[var(--color-accent)]">Copied</span>
            </>
          ) : (
            <>
              <Copy size={14} strokeWidth={1.5} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div className="p-4 overflow-x-auto text-ui-sm font-mono leading-relaxed text-[var(--color-text)]">
        <pre className="m-0 p-0 font-mono">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  )
}
