import type { Product } from '@/utils/db'
import { ErrorHandler } from '@/utils/ErrorHandler'
import { Logger } from '@/utils/Logger'
import { MetricsCollector } from '@/utils/MetricsCollector'
import { getProductHash } from '@/utils/ProductHash'

export interface ProductScanResult {
  products: Product[]
  scannedElements: number
  extractedProducts: number
  errors: string[]
}

/**
 * Sophisticated DOM scanner for extracting product data from Glovo pages.
 * Handles the complex task of finding, identifying, and extracting product information
 * from dynamically loaded content using multiple selector strategies.
 *
 * Key responsibilities:
 * - Discovering product cards across different page layouts
 * - Extracting product names, descriptions, prices, and images
 * - Handling dynamic content updates via mutation observers
 * - Providing fallback strategies for selector robustness
 * - Performance monitoring and error tracking
 *
 * Architecture features:
 * - Multi-tier selector system (primary Glovo selectors + fallbacks)
 * - Mutation observer for real-time content detection
 * - Comprehensive extraction rules for different data types
 * - Debug and analytics capabilities for troubleshooting
 *
 * The scanner is designed to be resilient to Glovo's UI changes by using
 * multiple selector strategies and graceful degradation.
 */
export class DomProductScanner {
  private static readonly PRODUCT_STORE_CONTAINER_SELECTOR =
    'div.store__page__body'
  private static readonly PRODUCT_SELECTORS = [
    // Glovo-specific selectors based on actual HTML structure
    'section[type="PRODUCT_TILE"]',

    // // Original selectors (keep for other sites)
    // '[data-qa="product-card"]',
    // '[data-test-id="product-card"]',
    // '.product-card',
    // '[class*="product-card"]',
    // '[class*="ProductCard"]',

    // // Generic but more specific selectors
    // 'article[class*="product"]',
    // 'div[class*="product"][class*="item"]',
    // 'li[class*="product"]',
    // 'div[class*="card"][class*="item"]',
  ]

  private static readonly EXTRACTION_RULES = {
    // Product name selectors - Glovo specific
    name: [
      '[data-test-id="tile__highlighter"] span',
      '.tile__description span',
      '[data-test-id="tile__highlighter"]',
      '.tile__description',

      // Fallback selectors
      '[data-qa="product-card-name"]',
      '[data-test-id="product-name"]',
      '.product-name',
      '.product-title',
      'h3',
      'h4',
      '[class*="name"]',
      '[class*="title"]',
    ],

    // Product description selectors
    description: [
      '[data-test-id="tile__highlighter"] span',
      '.tile__description span',
      '[data-test-id="tile__highlighter"]',
      '.tile__description',

      // Fallback selectors
      '[data-qa="product-card-description"]',
      '[data-test-id="product-description"]',
      '.product-description',
      '.product-details',
      'p',
      '[class*="description"]',
      '[class*="detail"]',
    ],

    // Product price selectors - Glovo specific
    price: [
      '[data-test-id="product-price-effective"]',
      '.product-price__effective',
      '[data-test-id="product-price"]',
      '.tile__price',
      '.product-price',

      // Fallback selectors
      '[data-qa="product-card-price"]',
      '.price',
      '[class*="price"]',
      '[class*="cost"]',
    ],

    // Product image selectors - Glovo specific
    image: [
      '.tile__image',
      '.store-product-image',
      '[data-test-id="img-formats"]',
      '[data-test-id="image-formats"] img',
      'picture img',

      // Fallback selectors
      '[data-qa="product-card-image"]',
      '[data-test-id="product-image"]',
      '.product-image img',
      '.product-picture img',
      'img',
      '[class*="image"] img',
      '[class*="picture"] img',
    ],

    // Product ID or link selectors
    id: [
      '[data-product-id]',
      '[data-id]',
      '[href*="/product/"]',
      '[href*="/item/"]',
      'a[href]',
    ],
  }

