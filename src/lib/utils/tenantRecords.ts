interface TenantOwnedRecord {
  companyUserGroupId?: string | null
  /** DAR-BE-005: set by list#OmsRestSourceConfigs / list#ShopifyAuthConfigs / list#NsAuthConfigs /
   *  list#NsRestletConfigs to `companyUserGroupId != activeTenantUserGroupId` — i.e. true exactly
   *  for a row shared IN from another tenant. Those services already scope their response to what
   *  the active tenant may see (owned rows plus ConfigTenantAccess grants), so a shared-in row must
   *  pass this filter even though its companyUserGroupId is the owner's, not ours. Record types that
   *  never share (SftpServerRecord, SavedRunSummary, ...) simply never set this field, so `undefined
   *  === true` is false and their filtering is unchanged. */
  isShared?: boolean
}

function normalizeTenantId(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

export function filterRecordsForActiveTenant<T extends TenantOwnedRecord>(
  records: T[],
  activeTenantUserGroupId?: string | null,
): T[] {
  const activeTenantId = normalizeTenantId(activeTenantUserGroupId)
  if (!activeTenantId) return records

  return records.filter(
    (record) => record.isShared === true || normalizeTenantId(record.companyUserGroupId) === activeTenantId,
  )
}
