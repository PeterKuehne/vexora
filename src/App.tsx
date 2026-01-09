import { useState, useCallback } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import { useSocket } from './hooks/useSocket'

function App() {
  const [count, setCount] = useState(0)
  const [streamedText, setStreamedText] = useState('')
  const [lastAck, setLastAck] = useState<string | null>(null)

  const { isConnected, sendMessage } = useSocket({
    autoConnect: true,
    onMessageAck: useCallback((data) => {
      setLastAck(`Received at ${data.timestamp}`)
    }, []),
    onStreamStart: useCallback(() => {
      setStreamedText('')
    }, []),
    onStreamToken: useCallback((data) => {
      setStreamedText(data.token)
    }, []),
    onStreamEnd: useCallback(() => {
      console.log('Stream ended')
    }, []),
  })

  const handleTestSocket = () => {
    sendMessage({
      conversationId: 'test-conv-1',
      message: 'Hello from the frontend!',
    })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="flex gap-8 mb-8">
        <a
          href="https://vite.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-transform hover:scale-110"
        >
          <img src={viteLogo} className="h-24 w-24" alt="Vite logo" />
        </a>
        <a
          href="https://react.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-transform hover:scale-110"
        >
          <img
            src={reactLogo}
            className="h-24 w-24 animate-spin"
            style={{ animationDuration: '20s' }}
            alt="React logo"
          />
        </a>
      </div>
      <h1 className="text-4xl font-bold mb-8" style={{ color: 'var(--primary)' }}>
        Qwen Chat
      </h1>

      {/* Socket.io Connection Status */}
      <div className="mb-6 flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-secondary">
          Socket.io: {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <div className="p-6 rounded-xl shadow-lg bg-surface space-y-4">
        <button
          onClick={() => setCount((count) => count + 1)}
          className="text-white px-6 py-3 rounded-lg font-medium transition-all cursor-pointer hover:opacity-90 bg-primary w-full"
        >
          count is {count}
        </button>

        {/* Socket.io Test Button */}
        <button
          onClick={handleTestSocket}
          disabled={!isConnected}
          className="w-full px-6 py-3 rounded-lg font-medium transition-all cursor-pointer border-2 border-primary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary hover:text-white"
          style={{ color: 'var(--primary)' }}
        >
          Test Socket.io
        </button>

        {/* Show streamed text if any */}
        {streamedText && (
          <div className="p-3 rounded-lg text-sm bg-green-500/10 text-green-400">
            Response: {streamedText}
          </div>
        )}

        {/* Show last acknowledgment */}
        {lastAck && <div className="text-xs text-secondary">{lastAck}</div>}

        <p className="mt-4 text-secondary">
          Edit <code className="px-2 py-1 rounded text-sm bg-code font-code">src/App.tsx</code> and
          save to test HMR
        </p>
      </div>
      <p className="mt-8 text-sm text-secondary">Click on the Vite and React logos to learn more</p>
    </div>
  )
}

export default App
