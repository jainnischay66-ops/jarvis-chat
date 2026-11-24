import { IndexedDBStorage, DEFAULT_SYSTEM_PROMPT, DEFAULT_PREFERENCES, getUIPreferences, saveUIPreferences } from './indexeddb'
import type { StorageProvider } from './types'

export * from './types'
export { DEFAULT_SYSTEM_PROMPT, DEFAULT_PREFERENCES, getUIPreferences, saveUIPreferences }

let storageInstance: StorageProvider | null = null

export function getStorage(): StorageProvider {
  if (!storageInstance) {
    storageInstance = new IndexedDBStorage()
  }
  return storageInstance
}
