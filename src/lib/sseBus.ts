import { EventEmitter } from 'events';

export interface SSEEvent {
  type: 'agent_update' | 'message_update' | 'conversation_update';
  data: Record<string, unknown>;
}

type SSECallback = (event: SSEEvent) => void;

/**
 * In-memory Server-Sent Events pub/sub bus.
 * 
 * Scoped by conversationId so each SSE client only receives
 * events relevant to the conversation they are watching.
 */
class SSEBus {
  private emitter = new EventEmitter();

  constructor() {
    // Allow many concurrent SSE listeners
    this.emitter.setMaxListeners(500);
  }

  /**
   * Emit an event to all subscribers watching a specific conversation.
   */
  emit(conversationId: string, event: SSEEvent): void {
    this.emitter.emit(`conversation:${conversationId}`, event);
  }

  /**
   * Subscribe to events for a specific conversation.
   * Returns an unsubscribe function.
   */
  subscribe(conversationId: string, callback: SSECallback): () => void {
    const channel = `conversation:${conversationId}`;
    this.emitter.on(channel, callback);
    return () => {
      this.emitter.off(channel, callback);
    };
  }
}

// Singleton instance — shared across all API routes in the same process
export const sseBus = new SSEBus();
