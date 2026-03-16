import { io, Socket } from 'socket.io-client';

import { NotificationItem, NotificationReadEvent } from '../../features/notifications/types';
import { useSessionStore } from '../session/session.store';

type NotificationSocketHandlers = {
  onNew?: (notification: NotificationItem) => void;
  onRead?: (event: NotificationReadEvent) => void;
};

let notificationSocket: Socket | null = null;

export function connectNotificationsSocket(handlers: NotificationSocketHandlers): Socket {
  const state = useSessionStore.getState();

  if (notificationSocket) {
    notificationSocket.disconnect();
    notificationSocket = null;
  }

  notificationSocket = io(state.realtimeBaseUrl, {
    transports: ['websocket'],
    auth: {
      token: state.accessToken,
    },
    autoConnect: true,
    forceNew: true,
  });

  notificationSocket.on('notification.new', (notification: NotificationItem) => {
    handlers.onNew?.(notification);
  });

  notificationSocket.on('notification.read', (event: NotificationReadEvent) => {
    handlers.onRead?.(event);
  });

  return notificationSocket;
}

export function disconnectNotificationsSocket(): void {
  if (notificationSocket) {
    notificationSocket.disconnect();
    notificationSocket = null;
  }
}
