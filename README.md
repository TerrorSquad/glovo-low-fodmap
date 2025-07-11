# Glovo FODMAP Helper

Chrome ekstenzija za označavanje FODMAP statusa proizvoda na Glovo aplikaciji.

## Funkcionalnosti

- Prikazuje FODMAP status proizvoda na Glovo sajtu.
- Sinhronizuje podatke sa eksternim API-jem.
- Omogućava ručnu sinhronizaciju iz popup-a.

## Struktura projekta

- `src/` - Izvorni TypeScript kod ekstenzije
- `manifest.json` - Chrome manifest
- `popup.css` - Stilovi za popup
- `background.ts` - Pozadinska skripta ([src/background.ts](src/background.ts))
- `content.ts` - Content skripta ([src/content.ts](src/content.ts))
- `injector.ts` - Injektor za presretanje podataka ([src/injector.ts](src/injector.ts))
- `db.ts` - Dexie baza ([src/db.ts](src/db.ts))

## Build i razvoj

Pokrenite sledeće komande:

```sh
pnpm install
pnpm run build
```

Za razvoj:

```sh
pnpm run dev
```

## Učitavanje ekstenzije u Chrome

1. Izvršite build (`pnpm run build`).
2. Otvorite `chrome://extensions/`.
3. Uključite "Developer mode".
4. Kliknite "Load unpacked" i izaberite `dist/` folder.

## Podešavanje API endpointa

API endpoint se podešava u [`src/background.ts`](src/background.ts):

```typescript
const API_ENDPOINT = 'https://tvoj-
