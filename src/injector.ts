import { type Product, type ProductsResponse } from './types/glovo'

console.log('✅ FODMAP Helper: Injector script is active in the MAIN world.')

function extractProductsFromResponse(data: ProductsResponse): Product[] {
  let products: Product[] = []
  if (Array.isArray(data)) {
    data.forEach((item) => {
      products = products.concat(extractProductsFromResponse(item))
    })
  } else if (typeof data === 'object' && data !== null) {
    if (data.type === 'PRODUCT_TILE' && data.data) {
      products.push(data.data as unknown as Product)
    } else {
      Object.values(data).forEach((value) => {
        products = products.concat(extractProductsFromResponse(value))
      })
    }
  }
  return products
}

function processAndPostData(jsonData: ProductsResponse, url: string) {
  const products = extractProductsFromResponse(jsonData)
  for (const product of products) {
    product.category = jsonData?.data?.title || 'Uncategorized'
  }

  if (products.length > 0) {
    window.postMessage({ type: 'GVO_FODMAP_PRODUCTS', products }, '*')
    console.log(
      `FODMAP Injektor: Uhvaćeno ${products.length} proizvoda sa URL-a: ${url}`,
    )
  }
}

// Presretač za FETCH API
const originalFetch = window.fetch
window.fetch = async (...args) => {
  const urlString =
    args[0] instanceof Request ? args[0].url : (args[0] as string)
  const response = await originalFetch(...args)

  if (
    urlString &&
    (urlString.includes('/content/main') ||
      urlString.includes('/content/partial'))
  ) {
    try {
      const clonedResponse = response.clone()
      const jsonData = await clonedResponse.json()
      processAndPostData(jsonData, urlString)
    } catch (e) {
      console.error('FODMAP Injektor: Greška pri parsiranju JSON odgovora', e)
    }
  }
  return response
}

// Presretač za XMLHttpRequest
const originalXhrOpen = XMLHttpRequest.prototype.open
XMLHttpRequest.prototype.open = function (...args: unknown[]) {
  this._url = args[1]

  return originalXhrOpen.apply(this, args as [string, string])
}
const originalXhrSend = XMLHttpRequest.prototype.send
XMLHttpRequest.prototype.send = function (...args: any[]) {
  this.addEventListener('load', function () {
    if (
      this._url &&
      (this._url.includes('/content/main') ||
        this._url.includes('/content/partial'))
    ) {
      try {
        const jsonData = JSON.parse(this.responseText)
        processAndPostData(jsonData, this._url)
      } catch (e) {}
    }
  })
  return originalXhrSend.apply(this, args)
}
