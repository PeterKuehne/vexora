import { io, Socket } from 'socket.io-client';

// Server URL - configurable via environment variable
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3001';

// Socket.io client instance (singleton)
let socket: Socket | null = null;

// Socket event types for type safety
export interface ChatMessagePayload {
  conversationId: string;
  message: string;
}

export interface ChatMessageAck {
  conversationId: string;
  status: 'received' | 'error';
  timestamp: string;
  error?: string;
}

export interface ChatStreamToken {
  conversationId: string;
  token: string;
}

export interface ChatStreamEvent {
  conversationId: string;
}

// Get or create socket connection
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    // Debug logging in development
    if (import.meta.env.DEV) {
      socket.on('connect', () => {
        console.log('🔌 Socket connected:', socket?.id);
      });

      socket.on('disconnect', (reason) => {
        console.log('🔌 Socket disconnected:', reason);
      });

      socket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error.message);
      });
    }
  }

  return socket;
}

// Connect to server
export function connectSocket(): void {
  const sock = getSocket();
  if (!sock.connected) {
    sock.connect();
  }
}

// Disconnect from server
export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}

// Check connection status
export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}

// Send chat message
export function sendChatMessage(payload: ChatMessagePayload): void {
  const sock = getSocket();
  if (sock.connected) {
    sock.emit('chat:message', payload);
  } else {
    console.warn('Socket not connected. Message not sent.');
  }
}

// Subscribe to chat events
export function onChatMessageAck(callback: (data: ChatMessageAck) => void): () => void {
  const sock = getSocket();
  sock.on('chat:message:ack', callback);
  return () => sock.off('chat:message:ack', callback);
}

export function onChatStreamStart(callback: (data: ChatStreamEvent) => void): () => void {
  const sock = getSocket();
  sock.on('chat:stream:start', callback);
  return () => sock.off('chat:stream:start', callback);
}

export function onChatStreamToken(callback: (data: ChatStreamToken) => void): () => void {
  const sock = getSocket();
  sock.on('chat:stream:token', callback);
  return () => sock.off('chat:stream:token', callback);
}

export function onChatStreamEnd(callback: (data: ChatStreamEvent) => void): () => void {
  const sock = getSocket();
  sock.on('chat:stream:end', callback);
  return () => sock.off('chat:stream:end', callback);
}

// Export socket instance for direct access if needed
export { socket };
