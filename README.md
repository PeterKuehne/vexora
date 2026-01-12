# Qwen Chat

Modern, minimalistic chat interface for local LLMs powered by Ollama. Claude-inspired design with conversation management, streaming responses, and markdown support.

![Qwen Chat Interface](docs/screenshot.png)

## Features

- 🤖 **Local AI Chat** - Powered by Ollama (runs completely offline)
- 💬 **Conversation Management** - Organize chats with groups (Today, Yesterday, etc.)
- 🎨 **Modern UI** - Claude-inspired design with dark/light themes
- ⚡ **Real-time Streaming** - See responses as they're generated
- 📝 **Markdown Support** - Full markdown rendering with syntax highlighting
- 🔍 **Search & Filter** - Find conversations by title or content
- 💾 **Local Storage** - All data stays on your device
- 🎯 **TypeScript** - Fully typed for better development experience
- 📱 **Responsive** - Works on desktop and mobile

## Prerequisites

### Ollama Installation

Qwen Chat requires **Ollama** to run AI models locally.

1. **Install Ollama:**
   - **macOS/Linux:** `curl -fsSL https://ollama.ai/install.sh | sh`
   - **Windows:** Download from [ollama.ai](https://ollama.ai)

2. **Download the Qwen model:**
   ```bash
   ollama pull qwen2.5:8b
   ```

3. **Start Ollama server:**
   ```bash
   ollama serve
   ```
   The server will run on `http://localhost:11434`

### System Requirements

- **Node.js** 18+ (LTS recommended)
- **npm** or **yarn**
- Modern web browser (Chrome, Firefox, Safari, Edge)
- 8GB+ RAM (for Qwen 2.5:8B model)

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd qwen-chat
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development servers:**
   ```bash
   npm run dev:all
   ```
   This runs both frontend (React) and backend (Express) servers concurrently.

4. **Open your browser:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

## Usage Guide

### Getting Started

1. **Ensure Ollama is running** with `ollama serve`
2. **Open Qwen Chat** in your browser
3. **Click "New Chat"** to start a conversation
4. **Type your message** and press Enter or click Send

### Interface Overview

- **Sidebar (Left):** Conversation list with search and groups
- **Header (Top):** App title, settings, theme toggle
- **Chat Area (Center):** Message history and responses
- **Input Area (Bottom):** Message composer with send button

### Features

#### Conversation Management
- **New Chat:** Click the "+" button to start fresh
- **Switch Chats:** Click any conversation in the sidebar
- **Search:** Use the search box to find specific conversations
- **Delete:** Click the trash icon on any conversation

#### Themes
- **Dark Theme:** Default dark mode
- **Light Theme:** Clean light interface
- **System Theme:** Follows your OS preference

#### Settings
- **Model Selection:** Choose from available Ollama models
- **Temperature:** Adjust response creativity (0.1-2.0)
- **System Prompt:** Set custom instructions for the AI
- **API URL:** Configure Ollama connection

### Keyboard Shortcuts

- **Enter:** Send message
- **Shift + Enter:** New line
- **Ctrl/Cmd + N:** New conversation
- **Ctrl/Cmd + K:** Focus search
- **Escape:** Close modals/sidebar

## Development

### Project Structure

```
qwen-chat/
├── src/                    # React frontend
│   ├── components/         # Reusable UI components
│   ├── contexts/          # React contexts (theme, conversations)
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utilities and services
│   ├── types/             # TypeScript type definitions
│   └── App.tsx            # Main application component
├── server/                # Express backend
│   └── src/               # Backend source code
├── public/                # Static assets
└── docs/                  # Documentation and screenshots
```

### Tech Stack

**Frontend:**
- React 19 with TypeScript
- Vite for fast development and building
- Tailwind CSS for styling
- Headless UI for accessible components
- Lucide React for icons
- react-markdown for message rendering

**Backend:**
- Express.js with TypeScript
- Socket.io for real-time communication
- CORS for cross-origin requests
- Zod for request validation

**Development:**
- ESLint + Prettier for code quality
- Vitest for testing
- Concurrently for running multiple servers

### Available Scripts

```bash
# Development
npm run dev              # Frontend only (Vite)
npm run dev:server       # Backend only (Express)
npm run dev:all          # Both frontend and backend

# Building
npm run build            # Build frontend
npm run build:server     # Build backend
npm run build:all        # Build both

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues
npm run format           # Format with Prettier
npm run format:check     # Check formatting
npm run typecheck        # TypeScript type checking

# Testing
npm test                 # Run tests in watch mode
npm run test:run         # Run tests once
npm run test:coverage    # Run tests with coverage
```

### API Endpoints

The backend provides a proxy layer to the Ollama API:

- `GET /api/health` - Check if Ollama is running
- `GET /api/models` - List available models
- `POST /api/chat` - Start a chat completion (streaming)

### Environment Variables

Create a `.env` file in the root directory:

```env
# Backend server port
PORT=3001

# Ollama API URL
OLLAMA_API_URL=http://localhost:11434

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173
```

## Troubleshooting

### Common Issues

**"Ollama not reachable" error:**
- Ensure Ollama is installed and running (`ollama serve`)
- Check that port 11434 is available
- Verify the model is downloaded (`ollama pull qwen2.5:8b`)

**Frontend not connecting to backend:**
- Ensure backend is running on port 3001
- Check CORS settings in server configuration
- Verify API_URL in frontend environment

**Build errors:**
- Run `npm run typecheck` to check TypeScript errors
- Ensure all dependencies are installed
- Clear node_modules and reinstall if needed

**Performance issues:**
- Close unused conversations (limit to 50-100 for best performance)
- Restart Ollama if model responses are slow
- Check available RAM (Qwen 2.5:8B needs ~8GB)

### Getting Help

1. Check the [Issues](../../issues) page for known problems
2. Search existing [Discussions](../../discussions)
3. Create a new issue with:
   - Your OS and Node.js version
   - Steps to reproduce the problem
   - Console error messages
   - Screenshot if relevant

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

1. Fork the repository
2. Clone your fork
3. Install dependencies: `npm install`
4. Create a feature branch: `git checkout -b feature/my-feature`
5. Make your changes and add tests
6. Run the test suite: `npm test`
7. Commit your changes: `git commit -m "Add my feature"`
8. Push to your fork: `git push origin feature/my-feature`
9. Create a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Ollama](https://ollama.ai) - For making local LLMs accessible
- [Qwen](https://qwenlm.github.io/) - For the excellent open-source LLM
- [Tailwind CSS](https://tailwindcss.com) - For the utility-first CSS framework
- [Lucide](https://lucide.dev) - For the beautiful icon set

---

**Made with ❤️ for the open-source AI community**