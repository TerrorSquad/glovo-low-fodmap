import { Config } from '../shared/Config'
import { type Product } from '../shared/db'
import { ErrorHandler } from '../shared/ErrorHandler'
import { PerformanceMonitor } from '../shared/PerformanceMonitor'
import { type InjectedProductData } from '../shared/types'
import { ProductManager } from './ProductManager'
import { StyleManager } from './StyleManager'

/**
 * Manages DOM operations and visual styling for product cards on Glovo pages.
 * Responsible for identifying, tagging, and updating product cards with FODMAP status information.
 *
 * Key responsibilities:
 * - Finding untagged product cards on the page
 * - Associating cards with external product IDs for database lookups
 * - Applying FODMAP status indicators and visibility controls
 * - Coordinating with StyleManager for visual appearance
 * - Performance optimization for bulk card operations
 *
 * This class operates entirely on the DOM and doesn't store any state itself,
 * making it safe to call methods multiple times without side effects.
 */
export class CardManager {
  private static readonly CARD_SELECTOR = Config.SELECTORS.CARD
  private static readonly CARD_NAME_SELECTOR = Config.SELECTORS.CARD_NAME

  /**
   * Tags visible product cards with external IDs for database association
   * Matches card names with injected product data to establish data relationships
   *
   * @param products - Array of product data containing names and external IDs
   *
   * Process:
   * 1. Finds all untagged cards on the page (no data-external-id attribute)
   * 2. Creates name-to-ID mapping from provided product data
   * 3. Extracts product names from card DOM elements
   * 4. Associates matching cards with external IDs via data attributes
   *
   * Used when: New products are injected via content script or API responses
   */
  static tagVisibleCards(products: InjectedProductData[]): void {
    PerformanceMonitor.measure('tagVisibleCards', () => {
      try {
        const untaggedCards = document.querySelectorAll<HTMLElement>(
          `${CardManager.CARD_SELECTOR}:not([data-external-id])`,
        )
        const productMap = new Map(
          products.map((p) => [p.name.trim(), p.externalId]),
        )

        untaggedCards.forEach((card) => {
          const cardName = card
            .querySelector(CardManager.CARD_NAME_SELECTOR)
            ?.textContent?.trim()

          if (!cardName) return

          const externalId = productMap.get(cardName)
          if (externalId) {
            card.dataset.externalId = externalId.toString()
          }
        })

        ErrorHandler.logInfo(
          'Content',
          `Tagged ${untaggedCards.length} cards with external IDs`,
        )
      } catch (error) {
        ErrorHandler.logError('Content', error, { context: 'Card tagging' })
      }
    })
  }

  /**
   * Tags visible product cards using database product records
   * Alternative to tagVisibleCards when working with stored Product objects instead of injected data
   *
   * @param products - Array of Product objects from database with names and external IDs
   *
   * Features case-insensitive name matching for better reliability
   * Used when: DOM scanning discovers products that already exist in database
   */
  static tagVisibleCardsByName(products: Product[]): void {
    PerformanceMonitor.measure('tagVisibleCardsByName', () => {
      try {
        const untaggedCards = document.querySelectorAll<HTMLElement>(
          `${CardManager.CARD_SELECTOR}:not([data-external-id])`,
        )
        const productMap = new Map(
          products.map((p) => [p.name.trim().toLowerCase(), p.externalId]),
        )

        untaggedCards.forEach((card) => {
          const cardName = card
            .querySelector(CardManager.CARD_NAME_SELECTOR)
            ?.textContent?.trim()

          if (!cardName) return

          const externalId = productMap.get(cardName.toLowerCase())
          if (externalId) {
            card.dataset.externalId = externalId.toString()
          }
        })

        ErrorHandler.logInfo(
          'Content',
          `Tagged ${untaggedCards.length} cards with external IDs from database`,
        )
      } catch (error) {
        ErrorHandler.logError('Content', error, {
          context: 'Card tagging by name',
        })
      }
    })
  }

  /**
   * Retrieves all product cards that have been tagged with external IDs
   * Returns only cards that have been associated with database products
   *
   * @returns Array of HTML elements representing tagged product cards
   *
   * Used for: Batch operations on known products, style updates,
   * and filtering operations that require database association
   */
  static getTaggedCards(): HTMLElement[] {
    return Array.from(
      document.querySelectorAll<HTMLElement>(
        `${CardManager.CARD_SELECTOR}[data-external-id]`,
      ),
    )
  }

  /**
   * Updates visual styling for all tagged product cards based on current FODMAP data
   * Coordinates between database lookups and visual styling application
   *
   * @param hideNonLowFodmap - Whether to hide products that are not LOW FODMAP
   * @returns Promise that resolves when all card updates are complete
   *
   * Performance optimizations:
   * - Only updates cards when changes are actually needed
   * - Batches database lookups for efficiency
   * - Logs performance metrics for slow operations (>10ms)
   * - Minimizes DOM manipulation by checking current state
   *
   * Update process:
   * 1. Retrieves all tagged cards from DOM
   * 2. Batch fetches product data from database by external IDs
   * 3. Compares current card state with desired state
   * 4. Applies styling changes only when necessary
   * 5. Updates visibility based on user preferences
   *
   * Called by: FodmapHelper during periodic updates, setting changes,
   * and after new FODMAP classifications are received
   */
  static async updateAllCards(hideNonLowFodmap: boolean): Promise<void> {
    return await PerformanceMonitor.measureAsync(
      'updateAllCards',
      async () => {
        try {
          const allCards = CardManager.getTaggedCards()
          if (allCards.length === 0) return

          const externalIds = allCards.map((card) => card.dataset.externalId!)
          const dbMap =
            await ProductManager.getProductsByExternalIds(externalIds)
          let changedCards = 0

          allCards.forEach((card) => {
            const externalId = card.dataset.externalId
            if (!externalId) return

            const product = dbMap.get(externalId)
            if (product) {
              const currentStatus = card.dataset.fodmapStatus

              // Determine visibility: hide only if user wants to hide AND product is not LOW
              const shouldBeHidden =
                product.status !== 'LOW' && hideNonLowFodmap
              const isCurrentlyHidden =
                card.classList.contains('fodmap-card-hidden')

              // Only apply styling if there's an actual change needed
              if (
                currentStatus !== product.status ||
                isCurrentlyHidden !== shouldBeHidden
              ) {
                StyleManager.applyToCard(card, product.status, shouldBeHidden)
                changedCards++
              }
            }
          })

          // Only log info message when there were changes
          if (changedCards > 0) {
            ErrorHandler.logInfo(
              'Content',
              `Updated styles for ${changedCards}/${allCards.length} cards (${hideNonLowFodmap ? 'hiding non-LOW' : 'showing all'})`,
            )
          }
        } catch (error) {
          ErrorHandler.logError('Content', error, {
            context: 'Card style update',
          })
        }
      },
      {
        threshold: 10, // Only log if update takes more than 10ms
        debugOnly: false, // Log updateAllCards even in non-debug mode but only when slow
        metadata: { hideNonLowFodmap },
      },
    )
  }
}
