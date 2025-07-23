import { ProductExtractor } from '@/entrypoints/injector.content/ProductExtractor'
/**
 * Intercepts fetch and XHR requests to capture Glovo product data
 */
export class ApiInterceptor {
  private static readonly TARGET_ENDPOINTS = [
    '/content/main',
    '/content/partial',
  ]

  static init(): void {
    // Only run in browser context
    if (
      typeof window === 'undefined' ||
      typeof XMLHttpRequest === 'undefined'
    ) {
      return
    }
    // Logger cannot be used in page context (world: MAIN).
    // Use console.log instead to avoid errors.
    // This is a workaround for the fact that Logger is not available in the MAIN world.
    console.log(
      '✅ FODMAP Helper: Injector script is active in the MAIN world.',
    )
    ApiInterceptor.setupFetchInterceptor()
    ApiInterceptor.setupXhrInterceptor()
  }

  private static setupFetchInterceptor(): void {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
      return
    }
    const originalFetch = window.fetch

    window.fetch = async (...args) => {
      const urlString =
        args[0] instanceof Request ? args[0].url : (args[0] as string)
      const response = await originalFetch(...args)

      if (urlString && ApiInterceptor.shouldIntercept(urlString)) {
        try {
          const clonedResponse = response.clone()
          const jsonData = await clonedResponse.json()
          ProductExtractor.processAndPostProducts(jsonData, urlString)
        } catch (error) {
          // Logger cannot be used in page context (world: MAIN). Use console.error instead.
          console.error('FODMAP Injector: Error parsing JSON response', error)
        }
      }

      return response
    }
  }

  /**
   * Confirmed to be used by Glovo to send API requests as of July 2025.
   */
  private static setupXhrInterceptor(): void {
    if (typeof XMLHttpRequest === 'undefined') {
      return
    }
    const originalXhrOpen = XMLHttpRequest.prototype.open
    const originalXhrSend = XMLHttpRequest.prototype.send

    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null,
    ) {
      // Store URL for later use
      ;(this as any)._url = url
      return originalXhrOpen.call(
        this,
        method,
        url,
        async ?? true,
        username,
        password,
      )
    }

    XMLHttpRequest.prototype.send = function (
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      this.addEventListener('load', function () {
        const url = (this as any)._url
        if (url && ApiInterceptor.shouldIntercept(url.toString())) {
          try {
            const jsonData = JSON.parse(this.responseText)
            ProductExtractor.processAndPostProducts(jsonData, url.toString())
          } catch (error) {
            // Silently ignore JSON parsing errors for XHR
          }
        }
      })

      return originalXhrSend.call(this, body)
    }
  }

  private static shouldIntercept(url: string): boolean {
    return ApiInterceptor.TARGET_ENDPOINTS.some((endpoint) =>
      url.includes(endpoint),
    )
  }
}
