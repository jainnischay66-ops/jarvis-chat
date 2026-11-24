'use client'

import React, { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { CodeBlock } from './CodeBlock'

interface MarkdownRendererProps {
  content: string
  isStreaming?: boolean
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  isStreaming = false,
}: MarkdownRendererProps) {
  return (
    <div className="prose dark:prose-invert max-w-none font-body-inter text-[var(--text)] leading-relaxed space-y-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          code({ className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '')
            const isInline = !match && !String(children).includes('\n')

            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 bg-[var(--surface-hi)] text-[var(--cyan)] font-mono text-xs border border-[var(--line)]"
                  {...props}
                >
                  {children}
                </code>
              )
            }

            const codeStr = String(children).replace(/\n$/, '')
            const language = match ? match[1] : 'text'

            return <CodeBlock code={codeStr} language={language} />
          },
          pre({ children }: any) {
            return <>{children}</>
          },
          a({ href, children }: any) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--cyan)] hover:underline font-medium inline-flex items-center gap-0.5"
              >
                {children}
              </a>
            )
          },
          table({ children }: any) {
            return (
              <div className="holo overflow-x-auto my-3 border border-[var(--line)]">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  {children}
                </table>
              </div>
            )
          },
          th({ children }: any) {
            return (
              <th className="border-b border-[var(--line)] bg-[var(--surface-hi)] px-4 py-2.5 font-hud tracking-wider text-[var(--cyan)] uppercase">
                {children}
              </th>
            )
          },
          td({ children }: any) {
            return (
              <td className="border-b border-[var(--line)] px-4 py-2.5 text-[var(--text)]">
                {children}
              </td>
            )
          },
          blockquote({ children }: any) {
            return (
              <blockquote className="border-l-2 border-[var(--gold)] pl-4 py-1 italic text-[var(--text-2)] my-3 bg-[var(--surface)]">
                {children}
              </blockquote>
            )
          },
          ul({ children }: any) {
            return <ul className="list-disc pl-5 space-y-1.5 my-2">{children}</ul>
          },
          ol({ children }: any) {
            return <ol className="list-decimal pl-5 space-y-1.5 my-2">{children}</ol>
          },
          h1({ children }: any) {
            return (
              <h1 className="font-hud text-xl font-semibold tracking-wider uppercase text-[var(--text)] mt-4 mb-2">
                {children}
              </h1>
            )
          },
          h2({ children }: any) {
            return (
              <h2 className="font-hud text-lg font-semibold tracking-wider uppercase text-[var(--text)] mt-3 mb-1.5">
                {children}
              </h2>
            )
          },
          h3({ children }: any) {
            return (
              <h3 className="font-hud text-base font-semibold tracking-wider uppercase text-[var(--cyan-dim)] mt-2.5 mb-1">
                {children}
              </h3>
            )
          },
          p({ children }: any) {
            return <p className="mb-2.5 last:mb-0">{children}</p>
          },
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-2 h-4 bg-[var(--cyan)] shadow-[var(--glow-cyan)] ml-1 animate-pulse align-middle" />
      )}
    </div>
  )
})
