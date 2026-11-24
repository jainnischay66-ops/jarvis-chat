'use client'

import React from 'react'
import { Shield } from 'lucide-react'
import { COMMAND_REGISTRY, type CommandDefinition } from '@/lib/commands'
import { Overlay } from './Overlay'

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
    <Overlay
      isOpen={isOpen}
      onClose={onClose}
      variant="dialog"
      title="VOICE & TACTICAL COMMAND PROTOCOLS"
      titleIcon={<Shield size={16} className="text-[var(--cyan)] flex-shrink-0" />}
      closeAriaLabel="Close commands dialog"
      errorFallbackLabel="voice commands"
      panelTestId="voice-commands-modal"
      bodyClassName="p-5"
      footer={
        <div className="px-5 py-3 flex items-center justify-between text-[11px] font-mono text-[var(--text-3)]">
          <span>Press Space to type in Standby</span>
          <span className="text-[var(--gold)]">AI Intent Fallback: ACTIVE</span>
        </div>
      }
    >
      <p className="font-mono text-xs text-[var(--text-2)] mb-4">
        Speak into the microphone or type any phrase below. Natural speech slips and variations are automatically mapped.
      </p>

      <div className="space-y-2.5">
        {COMMAND_REGISTRY.map((cmd: CommandDefinition) => (
          <div
            key={cmd.id}
            onClick={() => {
              onSelectCommand?.(cmd.displayPhrase)
              onClose()
            }}
            className="group p-2.5 bg-[var(--surface-hi)] border border-[var(--line)] hover:border-[var(--cyan)] transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-hud text-sm tracking-wider font-semibold text-[var(--text)] group-hover:text-[var(--cyan)] transition-colors">
                "{cmd.displayPhrase}"
              </span>
              <span className="font-mono text-[10px] tracking-wider text-[var(--cyan-dim)] uppercase px-1.5 py-0.5 border border-[var(--line)] flex-shrink-0">
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
    </Overlay>
  )
}
