import { db, type Product } from '@/utils/db'
import { ErrorHandler } from '@/utils/ErrorHandler'
import { Logger } from '@/utils/Logger'
import { getProductHash } from '@/utils/ProductHash'
import type { InjectedProductData } from '@/utils/types'

/**
 * Manages product data operations including saving, updating, and querying products.
 * Acts as the main interface between the extension and the IndexedDB database for product data.
 * Handles product lifecycle from initial discovery to FODMAP classification completion.
 */
export class ProductManager {
  /**
   * Resets submittedAt for products that are stuck in PENDING and not found by API.
   * Call after polling if API returns missing hashes.
   */
  static async resetSubmittedAtForMissingProducts(
    hashes: string[],
  ): Promise<void> {
    if (!hashes || hashes.length === 0) return

    const count = await db.products
      .where('hash')
      .anyOf(hashes)
      .modify({ submittedAt: null })

    if (count > 0) {
      Logger.info(
        'Content',
        `Reset submittedAt for ${count}/${hashes.length} missing products`,
      )
    }
  }
  /**
   * Saves new products discovered from Glovo pages to the database.
   * Only saves products that don't already exist to avoid duplicates.
   * Newly discovered products start with PENDING status for classification.
   *
   * @param products - Array of product data extracted from Glovo pages
   */
  static async saveNewProducts(products: InjectedProductData[]): Promise<void> {
    const incomingProducts: Product[] = products.map((p) => ({
      name: p.name,
      hash: getProductHash(p.name),
      price: p.price,
      category: p.category || 'Uncategorized',
      status: p.status || 'PENDING',
    }))

    const incomingHashes = incomingProducts.map((p) => p.hash)

    try {
      await db.transaction('rw', db.products, async () => {
        const existingProducts = await db.products
          .where('hash')
          .anyOf(incomingHashes)
          .toArray()

        const existingHashes = new Set(existingProducts.map((p) => p.hash))
        const newProductsToDb = incomingProducts.filter(
          (p) => !existingHashes.has(p.hash),
        )

        if (newProductsToDb.length > 0) {
          await db.products.bulkAdd(newProductsToDb)
          Logger.info(
            'Content',
            `Added ${newProductsToDb.length} new products to database`,
          )
          chrome.runtime.sendMessage({
            action: 'newProductsFound',
            data: {
              newProductHashes: newProductsToDb.map((p) => p.hash),
            },
          })
        }
      })
    } catch (error) {
      ErrorHandler.logError('Content', error, {
        context: 'Dexie transaction',
      })
    }
  }

  /**
   * Updates product statuses and timestamps based on API responses.
   * Used to save classification results received from the FODMAP API.
   * Updates both FODMAP status and processing timestamps.
   *
   * @param apiProducts - Products with updated status information from the API
   */
  static async updateStatuses(apiProducts: Product[]): Promise<void> {
    try {
      await db.transaction('rw', db.products, async () => {
        const hashes = apiProducts.map((p) => p.hash)
        const localProducts = await db.products
          .where('hash')
          .anyOf(hashes)
          .toArray()

        const localProductMap = new Map(localProducts.map((p) => [p.hash, p]))
        const finalUpdates: Product[] = []

        for (const apiProduct of apiProducts) {
          const localProduct = localProductMap.get(apiProduct.hash)
          if (localProduct) {
            localProduct.status = apiProduct.status

            // Update submittedAt if provided
            if (apiProduct.submittedAt !== undefined) {
              localProduct.submittedAt = apiProduct.submittedAt
            }

            // Update processedAt if provided
            if (apiProduct.processedAt !== undefined) {
              localProduct.processedAt = apiProduct.processedAt
            }

            // Update explanation if provided
            if (apiProduct.explanation !== undefined) {
              localProduct.explanation = apiProduct.explanation
            }

            // Update isFood if provided
            if (apiProduct.isFood !== undefined) {
              localProduct.isFood = apiProduct.isFood
            }

            finalUpdates.push(localProduct)
          }
        }

        if (finalUpdates.length > 0) {
          await db.products.bulkPut(finalUpdates)
          Logger.info(
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
  }

  /**
   * Retrieves products that need to be submitted to the FODMAP API for classification.
   * Returns products with UNKNOWN or PENDING status that haven't been submitted yet.
   * Used by sync operations to find products that need API processing.
   *
   * @returns Promise resolving to array of unsubmitted products
   */
  static async getUnsubmittedProducts(): Promise<Product[]> {
    return (
      (await ErrorHandler.safeExecute(
        async () =>
          db.products
            .where('status')
            .anyOf(['UNKNOWN', 'PENDING'])
            .and(
              (product) =>
                product.submittedAt === null ||
                product.submittedAt === undefined,
            )
            .toArray(),
        'Content',
        [],
      )) || []
    )
  }

  /**
   * Retrieves products that have been submitted to the API but not yet processed.
   * Returns products with PENDING status that have submittedAt but no processedAt timestamp.
   * Used by polling operations to check for completed classifications.
   *
   * @returns Promise resolving to array of submitted but unprocessed products
   */
  static async getSubmittedUnprocessedProducts(): Promise<Product[]> {
    return (
      (await ErrorHandler.safeExecute(
        async () =>
          db.products
            .where('status')
            .equals('PENDING')
            .and(
              (product) =>
                product.submittedAt !== null &&
                product.submittedAt !== undefined &&
                (product.processedAt === null ||
                  product.processedAt === undefined),
            )
            .toArray(),
        'Content',
        [],
      )) || []
    )
  }

  /**
   * Retrieves products by their hashes and returns them as a Map for efficient lookup.
   * Used when you need to quickly find specific products by their hash.
   *
   * @param hashes - Array of product hashes to search for
   * @returns Promise resolving to Map with hash as key and Product as value
   */
  static async getProductsByHashes(
    hashes: string[],
  ): Promise<Map<string, Product>> {
    const products =
      (await ErrorHandler.safeExecute(
        async () => db.products.where('hash').anyOf(hashes).toArray(),
        'Content',
        [],
      )) || []
    return new Map(products.map((p) => [p.hash, p]))
  }

  /**
   * Retrieves products by their hashes and returns them as an array.
   * Similar to getProductsByHashes but returns an array instead of a Map.
   *
   * @param hashes - Array of product hashes to search for
   * @returns Promise resolving to array of matching products
   */
  static async getProductsArrayByHashes(hashes: string[]): Promise<Product[]> {
    return (
      (await ErrorHandler.safeExecute(
        async () => db.products.where('hash').anyOf(hashes).toArray(),
        'Content',
        [],
      )) || []
    )
  }

  /**
   * Retrieves products by their names using case-insensitive matching.
   * Useful for finding products when you have the product name from the UI.
   * Normalizes names by trimming whitespace and converting to lowercase.
   *
   * @param names - Array of product names to search for
   * @returns Promise resolving to array of products with matching names
   */
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

  /**
   * Retrieves all products from the database.
   * Used for statistics, export functionality, and debugging.
   * Note: This can be memory-intensive with large product databases.
   *
   * @returns Promise resolving to array of all stored products
   */
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
