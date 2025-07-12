export interface Image {
  imageUrl: string
  imageServiceId: string
}

export interface Tracking {
  increment: number
  productSaleType: string
  isWeightedProduct: boolean
  subCategory: string
  subCategoryId: string
}

export interface ProductsResponse {
  type: string
  data: ProductsResponseData
}

export interface ProductsResponseData {
  title: string
  body: ProductsResponseBody[]
}

export interface ProductsResponseBody {
  id: string
  type: string
  data: ProductsResponseBodyData
}

export interface ProductsResponseBodyData {
  title: string
  slug: string
  elements: ProductElement[]
  columns: number
}

export interface ProductElement {
  type: string
  data: Product
}

export interface Product {
  /**
   * The category of the product, e.g., "Dairy", "Fruits", etc.
   * This is set based on the title of the data object in the response.
   * If the title is not available, it defaults to 'Uncategorized'.
   * @example "Dairy"
   */
  category: string
  id: number
  externalId: string
  storeProductId: string
  name: string
  description: string
  price: number
  priceInfo: PriceInfo
  images: unknown[]
  tags: unknown[]
  attributeGroups: unknown[]
  promotions: unknown[]
  indicators: unknown[]
  sponsored: boolean
  restricted: boolean
  tracking: Tracking
  showQuantifiers: boolean
}

export interface PriceInfo {
  amount: number
  currencyCode: string
  displayText: string
}
