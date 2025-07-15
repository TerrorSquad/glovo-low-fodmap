import { Logger } from '../shared/Logger'
import { MetricsCollector } from '../shared/MetricsCollector'
import { type Product } from '../shared/types/glovo'

export interface ProductScanResult {
  products: Product[]
  scannedElements: number
  extractedProducts: number
  errors: string[]
}

/**
 * Scans the DOM for existing Glovo product cards and extracts product data
 */
export class DomProductScanner {
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
   * Scans the entire page for product cards
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
      Logger.info(
        'DomProductScanner',
        '🔍 DOM Debug: Document ready state: ' + document.readyState,
      )
      Logger.info(
        'DomProductScanner',
        '🔍 DOM Debug: Body children count: ' + document.body.children.length,
      )

      // Find all potential product card elements
      const productElements = DomProductScanner.findProductElements()
      result.scannedElements = productElements.length

      Logger.info(
        'DomProductScanner',
        `Found ${productElements.length} potential product elements`,
      )

      // Debug: If no elements found, let's see what's actually on the page
      if (productElements.length === 0) {
        Logger.info(
          'DomProductScanner',
          '🔍 DOM Debug: No product elements found. Checking page structure...',
        )

        // Check for common container elements
        const containers = [
          'main',
          '[role="main"]',
          '.main',
          '#main',
          '.container',
          '.content',
          '.page',
          '[class*="product"]',
          '[class*="Product"]',
          '[class*="card"]',
          '[class*="Card"]',
          '[class*="item"]',
          '[class*="Item"]',
          '[data-qa]',
          '[data-test]',
        ]

        for (const selector of containers) {
          const elements = document.querySelectorAll(selector)
          if (elements.length > 0) {
            Logger.info(
              'DomProductScanner',
              `🔍 DOM Debug: Found ${elements.length} elements for "${selector}"`,
            )
            if (elements.length <= 5) {
              elements.forEach((el, i) => {
                Logger.info(
                  'DomProductScanner',
                  `  Element ${i}: ${el.tagName} ${el.className} ${el.id}`,
                )
              })
            }
          }
        }

        // Log a sample of all elements with classes
        const allElementsWithClasses = document.querySelectorAll('[class]')
        Logger.info(
          'DomProductScanner',
          `🔍 DOM Debug: Total elements with classes: ${allElementsWithClasses.length}`,
        )

        // Show first 10 elements with classes
        Array.from(allElementsWithClasses)
          .slice(0, 10)
          .forEach((el, i) => {
            Logger.info(
              'DomProductScanner',
              `  Sample ${i}: ${el.tagName} ${el.className.split(' ').slice(0, 3).join(' ')}`,
            )
          })
      }

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
      Logger.error('DomProductScanner', errorMsg, error)

