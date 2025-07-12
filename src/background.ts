import { type Product } from './db'

// TODO: Implement API endpoint
const API_ENDPOINT = 'https://tvoj-api.com/classify'

const logger = {
  log: (message: unknown, ...optionalParams: unknown[]) =>
    sendMessageToContent('log', message, ...optionalParams),
  warn: (message: unknown, ...optionalParams: unknown[]) =>
    sendMessageToContent('warn', message, ...optionalParams),

  error: (message: unknown, ...optionalParams: unknown[]) => {
    const serializedParams = optionalParams.map((param) => {
      if (param instanceof Error) {
        return {
          name: param.name,
          message: param.message,
          stack: param.stack,
        }
      }
      return param
    })
    sendMessageToContent('error', message, ...serializedParams)
  },
}

function sendMessageToContent(
  level: 'log' | 'warn' | 'error',
  message: unknown,
  ...optionalParams: unknown[]
) {
  chrome.tabs.query({ active: true, url: 'https://glovoapp.com/*' }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'log',
        payload: {
          level,
          message,
          optionalParams,
        },
      })
    }
  })
}

async function fetchAndProcessProducts() {
  try {
    const tabs = await chrome.tabs.query({
      active: true,
      url: 'https://glovoapp.com/*',
    })
    if (!tabs[0] || !tabs[0].id) {
      logger.log('Nema aktivnog Glovo taba.')
      return
    }
    const tab = tabs[0]

    const productsToClassify: Product[] = await chrome.tabs.sendMessage(
      tab.id as number,
      { action: 'getPendingProducts' },
    )

    if (!productsToClassify || productsToClassify.length === 0) {
      logger.log('Nema proizvoda za klasifikaciju iz content skripte.')
      return
    }

    logger.log(
      `Dobijeno ${productsToClassify.length} proizvoda od content skripte. Šaljem na API...`,
    )

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: productsToClassify }),
    })

    if (!response.ok) throw new Error(`API greška: ${response.statusText}`)
    const { results } = (await response.json()) as { results: Product[] }

    if (results && results.length > 0) {
      await chrome.tabs.sendMessage(tab.id as number, {
        action: 'updateStatuses',
        data: results,
      })
      logger.log(`Poslati ažurirani statusi nazad na content skriptu.`)
    }
  } catch (error) {
    logger.error('Greška u glavnom toku:', error)
  }
}

// Listener from popup
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'syncWithApi') {
    logger.log('Primljen manuelni zahtev za sinhronizaciju.')
    fetchAndProcessProducts()
    return true
  }
  if (message.action === 'newProductsFound') {
    logger.log('Primljena nova lista proizvoda za klasifikaciju.')
    fetchAndProcessProducts()
    return true
  }
})
