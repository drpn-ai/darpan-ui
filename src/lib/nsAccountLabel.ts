import { settingsFacade } from './api/facade'

/**
 * DAR-UI-050. A NetSuite account as people know it: its description, as the account list and the create flow show it.
 * The id is the fallback when the account has no description or the list cannot be read; it is never worth an error.
 */
export async function nsAccountLabel(nsAuthConfigId: string): Promise<string> {
  try {
    const response = await settingsFacade.listNsAuthConfigs({ pageIndex: 0, pageSize: 100 })
    const account = (response.authConfigs ?? []).find((c) => c.nsAuthConfigId === nsAuthConfigId)
    return account?.description?.trim() || nsAuthConfigId
  } catch {
    return nsAuthConfigId
  }
}
