'use client'

import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { OverlayToastPortal } from './Overlay'

interface ToastOptions {
  action?: {
    label: string
    onClick: () => void
  }
  duration?: number
  type?: 'default' | 'error'
}

interface ToastItem {
  id: string
  message: string
  options?: ToastOptions
}

interface ToastContextType {
  toast: (message: string, options?: ToastOptions) => void
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
})

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [currentToast, setCurrentToast] = useState<ToastItem | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const toast = useCallback((message: string, options?: ToastOptions) => {
    if (timerRef.current) clearTimeout(timerRef.current)

    const item: ToastItem = {
      id: Math.random().toString(),
      message,
      options,
    }
    setCurrentToast(item)

    const duration = options?.duration || (options?.action ? 6000 : 4000)
    timerRef.current = setTimeout(() => {
      setCurrentToast(null)
    }, duration)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <OverlayToastPortal>
        <AnimatePresence>
          {currentToast && (
            <motion.div
              key={currentToast.id}
              data-testid="overlay-toast"
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              className="holo pointer-events-auto flex items-center gap-3 px-4 py-2.5 bg-[var(--surface-hi)] text-[var(--text)] border border-[var(--cyan)] shadow-[0_0_16px_rgba(92,203,245,0.25)] text-xs font-mono uppercase tracking-wider max-w-[min(480px,calc(100vw-32px))]"
            >
              <span>{currentToast.message}</span>
              {currentToast.options?.action && (
                <button
                  onClick={() => {
                    currentToast.options?.action?.onClick()
                    setCurrentToast(null)
                  }}
                  className="text-[var(--gold)] hover:underline active:opacity-60 transition-opacity font-semibold ml-1 cursor-pointer flex-shrink-0"
                >
                  {currentToast.options.action.label}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </OverlayToastPortal>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
