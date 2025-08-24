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
- **IMPORTANT**: For new features/pages, create separate i18n files instead of adding to global translation files:
  - Create `src/lib/i18n/[lang]/[feature-name].json` for new features
  - Add the namespace to `namespaces` array in `src/lib/i18n.ts`
  - Use `useTranslation('[feature-name]')` in components for feature-specific translations
  - Use `useTranslation()` for common/global translations like "Back", "Cancel", etc.

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

## Development Best Practices & Common Pitfalls

### React State Management & useEffect
1. **Avoid Infinite Loops in useEffect**
   - NEVER include state setters that are called within the useEffect in the dependency array
   - Separate UI state from business logic state to prevent circular dependencies
   - Example pitfall:
   ```typescript
   // ❌ BAD - Causes infinite loop
   const [loading, setLoading] = useState(false);
   useEffect(() => {
     setLoading(true); // This changes 'loading'
     // ... async operation
     setLoading(false);
   }, [loading]); // 'loading' is in dependency array - INFINITE LOOP!
   
   // ✅ GOOD - Separate states
   const [isInitialLoad, setIsInitialLoad] = useState(true); // Never changes after first load
   const [showSkeleton, setShowSkeleton] = useState(false); // UI-only state, not in dependencies
   useEffect(() => {
     setShowSkeleton(true);
     // ... async operation
     setShowSkeleton(false);
   }, [otherDependencies]); // Only external dependencies
   ```

2. **Debounce Search Inputs**
   - Always debounce search inputs to prevent excessive API calls
   - Use separate state for input value and debounced value
   ```typescript
   const [searchTerm, setSearchTerm] = useState(''); // User input
   const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(''); // Debounced value
   
   useEffect(() => {
     const timer = setTimeout(() => {
       setDebouncedSearchTerm(searchTerm);
     }, 500);
     return () => clearTimeout(timer);
   }, [searchTerm]);
   ```

### API Integration & Data Handling
1. **Handle Null/Undefined API Response Fields**
   - Always provide fallback values for potentially missing fields
   - Use optional chaining and nullish coalescing
   ```typescript
   // ❌ BAD - Can cause runtime errors
   setFormData({
     name: provider.name,
     api_key: provider.api_key, // Could be undefined
   });
   
   // ✅ GOOD - Safe handling
   setFormData({
     name: provider.name || '',
     api_key: provider.api_key || '',
     status: provider.status ?? 1,
     config: {
       timeout: provider.config?.timeout || 30000,
       ...provider.config
     }
   });
   ```

2. **Form Validation Safety**
   - Always check for null/undefined before calling string methods
   ```typescript
   // ❌ BAD - Runtime error if field is undefined
   if (!formData.name.trim()) { /* ... */ }
   
   // ✅ GOOD - Safe validation
   if (!formData.name || !formData.name.trim()) { /* ... */ }
   ```

3. **API Response Structure**
   - Project uses wrapped API responses: `{ code, message, data }`
   - Always access actual data via `response.data.data`
   - API base path `/api/v1` is set in request instance, use relative paths in API functions

### UI/UX Best Practices
1. **Loading States Strategy**
   - **Skeleton screens**: For initial page loads and search results (new data)
   - **Spinner buttons**: For individual operations (status toggle, delete)
   - **Regular loading**: For pagination and filtering (same dataset)
   ```typescript
   // Show skeleton for: first load, search operations
   // Show spinner on buttons for: CRUD operations
   // Show regular loading for: pagination, filtering
   ```

2. **HeroUI Component Accessibility**
   - DropdownItem with complex content needs `textValue` prop for screen readers
   - Select components need `aria-label` when no visible label is present
   ```typescript
   // ✅ Accessible DropdownItem
   <DropdownItem textValue="Delete" onPress={onDelete}>
     <div className="flex items-center gap-2">
       <Icon icon="delete" />
       Delete
     </div>
   </DropdownItem>
   
   // ✅ Accessible Select without label
   <Select
     placeholder="Filter by status"
     aria-label="Filter by status"
   >
   ```

3. **HeroUI Select Component TypeScript Issues**
   - **Problem**: `Type 'Element[]' is not assignable to type 'CollectionElement<object>'`
   - **Cause**: HeroUI Select component has strict typing for children, doesn't accept arrays of SelectItem directly
   - **Solution**: Wrap mapped SelectItem arrays in React Fragment
   ```typescript
   // ❌ BAD - TypeScript error
   <Select>
     <SelectItem key="all">All Items</SelectItem>
     {items.map(item => (
       <SelectItem key={item.id}>{item.name}</SelectItem>
     ))}
   </Select>
   
   // ✅ GOOD - Wrap in React Fragment
   <Select>
     <>
       <SelectItem key="all">All Items</SelectItem>
       {items.map(item => (
         <SelectItem key={item.id}>{item.name}</SelectItem>
       ))}
     </>
   </Select>
   ```
   - **Key Points**:
     - SelectItem uses `key` prop as both React key and selection value
     - Don't add `value` prop to SelectItem (not supported)
     - `selectedKeys` array should contain the `key` values
     - `onSelectionChange` returns Set of `key` values

4. **Responsive Design Considerations**
   - Always test mobile layouts for forms and complex components
   - Use conditional rendering for mobile vs desktop when needed
   - HeroUI components generally handle responsive design well, but custom layouts need attention

### Time & Date Handling
1. **Unix Timestamps from API**
   - Backend returns seconds-based Unix timestamps
   - JavaScript Date expects milliseconds - multiply by 1000
   ```typescript
   // ✅ Correct timestamp handling
   const formatDate = (timestamp: number) => {
     if (!timestamp) return '-';
     const date = new Date(timestamp * 1000); // Convert seconds to milliseconds
     return date.toLocaleDateString();
   };
   ```

### Internationalization (i18n)
1. **Feature-Specific Translations**
   - Create separate translation files for each major feature
   - Add namespace to `src/lib/i18n.ts` namespaces array
   - Use `useTranslation('feature-name')` for feature-specific translations

2. **Async Translation Loading Issues**
   - Ensure proper async loading in `loadResources` function
   - Use `Promise.all()` instead of `forEach` for parallel loading
   ```typescript
   // ✅ Correct async loading
   await Promise.all(
     namespaces.map(async (namespace) => {
       // Load translation files
     })
   );
   ```

### Error Handling
1. **User Feedback**
   - Use `toast` from 'sonner' for user notifications
   - Provide specific error messages for different failure scenarios
   - Always handle both network errors and business logic errors

2. **Graceful Degradation**
   - Provide fallback UI states for empty data
   - Handle missing/corrupted data gracefully
   - Show appropriate empty states with actionable next steps