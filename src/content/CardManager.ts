import { Config } from '../shared/Config'
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

  static getTaggedCards(): HTMLElement[] {
    return Array.from(
      document.querySelectorAll<HTMLElement>(
        `${CardManager.CARD_SELECTOR}[data-external-id]:not([data-fodmap-style-applied])`,
      ),
    )
  }

  static async updateAllCards(hideNonLowFodmap: boolean): Promise<void> {
    return await PerformanceMonitor.measureAsync('updateAllCards', async () => {
      try {
        const allCards = CardManager.getTaggedCards()
        if (allCards.length === 0) return

        const externalIds = allCards.map((card) => card.dataset.externalId!)
        const dbMap = await ProductManager.getProductsByExternalIds(externalIds)

        allCards.forEach((card) => {
          const externalId = card.dataset.externalId
          if (!externalId) return

          const product = dbMap.get(externalId)
          if (product) {
            const shouldBeHidden = product.status !== 'LOW' && hideNonLowFodmap
            StyleManager.applyToCard(card, product.status, shouldBeHidden)
          }
        })

        ErrorHandler.logInfo(
          'Content',
          `Updated styles for ${allCards.length} cards`,
        )
      } catch (error) {
        ErrorHandler.logError('Content', error, {
          context: 'Card style update',
        })
      }
    })
  }
}
