import Dexie, { type Table } from 'dexie'

export type FodmapStatus = 'LOW' | 'HIGH' | 'UNKNOWN' | 'PENDING'

export interface Product {
  externalId: string
  name: string
  price?: number
  status: FodmapStatus
  category: string
  submittedAt?: Date | null // Timestamp when product was submitted to API (client-side)
  processedAt?: Date | null // Timestamp when backend finished processing (server-side)
}

export class FodmapDatabase extends Dexie {
  products!: Table<Product>

  constructor() {
    super('fodmapDatabase')
    this.version(8).stores({
      products: '++id, &externalId, name, status, submittedAt, processedAt',
    })
  }
}

export const db = new FodmapDatabase()
