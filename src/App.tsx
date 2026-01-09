import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="flex gap-8 mb-8">
        <a href="https://vite.dev" target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-110">
          <img src={viteLogo} className="h-24 w-24" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-110">
          <img src={reactLogo} className="h-24 w-24 animate-spin" style={{ animationDuration: '20s' }} alt="React logo" />
        </a>
      </div>
      <h1 className="text-4xl font-bold mb-8" style={{ color: 'var(--primary)' }}>Qwen Chat</h1>
      <p className="mb-6 text-secondary">Tailwind CSS configured with custom design system</p>
      <div className="p-6 rounded-xl shadow-lg bg-surface">
        <button
          onClick={() => setCount((count) => count + 1)}
          className="text-white px-6 py-3 rounded-lg font-medium transition-all cursor-pointer hover:opacity-90 bg-primary"
        >
          count is {count}
        </button>
        <p className="mt-4 text-secondary">
          Edit <code className="px-2 py-1 rounded text-sm bg-code font-code">src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="mt-8 text-sm text-secondary">
        Click on the Vite and React logos to learn more
      </p>
    </div>
  )
}

export default App
