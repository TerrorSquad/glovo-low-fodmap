import { type FodmapStatus } from './db'

export interface InjectedProductData {
  externalId: string
  name: string
  description?: string
  category: string
  status: FodmapStatus
  price?: number
  explanation?: string // Serbian language explanation of why product has this FODMAP status
  isFood?: boolean // Whether this product is food or not
}

export interface ChromeMessage {
  action: string
  payload?: any
  data?: any
  hide?: boolean
  hideNonLowFodmap?: boolean
  hideNonFoodItems?: boolean
}

export interface LogPayload {
  level: 'log' | 'info' | 'warn' | 'error'
  message: string
  optionalParams: unknown[]
}
