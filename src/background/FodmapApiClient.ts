import { type Product } from '../shared/db'

/**
 * Handles API communication for FODMAP classification
 */
export class FodmapApiClient {
  private readonly apiEndpoint: string

  constructor(apiEndpoint: string) {
    this.apiEndpoint = apiEndpoint
  }

  async classifyProducts(products: Product[]): Promise<Product[]> {
    if (!products.length) {
      throw new Error('No products to classify')
    }

    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products }),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`)
    }

    const data = (await response.json()) as { results: Product[] }
    return data.results || []
  }

  isConfigured(): boolean {
    return !!this.apiEndpoint && this.apiEndpoint !== 'undefined'
  }
}