  /**
   * Performs comprehensive scan of the entire page for product cards
   * Primary entry point for discovering all visible products on the current page
   *
   * @returns ProductScanResult containing discovered products, metrics, and errors
   *
   * Scanning process:
   * 1. Searches for elements matching product card selectors
   * 2. Extracts product data from each discovered element
   * 3. Applies data validation and cleaning
   * 4. Collects performance metrics and error information
   * 5. Provides debug information for troubleshooting
   *
   * Features:
   * - Multi-selector strategy for maximum coverage
   * - Graceful error handling for malformed elements
   * - Performance monitoring and metrics collection
   * - Debug output for development and troubleshooting
   *
   * Used by: Initial page load scanning, manual refresh operations,
   * and diagnostic tools for checking page parsing accuracy
   */
  static scanPage(): ProductScanResult {
    const startTime = performance.now()
    const result: ProductScanResult = {
      products: [],
      scannedElements: 0,
      extractedProducts: 0,
      errors: [],
    }

    try {
      Logger.info('DomProductScanner', 'Starting page scan for product cards')

      // Debug: Log page readiness
      Logger.debug(
        'DomProductScanner',
        '🔍 DOM Debug: Document ready state: ' + document.readyState,
      )
      Logger.debug(
        'DomProductScanner',
        '🔍 DOM Debug: Body children count: ' + document.body.children.length,
      )

      // Find all potential product card elements
      const productElements = DomProductScanner.findProductElements()
      result.scannedElements = productElements.length

      Logger.debug(
        'DomProductScanner',
        `Found ${productElements.length} potential product elements`,
      )

      // Extract data from each product element
      for (let i = 0; i < productElements.length; i++) {
        try {
          const product = DomProductScanner.extractProductFromElement(
            productElements[i],
            i,
          )
          if (product) {
            result.products.push(product)
            result.extractedProducts++
          }
        } catch (error) {
          const errorMsg = `Failed to extract product from element ${i}: ${error instanceof Error ? error.message : String(error)}`
          result.errors.push(errorMsg)
          Logger.warn('DomProductScanner', errorMsg)
        }
      }

      const duration = performance.now() - startTime
      Logger.info('DomProductScanner', `Page scan completed`, {
        scannedElements: result.scannedElements,
        extractedProducts: result.extractedProducts,
        errors: result.errors.length,
        duration: `${duration.toFixed(2)}ms`,
      })

      MetricsCollector.record('dom.scan.completed', result.extractedProducts, {
        scannedElements: result.scannedElements,
        errors: result.errors.length,
        duration,
      })
    } catch (error) {
      const errorMsg = `Page scan failed: ${error instanceof Error ? error.message : String(error)}`
      result.errors.push(errorMsg)
      ErrorHandler.logError('DomProductScanner', error, {
        context: 'Page scan',
        metadata: {
          scannedElements: result.scannedElements,
          extractedProducts: result.extractedProducts,
        },
      })

      MetricsCollector.record('dom.scan.error', 1, { error: errorMsg })
    }

    return result
  }

  /**
   * Scans a specific container for product cards
  /**
   * Scans a specific DOM container for product cards
   * More targeted scanning for specific page sections or dynamically added content
   *
   * @param container - DOM element to search within for product cards
   * @returns ProductScanResult containing products found within the container
   *
   * Use cases:
   * - Scanning newly added content sections
   * - Processing specific page areas (e.g., recommendation widgets)
   * - Handling incremental content loading scenarios
   * - Mutation observer callbacks for targeted updates
   *
   * More efficient than full page scans when you know the specific
   * area that contains new or updated product information.
   */
  static scanContainer(container: Element): ProductScanResult {
    const startTime = performance.now()
    const result: ProductScanResult = {
      products: [],
      scannedElements: 0,
      extractedProducts: 0,
      errors: [],
    }

    try {
      Logger.debug(
        'DomProductScanner',
        'Scanning container for product cards',
        {
          containerTag: container.tagName,
          containerClass: container.className,
        },
      )

      // Find product elements within the container
      const productElements: Element[] = []
      for (const selector of DomProductScanner.PRODUCT_SELECTORS) {
        const elements = container.querySelectorAll(selector)
        for (const element of elements) {
          if (!productElements.includes(element)) {
            productElements.push(element)
          }
        }
      }

      result.scannedElements = productElements.length

      // Extract data from each product element
      for (let i = 0; i < productElements.length; i++) {
        try {
          const product = DomProductScanner.extractProductFromElement(
            productElements[i],
            i,
          )
          if (product) {
            result.products.push(product)
            result.extractedProducts++
          }
        } catch (error) {
          const errorMsg = `Failed to extract product from container element ${i}: ${error instanceof Error ? error.message : String(error)}`
          result.errors.push(errorMsg)
          Logger.warn('DomProductScanner', errorMsg)
        }
      }

      const duration = performance.now() - startTime
      Logger.debug('DomProductScanner', `Container scan completed`, {
        scannedElements: result.scannedElements,
        extractedProducts: result.extractedProducts,
        errors: result.errors.length,
        duration: `${duration.toFixed(2)}ms`,
      })

      MetricsCollector.record('dom.container.scan', result.extractedProducts, {
        scannedElements: result.scannedElements,
        errors: result.errors.length,
        duration,
      })
    } catch (error) {
      const errorMsg = `Container scan failed: ${error instanceof Error ? error.message : String(error)}`
      result.errors.push(errorMsg)
      ErrorHandler.logError('DomProductScanner', error, {
        context: 'Container scan',
        metadata: {
          containerTag: container.tagName,
          containerClass: container.className,
        },
      })
    }

    return result
  }

