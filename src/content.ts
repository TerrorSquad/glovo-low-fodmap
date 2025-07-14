import { db, type FodmapStatus, type Product } from './db'

interface InjectedProductData {
  externalId: string
  name: string
  description?: string
  category: string
  status: FodmapStatus
  price?: number
}

// --- POMOĆNE FUNKCIJE ---
const injectCss = (): void => {
  const styleId = 'fodmap-helper-styles'
  if (document.getElementById(styleId)) return
  const css = `
    .fodmap-low-highlight { box-shadow: 0 0 7px 2px rgba(76, 175, 80, 0.55); border-radius: 16px; transition: all 0.2s ease-in-out; }
    .fodmap-badge { position: absolute; top: 5px; right: 5px; width: 22px; height: 22px; background-color: #28a745; border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 10; border: 1px solid white; cursor: help; }
    .fodmap-badge svg { width: 12px; height: 12px; fill: white; }
    .fodmap-badge-high { background-color: #dc3545 !important; }
    .fodmap-badge-unknown { background-color: #ffc107 !important; }
  `
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = css
  document.head.appendChild(style)
}

let hideNonLowFodmap = false

/**
 * Prima proizvode od injektora, upisuje nove u bazu i "taguje" DOM elemente.
 */
async function handleIncomingProducts(
  products: InjectedProductData[],
): Promise<void> {
  const incomingProducts: Product[] = products.map((p) => ({
    externalId: p.externalId,
    name: p.name,
    price: p.price,
    category: p.category || 'Uncategorized',
    status: p.status || 'PENDING',
  }))

  const incomingExtIds = incomingProducts.map((p) => p.externalId)

  try {
    await db.transaction('rw', db.products, async () => {
      const existingProducts = await db.products
        .where('externalId')
        .anyOf(incomingExtIds)
        .toArray()
      const existingExtIds = new Set(existingProducts.map((p) => p.externalId))
      const newProductsToDb = incomingProducts.filter(
        (p) => !existingExtIds.has(p.externalId),
      )

      if (newProductsToDb.length > 0) {
        await db.products.bulkAdd(newProductsToDb)
        console.log(
          `[Content] Dodato ${newProductsToDb.length} novih proizvoda u bazu.`,
        )
        chrome.runtime.sendMessage({ action: 'newProductsFound' })
      }
    })

    tagVisibleCards(products)
  } catch (error) {
    console.error('[Content] Greška unutar Dexie transakcije:', error)
  }
}

/**
 * Prolazi kroz vidljive kartice i dodaje im data-external-id atribut.
 */
function tagVisibleCards(products: InjectedProductData[]): void {
  const allCards = document.querySelectorAll<HTMLElement>(
    'section[type="PRODUCT_TILE"]:not([data-external-id])',
  )
  const productMap = new Map(products.map((p) => [p.name.trim(), p.externalId]))

  allCards.forEach((card) => {
    const cardName = card.children[0].children[1].innerText
      .split('\n')[0]
      .trim()
    const externalId = productMap.get(cardName)
    if (externalId) {
      card.dataset.externalId = externalId.toString()
    }
  })
}

/**
 * Glavna funkcija koja ažurira stilove na stranici.
 */
async function updatePageStyles() {
  // section[type="PRODUCT_TILE"][data-external-id]:not([data-fodmap-status="HIGH"]):not([data-fodmap-status="LOW"])
  const allCards = document.querySelectorAll<HTMLElement>(
    'section[type="PRODUCT_TILE"][data-external-id]',
  )
  if (allCards.length === 0) return

  const externalIds = Array.from(allCards).map(
    (card) => card.dataset.externalId!,
  )
  const productsFromDb = await db.products
    .where('externalId')
    .anyOf(externalIds)
    .toArray()
  const dbMap = new Map(productsFromDb.map((p) => [p.externalId, p]))

  allCards.forEach((card) => {
    const externalId = card.dataset.externalId
    if (!externalId) return

    const product = dbMap.get(externalId)
    if (product) {
      applyStylingToCard(card, product.status)
    }
  })
}

