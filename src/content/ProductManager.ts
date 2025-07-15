import { db, type Product } from '../shared/db'
import type { InjectedProductData } from '../shared/types'

/**
 * Manages product data operations
 */
export class ProductManager {
  static async saveNewProducts(products: InjectedProductData[]): Promise<void> {
    const incomingProducts: Product[] = products.map((p) => ({
      externalId: p.externalId,
      name: p.name,
      price: p.price,
      category: p.category || 'Uncategorized',
      status: p.status || 'PENDING',
    }))

    const incomingExtIds = incomingProducts.map((p) => p.externalId)

    try {
      await db.transaction('rw', db.products, async () => {
        const existingProducts = await db.products
          .where('externalId')
          .anyOf(incomingExtIds)
          .toArray()

        const existingExtIds = new Set(
          existingProducts.map((p) => p.externalId),
        )
        const newProductsToDb = incomingProducts.filter(
          (p) => !existingExtIds.has(p.externalId),
        )

        if (newProductsToDb.length > 0) {
          await db.products.bulkAdd(newProductsToDb)
          console.log(
            `[Content] Added ${newProductsToDb.length} new products to database.`,
          )
          chrome.runtime.sendMessage({ action: 'newProductsFound' })
        }
      })
    } catch (error) {
      console.error('[Content] Error in Dexie transaction:', error)
    }
  }

  static async updateStatuses(apiProducts: Product[]): Promise<void> {
    try {
      await db.transaction('rw', db.products, async () => {
        const externalIds = apiProducts.map((p) => p.externalId)
        const localProducts = await db.products
          .where('externalId')
          .anyOf(externalIds)
          .toArray()

        const localProductMap = new Map(
          localProducts.map((p) => [p.externalId, p]),
        )
        const finalUpdates: Product[] = []

        for (const apiProduct of apiProducts) {
          const localProduct = localProductMap.get(apiProduct.externalId)
          if (localProduct) {
            localProduct.status = apiProduct.status
            finalUpdates.push(localProduct)
          }
        }

        if (finalUpdates.length > 0) {
          await db.products.bulkPut(finalUpdates)
        }
      })
      console.log('[Content] Database updated with API statuses.')
    } catch (error) {
      console.error('[Content] Error updating database:', error)
      throw error
    }
  }

  static async getPendingProducts(): Promise<Product[]> {
    return await db.products.where('status').equals('PENDING').toArray()
  }

  static async getProductsByExternalIds(
    externalIds: string[],
  ): Promise<Map<string, Product>> {
    const products = await db.products
      .where('externalId')
      .anyOf(externalIds)
      .toArray()
    return new Map(products.map((p) => [p.externalId, p]))
  }
}
