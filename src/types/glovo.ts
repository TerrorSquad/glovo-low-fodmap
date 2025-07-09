export interface GlovoProducts {
  type: string;
  data: GlovoProductsData;
}

export interface GlovoProductsData {
  title: string;
  body:  Body[];
}

export interface Body {
  id:   string;
  type: string;
  data: BodyData;
}

export interface BodyData {
  title:    string;
  slug:     string;
  elements: Element[];
  tracking: FluffyTracking;
  columns:  number;
}

export interface Element {
  type: string;
  data: ElementData;
}

export interface ElementData {
  id:              number;
  externalId:      string;
  storeProductId:  string;
  name:            string;
  description:     string;
  price:           number;
  priceInfo:       PriceInfo;
  images:          any[];
  tags:            any[];
  attributeGroups: any[];
  promotions:      any[];
  indicators:      any[];
  sponsored:       boolean;
  restricted:      boolean;
  tracking:        PurpleTracking;
  showQuantifiers: boolean;
}

export interface PriceInfo {
  amount:       number;
  currencyCode: string;
  displayText:  string;
}

export interface PurpleTracking {
  increment:         number;
  productSaleType:   string;
  isWeightedProduct: boolean;
  subCategory:       string;
  subCategoryId:     string;
}

export interface FluffyTracking {
  collectionSectionId: number;
}
