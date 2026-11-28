import type { SessionInfo } from './api/types'
import { normalizeString } from './utils/strings'

export function resolveUserDisplayName(sessionInfo: SessionInfo | null | undefined): string {
  return normalizeString(sessionInfo?.displayName) || sessionInfo?.username || sessionInfo?.userId || 'Unknown user'
}