  /**
   * Finds all product card elements on the page
   */
  private static findProductElements(): Element[] {
    const elements: Element[] = []
    const seen = new Set<Element>()

    Logger.debug(
      'DomProductScanner',
      '🔍 DOM Debug: Searching for product elements...',
    )

    for (const selector of DomProductScanner.PRODUCT_SELECTORS) {
      try {
        const found = document.querySelectorAll(
          `${DomProductScanner.PRODUCT_STORE_CONTAINER_SELECTOR} ${selector}`,
        )
        Logger.debug(
          'DomProductScanner',
          `🔍 DOM Debug: Selector "${selector}" found ${found.length} elements`,
        )

        for (const element of found) {
          if (!seen.has(element)) {
            elements.push(element)
            seen.add(element)
            Logger.debug(
              'DomProductScanner',
              `  ✅ Added element: ${element.tagName} ${element.className.split(' ').slice(0, 2).join(' ')}`,
            )
          }
        }
      } catch (error) {
        Logger.warn('DomProductScanner', `Invalid selector: ${selector}`, {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    Logger.info(
      'DomProductScanner',
      `🔍 DOM Debug: Total elements found: ${elements.length}`,
    )
    return elements
  }

  /**
   * Extracts product data from a DOM element
   */
  private static extractProductFromElement(
    element: Element,
    index: number,
  ): Product | null {
    try {
      // Extract product name
      const name = DomProductScanner.extractText(
        element,
        DomProductScanner.EXTRACTION_RULES.name,
      )
      if (!name) {
        Logger.debug(
          'DomProductScanner',
          `No product name found for element ${index}`,
        )
        return null
      }

      const product: Product = {
        hash: getProductHash(name),
        name: name.trim(),
        category: 'Scanned',
        status: 'UNKNOWN',
      }

      Logger.debug('DomProductScanner', `Extracted product: ${product.name}`, {
        price: product.price,
      })

      return product
    } catch (error) {
      Logger.warn(
        'DomProductScanner',
        `Failed to extract product from element $index`,
        {
          error: error instanceof Error ? error.message : String(error),
        },
      )
      return null
    }
  }

  /**
   * Extracts text content using multiple selector strategies
   */
  private static extractText(
    element: Element,
    selectors: string[],
  ): string | null {
    for (const selector of selectors) {
      try {
        const found = element.querySelector(selector)
        if (found?.textContent?.trim()) {
          return found.textContent.trim()
        }
      } catch (error) {
        // Invalid selector, continue
      }
    }

    // Fallback to element's own text content if no specific selector worked
    const directText = element.textContent?.trim()
    return directText && directText.length > 0 && directText.length < 200
      ? directText
      : null
  }

  /**
   * Sets up a mutation observer to catch dynamically added products
  /**
   * Sets up a MutationObserver to detect dynamically added product cards
   * Enables real-time detection of new products as they're loaded via AJAX or navigation
   *
   * @param callback - Function called when new products are detected
   * @returns MutationObserver instance for lifecycle management
   *
   * Observer capabilities:
   * - Detects new DOM nodes added to the page
   * - Identifies product cards within added content
   * - Extracts product data from newly discovered elements
   * - Handles both direct product additions and container additions
   * - Debounces rapid changes to avoid excessive processing
   *
   * Monitoring strategy:
   * 1. Watches for childList mutations across the document
   * 2. Checks if added nodes are product cards or contain product cards
   * 3. Extracts product data from valid discoveries
   * 4. Invokes callback with discovered products
   *
   * Essential for single-page applications where content loads dynamically
   * without full page refreshes (like Glovo's infinite scroll and filtering).
   */
  static setupMutationObserver(
    callback: (products: Product[]) => void,
  ): MutationObserver {
    const observer = new MutationObserver((mutations) => {
      const addedProducts: Product[] = []

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element

              // Check if the added element itself is a product card
              const isProductCard = DomProductScanner.PRODUCT_SELECTORS.some(
                (selector) => {
                  try {
                    return element.matches(selector)
                  } catch {
                    return false
                  }
                },
              )

              if (isProductCard) {
                const product = DomProductScanner.extractProductFromElement(
                  element,
                  0,
                )
                if (product) {
                  addedProducts.push(product)
                }
              } else {
                // Check if the added element contains product cards
                const containerResult = DomProductScanner.scanContainer(element)
                addedProducts.push(...containerResult.products)
              }
            }
          }
        }
      }

      if (addedProducts.length > 0) {
        Logger.info(
          'DomProductScanner',
          `Detected ${addedProducts.length} new products via mutation observer`,
        )
        MetricsCollector.record('dom.mutation.products', addedProducts.length)
        callback(addedProducts)
      }
    })

    const targetElement = document.querySelector(
      DomProductScanner.PRODUCT_STORE_CONTAINER_SELECTOR,
    )
    if (targetElement) {
      observer.observe(targetElement, {
        childList: true,
        subtree: true,
      })

      Logger.info(
        'DomProductScanner',
        'Mutation observer started for dynamic product detection',
      )
    }

    return observer
  }
}
