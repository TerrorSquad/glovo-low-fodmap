# Glovo FODMAP Helper

Chrome ekstenzija za označavanje FODMAP statusa proizvoda na Glovo aplikaciji.

## Funkcionalnosti

- **Automatsko označavanje**: Prikazuje FODMAP status proizvoda (nizak/visok) direktno na Glovo sajtu
- **Vizuelni indikatori**: Zeleni badge za proizvode sa niskim FODMAP-om, crveni za visoke
- **Filtriranje**: Opcija sakrivanja proizvoda koji nisu low-FODMAP
- **Sinhronizacija**: Automatska sinhronizacija sa eksternim API-jem za ažuriranje statusa
- **Lokalna baza**: Čuva podatke o proizvodima u lokalnoj IndexedDB bazi

## Struktura projekta

```
src/
├── content.ts              # Entry point - inicijalizuje FodmapHelper
├── injector.ts             # Entry point - inicijalizuje ApiInterceptor
├── main.ts                 # Entry point - inicijalizuje PopupController
├── background.ts           # Entry point - inicijalizuje background services
│
├── types.ts                # Zajedničke TypeScript tipove i interfejse
├── types/
│   └── glovo.ts           # Glovo API tipovi i interfejsi
│
├── db.ts                   # Dexie baza definicija
│
# Content Script Components
├── FodmapHelper.ts         # Glavna klasa koja orchestrira funkcionalnost
├── StyleManager.ts         # CSS injection i vizuelni indikatori
├── ProductManager.ts       # Operacije sa bazom podataka (Dexie)
├── CardManager.ts          # DOM operacije na karticama proizvoda
├── MessageHandler.ts       # Chrome extension messaging za content
├── StorageManager.ts       # Chrome storage operacije
│
# Background Script Components
├── SyncOrchestrator.ts     # Orchestrira background sync proces
├── BackgroundMessageHandler.ts  # Chrome messaging za background
├── ContentMessenger.ts     # Komunikacija sa content skriptama
├── FodmapApiClient.ts      # API klijent za FODMAP klasifikaciju
├── BackgroundLogger.ts     # Logger koji prosleđuje poruke content skripti
│
# Injector Components
├── ApiInterceptor.ts       # Presretanje fetch/XHR zahteva
├── ProductExtractor.ts     # Ekstraktovanje proizvoda iz API odgovora
│
# Popup Components
└── PopupController.ts      # Popup UI kontroler
```

## Instalacija i razvoj

### Potrebni alati
- Node.js (verzija 18+)
- pnpm

### Setup

```bash
# Kloniraj repo
git clone <repo-url>
cd glovo-fodmap-helper

# Instaliraj dependencies
pnpm install

# Build za development
pnpm run dev

# Build za production
pnpm run build
```

## Učitavanje ekstenzije u Chrome

1. Izvršite build (`pnpm run build`)
2. Otvorite `chrome://extensions/`
3. Uključite "Developer mode" 
4. Kliknite "Load unpacked" i izaberite `dist/` folder

## Konfiguracija

### API Endpoint

API endpoint se podešava u `src/background.ts`:

```typescript
const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT
```

Ili dodajte `.env` fajl:

```
VITE_API_ENDPOINT=https://your-api.com/classify
```

### Build konfiguracija

- **Vite**: `vite.config.ts` - bundler konfiguracija
- **TypeScript**: `tsconfig.json` - TypeScript compiler opcije
- **Manifest**: `manifest.json` - Chrome extension manifest

## Arhitektura

### Kompletno modularni pristup

Aplikacija je potpuno refaktorisana u modularne komponente za maksimalnu održivost:

#### Content Script Komponente
- **FodmapHelper**: Glavna klasa koja koordiniše sve content script komponente
- **StyleManager**: Statičke metode za CSS injection i styling
- **ProductManager**: Statičke metode za operacije sa Dexie bazom
- **CardManager**: DOM manipulacija kartica proizvoda  
- **MessageHandler**: Centralizovano rukovanje Chrome porukama
- **StorageManager**: Chrome storage wrapper metode

#### Background Script Komponente  
- **SyncOrchestrator**: Koordiniše celokupan sync proces
- **BackgroundMessageHandler**: Rukuje Chrome runtime porukama
- **ContentMessenger**: Komunikacija sa content skriptama
- **FodmapApiClient**: HTTP klijent za FODMAP API
- **BackgroundLogger**: Logger koji prosleđuje poruke content skripti

#### Injector Komponente
- **ApiInterceptor**: Presretanje fetch/XHR zahteva na Glovo stranici
- **ProductExtractor**: Ekstraktovanje proizvoda iz API odgovora

#### Popup Komponente
- **PopupController**: Kompletan UI kontroler za popup

### Tipovi i interfejsi

- **types.ts**: Zajedničke tipove kroz celu aplikaciju
- **types/glovo.ts**: Specifične Glovo API tipove i interfejse

### Event Flow sa modularnim komponentama

1. **ApiInterceptor** presreće Glovo API pozive
2. **ProductExtractor** ekstraktuje proizvode iz odgovora  
3. **FodmapHelper** prima podatke preko `window.postMessage`
4. **ProductManager** čuva nove proizvode u Dexie bazu
5. **BackgroundMessageHandler** prima notifikaciju o novim proizvodima
6. **SyncOrchestrator** koordiniše API poziv preko **FodmapApiClient**-a
7. **ContentMessenger** šalje rezultate nazad content skripti
8. **ProductManager** ažurira statuse u bazi
9. **CardManager** aplicira vizuelne stilove preko **StyleManager**-a

## Development

### Dodavanje novih funkcionalnosti

#### Content Script funkcionalnosti:
1. Dodajte tipove u `types.ts` ako je potrebno
2. Implementirajte logiku u odgovarajućem manager-u:
   - **UI/Styling** → `StyleManager.ts` ili `CardManager.ts`
   - **Baza podataka** → `ProductManager.ts`
   - **Chrome poruke** → `MessageHandler.ts`
   - **Storage** → `StorageManager.ts`
3. Ažurirajte `FodmapHelper.ts` da koristi novu funkcionalnost

#### Background Script funkcionalnosti:
1. **API komunikacija** → `FodmapApiClient.ts`
2. **Sync logika** → `SyncOrchestrator.ts`  
3. **Chrome poruke** → `BackgroundMessageHandler.ts`
4. **Content komunikacija** → `ContentMessenger.ts`

#### Injector funkcionalnosti:
1. **API presretanje** → `ApiInterceptor.ts`
2. **Ekstraktovanje podataka** → `ProductExtractor.ts`

#### Popup funkcionalnosti:
1. **UI kontrola** → `PopupController.ts`

### Debugging

Source maps su omogućeni u development build-u za lakše debugovanje svih komponenti.

### Testing

```bash
# Pokretanje linter-a
pnpm run lint

# Type checking  
pnpm run type-check

# Build test
pnpm run build
```

### Prednosti nove arhitekture

- ✅ **Single Responsibility Principle**: Svaka klasa ima jednu odgovornost
- ✅ **Separation of Concerns**: UI, logika, storage i komunikacija su razdvojeni
- ✅ **Testability**: Svaka komponenta može biti nezavisno testirana
- ✅ **Maintainability**: Lakše dodavanje novih funkcionalnosti
- ✅ **Type Safety**: Kompletna TypeScript podrška
- ✅ **Code Reusability**: Zajedničke komponente mogu biti ponovo korišćene
- ✅ **Error Isolation**: Greške u jednoj komponenti ne utiču na druge
