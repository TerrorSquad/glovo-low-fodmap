import { db, type Product } from '../shared/db'
import { ErrorHandler } from '../shared/ErrorHandler'
import { PerformanceMonitor } from '../shared/PerformanceMonitor'
import type { InjectedProductData } from '../shared/types'

/**
 * Manages product data operations
 */
export class ProductManager {
  static async saveNewProducts(products: InjectedProductData[]): Promise<void> {
    return await PerformanceMonitor.measureAsync(
      'saveNewProducts',
      async () => {
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
              ErrorHandler.logInfo(
                'Content',
                `Added ${newProductsToDb.length} new products to database`,
              )
              chrome.runtime.sendMessage({
                action: 'newProductsFound',
                data: {
                  newProductIds: newProductsToDb.map((p) => p.externalId),
                },
              })
            }
          })
        } catch (error) {
          ErrorHandler.logError('Content', error, {
            context: 'Dexie transaction',
          })
        }
      },
    )
  }

  static async updateStatuses(apiProducts: Product[]): Promise<void> {
    return await PerformanceMonitor.measureAsync('updateStatuses', async () => {
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
            ErrorHandler.logInfo(
              'Content',
              `Updated ${finalUpdates.length} product statuses from API`,
            )
          }
        })
      } catch (error) {
        ErrorHandler.logError('Content', error, {
          context: 'Database status update',
        })
        throw error
      }
    })
  }

  static async getPendingProducts(): Promise<Product[]> {
    return (
      (await ErrorHandler.safeExecute(
        async () => db.products.where('status').equals('PENDING').toArray(),
        'Content',
        [],
      )) || []
    )
  }

  static async getUnknownProducts(): Promise<Product[]> {
    return (
      (await ErrorHandler.safeExecute(
        async () => db.products.where('status').equals('UNKNOWN').toArray(),
        'Content',
        [],
      )) || []
    )
  }

  static async getProductsByExternalIds(
    externalIds: string[],
  ): Promise<Map<string, Product>> {
    const products =
      (await ErrorHandler.safeExecute(
        async () =>
          db.products.where('externalId').anyOf(externalIds).toArray(),
        'Content',
        [],
      )) || []
    return new Map(products.map((p) => [p.externalId, p]))
  }

  static async getProductsArrayByExternalIds(
    externalIds: string[],
  ): Promise<Product[]> {
    return (
      (await ErrorHandler.safeExecute(
        async () =>
          db.products.where('externalId').anyOf(externalIds).toArray(),
        'Content',
        [],
      )) || []
    )
  }

  static async getProductsByNames(names: string[]): Promise<Product[]> {
    return (
      (await ErrorHandler.safeExecute(
        async () => {
          // Clean and normalize names for better matching
          const normalizedNames = names.map((name) => name.trim().toLowerCase())

          // Get all products and filter by normalized names
          const allProducts = await db.products.toArray()
          return allProducts.filter((product) =>
            normalizedNames.includes(product.name.trim().toLowerCase()),
          )
        },
        'Content',
        [],
      )) || []
    )
  }

  static async getAllProducts(): Promise<Product[]> {
    return (
      (await ErrorHandler.safeExecute(
        async () => db.products.toArray(),
        'Content',
        [],
      )) || []
    )
  }
}
