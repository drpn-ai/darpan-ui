import { describe, expect, it } from 'vitest'
import { OMS_BASE_URL_PLACEHOLDER, OMS_HOST_PLACEHOLDER, OMS_SWAGGER_SOURCE } from '../omsSwagger'

describe('HotWax Swagger metadata', () => {
  // The orders-endpoint swagger doc that used to live here was deleted once the per-endpoint
  // registry (SourceConfigEndpoint) became the source of truth for endpoint labels -- see
  // ReconciliationRuleSetManagerPage.vue and the two settings dashboard pages. What remains here
  // is placeholder/display metadata only, never a live API target.
  it('captures the placeholder HotWax host and base URL used for setup hints', () => {
    expect(OMS_BASE_URL_PLACEHOLDER).toBe(`https://${OMS_HOST_PLACEHOLDER}`)
    expect(OMS_SWAGGER_SOURCE.title).toBe('HotWax API')
    expect(OMS_SWAGGER_SOURCE.basePath).toBe('/rest/s1/oms/orders')
  })
})
