export interface OmsSwaggerEndpointDoc {
  id: string
  label: string
  method: string
  path: string
  summary: string
  responseSchema: string
  authLabels: string[]
  queryParameters: string[]
}

// Display/placeholder value only — sample host shown in OMS swagger docs and form hints; never a live API target.
export const OMS_HOST_PLACEHOLDER = 'dev-maarg.hotwax.io'

export const OMS_SWAGGER_SOURCE = {
  title: 'HotWax API',
  version: '1.0.0',
  scheme: 'https',
  host: OMS_HOST_PLACEHOLDER,
  basePath: '/rest/s1/oms/orders',
} as const

// Display/placeholder value only — derived from the placeholder host above; never a live API target.
export const OMS_BASE_URL_PLACEHOLDER = `${OMS_SWAGGER_SOURCE.scheme}://${OMS_SWAGGER_SOURCE.host}`

export const OMS_ORDERS_ENDPOINT_DOC: OmsSwaggerEndpointDoc = {
  id: 'orders-list',
  label: 'Orders API',
  method: 'GET',
  path: OMS_SWAGGER_SOURCE.basePath,
  summary: 'list OrderHeader (master: default)',
  responseSchema: 'OrderHeader.default[]',
  authLabels: ['Basic', 'API key header'],
  queryParameters: [
    'pageIndex',
    'pageSize',
    'orderByField',
    'pageNoLimit',
    'dependentLevels',
    'orderDate',
    'lastUpdatedStamp',
    'createdStamp',
  ],
}
