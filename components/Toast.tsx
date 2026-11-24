'use client'

import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

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
  const timerRef = useRef<any>(null)

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
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center">
        <AnimatePresence>
          {currentToast && (
            <motion.div
              key={currentToast.id}
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-card bg-[#1C1C1E] text-[#F5F5F7] shadow-float border border-[var(--color-separator)] text-ui-sm font-medium"
            >
              <span>{currentToast.message}</span>
              {currentToast.options?.action && (
                <button
                  onClick={() => {
                    currentToast.options?.action?.onClick()
                    setCurrentToast(null)
                  }}
                  className="text-[var(--color-accent)] hover:opacity-80 active:opacity-60 transition-opacity font-semibold ml-1"
                >
                  {currentToast.options.action.label}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
