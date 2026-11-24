'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  }

  public static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo)
  }

  private handleReload = () => {
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[100dvh] p-6 text-center bg-[var(--color-bg)]">
          <div className="max-w-md w-full flex flex-col items-center">
            <h1 className="text-2xl font-semibold text-[var(--color-text)] tracking-tight mb-2">
              Something went wrong.
            </h1>
            <p className="text-ui-base text-[var(--color-text-secondary)] mb-6 text-balance">
              An unexpected error occurred. Your conversations are safely preserved on this device.
            </p>
            <button
              onClick={this.handleReload}
              className="px-5 py-2.5 rounded-button bg-[var(--color-accent)] text-white font-medium text-ui-base hover:opacity-90 active:scale-95 transition-all shadow-sm"
            >
              Reload application
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
