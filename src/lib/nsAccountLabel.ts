import { settingsFacade } from './api/facade'

/**
 * DAR-UI-051. Every account's description by id, empty when the list cannot be read. The list does not depend on
 * which account a page names, so a page fetches it beside the record that names one, not after it.
 */
export async function nsAccountLabels(): Promise<Record<string, string>> {
  try {
    const response = await settingsFacade.listNsAuthConfigs({ pageIndex: 0, pageSize: 100 })
    return Object.fromEntries((response.authConfigs ?? []).map((c) => [c.nsAuthConfigId, c.description?.trim() ?? '']))
  } catch {
    return {}
  }
}

export function accountLabelOf(labels: Record<string, string>, nsAuthConfigId: string): string {
  return labels[nsAuthConfigId] || nsAuthConfigId
}
