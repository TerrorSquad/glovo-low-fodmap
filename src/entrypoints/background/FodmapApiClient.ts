import { Config } from '@/utils/Config'
import { Product } from '@/utils/db'
import { ErrorHandler } from '@/utils/ErrorHandler'

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
    hash: string
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
  missingHashes: string[]
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
  }

  /**
   * Poll for status updates of pending products
   */
  async pollProductStatus(
    hashes: string[],
    options: ApiRetryOptions = {},
  ): Promise<StatusResponse> {
    const {
      maxAttempts = Config.SYNC_RETRY_ATTEMPTS,
      delayMs = Config.SYNC_RETRY_DELAY,
      backoffMultiplier = 2,
    } = options

    if (!hashes.length) {
      return { results: [], found: 0, missing: 0, missingHashes: [] }
    }

    const batches = this.createBatches(hashes, Config.POLL_BATCH_SIZE)
    const allResults: StatusResponse['results'] = []
    let totalFound = 0
    let totalMissing = 0
    const allMissingHashes: string[] = []

    for (const batch of batches) {
      const result = await this.pollBatch(batch, {
        maxAttempts,
        delayMs,
        backoffMultiplier,
      })
      allResults.push(...result.results)
      totalFound += result.found
      totalMissing += result.missing
      allMissingHashes.push(...result.missingHashes)
    }

    return {
      results: allResults,
      found: totalFound,
      missing: totalMissing,
      missingHashes: allMissingHashes,
    }
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
          signal: AbortSignal.timeout(Config.SYNC_REQUEST_TIMEOUT),
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
    hashes: string[],
    options: Required<ApiRetryOptions>,
  ): Promise<StatusResponse> {
    const { maxAttempts, delayMs, backoffMultiplier } = options
    let lastError: Error

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(`${this.apiEndpoint}/products/status`, {
          signal: AbortSignal.timeout(Config.SYNC_REQUEST_TIMEOUT),
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ hashes }),
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
          metadata: { attempt, maxAttempts, productCount: hashes.length },
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
