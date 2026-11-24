import type { Message } from '@/lib/llm/types';

/**
 * Default maximum token limit for context window trimming.
 */
export const DEFAULT_MAX_TOKENS = 100000;

/**
 * Result returned by trimMessages.
 */
export interface TrimResult {
  trimmed: Message[];
  wasTrimmed: boolean;
  removedCount: number;
}

export type TrimMessagesResult = TrimResult;

/**
 * Rough estimation of tokens from text (1 token ≈ 4 characters for English).
 */
export function estimateTokens(text: string): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  return Math.ceil(text.length / 4);
}

/**
 * Estimates total tokens for an array of messages based on their content.
 */
export function estimateMessagesTokens(messages: Message[]): number {
  if (!messages || !Array.isArray(messages)) {
    return 0;
  }
  return messages.reduce((total, message) => {
    if (!message || typeof message.content !== 'string') {
      return total;
    }
    return total + estimateTokens(message.content);
  }, 0);
}

/**
 * Trims a list of messages to fit within a given token budget.
 *
 * Rules:
 * - Always keeps the system prompt (first message if role is 'system')
 * - Always keeps the latest user message
 * - Removes oldest messages first until under budget
 * - Returns { trimmed: Message[], wasTrimmed: boolean, removedCount: number }
 */
export function trimMessages(
  messages: Message[],
  maxTokens: number = DEFAULT_MAX_TOKENS,
  systemPrompt: string = ''
): TrimResult {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return {
      trimmed: [],
      wasTrimmed: false,
      removedCount: 0,
    };
  }

  let actualMaxTokens = maxTokens;
  let actualSystemPrompt = systemPrompt;
  if (typeof maxTokens === 'string') {
    actualSystemPrompt = maxTokens;
    actualMaxTokens = DEFAULT_MAX_TOKENS;
  } else if (typeof actualMaxTokens !== 'number' || isNaN(actualMaxTokens)) {
    actualMaxTokens = DEFAULT_MAX_TOKENS;
  }
  if (typeof actualSystemPrompt !== 'string') {
    actualSystemPrompt = '';
  }

  const hasSystemMessage = messages[0]?.role === 'system';
  const systemPromptTokens = hasSystemMessage ? 0 : estimateTokens(actualSystemPrompt);

  let currentTokens = systemPromptTokens + estimateMessagesTokens(messages);

  if (currentTokens <= actualMaxTokens) {
    return {
      trimmed: [...messages],
      wasTrimmed: false,
      removedCount: 0,
    };
  }

  // Identify protected message indices:
  // 1. First message if role is 'system'
  // 2. Latest user message
  const protectedIndices = new Set<number>();
  if (hasSystemMessage) {
    protectedIndices.add(0);
  }

  let latestUserIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === 'user') {
      latestUserIndex = i;
      break;
    }
  }
  if (latestUserIndex !== -1) {
    protectedIndices.add(latestUserIndex);
  }

  // Removable indices in chronological order (oldest first)
  const removableIndices: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (!protectedIndices.has(i)) {
      removableIndices.push(i);
    }
  }

  const removedIndices = new Set<number>();
  for (const idx of removableIndices) {
    removedIndices.add(idx);
    const msgContent = messages[idx]?.content;
    currentTokens -= (msgContent ? estimateTokens(msgContent) : 0);
    if (currentTokens <= actualMaxTokens) {
      break;
    }
  }

  const trimmed = messages.filter((_, idx) => !removedIndices.has(idx));

  return {
    trimmed,
    wasTrimmed: removedIndices.size > 0,
    removedCount: removedIndices.size,
  };
}

export type { Message };