function applyStylingToCard(card: HTMLElement, status: FodmapStatus) {
  const isHidden = card.style.display === 'none'
  const shouldBeHidden = status !== 'LOW' && hideNonLowFodmap

  if (card.dataset.fodmapStatus === status && isHidden === shouldBeHidden)
    return

  // Reset
  card.classList.remove('fodmap-low-highlight')
  card.querySelector('.fodmap-badge')?.remove()
  card.style.position = 'relative'

  // Primeni stilove
  if (status === 'LOW') {
    card.classList.add('fodmap-low-highlight')
    const badge = document.createElement('div')
    badge.className = 'fodmap-badge'
    badge.title = 'Low-FODMAP'
    badge.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z"/></svg>`
    card.appendChild(badge)
  } else if (status === 'HIGH') {
    const badge = document.createElement('div')
    badge.className = 'fodmap-badge fodmap-badge-high'
    badge.title = 'High-FODMAP'
    badge.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M24 20.188l-8.315-8.209 8.2-8.282-3.697-3.697-8.212 8.318-8.31-8.203-3.666 3.666 8.321 8.24-8.206 8.313 3.666 3.666 8.237-8.318 8.285 8.203z"/></svg>`
    card.appendChild(badge)
  } else if (status === 'UNKNOWN') {
    const badge = document.createElement('div')
    badge.className = 'fodmap-badge fodmap-badge-unknown'
    badge.title = 'Unknown FODMAP status'
    badge.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2c-5.523 0-10 4.477-10 10s4.477 10 10 10 10-4.477 10-10-4.477-10-10-10zm1 15h-2v-2h2v2zm0-4h-2v-6h2v6z"/></svg>`
    card.appendChild(badge)
  }

  // Primeni sakrivanje/prikazivanje
  card.style.display = shouldBeHidden ? 'none' : 'block'
  card.dataset.fodmapStatus = status
}

// --- POKRETANJE ---
function main() {
  injectCss()

  window.addEventListener('message', (event) => {
    if (event.source === window && event.data?.type === 'GVO_FODMAP_PRODUCTS') {
      handleIncomingProducts(event.data.products)
    }
  })

  chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
    if (message.action === 'log') {
      const level: 'log' | 'info' | 'warn' | 'error' =
        message.payload.level || 'log'
      const msg = message.payload.message || ''
      const optionalParams = message.payload.optionalParams || []
      console[level](`BG ${msg}`, ...optionalParams)
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
      const productsToUpdate: Product[] = message.data.map((p: Product) => {
        return {
          externalId: p.externalId,
          name: p.name,
          category: p.category || 'Uncategorized',
          status: p.status || 'PENDING',
        }
      })
      db.transaction('rw', db.products, async () => {
        const externalIds = productsToUpdate.map((p) => p.externalId)
        const localProducts = await db.products
          .where('externalId')
          .anyOf(externalIds)
          .toArray()
        const localProductMap = new Map(
          localProducts.map((p) => [p.externalId, p]),
        )

        const finalUpdates: Product[] = []
        for (const apiProduct of productsToUpdate) {
          const localProduct = localProductMap.get(apiProduct.externalId)
          if (localProduct) {
            localProduct.status = apiProduct.status
            finalUpdates.push(localProduct)
          }
        }
        if (finalUpdates.length > 0) {
          await db.products.bulkPut(finalUpdates)
        }
      })
        .then(() => {
          console.log('[Content] Baza ažurirana sa statusima od API-ja.')
          updatePageStyles()
          sendResponse({ success: true })
        })
        .catch((error) => {
          console.error('[Content] Greška pri ažuriranju baze:', error)
          sendResponse({ success: false, error: error.message })
        })
    }

    if (message.action === 'refreshStyles') {
      updatePageStyles()
    } else if (message.action === 're-evaluate') {
      hideNonLowFodmap = message.hide
      updatePageStyles()
    }
  })

  // Učitaj inicijalno stanje za sakrivanje
  chrome.storage.sync.get({ hideNonLowFodmap: false }, (data) => {
    hideNonLowFodmap = !!data.hideNonLowFodmap
    setInterval(updatePageStyles, 1000)
  })
}

main()
