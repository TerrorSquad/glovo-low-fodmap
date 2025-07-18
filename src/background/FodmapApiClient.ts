import { Config } from '../shared/Config'
import { type Product } from '../shared/db'
import { ErrorBoundary } from '../shared/ErrorBoundary'
import { ErrorHandler } from '../shared/ErrorHandler'
import { PerformanceMonitor } from '../shared/PerformanceMonitor'

type ApiRetryOptions = {
  maxAttempts?: number
  delayMs?: number
  backoffMultiplier?: number
}

type SubmitResponse = {
  success: boolean
  submitted_count: number
  message?: string
}

export type StatusResponse = {
  results: Array<{
    id: number
    externalId: string
    name: string
    category: string
    status: 'LOW' | 'MODERATE' | 'HIGH' | 'UNKNOWN' | 'PENDING'
    createdAt: string
    updatedAt: string
    processedAt?: string
    explanation?: string // Serbian language explanation of why product has this FODMAP status
    isFood?: boolean // Whether this product is food or not
  }>
  found: number
  missing: number
  missing_ids: string[]
}

/**
 * Handles API communication for FODMAP classification using submit/poll pattern
 */
export class FodmapApiClient {
  private readonly apiEndpoint: string

  constructor(apiEndpoint: string) {
    this.apiEndpoint = apiEndpoint
  }

  /**
   * Submit unknown/pending products for classification
   */
  async submitProducts(
    products: Product[],
    options: ApiRetryOptions = {},
  ): Promise<SubmitResponse> {
    const {
      maxAttempts = Config.SYNC_RETRY_ATTEMPTS,
      delayMs = Config.SYNC_RETRY_DELAY,
      backoffMultiplier = 2,
    } = options

    return await PerformanceMonitor.measureAsync(
      'submitProducts',
      async () => {
        return (
          (await ErrorBoundary.protect(async () => {
            if (!products.length) {
              throw new Error('No products to submit')
            }

            const batches = this.createBatches(products, Config.SYNC_BATCH_SIZE)
            let totalSubmitted = 0

            for (const batch of batches) {
              const result = await this.submitBatch(batch, {
                maxAttempts,
                delayMs,
                backoffMultiplier,
              })
              totalSubmitted += result.submitted_count
            }

            return {
              success: true,
              submitted_count: totalSubmitted,
              message: `Successfully submitted ${totalSubmitted} products`,
            }
          }, 'FodmapApiClient.submitProducts')) || {
            success: false,
            submitted_count: 0,
            message: 'Error boundary returned null',
          }
        )
      },
      {
        threshold: 1000,
        metadata: {
          productCount: products.length,
          batchCount: this.createBatches(products, Config.SYNC_BATCH_SIZE)
            .length,
        },
      },
    )
  }

  /**
   * Poll for status updates of pending products
   */
  async pollProductStatus(
    externalIds: string[],
    options: ApiRetryOptions = {},
  ): Promise<StatusResponse> {
    const {
      maxAttempts = Config.SYNC_RETRY_ATTEMPTS,
      delayMs = Config.SYNC_RETRY_DELAY,
      backoffMultiplier = 2,
    } = options

    return await PerformanceMonitor.measureAsync(
      'pollProductStatus',
      async () => {
        return (
          (await ErrorBoundary.protect(async () => {
            if (!externalIds.length) {
              return { results: [], found: 0, missing: 0, missing_ids: [] }
            }

            const batches = this.createBatches(
              externalIds,
              Config.POLL_BATCH_SIZE,
            )
            const allResults: StatusResponse['results'] = []
            let totalFound = 0
            let totalMissing = 0
            const allMissingIds: string[] = []

            for (const batch of batches) {
              const result = await this.pollBatch(batch, {
                maxAttempts,
                delayMs,
                backoffMultiplier,
              })
              allResults.push(...result.results)
              totalFound += result.found
              totalMissing += result.missing
              allMissingIds.push(...result.missing_ids)
            }

            return {
              results: allResults,
              found: totalFound,
              missing: totalMissing,
              missing_ids: allMissingIds,
            }
          }, 'FodmapApiClient.pollProductStatus')) || {
            results: [],
            found: 0,
            missing: 0,
            missing_ids: [],
          }
        )
      },
      {
        threshold: 1000,
        metadata: {
          productCount: externalIds.length,
          batchCount: this.createBatches(externalIds, Config.POLL_BATCH_SIZE)
            .length,
        },
      },
    )
  }

  private async submitBatch(
    products: Product[],
    options: Required<ApiRetryOptions>,
  ): Promise<SubmitResponse> {
    const { maxAttempts, delayMs, backoffMultiplier } = options
    let lastError: Error

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(`${this.apiEndpoint}/products/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ products }),
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const result: SubmitResponse = await response.json()
        return result
      } catch (error) {
        lastError = error as Error
        ErrorHandler.logError('Background', error, {
          context: 'Product submission',
          metadata: { attempt, maxAttempts, productCount: products.length },
        })

        if (attempt < maxAttempts) {
          const delay = delayMs * backoffMultiplier ** (attempt - 1)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError!
  }

  private async pollBatch(
    externalIds: string[],
    options: Required<ApiRetryOptions>,
  ): Promise<StatusResponse> {
    const { maxAttempts, delayMs, backoffMultiplier } = options
    let lastError: Error

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(`${this.apiEndpoint}/products/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ external_ids: externalIds }),
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const result: StatusResponse = await response.json()
        return result
      } catch (error) {
        lastError = error as Error
        ErrorHandler.logError('Background', error, {
          context: 'Product status polling',
          metadata: { attempt, maxAttempts, productCount: externalIds.length },
        })

        if (attempt < maxAttempts) {
          const delay = delayMs * backoffMultiplier ** (attempt - 1)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError!
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }

  isConfigured(): boolean {
    return Boolean(this.apiEndpoint && this.apiEndpoint.trim() !== '')
  }
}
