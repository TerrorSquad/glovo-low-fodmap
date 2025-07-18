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

type StatusResponse = {
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
  private serverHealthCache: { isHealthy: boolean; lastCheck: number } | null =
    null
  private readonly HEALTH_CACHE_TTL = 90000 // 1.5 minutes cache for healthy
  private readonly UNHEALTHY_CACHE_TTL = 30000 // 30 seconds cache for unhealthy

  constructor(apiEndpoint: string) {
    this.apiEndpoint = apiEndpoint
  }

  /**
   * Check if the API server is healthy and ready to receive requests
   * Uses custom /api/health endpoint
   */
  private async checkServerHealth(): Promise<boolean> {
    const now = Date.now()

    // Use cached result if recent - different TTL for healthy vs unhealthy
    if (this.serverHealthCache) {
      const cacheAge = now - this.serverHealthCache.lastCheck
      const maxAge = this.serverHealthCache.isHealthy
        ? this.HEALTH_CACHE_TTL
        : this.UNHEALTHY_CACHE_TTL

      if (cacheAge < maxAge) {
        return this.serverHealthCache.isHealthy
      }
    }

    // Use /api/health endpoint (strip /api/v1 if present)
    const healthUrl =
      this.apiEndpoint.replace(/\/api\/v\d+\/?$/, '') + '/api/health'

    try {
      const controller = new AbortController()
      let timeoutId: NodeJS.Timeout | null = null

      // Create a promise that rejects on timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort()
          reject(
            new Error('Health check timeout - server may be cold starting'),
          )
        }, 8000)
      })

      // Race between fetch and timeout
      const fetchPromise = fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
      })

      const response = await Promise.race([fetchPromise, timeoutPromise])

      // Clear timeout if fetch succeeded
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      const isHealthy = response.ok
      this.serverHealthCache = { isHealthy, lastCheck: now }

      if (!isHealthy) {
        ErrorHandler.logWarning(
          'Background',
          `Server health check failed with status ${response.status}`,
          {
            context: 'Server health check',
            metadata: {
              status: response.status,
              statusText: response.statusText,
              healthUrl,
            },
          },
        )
      }

      return isHealthy
    } catch (error) {
      this.serverHealthCache = { isHealthy: false, lastCheck: now }

      const isTimeoutError =
        error instanceof Error && error.message.includes('timeout')
      const isAbortError = error instanceof Error && error.name === 'AbortError'
      const isCorsError =
        error instanceof Error && error.message.includes('CORS')

      if (isTimeoutError || isAbortError) {
        ErrorHandler.logWarning(
          'Background',
          'Health check timeout - server may be cold starting',
          {
            context: 'Server health check timeout',
            metadata: {
              endpoint: healthUrl,
              timeoutMs: 8000,
              errorType: isTimeoutError ? 'timeout' : 'abort',
            },
          },
        )
      } else if (isCorsError) {
        ErrorHandler.logWarning(
          'Background',
          'Health check CORS error - server needs CORS configuration for Chrome extensions',
          {
            context: 'Server health check CORS',
            metadata: {
              endpoint: healthUrl,
              errorType: 'cors',
              solution:
                'Add Access-Control-Allow-Origin header for chrome-extension://* origins',
            },
          },
        )
      } else {
        ErrorHandler.logError('Background', error, {
          context: 'Server health check',
          metadata: { endpoint: healthUrl },
        })
      }

      return false
    }
  }

  /**
   * Ensure server is healthy before making API calls
   */
  private async ensureServerHealth(): Promise<void> {
    const isHealthy = await this.checkServerHealth()
    if (!isHealthy) {
      throw new Error(
        'API server is not healthy or not responding. The server may be starting up, please try again in a moment.',
      )
    }
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

            // Ensure server is healthy before making requests
            await this.ensureServerHealth()

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

            // Ensure server is healthy before making requests
            await this.ensureServerHealth()

            const batches = this.createBatches(
              externalIds,
              Config.SYNC_BATCH_SIZE,
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
          batchCount: this.createBatches(externalIds, Config.SYNC_BATCH_SIZE)
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

  /**
   * Public method for manual health check (for diagnostics)
   */
  async healthCheck(): Promise<{ isHealthy: boolean; message: string }> {
    try {
      const isHealthy = await this.checkServerHealth()
      return {
        isHealthy,
        message: isHealthy
          ? 'API server is healthy and ready'
          : 'API server is not responding or not healthy',
      }
    } catch (error) {
      return {
        isHealthy: false,
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }
}
