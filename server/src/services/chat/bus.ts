import { Response } from 'express';
import { EventEmitter } from 'events';

class ChatMessageBus extends EventEmitter {
  private clients: Map<string, Set<Response>> = new Map();

  constructor() {
    super();
    this.setMaxListeners(200);
  }

  /**
   * Registers an active SSE client response on a specific complaint channel
   */
  registerClient(complaintId: string, res: Response) {
    if (!this.clients.has(complaintId)) {
      this.clients.set(complaintId, new Set());
    }

    const set = this.clients.get(complaintId)!;
    set.add(res);

    // Initial SSE connection handshake
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    res.write(`event: connected\ndata: ${JSON.stringify({ complaintId, time: new Date().toISOString() })}\n\n`);

    res.on('close', () => {
      set.delete(res);
      if (set.size === 0) {
        this.clients.delete(complaintId);
      }
    });
  }

  /**
   * Broadcasts a new message or status change to all connected SSE clients
   */
  broadcast(complaintId: string, event: string, data: any) {
    const set = this.clients.get(complaintId);
    if (!set || set.size === 0) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of set) {
      try {
        res.write(payload);
      } catch {
        // Handled via close event
      }
    }
  }

  /**
   * Convenience helper to emit a status change event
   */
  emitStatusChange(complaintId: string, status: string) {
    this.broadcast(complaintId, 'status_change', { status });
  }
}

export const chatBus = new ChatMessageBus();
