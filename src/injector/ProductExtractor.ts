import { type Product, type ProductsResponse } from '../shared/types/glovo'

/**
 * Extracts products from Glovo API response data
 */
export class ProductExtractor {
  static extractFromResponse(data: ProductsResponse): Product[] {
    let products: Product[] = []

    if (Array.isArray(data)) {
      data.forEach((item) => {
        products = products.concat(ProductExtractor.extractFromResponse(item))
      })
    } else if (typeof data === 'object' && data !== null) {
      if (data.type === 'PRODUCT_TILE' && data.data) {
        products.push(data.data as unknown as Product)
      } else {
        Object.values(data).forEach((value) => {
          products = products.concat(
            ProductExtractor.extractFromResponse(value),
          )
        })
      }
    }

    return products
  }

  static processAndPostProducts(jsonData: ProductsResponse, url: string): void {
    const products = ProductExtractor.extractFromResponse(jsonData)

    // Set category from response data
    for (const product of products) {
      product.category = jsonData?.data?.title || 'Uncategorized'
    }

    if (products.length > 0) {
      window.postMessage({ type: 'GVO_FODMAP_PRODUCTS', products }, '*')
      console.log(
        `FODMAP Injector: Captured ${products.length} products from URL: ${url}`,
      )
    }
  }
}
