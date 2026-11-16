import { io } from 'socket.io-client';

let socketInstance = null;

export function getSocket(token) {
  if (!token) {
    if (socketInstance) {
      socketInstance.disconnect();
      socketInstance = null;
    }
    return null;
  }

  if (socketInstance) {
    if (socketInstance.auth?.token !== token) {
      socketInstance.auth = { token };
      socketInstance.disconnect().connect();
    }
    return socketInstance;
  }

  // Determine socket connection URL
  // Uses relative path through Vite proxy in dev/docker, or window.location.origin
  socketInstance = io({
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    transports: ['websocket', 'polling']
  });

  return socketInstance;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
