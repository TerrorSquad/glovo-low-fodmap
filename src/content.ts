import { db, type FodmapStatus, type Product } from './db'

const injectCss = (): void => {
  const styleId = 'fodmap-helper-styles'
  if (document.getElementById(styleId)) return
  const css = `
    .fodmap-low-highlight { box-shadow: 0 0 7px 2px rgba(76, 175, 80, 0.55); border-radius: 16px; }
    .fodmap-badge { position: absolute; top: 5px; right: 5px; width: 22px; height: 22px; background-color: #28a745; border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 10; border: 1px solid white; cursor: help; }
    .fodmap-badge svg { width: 12px; height: 12px; fill: white; }
    .fodmap-badge-high { background-color: #dc3545 !important; }
  `
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = css
  document.head.appendChild(style)
}

async function handleIncomingProducts(products: Product[]): Promise<void> {
  const incomingProducts: Product[] = products.map((p) => ({
    name: p.name,
    externalId: p.externalId,
    price: p.price,
    category: p.category || '',
    status: 'PENDING',
  }))

  const incomingIds = incomingProducts.map((p) => p.externalId)

  try {
    // Započinjemo transakciju za čitanje i pisanje u 'products' tabelu
    await db.transaction('rw', db.products, async () => {
      // 1. Unutar transakcije, čitamo koji proizvodi već postoje
      const existingProducts = await db.products
        .where('externalId')
        .anyOf(incomingIds)
        .toArray()
      const existingIds = new Set(existingProducts.map((p) => p.externalId))

      // 2. Filtriramo samo one koji zaista ne postoje
      const newProductsToDb = incomingProducts.filter(
        (p) => !existingIds.has(p.externalId),
      )

      if (newProductsToDb.length > 0) {
        // 3. Dodajemo samo nove proizvode. Ovo je sada bezbedno.
        await db.products.bulkAdd(newProductsToDb)
        console.log(
          `[Content] Uspešno dodato ${newProductsToDb.length} novih proizvoda u bazu.`,
        )

        // Javljamo pozadinskoj skripti da ima posla
        chrome.runtime.sendMessage({ action: 'newProductsFound' })
      }
    })
  } catch (error) {
    // Dexie će automatski uhvatiti greške poput ConstraintError unutar transakcije
    console.error('[Content] Greška unutar Dexie transakcije:', error)
  }
}

function applyStylingToCard(card: HTMLElement, status: FodmapStatus) {
  if (card.dataset.fodmapStatus === status) return // Optimizacija

  // Reset
  card.classList.remove('fodmap-low-highlight')
  card.querySelector('.fodmap-badge')?.remove()
  card.style.position = 'relative'

  if (status === 'UNKNOWN' || status === 'PENDING') return

  const badge = document.createElement('div')
  badge.className = 'fodmap-badge'

  if (status === 'LOW') {
    card.classList.add('fodmap-low-highlight')
    badge.title = 'Low-FODMAP'
    badge.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z"/></svg>`
  } else if (status === 'HIGH') {
    badge.classList.add('fodmap-badge-high')
    badge.title = 'High-FODMAP'
    badge.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M24 20.188l-8.315-8.209 8.2-8.282-3.697-3.697-8.212 8.318-8.31-8.203-3.666 3.666 8.321 8.24-8.206 8.313 3.666 3.666 8.237-8.318 8.285 8.203z"/></svg>`
  }

  card.appendChild(badge)
  card.dataset.fodmapStatus = status
}

async function renderAllVisibleCards() {
  const allCards = document.querySelectorAll<HTMLElement>(
    'section[type="PRODUCT_TILE"]',
  )
  const productNames = Array.from(allCards).map((card) =>
    card.innerText.split('\n')[0].trim(),
  )

  if (productNames.length === 0) return

  const productsFromDb = await db.products
    .where('name')
    .anyOf(productNames)
    .toArray()
  const dbMap = new Map(productsFromDb.map((p) => [p.name, p]))

  allCards.forEach((card) => {
    const name = card.innerText.split('\n')[0].trim()
    const product = dbMap.get(name)
    if (product) {
      applyStylingToCard(card, product.status)
    }
  })
}

function main() {
  injectCss()

  // Listener za poruke od injector.js
  window.addEventListener('message', (event) => {
    if (event.source === window && event.data?.type === 'GVO_FODMAP_PRODUCTS') {
      handleIncomingProducts(event.data.products)
    }
  })

  // Listening for messages from background script
  chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
    if (message.action === 'log') {
      const level: 'log' | 'info' | 'warn' | 'error' =
        message.payload.level || 'log'
      const msg = message.payload.msg || ''
      const optionalParams = message.payload.optionalParams || []
      const style =
        'background: #333; color: #fff; padding: 2px 6px; border-radius: 3px;'
      console[level](
        `%cBG%c ${msg}`,
        style,
        'background: transparent; color: inherit;',
        ...optionalParams,
      )
    }

    if (message.action === 'getPendingProducts') {
      db.products
        .where('status')
        .equals('PENDING')
        .toArray()
        .then((products) => {
          sendResponse(products)
        })
      return true
    }

    if (message.action === 'updateStatuses') {
      const products: Product[] = message.data
      db.products.bulkPut(products).then(() => {
        console.log('[Content] Baza ažurirana sa statusima od API-ja.')
        renderAllVisibleCards()
      })
      return true
    }

    if (message.action === 're-evaluate') {
      renderAllVisibleCards()
    }
  })

  setInterval(renderAllVisibleCards, 2000)
}

main()
