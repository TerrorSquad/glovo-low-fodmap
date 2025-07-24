# TypeScript Import/Export Policy

Always use ES module `import`/`export` syntax for all TypeScript code. Never use `require(...)` in this project.
# Automated Core Refactor Policy

For core migrations or refactors (such as changing product identification from `externalId` to `hash`), Copilot should automatically update all related files across the codebase without repeatedly asking for user confirmation. Assume that all affected files and logic must be updated for consistency and reliability. Only request confirmation for ambiguous, destructive, or non-obvious changes.
# GitHub Copilot Instructions for Glovo FODMAP Helper Extension

## Project Overview
This is a Chrome Extension (Manifest v3) that helps users identify FODMAP-friendly products on Glovo's food delivery platform. The extension intercepts product data, classifies it using AI, stores results locally, and provides UI controls to filter products by FODMAP status.

## Core Architecture Patterns

### 1. **Manager Pattern** - Primary Design Pattern
- **Purpose**: Single responsibility principle with clear separation of concerns
- **Location**: All managers in `src/*/` directories
- **Key Managers**:
  - `ProductManager`: FODMAP status classification and product management
  - `StorageManager`: IndexedDB operations via Dexie
  - `CardManager`: DOM manipulation for product cards
  - `DomProductScanner`: Product discovery from DOM
  - `PopupController`: Popup UI state management
  - `SyncOrchestrator`: Background sync coordination

### 2. **Message Passing Architecture**
- **Communication**: Chrome runtime messaging between scripts
- **Pattern**: `MessageHandler` classes in each context (content/background/popup)
- **Message Format**: `ChromeMessage` interface with `action` and `payload/data`
- **Async Handling**: Always return `true` from message handlers for async responses


## Build System & Development

### Package Manager: `pnpm`
```bash
# Install dependencies
pnpm install

# Development build with hot reload
pnpm dev

# Production build
pnpm build

# Linting/formatting (Biome)
pnpm lint
pnpm format
```

### Build Configuration
- **Bundler**: Vite with `@crxjs/vite-plugin`
- **TypeScript**: Strict mode enabled
- **CSS**: Tailwind CSS with dark mode support
- **Linting**: Biome (replaces ESLint + Prettier)
- **Git Hooks**: Husky for pre-commit validation

### Extension Structure
```
src/
├── background.ts        # Service worker entry point
├── content.ts          # Content script entry point  
├── popup.ts           # Popup script entry point
├── content/           # Content script modules
├── background/        # Background script modules
├── popup/            # Popup UI modules
├── injector/         # Page injection modules
└── shared/           # Common utilities
```

## Development Guidelines

### 1. **Chrome Extension Specifics**
- **Manifest**: V3 with service worker background
- **Permissions**: Active tab, storage, host permissions for Glovo domains
- **CSP**: No inline scripts, use external files
- **Storage**: IndexedDB (Dexie) for products, chrome.storage for settings

### 2. **TypeScript Conventions**
- **Interfaces**: Use `I` prefix for behavior contracts (e.g., `IFodmapHelper`)
- **Types**: Centralized in `src/shared/types.ts`
- **Exports**: Explicit named exports, avoid default exports
- **Async**: Always use async/await, never Promises directly

### 3. **State Management**
- **Settings**: Chrome storage sync for cross-device persistence
- **Products**: IndexedDB for large datasets
- **UI State**: Local component state in managers
- **Dark Mode**: CSS variables with `dark:` Tailwind classes

### 4. **Error Handling**
- **Logging**: `DiagnosticUtils.log()` with levels (log/info/warn/error)
- **Recovery**: Implement graceful degradation for API failures
- **User Feedback**: Always show status in popup for long operations

## Key Configuration

### Environment Configuration
- **File**: `src/shared/Config.ts`
- **API Endpoints**: Centralized URL management
- **Feature Flags**: Debug modes, performance monitoring
- **Environment**: Development vs production settings

### Chrome Extension Manifest
- **Permissions**: Minimal required permissions
- **Host Permissions**: Glovo domains only
- **Content Scripts**: Injected into Glovo product pages
- **Background**: Service worker with message handling

## Common Patterns & Conventions

