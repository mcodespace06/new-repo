import { Response } from 'express';

export interface SosEventPayload {
  type: 'TRIGGERED' | 'PING' | 'STATUS_CHANGE';
  sosId: string;
  data: any;
  timestamp: string;
}

class SosEventBus {
  private clients: Map<string, Response> = new Map();

  /**
   * Register a new SSE connection for security & admin personnel.
   */
  public subscribe(clientId: string, res: Response): void {
    this.clients.set(clientId, res);

    // Initial keep-alive ping
    res.write(`event: connected\ndata: ${JSON.stringify({ clientId, timestamp: new Date().toISOString() })}\n\n`);

    res.on('close', () => {
      this.clients.delete(clientId);
    });
  }

  /**
   * Broadcast an SOS event to all subscribed consoles.
   */
  public broadcast(event: string, payload: any): void {
    const data = JSON.stringify(payload);
    for (const [clientId, res] of this.clients.entries()) {
      try {
        res.write(`event: ${event}\ndata: ${data}\n\n`);
      } catch (err) {
        this.clients.delete(clientId);
      }
    }
  }

  /**
   * Returns current active listener count.
   */
  public getListenerCount(): number {
    return this.clients.size;
  }
}

export const sosBus = new SosEventBus();
