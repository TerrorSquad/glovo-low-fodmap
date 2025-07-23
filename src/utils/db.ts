import Dexie, { type Table } from 'dexie'

export type FodmapStatus = 'LOW' | 'MODERATE' | 'HIGH' | 'UNKNOWN' | 'PENDING'

export interface Product {
  // hash used for deduplication
  name: string
  hash: string // Stable hash for deduplication (based on name)
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
    this.version(11).stores({
      products: '++id, &hash, name, status, submittedAt, processedAt, isFood',
    })
  }
}

export const db = new FodmapDatabase()
