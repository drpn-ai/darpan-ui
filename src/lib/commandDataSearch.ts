import type { GeneratedOutput, SftpServerRecord } from './api/types'
import type { CommandAction } from './types/ux'
import { resolveRecordLabel } from './utils/recordLabel'
import { countLabel } from './utils/strings'

const DEFAULT_RESULT_LIMIT = 6

function toIdSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value.trim())
}

function buildActionId(prefix: string, values: string[]): string {
  const normalizedValues = values.map(toIdSegment).filter(Boolean).join('-')
  return [prefix, normalizedValues || 'record'].join('-')
}

function appendQueryParams(path: string, params: Record<string, string | undefined>): string {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    const trimmedValue = value?.trim()
    if (trimmedValue) query.set(key, trimmedValue)
  })

  const queryText = query.toString()
  return queryText ? `${path}?${queryText}` : path
}

function compactAliases(values: Array<string | number | undefined>): string[] {
  const seen = new Set<string>()

  return values
    .map((value) => String(value ?? '').trim())
    .filter((value) => value.length > 0)
    .filter((value) => {
      const normalized = value.toLowerCase()
      if (seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })
}

function describeSftpServer(server: SftpServerRecord): string {
  const connection = [server.host, server.username ? `as ${server.username}` : ''].filter(Boolean).join(' ')
  return connection || 'Open the SFTP server editor.'
}

function resolveOutputLabel(output: GeneratedOutput): string {
  return resolveRecordLabel({
    primary: output.savedRunName,
    description: output.mappingName,
    fallbackId: output.fileName,
  })
}

function describeGeneratedOutput(output: GeneratedOutput): string {
  const diffText = typeof output.totalDifferences === 'number' ? countLabel(output.totalDifferences, 'difference') : 'Saved result'
  const systemLabels = [output.file1Label, output.file2Label].map((label) => label?.trim()).filter(Boolean)

  if (systemLabels.length === 2) return `${diffText} for ${systemLabels[0]} and ${systemLabels[1]}.`
  if (systemLabels.length === 1) return `${diffText} for ${systemLabels[0]}.`
  return `${diffText}.`
}

export function buildSftpServerCommandActions(
  servers: SftpServerRecord[],
  limit = DEFAULT_RESULT_LIMIT,
): CommandAction[] {
  return servers.slice(0, limit).map((server) => {
    const label = resolveRecordLabel({
      description: server.description,
      fallbackId: server.sftpServerId,
    })

    return {
      id: buildActionId('data-sftp-server', [server.sftpServerId]),
      label: `Edit SFTP: ${label}`,
      description: describeSftpServer(server),
      group: 'Data',
      to: `/settings/sftp/edit/${encodePathSegment(server.sftpServerId)}`,
      aliases: compactAliases([
        label,
        server.sftpServerId,
        server.description,
        server.host,
        server.username,
        'sftp',
        'sftp server',
        'file server',
        'edit sftp',
      ]),
      requiresQuery: true,
    }
  })
}

export function buildGeneratedOutputCommandActions(
  outputs: GeneratedOutput[],
  limit = DEFAULT_RESULT_LIMIT,
): CommandAction[] {
  return outputs
    .filter((output) => output.savedRunId?.trim() && output.fileName?.trim())
    .slice(0, limit)
    .map((output) => {
      const label = resolveOutputLabel(output)
      const resultPath = `/reconciliation/run-result/${encodePathSegment(output.savedRunId ?? '')}/${encodePathSegment(output.fileName)}`

      return {
        id: buildActionId('data-run-result', [output.savedRunId ?? '', output.fileName]),
        label: `Open Result: ${label}`,
        description: describeGeneratedOutput(output),
        group: 'Data',
        to: appendQueryParams(resultPath, {
          runName: output.savedRunName || output.mappingName,
          file1SystemLabel: output.file1Label,
          file2SystemLabel: output.file2Label,
        }),
        aliases: compactAliases([
          label,
          output.fileName,
          output.savedRunId,
          output.savedRunName,
          output.mappingName,
          output.file1Label,
          output.file2Label,
          'run result',
          'saved result',
          'diff result',
          'open result',
        ]),
        requiresQuery: true,
      }
    })
}

export function buildDataCommandActions({
  sftpServers,
  generatedOutputs,
}: {
  sftpServers: SftpServerRecord[]
  generatedOutputs: GeneratedOutput[]
}): CommandAction[] {
  return [
    ...buildGeneratedOutputCommandActions(generatedOutputs),
    ...buildSftpServerCommandActions(sftpServers),
  ]
}
