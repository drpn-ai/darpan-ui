// DAR-UI-138, DAR-OPS-029 U09. A query page's runs from this visit: the newest three, each with its files' preview, and
// the words the Result step shows for them. Nothing here is saved; leaving the page clears them.
import { computed, ref } from 'vue'
import type { QueryError, QueryRun } from '../lib/api/scriptTypes'
import { statusWords } from '../lib/scriptDeployment'
import { formatClockTime } from '../lib/utils/date'
import { countLabel } from '../lib/utils/strings'

export interface QueryRunCell {
  n: number
  label: string
  time: string
  run: QueryRun
  meta: string
}

const MAX_RUNS = 3
const READ_KINDS: ReadonlySet<string> = new Set(['READ_ERROR', 'READ_NOT_ALLOWED', 'READ_TOO_LARGE'])

/** A read failure names its kind; a script error names its line. */
export function queryErrorText(error: QueryError): string {
  if (READ_KINDS.has(error.kind)) return `${statusWords(error.kind)}: ${error.message}`
  return `${error.line ? `Line ${error.line}: ` : ''}${error.message}`
}

export function rowsWords(count: number): string {
  return countLabel(count, 'row')
}

export function cellText(value: unknown): string {
  if (value == null) return ''
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

/** "120 units · 9 ms · read orders 3": what the run cost and what it read. */
export function runMeta(run: QueryRun): string {
  const reads = Object.entries(run.readCounts ?? {}).map(([name, count]) => `read ${name} ${count.toLocaleString()}`)
  return [
    ...(run.units != null ? [`${run.units.toLocaleString()} units`] : []),
    ...(run.elapsedMs != null ? [`${run.elapsedMs} ms`] : []),
    ...reads,
  ].join(' · ')
}

export function useQueryRuns() {
  const runs = ref<QueryRunCell[]>([])
  let runCount = 0
  /** The line the newest run's script error names, for the gutter. */
  const errorLine = computed(() => runs.value[0]?.run.error?.line ?? null)

  function addRun(label: string, run: QueryRun): void {
    runCount += 1
    runs.value = [
      { n: runCount, label, time: formatClockTime(new Date()), run, meta: runMeta(run) },
      ...runs.value,
    ].slice(0, MAX_RUNS)
  }

  function nextRunLabel(): string {
    return `Run ${runCount + 1}`
  }

  return { runs, errorLine, addRun, nextRunLabel }
}
