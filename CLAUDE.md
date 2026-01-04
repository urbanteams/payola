# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. It uses Claude AI to generate React components based on user prompts, displays them in a live preview using a virtual file system, and allows users to iterate on components through conversation.

## Commands

### Development
```bash
npm run dev          # Start Next.js dev server with Turbopack
npm run dev:daemon   # Start dev server in background, logs to logs.txt
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run Vitest tests
```

### Database
```bash
npm run setup        # Install deps + generate Prisma client + run migrations
npm run db:reset     # Reset database (destructive)
npx prisma generate  # Regenerate Prisma client
npx prisma migrate dev  # Create and run new migrations
```

### Testing
```bash
npm test                           # Run all tests
npm test -- --watch                # Run tests in watch mode
npm test -- src/path/to/test.tsx   # Run specific test file
```

## Architecture

### Core Concept: Virtual File System + AI Tools

The application's unique architecture revolves around:
- **Virtual File System (VFS)**: Files are not written to disk. Everything exists in memory via `VirtualFileSystem` class (src/lib/file-system.ts)
- **AI Tool Integration**: Claude AI has two tools (`str_replace_editor` and `file_manager`) that operate on the VFS
- **Live Preview**: JSX/TSX files in VFS are transformed via Babel and rendered in an iframe using import maps

### Request Flow

1. **User sends chat message** → ChatInterface component
2. **POST /api/chat** → Chat route handler (src/app/api/chat/route.ts)
   - Reconstructs VFS from serialized file nodes
   - Calls Vercel AI SDK `streamText()` with Claude model
   - AI has access to two tools that modify VFS
3. **AI makes tool calls** to create/edit files in VFS
4. **Tool results streamed back** to client
5. **FileSystemContext** handles tool calls on client side, updates VFS
6. **PreviewFrame** re-renders when VFS changes
7. **On completion**, chat messages and VFS state saved to database (for authenticated users)

### Virtual File System Details

- **Location**: src/lib/file-system.ts
- **Key methods**:
  - `createFile(path, content)`: Create file with auto parent directory creation
  - `updateFile(path, content)`: Update file content
  - `deleteFile(path)`: Delete file or directory recursively
  - `rename(oldPath, newPath)`: Move/rename with path updates
  - `serialize()`: Export to JSON for database storage
  - `deserializeFromNodes()`: Reconstruct from JSON
- **Context**: FileSystemContext (src/lib/contexts/file-system-context.tsx) wraps VFS for React components
- **Critical**: VFS is serialized and sent with every AI request in the `body.files` parameter

### AI Tools

Both tools are defined in src/lib/tools/:

1. **str_replace_editor** (str-replace.ts)
   - Commands: `view`, `create`, `str_replace`, `insert`
   - Primary tool for file manipulation
   - Mirrors behavior of text editor commands

2. **file_manager** (file-manager.ts)
   - Commands: `rename`, `delete`
   - Used for file operations beyond editing

### Preview System

**Transformation Pipeline** (src/lib/transform/jsx-transformer.ts):
1. **transformJSX()**: Uses @babel/standalone to transform JSX/TSX to JS
2. **createImportMap()**:
   - Transforms all files to blobs
   - Creates import map with blob URLs
   - Maps `@/` alias to root directory
   - Adds external deps via esm.sh (e.g., `react: "https://esm.sh/react@19"`)
   - Collects CSS imports and inlines them
3. **createPreviewHTML()**: Generates full HTML document with:
   - Tailwind CSS CDN
   - Import map script tag
   - Module script that loads entry point (usually /App.jsx)
   - Error boundary for runtime errors

**Preview Component** (src/components/preview/PreviewFrame.tsx):
- Watches VFS via `refreshTrigger` from FileSystemContext
- Looks for entry point: /App.jsx, /App.tsx, /index.jsx, etc.
- Renders iframe with `srcdoc` containing preview HTML
- Sandbox attribute: `allow-scripts allow-same-origin allow-forms`

### Authentication & Persistence

- **Auth**: JWT-based auth using jose library (src/lib/auth.ts)
- **Session**: Cookie-based, uses bcrypt for password hashing
- **Database**: SQLite via Prisma
  - Users can sign up or continue anonymously
  - Projects are saved for authenticated users only
  - Anonymous work tracked in localStorage via anon-work-tracker.ts
- **Models** (prisma/schema.prisma):
  - `User`: id, email, password, timestamps
  - `Project`: id, name, userId (nullable), messages (JSON), data (JSON - serialized VFS), timestamps

### State Management

Two primary React contexts:

1. **FileSystemContext** (src/lib/contexts/file-system-context.tsx)
   - Owns VirtualFileSystem instance
   - Manages selected file for code editor
   - Handles tool calls from AI
   - Provides refresh mechanism via `refreshTrigger`

2. **ChatContext** (src/lib/contexts/chat-context.tsx)
   - Wraps Vercel AI SDK's `useChat` hook
   - Sends VFS state with every message
   - Delegates tool calls to FileSystemContext
   - Tracks anonymous work

### Mock Provider

When `ANTHROPIC_API_KEY` is not set, a MockLanguageModel is used (src/lib/provider.ts):
- Returns static component templates (Counter, ContactForm, Card)
- Simulates tool calls in steps
- Limited to 4 steps vs 40 for real API
- Useful for development without API costs

## Path Alias

The project uses `@/` as an alias for `./src/`:
- Configured in tsconfig.json: `"@/*": ["./src/*"]`
- Supported in imports throughout the codebase
- The preview system resolves `@/` imports to root paths in the VFS

## Testing Strategy

- **Framework**: Vitest with React Testing Library
- **Config**: vitest.config.mts
- **Location**: Tests co-located with code in `__tests__/` directories
- **Coverage**: Focus on contexts, transformers, and complex components
- Key test files:
  - src/lib/contexts/__tests__/*.test.tsx
  - src/lib/transform/__tests__/*.test.ts
  - src/components/chat/__tests__/*.test.tsx

## Important Constraints

1. **No real file system**: All file operations must go through VirtualFileSystem
2. **Import map limitations**: All imports must be resolvable via the import map or esm.sh
3. **Babel in browser**: Transformation happens client-side, so syntax errors appear in preview
4. **VFS serialization**: Every AI request sends entire VFS, so large codebases can hit size limits
5. **Entry point convention**: Preview looks for /App.jsx or /index.jsx - components must export default

## Key Files to Understand

- **src/app/api/chat/route.ts**: AI integration point, handles streaming responses
- **src/lib/file-system.ts**: Core VFS implementation
- **src/lib/transform/jsx-transformer.ts**: JSX transformation and import map generation
- **src/lib/contexts/file-system-context.tsx**: React integration of VFS
- **src/lib/contexts/chat-context.tsx**: Chat state and AI communication
- **src/components/preview/PreviewFrame.tsx**: Live preview rendering

## Prompt Engineering

The system prompt is in src/lib/prompts/generation.tsx. It instructs the AI to:
- Use the provided tools to create/edit files
- Create React components with Tailwind CSS
- Always create an App.jsx entry point
- Use proper component structure and exports
