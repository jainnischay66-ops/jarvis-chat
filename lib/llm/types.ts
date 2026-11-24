export interface Attachment {
  id: string
  type: 'image' | 'text' | 'pdf'
  name: string
  content: string // base64 data for image, or plain text
  mimeType: string
  size: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  attachments?: Attachment[]
  createdAt: number
  stopped?: boolean
  versions?: string[]
}

export interface StreamOptions {
  model: string
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

export interface StreamChunk {
  type: 'text' | 'error' | 'done'
  content: string
}

export interface LLMProvider {
  name: string
  supportsAttachments: boolean
  stream(messages: Message[], options: StreamOptions): AsyncIterable<StreamChunk>
}

export type ProviderName = 'gemini' | 'anthropic' | 'openai-compatible'
