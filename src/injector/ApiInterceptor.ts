import { ProductExtractor } from './ProductExtractor'

/**
 * Intercepts fetch and XHR requests to capture Glovo product data
 */
export class ApiInterceptor {
  private static readonly TARGET_ENDPOINTS = [
    '/content/main',
    '/content/partial',
  ]

  static init(): void {
    console.log(
      '✅ FODMAP Helper: Injector script is active in the MAIN world.',
    )
    ApiInterceptor.setupFetchInterceptor()
    ApiInterceptor.setupXhrInterceptor()
  }

  private static setupFetchInterceptor(): void {
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
          console.error('FODMAP Injector: Error parsing JSON response', error)
        }
      }

      return response
    }
  }

  private static setupXhrInterceptor(): void {
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
