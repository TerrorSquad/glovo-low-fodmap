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
├── content.ts          # Glavna content skripta - inicijalizuje aplikaciju
├── FodmapHelper.ts     # Glavna klasa koja orchestrira funkcionalnost
├── StyleManager.ts     # Upravljanje CSS stilovima i vizuelnim indikatorima
├── ProductManager.ts   # Operacije sa bazom podataka (Dexie)
├── CardManager.ts      # DOM operacije na karticama proizvoda
├── MessageHandler.ts   # Chrome extension messaging
├── StorageManager.ts   # Chrome storage operacije
├── types.ts           # TypeScript tipovi i interfejsi
├── background.ts      # Background skripta
├── popup.ts          # Popup skripta
└── db.ts             # Dexie baza definicija
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

### Modularni pristup

Aplikacija je refaktorisana u modularne klase za bolju održivost:

- **FodmapHelper**: Glavna klasa koja koordiniše sve komponente
- **StyleManager**: Statičke metode za CSS injection i styling
- **ProductManager**: Statičke metode za operacije sa bazom
- **CardManager**: DOM manipulacija kartica proizvoda
- **MessageHandler**: Centralizovano rukovanje Chrome porukama
- **StorageManager**: Chrome storage wrapper

### Tipovi

Svi tipovi su izdvojeni u `types.ts` za lakše održavanje i type safety.

### Event Flow

1. Injected script hvata proizvode sa stranice
2. Content script prima podatke preko `window.postMessage`
3. ProductManager čuva nove proizvode u bazu
4. Background script poziva API za pending proizvode
5. API vraća FODMAP statuse
6. ProductManager ažurira statuse u bazi
7. CardManager aplicira vizuelne stilove

## Development

### Dodavanje novih funkcionalnosti

1. Dodajte tipove u `types.ts` ako je potrebno
2. Implementirajte logiku u odgovarajućem manager-u
3. Ažurirajte `FodmapHelper` da koristi novu funkcionalnost

### Debugging

Source maps su omogućeni u development build-u za lakše debugovanje.

### Testing

```bash
# Pokretanje linter-a
pnpm run lint

# Type checking
pnpm run type-check
```
