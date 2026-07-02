import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

vi.mock('../../lib/api/facade', () => ({
  reconciliationFacade: {
    getGeneratedOutput: vi.fn(),
  },
}))

vi.mock('../../lib/utils/download', () => ({
  downloadTextFile: vi.fn(),
}))

import { useRunResultDownloads } from '../useRunResultDownloads'
import type { RunSourceFileView } from '../useRunResultSourceDetails'
import { ApiCallError } from '../../lib/api/client'
import { reconciliationFacade } from '../../lib/api/facade'
import { downloadTextFile } from '../../lib/utils/download'

const getGeneratedOutput = vi.mocked(reconciliationFacade.getGeneratedOutput)
const downloadFile = vi.mocked(downloadTextFile)

function buildDownloads() {
  return useRunResultDownloads({
    outputFileName: computed(() => 'CSV-Order-Compare-diff.json'),
  })
}

function buildSourceFile(overrides: Partial<RunSourceFileView> = {}): RunSourceFileView {
  return {
    key: 'file1-runs/RS/orders-1.csv',
    label: 'OMS',
    fileName: 'orders-1.csv',
    filePath: 'runs/RS/orders-1.csv',
    sourceFormat: 'csv',
    downloadFileName: 'orders-1.csv',
    canDownload: true,
    ...overrides,
  }
}

describe('useRunResultDownloads', () => {
  beforeEach(() => {
    getGeneratedOutput.mockReset()
    downloadFile.mockReset()
  })

  it('downloads a run source file with its own format and file name', async () => {
    getGeneratedOutput.mockResolvedValue({
      outputFile: {
        downloadFileName: 'orders-1.csv',
        contentText: 'id\n1001',
        contentType: 'text/csv; charset=UTF-8',
      },
    } as never)
    const downloads = buildDownloads()

    await downloads.downloadRunSourceFile(buildSourceFile())

    expect(getGeneratedOutput).toHaveBeenCalledWith({ fileName: 'runs/RS/orders-1.csv', format: 'csv' })
    expect(downloadFile).toHaveBeenCalledWith('orders-1.csv', 'id\n1001', 'text/csv; charset=UTF-8')
    expect(downloads.sourceDownloadError.value).toBeNull()
    expect(downloads.downloadingSourceFilePath.value).toBe('')
  })

  it('skips source downloads without a file path or while another download is running', async () => {
    const downloads = buildDownloads()

    await downloads.downloadRunSourceFile(buildSourceFile({ filePath: '' }))
    expect(getGeneratedOutput).not.toHaveBeenCalled()

    downloads.downloadingSourceFilePath.value = 'runs/RS/other.csv'
    await downloads.downloadRunSourceFile(buildSourceFile())
    expect(getGeneratedOutput).not.toHaveBeenCalled()
  })

  it('surfaces source download failures without leaving the busy flag set', async () => {
    getGeneratedOutput.mockRejectedValue(new ApiCallError('File is gone', 404))
    const downloads = buildDownloads()

    await downloads.downloadRunSourceFile(buildSourceFile())

    expect(downloads.sourceDownloadError.value).toBe('File is gone')
    expect(downloads.downloadingSourceFilePath.value).toBe('')
    expect(downloadFile).not.toHaveBeenCalled()
  })

  it('reports a generic source error when the response has no content', async () => {
    getGeneratedOutput.mockResolvedValue({ outputFile: { contentText: '' } } as never)
    const downloads = buildDownloads()

    await downloads.downloadRunSourceFile(buildSourceFile())

    expect(downloads.sourceDownloadError.value).toBe('Unable to download source file.')
  })

  it('downloads the saved result on demand using the route file name', async () => {
    getGeneratedOutput.mockResolvedValue({
      outputFile: {
        downloadFileName: 'downloaded-result.json',
        contentText: '{"download":true}',
        contentType: 'application/json',
      },
    } as never)
    const downloads = buildDownloads()
    downloads.downloadableOutputFile.value = {
      fileName: 'CSV-Order-Compare-diff.json',
      downloadFileName: 'CSV-Order-Compare-diff.json',
      contentType: 'application/json',
    } as never

    await downloads.downloadSavedResult()

    expect(getGeneratedOutput).toHaveBeenCalledWith({ fileName: 'CSV-Order-Compare-diff.json', format: 'json' })
    expect(downloadFile).toHaveBeenCalledWith('downloaded-result.json', '{"download":true}', 'application/json')
    expect(downloads.downloadingSavedResult.value).toBe(false)
  })

  it('skips the saved-result download when no downloadable file descriptor is loaded', async () => {
    const downloads = buildDownloads()

    await downloads.downloadSavedResult()

    expect(getGeneratedOutput).not.toHaveBeenCalled()
  })

  it('surfaces saved-result download failures', async () => {
    getGeneratedOutput.mockRejectedValue(new ApiCallError('Download blocked', 403))
    const downloads = buildDownloads()
    downloads.downloadableOutputFile.value = { fileName: 'CSV-Order-Compare-diff.json' } as never

    await downloads.downloadSavedResult()

    expect(downloads.resultDownloadError.value).toBe('Download blocked')
    expect(downloads.downloadingSavedResult.value).toBe(false)
  })

  it('resetDownloadState clears descriptors, errors, and busy flags', () => {
    const downloads = buildDownloads()
    downloads.downloadableOutputFile.value = { fileName: 'x.json' } as never
    downloads.sourceDownloadError.value = 'boom'
    downloads.downloadingSourceFilePath.value = 'runs/RS/orders-1.csv'
    downloads.resultDownloadError.value = 'boom'
    downloads.downloadingSavedResult.value = true

    downloads.resetDownloadState()

    expect(downloads.downloadableOutputFile.value).toBeNull()
    expect(downloads.sourceDownloadError.value).toBeNull()
    expect(downloads.downloadingSourceFilePath.value).toBe('')
    expect(downloads.resultDownloadError.value).toBeNull()
    expect(downloads.downloadingSavedResult.value).toBe(false)
  })
})
