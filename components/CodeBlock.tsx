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

  const lines = code.split('\n')

  return (
    <div className="chamfer-card relative my-3 overflow-hidden border border-[var(--line)] bg-[var(--surface-hi)] group shadow-[inset_0_0_12px_rgba(8,20,32,0.8)]">
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-[var(--line)] bg-[var(--surface)] select-none">
        <span className="text-[11px] font-mono text-[var(--cyan)] uppercase tracking-widest font-medium">
          {language}
        </span>
        <button
          onClick={handleCopy}
          aria-label="Copy code to clipboard"
          className={`flex items-center gap-1.5 text-xs transition-colors px-2 py-0.5 font-mono ${
            copied
              ? 'text-[var(--gold)] font-medium shadow-[var(--glow-gold)]'
              : 'text-[var(--text-2)] hover:text-[var(--cyan)]'
          }`}
        >
          {copied ? (
            <>
              <Check size={13} strokeWidth={1.5} className="text-[var(--gold)]" />
              <span className="text-[11px] tracking-wider">COPIED</span>
            </>
          ) : (
            <>
              <Copy size={13} strokeWidth={1.5} />
              <span className="text-[11px] tracking-wider">COPY</span>
            </>
          )}
        </button>
      </div>

      <div className="p-3.5 overflow-x-auto text-xs sm:text-sm font-mono leading-relaxed text-[var(--text)] flex">
        {/* Cyan line numbers */}
        <div className="select-none text-right pr-3.5 border-r border-[var(--line)] text-[var(--cyan)] opacity-45 font-mono text-xs leading-relaxed shrink-0">
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        {/* Code content */}
        <pre className="m-0 pl-3.5 font-mono flex-1 overflow-x-auto leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  )
}
