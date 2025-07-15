import { Config } from '../shared/Config'
import { type Product } from '../shared/db'
import { ErrorHandler } from '../shared/ErrorHandler'
import { PerformanceMonitor } from '../shared/PerformanceMonitor'

type ApiRetryOptions = {
  maxAttempts?: number
  delayMs?: number
  backoffMultiplier?: number
}

/**
 * Handles API communication for FODMAP classification
 */
export class FodmapApiClient {
  private readonly apiEndpoint: string

  constructor(apiEndpoint: string) {
    this.apiEndpoint = apiEndpoint
  }

  async classifyProducts(
    products: Product[],
    options: ApiRetryOptions = {},
  ): Promise<Product[]> {
    const {
      maxAttempts = Config.SYNC_RETRY_ATTEMPTS,
      delayMs = Config.SYNC_RETRY_DELAY,
      backoffMultiplier = 2,
    } = options

    return await PerformanceMonitor.measureAsync(
      'classifyProducts',
      async () => {
        if (!products.length) {
          throw new Error('No products to classify')
        }

        // Split into batches if needed
        const batches = this.createBatches(products, Config.SYNC_BATCH_SIZE)
        const allResults: Product[] = []

        for (const batch of batches) {
          const batchResults = await this.classifyBatch(batch, {
            maxAttempts,
            delayMs,
            backoffMultiplier,
          })
          allResults.push(...batchResults)
        }

        return allResults
      },
      {
        threshold: 1000, // Log if API call takes > 1 second
        metadata: {
          productCount: products.length,
          batchCount: this.createBatches(products, Config.SYNC_BATCH_SIZE)
            .length,
        },
      },
    )
  }

  private async classifyBatch(
    products: Product[],
    options: Required<ApiRetryOptions>,
  ): Promise<Product[]> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      try {
        const response = await fetch(this.apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products }),
        })

        if (!response.ok) {
          throw new Error(
            `API error: ${response.status} ${response.statusText}`,
          )
        }

        const data = (await response.json()) as { results: Product[] }

        ErrorHandler.logInfo(
          'Background',
          `Successfully classified ${products.length} products${attempt > 1 ? ` (attempt ${attempt})` : ''}`,
        )

        return data.results || []
      } catch (error) {
        lastError = error as Error

        ErrorHandler.logWarning(
          'Background',
          `API call attempt ${attempt}/${options.maxAttempts} failed`,
          {
            error: lastError.message,
            productCount: products.length,
          },
        )

        // Don't delay after the last attempt
        if (attempt < options.maxAttempts) {
          const delay =
            options.delayMs * options.backoffMultiplier ** (attempt - 1)
          ErrorHandler.logInfo('Background', `Retrying in ${delay}ms...`)
          await this.sleep(delay)
        }
      }
    }

    // All attempts failed
    throw new Error(
      `API classification failed after ${options.maxAttempts} attempts: ${lastError?.message}`,
    )
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  isConfigured(): boolean {
    return !!this.apiEndpoint && this.apiEndpoint !== 'undefined'
  }
}
