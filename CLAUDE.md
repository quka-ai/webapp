# Quka Web Frontend - Claude Reference

## Project Overview
Quka is a RAG (Retrieval-Augmented Generation) web application frontend built with React and TypeScript. It provides knowledge management, AI chat functionality, and collaborative workspace features.

## Tech Stack

### Core Framework
- **React 18.3.1** with TypeScript
- **Vite 6.2.3** as build tool
- **React Router 6.23.0** for routing

### UI Libraries
- **HeroUI 2.7.10** - Primary UI component library (React Aria based)
- **Tailwind CSS 3.4.3** - Utility-first CSS framework
- **Framer Motion 11.15.0** - Animation library
- **Lucide React 0.451.0** - Icon library
- **Radix UI** - Headless UI components (toast, icons)

### State Management
- **Valtio 2.0.0** - Proxy-based state management
- **Immer 10.1.1** - Immutable state updates
- **use-immer 0.10.0** - React hook for Immer

### Rich Text Editor
- **EditorJS 2.30.7** - Block-style editor
- Multiple EditorJS plugins (header, list, code, image, table, etc.)
- **CodeMirror** integration for code editing

### Internationalization
- **i18next 23.16.2** - Internationalization framework
- **react-i18next 15.1.0** - React integration
- Support for: English, Chinese, Japanese

### Data & Communication
- **Axios 1.7.7** - HTTP client
- **WebSocket** integration for real-time communication
- **Crypto-js 4.2.0** - Cryptographic functions

### Content Processing
- **React Markdown 10.1.0** - Markdown rendering
- **Highlight.js 11.10.0** - Code syntax highlighting
- **KaTeX 0.16.21** - Math formula rendering
- **Showdown 2.1.0** - Markdown converter

### Media & Files
- **React Dropzone 14.3.5** - File upload
- **Video.js 8.20.0** - Video player
- **React Medium Image Zoom 5.2.14** - Image zoom functionality

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── editor/         # Rich text editor components
│   ├── space/          # Space management components
│   └── ui/             # Base UI components
├── pages/              # Page components
│   ├── dashboard/      # Main dashboard pages
│   │   ├── chat/       # Chat functionality
│   │   ├── journal/    # Journal/diary features
│   │   └── setting/    # User settings
│   └── share/          # Shared content pages
├── hooks/              # Custom React hooks
├── stores/             # Valtio state stores
├── apis/               # API layer
├── layouts/            # Layout components
├── lib/                # Utility libraries
│   └── i18n/           # Internationalization files
└── types/              # TypeScript type definitions
```

## Key Features

### 1. User Authentication
- Login/signup with email
- Password reset functionality
- Protected routes with authentication checks

### 2. Space Management
- Multi-workspace support
- Space settings and user management
- Space application system

### 3. Knowledge Management
- Create, edit, and organize knowledge base
- Rich text editor with multiple content types
- Knowledge sharing capabilities

### 4. AI Chat System
- Chat sessions with AI
- Message history and session management
- Real-time communication via WebSocket

### 5. Journal System
- Daily journal entries
- Calendar-based navigation

### 6. File Management
- Image and video upload
- File compression and optimization
- Media preview and zoom

## Build Commands

```bash
# Development
npm run dev

# Production build
npm run build

# Beta build
npm run build-beta

# Linting
npm run lint

# Preview build
npm run preview
```

## Development Notes

### State Management
- Uses Valtio for reactive state management
- Store files in `src/stores/`
- Key stores: user, space, knowledge, session, event

### API Layer
- Centralized API calls in `src/apis/`
- Axios interceptors for authentication
- Error handling and request/response transformation

### Routing
- React Router with nested routes
- Protected routes for authenticated users
- Dynamic routing for spaces and content

### Styling
- Tailwind CSS for utility classes
- HeroUI components for complex UI elements
- Custom CSS for specific styling needs

### Internationalization
- i18next configuration in `src/lib/i18n.ts`
- Language files in `src/lib/i18n/[lang]/`
- Automatic language detection

### Real-time Features
- WebSocket connection management in `src/stores/socket.ts`
- Event-driven architecture for real-time updates
- Connection state management

## Environment Setup
- Node.js environment
- Vite dev server on port 5173 (default)
- Hot module replacement enabled
- TypeScript strict mode enabled

## Key Dependencies to Note
- **@heroui/react** - Main UI framework
- **@editorjs/editorjs** - Rich text editor
- **valtio** - State management
- **react-router-dom** - Client-side routing
- **axios** - HTTP requests
- **i18next** - Internationalization
- **framer-motion** - Animations
- **tailwindcss** - CSS framework