      MetricsCollector.record('dom.scan.error', 1, { error: errorMsg })
    }

    return result
  }

  /**
   * Scans a specific container for product cards
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
      Logger.error('DomProductScanner', errorMsg, error)
    }

    return result
  }

  /**
   * Finds all product card elements on the page
   */
  private static findProductElements(): Element[] {
    const elements: Element[] = []
    const seen = new Set<Element>()

    Logger.info(
      'DomProductScanner',
      '🔍 DOM Debug: Searching for product elements...',
    )

    for (const selector of DomProductScanner.PRODUCT_SELECTORS) {
      try {
        const found = document.querySelectorAll(selector)
        Logger.info(
          'DomProductScanner',
          `🔍 DOM Debug: Selector "${selector}" found ${found.length} elements`,
        )

        for (const element of found) {
          if (!seen.has(element)) {
            elements.push(element)
            seen.add(element)
            Logger.info(
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

    // If no elements found with our selectors, try more generic approaches
    if (elements.length === 0) {
      Logger.info(
        'DomProductScanner',
        '🔍 DOM Debug: No elements found with specific selectors, trying broader search...',
      )

      // Try to find elements that might be product cards based on structure
      const broadSelectors = [
        // Glovo-specific broad selectors
        'section[type="PRODUCT_TILE"]',
        '[data-test-id*="product"]',
        '[data-test-id*="tile"]',
        '.tile',

        // More specific selectors for product-like elements
        'article', // Common for product cards
        'li[class*="item"]', // List items with "item" in class
        'div[class*="product"]:not([id*="__"]):not([class*="wrapper"]):not([class*="container"])', // Product divs, excluding large containers
        'div[class*="card"]:not([id*="__"]):not([class*="wrapper"]):not([class*="container"])', // Card divs, excluding large containers
        'div[class*="item"]:not([id*="__"]):not([class*="wrapper"]):not([class*="container"])', // Item divs, excluding large containers
        '[class*="menu-item"]', // Menu items
        '[class*="store-item"]', // Store items

        // Fallback selectors
        'div[class]:has(img):has([class*="price"])', // Divs with images and price indicators
        'div[class]:has(img):has(a[href])', // Divs with images and links
      ]

      for (const selector of broadSelectors) {
        try {
          const found = document.querySelectorAll(selector)
          Logger.info(
            'DomProductScanner',
            `🔍 DOM Debug: Broad selector "${selector}" found ${found.length} elements`,
          )

          if (found.length > 0 && found.length < 100) {
            // Reasonable number
            for (const element of found) {
              if (!seen.has(element)) {
                // Skip large container elements that shouldn't be product cards
                const isLargeContainer =
                  element.id &&
                  (element.id.includes('__') ||
                    element.id.includes('layout') ||
                    element.id.includes('wrapper') ||
                    element.id.includes('app'))

                const hasWrapperClass =
                  element.className &&
                  (element.className.includes('wrapper') ||
                    element.className.includes('container') ||
                    element.className.includes('layout') ||
                    element.className.includes('app-'))

                if (isLargeContainer || hasWrapperClass) {
                  continue // Skip large containers
                }

                // Check if this element might contain product information
                const hasText =
                  element.textContent &&
                  element.textContent.trim().length > 10 &&
                  element.textContent.trim().length < 500
                const hasLinks = element.querySelector('a[href]')
                const hasImages = element.querySelector('img')
                const hasPriceIndicators =
                  element.textContent &&
                  /€|EUR|\$|USD|\d+[.,]\d+/.test(element.textContent)

                // More specific criteria for product elements
                const hasProductIndicators =
                  element.textContent &&
                  /produkt|item|artikel|cena|price/i.test(element.textContent)
                const hasReasonableSize =
                  element.children.length > 0 && element.children.length < 20

                if (
                  hasText &&
                  hasReasonableSize &&
                  (hasLinks ||
                    hasImages ||
                    hasPriceIndicators ||
                    hasProductIndicators)
                ) {
                  elements.push(element)
                  seen.add(element)
                  Logger.info(
                    'DomProductScanner',
                    `  ✅ Added broad element: ${element.tagName} ${element.className.split(' ').slice(0, 2).join(' ')}`,
                  )
                }
              }
            }
          }
        } catch (error) {
          // Continue with next selector
        }
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

      // Extract other fields
      const description = DomProductScanner.extractText(
        element,
        DomProductScanner.EXTRACTION_RULES.description,
      )
      const priceText = DomProductScanner.extractText(
        element,
        DomProductScanner.EXTRACTION_RULES.price,
      )
      const imageUrl = DomProductScanner.extractAttribute(
        element,
        DomProductScanner.EXTRACTION_RULES.image,
        'src',
      )
      const productId = DomProductScanner.extractProductId(element)

      // Parse price
      let price = 0
      if (priceText) {
        const priceMatch = priceText.match(/[\d,]+\.?\d*/g)
        if (priceMatch) {
          price = parseFloat(priceMatch[0].replace(',', '.')) || 0
        }
      }

      // Create product object compatible with Glovo's Product interface
      const timestamp = Date.now()
      const uniqueId =
        productId ||
        `dom-${index}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`

      const product: Product = {
        id: parseInt(
          productId?.replace(/\D/g, '') || `${index}${timestamp}`.slice(-8),
          10,
        ),
        externalId: uniqueId,
        storeProductId: productId || `store-${index}-${timestamp}`,
        name: name.trim(),
        description: description?.trim() || '',
        price: Math.round(price * 100), // Convert to cents
        priceInfo: {
          amount: Math.round(price * 100),
          currencyCode: 'EUR',
          displayText: priceText || `€${price.toFixed(2)}`,
        },
        category: 'Scanned', // Default category for DOM-scanned products
        images: imageUrl ? [{ imageUrl, imageServiceId: 'dom-extracted' }] : [],
        tags: [],
        attributeGroups: [],
        promotions: [],
        indicators: [],
        sponsored: false,
        restricted: false,
        tracking: {
          increment: 1,
          productSaleType: 'unit',
          isWeightedProduct: false,
          subCategory: 'dom-scanned',
          subCategoryId: 'dom-scanned-id',
        },
        showQuantifiers: false,
      }

      Logger.debug('DomProductScanner', `Extracted product: ${product.name}`, {
        id: product.id,
        price: product.price,
        hasImage: product.images.length > 0,
        hasDescription: !!product.description,
      })

      return product
    } catch (error) {
      Logger.warn(
        'DomProductScanner',
        `Failed to extract product from element ${index}`,
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
   * Extracts attribute value using multiple selector strategies
   */
  private static extractAttribute(
    element: Element,
    selectors: string[],
    attribute: string,
  ): string | null {
    for (const selector of selectors) {
      try {
        const found = element.querySelector(selector)
        if (found?.hasAttribute(attribute)) {
          const value = found.getAttribute(attribute)
          if (value?.trim()) {
            return value.trim()
          }
        }
      } catch (error) {
        // Invalid selector, continue
      }
    }
    return null
  }

  /**
   * Extracts product ID from various sources
   */
  private static extractProductId(element: Element): string | null {
    // Try data attributes first
    for (const attr of [
      'data-product-id',
      'data-id',
      'data-key',
      'data-item-id',
    ]) {
      const value = element.getAttribute(attr)
      if (value?.trim()) {
        return value.trim()
      }
    }

    // Try to extract from href
    const link = element.querySelector('a[href]') as HTMLAnchorElement
    if (link?.href) {
      const urlMatch = link.href.match(/\/(?:product|item)\/([^/?]+)/)
      if (urlMatch?.[1]) {
        return urlMatch[1]
      }
    }

    // Try to extract from nested elements
    const idElement = element.querySelector('[id]')
    if (idElement?.id) {
      return idElement.id
    }

    return null
  }

  /**
   * Sets up a mutation observer to catch dynamically added products
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

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    Logger.info(
      'DomProductScanner',
      'Mutation observer started for dynamic product detection',
    )
    MetricsCollector.record('dom.mutation.observer.started', 1)

    return observer
  }

  /**
   * Debug utility to analyze the current page structure
   * Call this in browser console: window.fodmapDebug.analyzePage()
   */
  static analyzePage(): void {
    Logger.info('DomProductScanner', '🔍 Glovo Page Structure Analysis')
    Logger.info('DomProductScanner', '================================')

    // 1. Check document readiness
    Logger.info(
      'DomProductScanner',
      'Document ready state: ' + document.readyState,
    )
    Logger.info(
      'DomProductScanner',
      'Body children count: ' + document.body.children.length,
    )
    Logger.info('DomProductScanner', 'URL: ' + window.location.href)

    // 2. Look for Nuxt/Vue indicators
    const nuxtApp =
      document.querySelector('#__nuxt') || document.querySelector('[data-nuxt]')
    Logger.info('DomProductScanner', 'Nuxt app element found: ' + !!nuxtApp)

    // 3. Check for common Glovo class patterns
    const glovoPatterns = [
      'glovo',
      'Glovo',
      'GLOVO',
      'store',
      'Store',
      'product',
      'Product',
      'card',
      'Card',
      'item',
      'Item',
    ]

    glovoPatterns.forEach((pattern) => {
      const elements = document.querySelectorAll(`[class*="${pattern}"]`)
      if (elements.length > 0) {
        Logger.info(
          'DomProductScanner',
          `Pattern "${pattern}": ${elements.length} elements`,
        )
        if (elements.length <= 10) {
          elements.forEach((el, i) => {
            Logger.info(
              'DomProductScanner',
              `  ${i}: ${el.tagName}.${el.className}`,
            )
          })
        }
      }
    })

    // 4. Check for data attributes
    const dataQaElements = document.querySelectorAll('[data-qa]')
    const dataTestElements = document.querySelectorAll('[data-test]')
    Logger.info(
      'DomProductScanner',
      `Data-qa elements: ${dataQaElements.length}`,
    )
    Logger.info(
      'DomProductScanner',
      `Data-test elements: ${dataTestElements.length}`,
    )

    if (dataQaElements.length > 0 && dataQaElements.length <= 20) {
      Logger.info('DomProductScanner', 'Data-qa attributes found:')
      Array.from(dataQaElements).forEach((el, i) => {
        Logger.info(
          'DomProductScanner',
          `  ${i}: data-qa="${el.getAttribute('data-qa')}"`,
        )
      })
    }

    // 5. Look for elements with images and text (likely products)
    const candidateElements = document.querySelectorAll(
      'div, article, li, section',
    )
    let productCandidates = 0

    Array.from(candidateElements).forEach((el) => {
      const hasImg = el.querySelector('img')
      const hasText = el.textContent && el.textContent.trim().length > 20
      const hasPrice =
        el.textContent && /€|\$|EUR|USD|\d+[.,]\d+/.test(el.textContent)
      const hasLink = el.querySelector('a[href]')

      if (hasImg && hasText && (hasPrice || hasLink)) {
        productCandidates++
        if (productCandidates <= 5) {
          Logger.info(
            'DomProductScanner',
            `Product candidate ${productCandidates}:`,
            {
              tag: el.tagName,
              classes: el.className.split(' ').slice(0, 3).join(' '),
              id: el.id,
              hasImg: !!hasImg,
              hasPrice: !!hasPrice,
              hasLink: !!hasLink,
              textSample: el.textContent?.trim().substring(0, 100),
            },
          )
        }
      }
    })

    Logger.info(
      'DomProductScanner',
      `Total product candidates found: ${productCandidates}`,
    )
    Logger.info('DomProductScanner', '================================')
  }
}
