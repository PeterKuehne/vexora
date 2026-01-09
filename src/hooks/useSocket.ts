import { useEffect, useState, useCallback } from 'react'
import {
  getSocket,
  connectSocket,
  disconnectSocket,
  isSocketConnected,
  sendChatMessage,
  onChatMessageAck,
  onChatStreamStart,
  onChatStreamToken,
  onChatStreamEnd,
  type ChatMessagePayload,
  type ChatMessageAck,
  type ChatStreamToken,
  type ChatStreamEvent,
} from '../lib/socket'

export interface UseSocketReturn {
  isConnected: boolean
  connect: () => void
  disconnect: () => void
  sendMessage: (payload: ChatMessagePayload) => void
}

export interface UseSocketOptions {
  autoConnect?: boolean
  onMessageAck?: (data: ChatMessageAck) => void
  onStreamStart?: (data: ChatStreamEvent) => void
  onStreamToken?: (data: ChatStreamToken) => void
  onStreamEnd?: (data: ChatStreamEvent) => void
}

/**
 * React hook for Socket.io connection management
 */
export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const { autoConnect = true, onMessageAck, onStreamStart, onStreamToken, onStreamEnd } = options

  const [isConnected, setIsConnected] = useState(isSocketConnected())

  // Connection status sync
  useEffect(() => {
    const socket = getSocket()

    const handleConnect = () => setIsConnected(true)
    const handleDisconnect = () => setIsConnected(false)

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)

    // Auto-connect if enabled
    if (autoConnect) {
      connectSocket()
    }

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
    }
  }, [autoConnect])

  // Event subscriptions
  useEffect(() => {
    const unsubscribers: (() => void)[] = []

    if (onMessageAck) {
      unsubscribers.push(onChatMessageAck(onMessageAck))
    }
    if (onStreamStart) {
      unsubscribers.push(onChatStreamStart(onStreamStart))
    }
    if (onStreamToken) {
      unsubscribers.push(onChatStreamToken(onStreamToken))
    }
    if (onStreamEnd) {
      unsubscribers.push(onChatStreamEnd(onStreamEnd))
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub())
    }
  }, [onMessageAck, onStreamStart, onStreamToken, onStreamEnd])

  const connect = useCallback(() => {
    connectSocket()
  }, [])

  const disconnect = useCallback(() => {
    disconnectSocket()
  }, [])

  const sendMessage = useCallback((payload: ChatMessagePayload) => {
    sendChatMessage(payload)
  }, [])

  return {
    isConnected,
    connect,
    disconnect,
    sendMessage,
  }
}

export default useSocket
