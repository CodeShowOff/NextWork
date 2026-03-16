import { Injectable } from '@nestjs/common';

@Injectable()
export class RealtimeMetricsService {
  private activeConnections = 0;
  private authenticatedConnections = 0;
  private failedAuthentications = 0;
  private sentMessages = 0;
  private typingEvents = 0;

  onConnectionOpen(): void {
    this.activeConnections += 1;
  }

  onConnectionClose(params?: { wasAuthenticated?: boolean }): void {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
    if (params?.wasAuthenticated) {
      this.authenticatedConnections = Math.max(0, this.authenticatedConnections - 1);
    }
  }

  onAuthenticatedConnection(): void {
    this.authenticatedConnections += 1;
  }

  onAuthenticationFailed(): void {
    this.failedAuthentications += 1;
  }

  onMessageSent(): void {
    this.sentMessages += 1;
  }

  onTypingEvent(): void {
    this.typingEvents += 1;
  }

  getSnapshot() {
    return {
      activeConnections: this.activeConnections,
      authenticatedConnections: this.authenticatedConnections,
      failedAuthentications: this.failedAuthentications,
      sentMessages: this.sentMessages,
      typingEvents: this.typingEvents,
      sampledAt: new Date().toISOString(),
    };
  }
}
