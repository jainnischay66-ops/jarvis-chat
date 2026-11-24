'use client'

import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Mic, Terminal, Volume2, Shield } from 'lucide-react'
import { COMMAND_REGISTRY, type CommandDefinition } from '@/lib/commands'

interface VoiceCommandsModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectCommand?: (phrase: string) => void
}

export function VoiceCommandsModal({
  isOpen,
  onClose,
  onSelectCommand,
}: VoiceCommandsModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={open => !open && onClose()}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg p-5 bg-[var(--surface)] border border-[var(--cyan)] shadow-[0_0_24px_rgba(92,203,245,0.25)] select-none text-[var(--text)] focus:outline-none"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-[var(--cyan)]" />
                    <Dialog.Title className="font-hud text-sm font-semibold tracking-wider text-[var(--cyan)] uppercase">
                      VOICE & TACTICAL COMMAND PROTOCOLS
                    </Dialog.Title>
                  </div>
                  <Dialog.Close asChild>
                    <button
                      aria-label="Close commands dialog"
                      className="w-7 h-7 flex items-center justify-center text-[var(--text-3)] hover:text-[var(--cyan)] transition-colors cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  </Dialog.Close>
                </div>

                {/* Subtitle */}
                <p className="font-mono text-xs text-[var(--text-2)] mt-2 mb-4">
                  Speak into the microphone or type any phrase below. Natural speech slips and variations are automatically mapped.
                </p>

                {/* Command Registry List */}
                <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                  {COMMAND_REGISTRY.map((cmd: CommandDefinition) => (
                    <div
                      key={cmd.id}
                      onClick={() => {
                        onSelectCommand?.(cmd.displayPhrase)
                        onClose()
                      }}
                      className="group p-2.5 bg-[var(--surface-hi)] border border-[var(--line)] hover:border-[var(--cyan)] transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-hud text-sm tracking-wider font-semibold text-[var(--text)] group-hover:text-[var(--cyan)] transition-colors">
                          "{cmd.displayPhrase}"
                        </span>
                        <span className="font-mono text-[10px] tracking-wider text-[var(--cyan-dim)] uppercase px-1.5 py-0.5 border border-[var(--line)]">
                          {cmd.category}
                        </span>
                      </div>

                      <p className="font-mono text-[11px] text-[var(--text-3)] mt-1">
                        {cmd.description}
                      </p>

                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {cmd.aliases.slice(0, 4).map(a => (
                          <span
                            key={a}
                            className="font-mono text-[10px] text-[var(--text-3)] bg-[var(--surface)] px-1 py-0.5 border border-[var(--line)]"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer hint */}
                <div className="mt-4 pt-3 border-t border-[var(--line)] flex items-center justify-between text-[11px] font-mono text-[var(--text-3)]">
                  <span>Press Space to type in Standby</span>
                  <span className="text-[var(--gold)]">AI Intent Fallback: ACTIVE</span>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
