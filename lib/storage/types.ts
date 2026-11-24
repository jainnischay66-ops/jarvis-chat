export interface StoredAttachment {
  id: string
  type: 'image' | 'text' | 'pdf'
  name: string
  mimeType: string
  size: number
  preview?: string
  content?: string
}

export interface StoredMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
  stopped?: boolean
  versions?: string[]
  currentVersion?: number
  attachments?: StoredAttachment[]
}

export interface Conversation {
  id: string
  title: string
  messages: StoredMessage[]
  createdAt: number
  updatedAt: number
  pinned?: boolean
  draft?: string
  scrollPosition?: number
}

export interface StorageProvider {
  getConversation(id: string): Promise<Conversation | null>
  getAllConversations(): Promise<Conversation[]>
  saveConversation(conv: Conversation): Promise<void>
  deleteConversation(id: string): Promise<void>
  searchConversations(query: string): Promise<Conversation[]>
  exportAll(): Promise<string>
  importAll(data: string): Promise<void>
  clearAll(): Promise<void>
}

export interface UIPreferences {
  theme: 'light' | 'dark' | 'system'
  sidebarOpen: boolean
  lastConversationId?: string
  temperature: number
  maxContextMessages: number
  systemPrompt: string
  readAloud: boolean
  provider: 'gemini' | 'anthropic' | 'openai-compatible'
  model: string
}
