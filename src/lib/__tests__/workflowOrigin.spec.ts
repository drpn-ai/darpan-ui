import { describe, expect, it } from 'vitest'
import {
  WORKFLOW_ORIGIN_LABEL_KEY,
  WORKFLOW_ORIGIN_PATH_KEY,
  WORKFLOW_ORIGIN_ROUTE_STATE_KEY,
  buildWorkflowOriginState,
  resolveStaticPageLabel,
} from '../workflowOrigin'

describe('workflowOrigin', () => {
  it('builds a serializable workflow origin state payload', () => {
    expect(buildWorkflowOriginState('Dashboard', '/')).toEqual({
      [WORKFLOW_ORIGIN_LABEL_KEY]: 'Dashboard',
      [WORKFLOW_ORIGIN_PATH_KEY]: '/',
    })
  })

  it('builds a workflow origin payload with optional route state', () => {
    expect(
      buildWorkflowOriginState('Run Details', '/reconciliation/ruleset-manager', {
        reconciliationRuleSetDraft: { runName: 'JSON Order Compare' },
      }),
    ).toEqual({
      [WORKFLOW_ORIGIN_LABEL_KEY]: 'Run Details',
      [WORKFLOW_ORIGIN_PATH_KEY]: '/reconciliation/ruleset-manager',
      [WORKFLOW_ORIGIN_ROUTE_STATE_KEY]: {
        reconciliationRuleSetDraft: { runName: 'JSON Order Compare' },
      },
    })
  })

  it('returns the static page label for non-workflow routes', () => {
    expect(
      resolveStaticPageLabel({
        meta: {
          surfaceMode: 'static',
          staticPageLabel: 'Dashboard',
        },
      }),
    ).toBe('Dashboard')
  })

  it('does not resolve a static label for workflow routes', () => {
    expect(
      resolveStaticPageLabel({
        meta: {
          surfaceMode: 'workflow',
          staticPageLabel: 'Dashboard',
        },
      }),
    ).toBeNull()
  })
})