### 1. **Manager Initialization**
```typescript
// Always follow this pattern for managers
export class ExampleManager {
  private static instance?: ExampleManager
  
  private constructor() {
    // Initialize resources
  }
  
  static getInstance(): ExampleManager {
    if (!this.instance) {
      this.instance = new ExampleManager()
    }
    return this.instance
  }
}
```

### 2. **Message Handling**
```typescript
// Message handler pattern
handleMessage = (
  message: ChromeMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void,
): boolean => {
  return PerformanceMonitor.measure('handleMessage', () => {
    switch (message.action) {
      case 'actionName':
        this.handleAction(message.payload, sendResponse)
        return true // For async response
      default:
        return false
    }
  })
}
```


### 4. **Storage Operations**
```typescript
// Always use StorageManager for IndexedDB
const products = await StorageManager.getInstance().getAllProducts()
await StorageManager.getInstance().saveProduct(product)

// Use chrome.storage for simple settings
await chrome.storage.sync.set({ hideNonLowFodmap: true })
const settings = await chrome.storage.sync.get(['hideNonLowFodmap'])
```

## Testing & Debugging

### Debug Tools in Popup
- **Health Check**: Verify all systems operational
- **Diagnostics**: Export system information
- **Export Data**: Download IndexedDB contents
- **Clear Data**: Reset extension state

### Development Debugging
- **Console Logs**: Use `DiagnosticUtils.log()` instead of `console.log`
- **Performance**: `PerformanceMonitor.measure()` for timing critical operations
- **Error Tracking**: All errors logged with context via `ErrorHandler`

### Chrome DevTools
- **Service Worker**: Background script debugging in chrome://extensions
- **Content Script**: Available in page DevTools
- **Popup**: Right-click popup → Inspect

## Critical Implementation Details

### 1. **FODMAP Classification**
- **AI Integration**: External API using submit-and-poll pattern
- **Endpoints**: `/products/submit` for submission, `/products/status` for polling
- **Response Format**: Status endpoint returns `{results: [], found: number, missing: number, missing_ids: []}`
- **Workflow**: Submit unknown products → mark as pending → poll for completed classifications
- **Fallback**: Local JSON files for common products
- **Caching**: IndexedDB storage prevents re-classification
- **Status Types**: `LOW`, `HIGH`, `UNKNOWN`, `PENDING` (enum in `db.ts`)

### 2. **Product Detection**
- **DOM Scanning**: `DomProductScanner` finds product elements
- **API Interception**: `ApiInterceptor` captures AJAX responses
- **Real-time**: MutationObserver for dynamic content updates
- **Debouncing**: Prevent excessive processing during scrolling

### 3. **UI Integration**
- **Card Modification**: Visual indicators on product cards
- **Hiding Logic**: CSS display manipulation
- **Toggle Control**: Real-time hiding/showing via popup
- **Dark Mode**: Synchronized across all extension contexts

### 4. **Performance Considerations**
- **Lazy Loading**: Managers initialized only when needed
- **Debouncing**: DOM updates debounced to prevent UI thrashing
- **Memory Management**: Clean up observers and intervals
- **Background Sync**: Throttled to prevent excessive API calls

## File Naming & Organization

### Naming Conventions
- **Classes**: PascalCase with descriptive names (`ProductManager`)
- **Files**: Match class names exactly
- **Interfaces**: `I` prefix for behavior contracts
- **Types**: Descriptive, centralized in `types.ts`
- **Constants**: UPPER_SNAKE_CASE in `Config.ts`

### Directory Structure
- **Shared**: Common utilities, types, configurations
- **Context-Specific**: Separate directories for each extension context
- **Related Grouping**: Keep related functionality together
- **Single Responsibility**: One primary class per file

## Integration Points

### External Dependencies
- **Dexie**: IndexedDB wrapper for product storage
- **Tailwind CSS**: Utility-first CSS framework
- **Chrome APIs**: Runtime, storage, tabs, scripting
- **Biome**: Linting and formatting tool

### API Integrations
- **FODMAP Classification**: External AI service
- **Glovo**: DOM integration with their web app
- **Chrome Storage**: Settings persistence
- **IndexedDB**: Product data persistence

This extension follows modern Chrome extension development practices with TypeScript, proper error handling, and clean architecture patterns. Always prioritize user privacy, performance, and reliable functionality.
