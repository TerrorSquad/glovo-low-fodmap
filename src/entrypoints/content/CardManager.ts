import { ProductManager } from '@/entrypoints/content/ProductManager'
import { StyleManager } from '@/entrypoints/content/StyleManager'
import { Config } from '@/utils/Config'
import { Product } from '@/utils/db'
import { ErrorHandler } from '@/utils/ErrorHandler'
import { Logger } from '@/utils/Logger'
import type { InjectedProductData } from '@/utils/types'

/**
 * Manages DOM operations and visual styling for product cards on Glovo pages.
 * Responsible for identifying, tagging, and updating product cards with FODMAP status information.
 *
 * Key responsibilities:
 * - Finding untagged product cards on the page
 * - Associating cards with product hashes for database lookups
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
   * Tags visible product cards with hashes for database association
   * Matches card names with injected product data to establish data relationships
   *
   * @param products - Array of product data containing names and hashes
   *
   * Process:
   * 1. Finds all untagged cards on the page (no data-hash attribute)
   * 2. Creates name-to-hash mapping from provided product data
   * 3. Extracts product names from card DOM elements
   * 4. Associates matching cards with hashes via data attributes
   *
   * Used when: New products are injected via content script or API responses
   */
  static tagVisibleCards(products: InjectedProductData[]): void {
    try {
      const untaggedCards = document.querySelectorAll<HTMLElement>(
        `${CardManager.CARD_SELECTOR}:not([data-hash])`,
      )
      const productMap = new Map(products.map((p) => [p.name.trim(), p.hash]))

      untaggedCards.forEach((card) => {
        const cardName = card
          .querySelector(CardManager.CARD_NAME_SELECTOR)
          ?.textContent?.trim()

        if (!cardName) return

        const hash = productMap.get(cardName)
        if (hash) {
          card.dataset.hash = hash.toString()
        }
      })

      Logger.info('Content', `Tagged ${untaggedCards.length} cards with hashes`)
    } catch (error) {
      ErrorHandler.logError('Content', error, { context: 'Card tagging' })
    }
  }

  /**
   * Tags visible product cards using database product records
   * Alternative to tagVisibleCards when working with stored Product objects instead of injected data
   *
   * @param products - Array of Product objects from database with names and hashes
   *
   * Features case-insensitive name matching for better reliability
   * Used when: DOM scanning discovers products that already exist in database
   */
  static tagVisibleCardsByName(products: Product[]): void {
    try {
      const untaggedCards = document.querySelectorAll<HTMLElement>(
        `${CardManager.CARD_SELECTOR}:not([data-hash])`,
      )
      const productMap = new Map(
        products.map((p) => [p.name.trim().toLowerCase(), p.hash]),
      )

      untaggedCards.forEach((card) => {
        const cardName = card
          .querySelector(CardManager.CARD_NAME_SELECTOR)
          ?.textContent?.trim()

        if (!cardName) return

        const hash = productMap.get(cardName.toLowerCase())
        if (hash) {
          card.dataset.hash = hash.toString()
        }
      })

      Logger.info(
        'Content',
        `Tagged ${untaggedCards.length} cards with hashes from database`,
      )
    } catch (error) {
      ErrorHandler.logError('Content', error, {
        context: 'Card tagging by name',
      })
    }
  }

  /**
   * Retrieves all product cards that have been tagged with hashes
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
        `${CardManager.CARD_SELECTOR}[data-hash]`,
      ),
    )
  }

  /**
   * Updates visual styling for all tagged product cards based on current FODMAP data
   * Coordinates between database lookups and visual styling application
   *
   * @param hideNonLowFodmap - Whether to hide products that are not LOW FODMAP
   * @param hideNonFoodItems - Whether to hide products that are not food
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
   * 2. Batch fetches product data from database by hashes
   * 3. Compares current card state with desired state
   * 4. Applies styling changes only when necessary
   * 5. Updates visibility based on user preferences
   *
   * Called by: FodmapHelper during periodic updates, setting changes,
   * and after new FODMAP classifications are received
   */
  static async updateAllCards(
    hideNonLowFodmap: boolean,
    hideNonFoodItems: boolean = false,
  ): Promise<void> {
    try {
      const allCards = CardManager.getTaggedCards()
      if (allCards.length === 0) return

      const hashes = allCards.map((card) => card.dataset.hash!)
      const dbMap = await ProductManager.getProductsByHashes(hashes)
      let changedCards = 0

      allCards.forEach((card) => {
        const hash = card.dataset.hash
        if (!hash) return

        const product = dbMap.get(hash)
        if (product) {
          const currentStatus = card.dataset.fodmapStatus

          // Determine visibility based on both FODMAP status and food type
          // Hide non-low FODMAP products only if they are food items
          const shouldHideForFodmap =
            product.status !== 'LOW' &&
            hideNonLowFodmap &&
            product.isFood !== false
          const shouldHideForNonFood =
            product.isFood === false && hideNonFoodItems
          const shouldBeHidden = shouldHideForFodmap || shouldHideForNonFood

          const isCurrentlyHidden =
            card.classList.contains('fodmap-card-hidden')

          // Only apply styling if there's an actual change needed
          if (
            currentStatus !== product.status ||
            isCurrentlyHidden !== shouldBeHidden
          ) {
            StyleManager.applyToCard(card, product, shouldBeHidden)
            changedCards++
          }
        }
      })

      // Only log info message when there were changes
      if (changedCards > 0) {
        const filterDescription = []
        if (hideNonLowFodmap)
          filterDescription.push('hiding non-LOW FODMAP food items')
        if (hideNonFoodItems) filterDescription.push('hiding non-food items')
        const filterText =
          filterDescription.length > 0
            ? `(${filterDescription.join(', ')})`
            : '(showing all)'

        Logger.info(
          'Content',
          `Updated styles for ${changedCards}/${allCards.length} cards ${filterText}`,
        )
      }
    } catch (error) {
      ErrorHandler.logError('Content', error, {
        context: 'Updating all cards',
        metadata: { hideNonLowFodmap, hideNonFoodItems },
      })
    }
  }
}
