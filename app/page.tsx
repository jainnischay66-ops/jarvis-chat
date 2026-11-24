'use client'

import dynamic from 'next/dynamic'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ToastProvider } from '@/components/Toast'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const ChatWindow = dynamic(() => import('@/components/ChatWindow'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100dvh',
        backgroundColor: 'var(--color-bg)',
      }}
    >
      <div style={{ color: 'var(--color-text-secondary)', fontSize: '15px' }}>
        Loading...
      </div>
    </div>
  ),
})

export default function Home() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <ChatWindow />
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
