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
    <div className="prose dark:prose-invert max-w-none text-body text-[var(--color-text)] leading-relaxed space-y-3">
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
                  className="px-1.5 py-0.5 rounded-sm bg-[var(--color-surface-secondary)] text-[var(--color-text)] font-mono text-ui-sm border border-[var(--color-separator)]"
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
                className="text-[var(--color-accent)] hover:underline font-medium inline-flex items-center gap-0.5"
              >
                {children}
              </a>
            )
          },
          table({ children }: any) {
            return (
              <div className="overflow-x-auto my-3 border border-[var(--color-separator)] rounded-code">
                <table className="w-full text-left border-collapse text-ui-sm">
                  {children}
                </table>
              </div>
            )
          },
          th({ children }: any) {
            return (
              <th className="border-b border-[var(--color-separator)] bg-[var(--color-surface-secondary)] px-4 py-2.5 font-semibold text-[var(--color-text)]">
                {children}
              </th>
            )
          },
          td({ children }: any) {
            return (
              <td className="border-b border-[var(--color-separator)] px-4 py-2.5 text-[var(--color-text)]">
                {children}
              </td>
            )
          },
          blockquote({ children }: any) {
            return (
              <blockquote className="border-l-2 border-[var(--color-accent)] pl-4 py-1 italic text-[var(--color-text-secondary)] my-3">
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
              <h1 className="text-xl font-semibold tracking-tight text-[var(--color-text)] mt-4 mb-2">
                {children}
              </h1>
            )
          },
          h2({ children }: any) {
            return (
              <h2 className="text-lg font-semibold tracking-tight text-[var(--color-text)] mt-3 mb-1.5">
                {children}
              </h2>
            )
          },
          h3({ children }: any) {
            return (
              <h3 className="text-base font-semibold text-[var(--color-text)] mt-2.5 mb-1">
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
        <span className="streaming-cursor" aria-hidden="true" />
      )}
    </div>
  )
})
