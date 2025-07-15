import Dexie, { type Table } from 'dexie'

export type FodmapStatus = 'LOW' | 'HIGH' | 'UNKNOWN' | 'PENDING'

export interface Product {
  externalId: string
  name: string
  price?: number
  status: FodmapStatus
  category: string
}

export class FodmapDatabase extends Dexie {
  products!: Table<Product>

  constructor() {
    super('fodmapDatabase')
    this.version(7).stores({
      products: '++id, &externalId, name, status',
    })
  }
}

export const db = new FodmapDatabase()
