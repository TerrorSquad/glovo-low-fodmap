import Dexie, { type Table } from 'dexie'

export type FodmapStatus = 'LOW' | 'MODERATE' | 'HIGH' | 'UNKNOWN' | 'PENDING'

export interface Product {
  externalId: string
  name: string
  price?: number
  status: FodmapStatus
  category: string
  submittedAt?: Date | null // Timestamp when product was submitted to API (client-side)
  processedAt?: Date | null // Timestamp when backend finished processing (server-side)
  explanation?: string // Serbian language explanation of why product has this FODMAP status
  isFood?: boolean // Whether this product is food or not
}

export class FodmapDatabase extends Dexie {
  products!: Table<Product>

  constructor() {
    super('fodmapDatabase')
    this.version(9).stores({
      products:
        '++id, &externalId, name, status, submittedAt, processedAt, isFood',
    })
  }
}

export const db = new FodmapDatabase()
