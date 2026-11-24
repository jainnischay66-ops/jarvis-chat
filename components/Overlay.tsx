'use client'

import React, { Component, type ErrorInfo, type ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle, RefreshCw } from 'lucide-react'

interface OverlayErrorBoundaryProps {
  children: ReactNode
  fallbackLabel?: string
  onReset?: () => void
}

interface OverlayErrorBoundaryState {
  hasError: boolean
  errorMessage: string | null
}

class OverlayErrorBoundary extends Component<
  OverlayErrorBoundaryProps,
  OverlayErrorBoundaryState
> {
  public state: OverlayErrorBoundaryState = {
    hasError: false,
    errorMessage: null,
  }

  public static getDerivedStateFromError(error: Error): OverlayErrorBoundaryState {
    return { hasError: true, errorMessage: error.message }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Overlay] Error loading overlay content:', error, errorInfo)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, errorMessage: null })
    this.props.onReset?.()
  }

  public render() {
    if (this.state.hasError) {
      const label = this.props.fallbackLabel || 'overlay'
      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center p-6 text-center space-y-4 min-h-[200px]"
        >
          <AlertTriangle size={28} className="text-[var(--red)]" />
          <div className="space-y-1">
            <p className="font-hud text-sm font-semibold tracking-wider text-[var(--text)] uppercase">
              Could not load {label}. Retry.
            </p>
            {this.state.errorMessage && (
              <p className="font-mono text-xs text-[var(--text-3)]">
                {this.state.errorMessage}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 px-4 py-2 font-hud text-xs tracking-wider uppercase border border-[var(--cyan)] text-[var(--cyan)] bg-[var(--cyan-faint)] hover:brightness-125 transition-all cursor-pointer"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export interface OverlayProps {
  isOpen: boolean
  onClose: () => void
  variant?: 'dialog' | 'sheet-right'
  title: ReactNode
  titleIcon?: ReactNode
  headerExtra?: ReactNode
  footer?: ReactNode
  maxWidth?: string
  ariaLabel?: string
  closeAriaLabel?: string
  errorFallbackLabel?: string
  panelTestId?: string
  panelClassName?: string
  bodyClassName?: string
  children: ReactNode
  onKeyDown?: (e: React.KeyboardEvent) => void
  hideHeader?: boolean
}

export function Overlay({
  isOpen,
  onClose,
  variant = 'dialog',
  title,
  titleIcon,
  headerExtra,
  footer,
  maxWidth = '560px',
  ariaLabel,
  closeAriaLabel = 'Close dialog',
  errorFallbackLabel = 'content',
  panelTestId,
  panelClassName = '',
  bodyClassName = '',
  children,
  onKeyDown,
  hideHeader = false,
}: OverlayProps) {
  const [retryKey, setRetryKey] = useState(0)

  return (
    <Dialog.Root open={isOpen} onOpenChange={open => !open && onClose()}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            {/* Dimmed backdrop — clicking closes */}
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 9990,
                }}
                className="bg-black/70 backdrop-blur-sm"
              />
            </Dialog.Overlay>

            {variant === 'sheet-right' ? (
              <Dialog.Content asChild aria-label={ariaLabel}>
                <motion.div
                  aria-modal="true"
                  data-overlay-panel="sheet-right"
                  data-testid={panelTestId}
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 36 }}
                  onKeyDown={onKeyDown}
                  style={{
                    position: 'fixed',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    height: '100dvh',
                    width: 'min(480px, 100vw)',
                    zIndex: 9999,
                  }}
                  className="focus:outline-none select-none pointer-events-auto"
                >
                  <div
                    className={`relative flex flex-col w-full h-full holo-brackets bg-[var(--surface)] border-l border-[var(--line)] shadow-float overflow-hidden text-[var(--text)] ${panelClassName}`}
                  >
                    {!hideHeader ? (
                      <div className="flex-shrink-0 flex items-center justify-between px-5 h-14 border-b border-[var(--line)] safe-area-top bg-[var(--surface)]">
                        <div className="flex items-center gap-2 min-w-0">
                          {titleIcon}
                          <Dialog.Title className="font-hud text-base font-semibold tracking-wider text-[var(--text)] uppercase truncate">
                            {title}
                          </Dialog.Title>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {headerExtra}
                          <Dialog.Close asChild>
                            <button
                              type="button"
                              aria-label={closeAriaLabel}
                              className="w-9 h-9 rounded flex items-center justify-center text-[var(--text-2)] hover:text-[var(--cyan)] hover:bg-[var(--surface-hi)] transition-all cursor-pointer"
                            >
                              <X size={18} strokeWidth={1.5} />
                            </button>
                          </Dialog.Close>
                        </div>
                      </div>
                    ) : (
                      <Dialog.Title className="sr-only">{title}</Dialog.Title>
                    )}

                    <div
                      className={`flex-1 min-h-0 overflow-y-auto overscroll-contain momentum-scroll ${bodyClassName}`}
                    >
                      <OverlayErrorBoundary
                        key={retryKey}
                        fallbackLabel={errorFallbackLabel}
                        onReset={() => setRetryKey(k => k + 1)}
                      >
                        {children}
                      </OverlayErrorBoundary>
                    </div>

                    {footer && (
                      <div className="flex-shrink-0 border-t border-[var(--line)] bg-[var(--surface)] safe-area-bottom">
                        {footer}
                      </div>
                    )}
                  </div>
                </motion.div>
              </Dialog.Content>
            ) : (
              /* Centered Dialog Grid Wrapper — handles ALL positioning, NO transforms on this element */
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 9999,
                  display: 'grid',
                  placeItems: 'center',
                  paddingTop: 'max(16px, env(safe-area-inset-top, 16px))',
                  paddingRight: 'max(16px, env(safe-area-inset-right, 16px))',
                  paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
                  paddingLeft: 'max(16px, env(safe-area-inset-left, 16px))',
                  pointerEvents: 'none',
                }}
              >
                <Dialog.Content asChild aria-label={ariaLabel}>
                  <motion.div
                    aria-modal="true"
                    data-overlay-panel="dialog"
                    data-testid={panelTestId}
                    initial={{ opacity: 0, scale: 0.96, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 10 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    onKeyDown={onKeyDown}
                    style={{
                      width: `min(${maxWidth}, calc(100vw - 32px))`,
                      maxHeight: 'min(85dvh, 720px)',
                      pointerEvents: 'auto',
                    }}
                    className={`relative flex flex-col bg-[var(--surface)] border border-[var(--cyan)] shadow-[0_0_24px_rgba(92,203,245,0.25)] select-none text-[var(--text)] focus:outline-none overflow-hidden ${panelClassName}`}
                  >
                    {!hideHeader ? (
                      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-[var(--line)] bg-[var(--surface)]">
                        <div className="flex items-center gap-2 min-w-0">
                          {titleIcon}
                          <Dialog.Title className="font-hud text-sm font-semibold tracking-wider text-[var(--cyan)] uppercase truncate">
                            {title}
                          </Dialog.Title>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {headerExtra}
                          <Dialog.Close asChild>
                            <button
                              type="button"
                              aria-label={closeAriaLabel}
                              className="w-7 h-7 flex items-center justify-center text-[var(--text-3)] hover:text-[var(--cyan)] transition-colors cursor-pointer"
                            >
                              <X size={16} />
                            </button>
                          </Dialog.Close>
                        </div>
                      </div>
                    ) : (
                      <Dialog.Title className="sr-only">{title}</Dialog.Title>
                    )}

                    <div
                      className={`flex-1 min-h-0 overflow-y-auto overscroll-contain ${bodyClassName}`}
                    >
                      <OverlayErrorBoundary
                        key={retryKey}
                        fallbackLabel={errorFallbackLabel}
                        onReset={() => setRetryKey(k => k + 1)}
                      >
                        {children}
                      </OverlayErrorBoundary>
                    </div>

                    {footer && (
                      <div className="flex-shrink-0 border-t border-[var(--line)] bg-[var(--surface)]">
                        {footer}
                      </div>
                    )}
                  </motion.div>
                </Dialog.Content>
              </div>
            )}
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}

/**
 * Shared portal container for Toasts, mounted directly into document.body
 * below modals (z-index 9000) and above HUD/rails/orb.
 */
export function OverlayToastPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || typeof document === 'undefined') return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
        zIndex: 9000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'none',
        paddingLeft: '16px',
        paddingRight: '16px',
      }}
    >
      {children}
    </div>,
    document.body
  )
}
