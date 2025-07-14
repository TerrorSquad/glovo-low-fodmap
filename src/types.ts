import type { FodmapStatus } from './db'

export interface InjectedProductData {
  externalId: string
  name: string
  description?: string
  category: string
  status: FodmapStatus
  price?: number
}

export interface ChromeMessage {
  action: string
  payload?: any
  data?: any
  hide?: boolean
}

export interface LogPayload {
  level: 'log' | 'info' | 'warn' | 'error'
  message: string
  optionalParams: unknown[]
}
