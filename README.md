# Glovo FODMAP Helper

A modern Chrome extension for displaying the FODMAP status of products on the Glovo application, built with WXT, Vue.js, and TypeScript.

## Features

- **Automatic Labeling**: Displays the FODMAP status (`LOW`, `HIGH`, `MODERATE`, `UNKNOWN`) directly on the Glovo website.
- **Visual Indicators**: Clear badges with icons and colors for each status.
- **Dynamic Tooltips**: Provides additional information about the status, including explanations from the API, on hover.
- **Filtering**: Option to hide products that are not LOW FODMAP, as well as those that are not food items.
- **API Synchronization**: Uses a "submit-and-poll" pattern to send new products to an external API and periodically fetch updated statuses,.
- **Local Database**: Efficiently stores product data in a local IndexedDB using Dexie.js.
- **Advanced Settings**: The popup interface allows for adjusting dark mode and tooltip font size.
- **Diagnostics**: Built-in debugging tools available in the popup for the development environment.

## Tech Stack
- Framework: [WXT (Web Extension Toolkit)](https://wxt.dev/)
- UI: [Vue.js](https://vuejs.org/)
- Language: [TypeScript](https://www.typescriptlang.org/)
- Styling: [TailwindCSS](https://tailwindcss.com/)
- Local Database: [Dexie.js (Wrapper for IndexedDB)](https://dexie.org/)
- Linting & Formatting: [Biome](https://biomejs.dev/)

## Project Structure
The project uses a modular architecture recommended by WXT, with a clear separation into entrypoints and utils.
- **src/entrypoints**: Contains the main entry points for the extension, such as content scripts, background scripts, and popup.
- **src/utils**: Contains utility functions and classes for handling common tasks like API requests, database operations, and DOM manipulation.
- **src/types**: Contains TypeScript types and interfaces used

## Installation and Development

### Required Tools
- Volta - tool for managing Node.js versions and packages.
- Node.js (version 22) - defined in `package.json` under `volta.node` key.
- pnpm - package manager for Node.js projects.

### Setup

```bash
# Clone the repository
git clone https://github.com/TerrorSquad/glovo-low-fodmap.git
cd glovo-low-fodmap

# Install dependencies
pnpm install

# Run the development server (with hot-reloading)
pnpm run dev

# Build for production
pnpm run build:prod
```

## Loading the Extension in Chrome
1. Run pnpm run build or pnpm run dev.
2. Open chrome://extensions/.
3. Enable "Developer mode".
4. Click "Load unpacked" and select the .output/chrome-mv3 folder.

## Configuration

### API Endpoint

The API endpoint is configured by creating a `.env` file in the project root:

```bash
VITE_API_ENDPOINT=https://your-api.com/classify
```

You can access this variable in your code using:

```typescript
const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT
```

### Build configuration

- **WXT**: wxt.config.ts - The main configuration file for the extension.
- **TypeScript**: tsconfig.json - Options for the TypeScript compiler.
- **Manifest**: Automatically generated from wxt.config.ts.

## Architecture

###  Data Flow
- **Interception** (`injector.content`): The `ApiInterceptor` intercepts `fetch/XHR` calls from the Glovo site. The `ProductExtractor` extracts clean product data from the JSON response.
- **Data Transfer** (`injector -> content`): The injector sends the product list to the content script via window.postMessage [cite: file-ProductExtractor.ts].
# Glovo FODMAP Helper

A modern Chrome extension for displaying the FODMAP status of products on the Glovo application, built with WXT, Vue.js, and TypeScript.

## Features

- **Automatic Labeling**: Displays the FODMAP status (`LOW`, `HIGH`, `MODERATE`, `UNKNOWN`) directly on the Glovo website.
- **Visual Indicators**: Clear badges with icons and colors for each status.
- **Dynamic Tooltips**: Provides additional information about the status, including explanations from the API, on hover.
- **Filtering**: Option to hide products that are not LOW FODMAP, as well as those that are not food items.
- **API Synchronization**: Uses a "submit-and-poll" pattern to send new products to an external API and periodically fetch updated statuses,.
- **Local Database**: Efficiently stores product data in a local IndexedDB using Dexie.js.
- **Advanced Settings**: The popup interface allows for adjusting dark mode and tooltip font size.
- **Diagnostics**: Built-in debugging tools available in the popup for the development environment.

## Tech Stack
- Framework: [WXT (Web Extension Toolkit)](https://wxt.dev/)
- UI: [Vue.js](https://vuejs.org/)
- Language: [TypeScript](https://www.typescriptlang.org/)
- Styling: [TailwindCSS](https://tailwindcss.com/)
- Local Database: [Dexie.js (Wrapper for IndexedDB)](https://dexie.org/)
- Linting & Formatting: [Biome](https://biomejs.dev/)

## Project Structure
The project uses a modular architecture recommended by WXT, with a clear separation into entrypoints and utils.
- **src/entrypoints**: Contains the main entry points for the extension, such as content scripts, background scripts, and popup.
- **src/utils**: Contains utility functions and classes for handling common tasks like API requests, database operations, and DOM manipulation.
- **src/types**: Contains TypeScript types and interfaces used

## Installation and Development

### Required Tools
- Volta - tool for managing Node.js versions and packages.
- Node.js (version 22) - defined in `package.json` under `volta.node` key.
- pnpm - package manager for Node.js projects.

### Setup

```bash
# Clone the repository
git clone https://github.com/TerrorSquad/glovo-low-fodmap.git
cd glovo-low-fodmap

# Install dependencies
pnpm install

# Chrome: Run the development server (with hot-reloading)
pnpm run dev
# Chrome: Production build in development mode
pnpm run build
# Chrome: Build for production
pnpm run build:prod
# Chrome: Create a zip file for distribution
pnpm run zip

# Firefox: Run the development server (with hot-reloading)
pnpm run dev:firefox
# Firefox: Production build in development mode
pnpm run build:firefox
# Firefox: Build for production
pnpm run build:prod:firefox
# Firefox: Create a zip file for distribution
pnpm run zip:firefox

# Run TypeScript compiler
pnpm run compile
```

## Loading the Extension in Chrome
1. Run `pnpm run build` or `pnpm run dev`.
2. Open `chrome://extensions/`.
3. Enable "Developer mode".
4. Click "Load unpacked" and select the `dist/chrome-mv3` folder.

## Configuration

### API Endpoint

The API endpoint is configured by creating a `.env` file in the project root:

```bash
VITE_API_ENDPOINT=https://your-api.com/
```

You can access this variable in your code using:

```typescript
const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT
```

### Build configuration

- **WXT**: `wxt.config.ts` - The main configuration file for the extension.
- **TypeScript**: `tsconfig.json` - Options for the TypeScript compiler.
- **Manifest**: Automatically generated from `wxt.config.ts`.

## Architecture

###  Data Flow
- **Interception** (`injector.content`): The `ApiInterceptor` intercepts `fetch/XHR` calls from the Glovo site. The `ProductExtractor` extracts clean product data from the JSON response.
- **Data Transfer** (`injector -> content`): The injector sends the product list to the `content` script via `window.postMessage`.
- **Database Write** (`content`): The `FodmapHelper` receives the data. The `ProductManager` checks for new products and writes them to the IndexedDB with a PENDING status.
- **Signal to Background** (`content -> background`): The content script sends a newProductsFound message to the background script.
- **Synchronization** (`background`): The `SyncOrchestrator` receives the signal and calls the `FodmapApiClient`, which sends the PENDING products to the Laravel API.
- **Status Update** (`background -> content`): After receiving a response from the API, the background script sends an updateStatuses message with the new data back to the content script.
- **Display on Page** (`content`): The `ProductManager` updates the statuses in the local database. The `CardManager` and `StyleManager` then apply the appropriate styles (badges, highlights) to the products on the page.

### Architectural Advantages
- ✅ Single Responsibility Principle: Each class has one, clearly defined responsibility.
- ✅ Separation of Concerns: UI, logic, database, and network communication are completely separate.
- ✅ Testability: Each component can be tested independently, as demonstrated by `ExtensionTester.ts`.
- ✅ Maintainability: The structure allows for easy addition of new features and debugging.
- ✅ Type Safety: The entire project is written in TypeScript with strict rules.
