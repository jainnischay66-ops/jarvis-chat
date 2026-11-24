'use client'

import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Overlay } from './Overlay'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  panelTestId?: string
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  panelTestId = 'confirm-dialog',
}: ConfirmDialogProps) {
  return (
    <Overlay
      isOpen={isOpen}
      onClose={onClose}
      variant="dialog"
      maxWidth="440px"
      title={title}
      titleIcon={
        <AlertTriangle
          size={16}
          className={destructive ? 'text-[var(--red)]' : 'text-[var(--gold)]'}
        />
      }
      closeAriaLabel="Close confirmation dialog"
      errorFallbackLabel="confirmation dialog"
      panelTestId={panelTestId}
      bodyClassName="p-5"
      footer={
        <div className="flex items-center justify-end gap-2.5 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 font-hud text-xs tracking-wider uppercase border border-[var(--line)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-3)] transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={async () => {
              await onConfirm()
              onClose()
            }}
            className={`px-4 py-1.5 font-hud text-xs tracking-wider uppercase font-semibold transition-opacity hover:opacity-90 cursor-pointer ${
              destructive
                ? 'bg-[var(--red)] text-white'
                : 'bg-[var(--cyan)] text-black'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <p className="font-mono text-xs leading-relaxed text-[var(--text-2)]">
        {description}
      </p>
    </Overlay>
  )
}
