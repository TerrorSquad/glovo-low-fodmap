import { Config } from '../shared/Config'
import { type Product } from '../shared/db'
import { ErrorHandler } from '../shared/ErrorHandler'
import { PerformanceMonitor } from '../shared/PerformanceMonitor'
import { type InjectedProductData } from '../shared/types'
import { ProductManager } from './ProductManager'
import { StyleManager } from './StyleManager'

/**
 * Handles DOM operations for product cards
 */
export class CardManager {
  private static readonly CARD_SELECTOR = Config.SELECTORS.CARD
  private static readonly CARD_NAME_SELECTOR = Config.SELECTORS.CARD_NAME

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

  static getTaggedCards(): HTMLElement[] {
    return Array.from(
      document.querySelectorAll<HTMLElement>(
        `${CardManager.CARD_SELECTOR}[data-external-id]:not([data-fodmap-style-applied])`,
      ),
    )
  }

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
              `Updated styles for ${changedCards}/${allCards.length} cards`,
            )
          }
        } catch (error) {
          ErrorHandler.logError('Content', error, {
            context: 'Card style update',
          })
        }
      },
      {
        threshold: 5, // Only log if update takes more than 5ms
        debugOnly: false, // Log updateAllCards even in non-debug mode but only when slow
        metadata: { hideNonLowFodmap },
      },
    )
  }
}
