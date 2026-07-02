import { ref, type ComputedRef, type Ref } from 'vue'
import { ApiCallError } from '../lib/api/client'
import { reconciliationFacade } from '../lib/api/facade'
import type { GetGeneratedOutputFile } from '../lib/api/types'
import { downloadTextFile } from '../lib/utils/download'
import type { RunSourceFileView } from './useRunResultSourceDetails'

export type DownloadableOutputFile = Omit<GetGeneratedOutputFile, 'contentText'>

export interface UseRunResultDownloadsDeps {
  outputFileName: ComputedRef<string>
}

export interface UseRunResultDownloads {
  downloadableOutputFile: Ref<DownloadableOutputFile | null>
  sourceDownloadError: Ref<string | null>
  downloadingSourceFilePath: Ref<string>
  resultDownloadError: Ref<string | null>
  downloadingSavedResult: Ref<boolean>
  downloadRunSourceFile: (sourceFile: RunSourceFileView) => Promise<void>
  downloadSavedResult: () => Promise<void>
  resetDownloadState: () => void
}

export function useRunResultDownloads(deps: UseRunResultDownloadsDeps): UseRunResultDownloads {
  const downloadableOutputFile = ref<DownloadableOutputFile | null>(null)
  const sourceDownloadError = ref<string | null>(null)
  const downloadingSourceFilePath = ref('')
  const resultDownloadError = ref<string | null>(null)
  const downloadingSavedResult = ref(false)

  async function downloadRunSourceFile(sourceFile: RunSourceFileView): Promise<void> {
    if (!sourceFile.filePath || downloadingSourceFilePath.value) return

    downloadingSourceFilePath.value = sourceFile.filePath
    sourceDownloadError.value = null

    try {
      const response = await reconciliationFacade.getGeneratedOutput({
        fileName: sourceFile.filePath,
        format: sourceFile.sourceFormat || 'json',
      })
      const outputFile = response.outputFile
      if (!outputFile?.contentText) throw new Error('Unable to download source file.')

      downloadTextFile(
        outputFile.downloadFileName || sourceFile.downloadFileName || sourceFile.fileName,
        outputFile.contentText,
        outputFile.contentType || (sourceFile.sourceFormat === 'csv' ? 'text/csv; charset=UTF-8' : 'application/json; charset=UTF-8'),
      )
    } catch (error) {
      sourceDownloadError.value = error instanceof ApiCallError ? error.message : 'Unable to download source file.'
    } finally {
      downloadingSourceFilePath.value = ''
    }
  }

  async function downloadSavedResult(): Promise<void> {
    if (!downloadableOutputFile.value || downloadingSavedResult.value) return

    downloadingSavedResult.value = true
    resultDownloadError.value = null

    try {
      const response = await reconciliationFacade.getGeneratedOutput({
        fileName: deps.outputFileName.value,
        format: 'json',
      })
      const outputFile = response.outputFile
      if (!outputFile?.contentText) throw new Error('Unable to download saved result.')

      downloadTextFile(
        outputFile.downloadFileName || downloadableOutputFile.value.downloadFileName || deps.outputFileName.value || 'saved-result.json',
        outputFile.contentText,
        outputFile.contentType || downloadableOutputFile.value.contentType || 'application/json',
      )
    } catch (error) {
      resultDownloadError.value = error instanceof ApiCallError ? error.message : 'Unable to download saved result.'
    } finally {
      downloadingSavedResult.value = false
    }
  }

  function resetDownloadState(): void {
    downloadableOutputFile.value = null
    sourceDownloadError.value = null
    downloadingSourceFilePath.value = ''
    resultDownloadError.value = null
    downloadingSavedResult.value = false
  }

  return {
    downloadableOutputFile,
    sourceDownloadError,
    downloadingSourceFilePath,
    resultDownloadError,
    downloadingSavedResult,
    downloadRunSourceFile,
    downloadSavedResult,
    resetDownloadState,
  }
}
