<template>
  <div class="audit-columns" :class="{ 'audit-columns--rail': rail, 'audit-columns--health': isHealth }" :data-level="level" data-testid="audit-columns">
    <nav class="audit-path" aria-label="Path">
      <button type="button" class="audit-path-step" data-testid="audit-path-top" @click="emit('navigate', { category: undefined, statement: undefined, finding: undefined, source: undefined })">
        {{ report.report.audit.name }}
      </button>
      <span v-if="categoryLabel" class="audit-path-part audit-path-part--2">
        <span aria-hidden="true">›</span>
        <button type="button" class="audit-path-step" data-testid="audit-path-category" @click="emit('navigate', { category, statement: undefined, finding: undefined, source: undefined })">
          {{ categoryLabel }}
        </button>
      </span>
      <span v-if="secondLabel" class="audit-path-part audit-path-part--3">
        <span aria-hidden="true">›</span>
        <button type="button" class="audit-path-step" data-testid="audit-path-statement" @click="emit('navigate', isHealth ? { source } : { statement, finding: undefined })">
          {{ secondLabel }}
        </button>
      </span>
      <span v-if="finding" class="audit-path-part">
        <span aria-hidden="true">›</span>
        <span class="audit-path-step audit-path-step--current">{{ finding }}</span>
      </span>
    </nav>

    <div class="audit-columns-grid">
      <!-- Column 1: Run health, then the categories. A rail while a finding is open, so the evidence gets the room. -->
      <section class="audit-col audit-col--1" aria-label="Categories">
        <button
          v-for="item in categories"
          :key="item.id"
          type="button"
          class="audit-row"
          :class="{ 'audit-row--picked': item.id === category, 'audit-row--rule': item.id === HEALTH }"
          :aria-label="rail ? `${item.label}, ${item.sub}` : undefined"
          :aria-current="item.id === category ? 'true' : undefined"
          :data-testid="`audit-category-${item.id}`"
          @click="emit('navigate', { category: item.id, statement: undefined, finding: undefined, source: undefined })"
        >
          <template v-if="rail">
            <span class="audit-rail-label">{{ item.short }}</span>
            <span class="audit-rail-count" :class="{ 'audit-rail-count--hot': item.attention }">{{ item.id === HEALTH ? (item.attention ? '!' : item.running ? '…' : '✓') : item.count }}</span>
          </template>
          <template v-else>
            <span class="audit-row-main">
              <span>{{ item.label }}<span v-if="item.running" class="audit-live-dot" aria-hidden="true" data-testid="audit-health-running" /></span>
              <span class="audit-row-sub">{{ item.sub }}</span>
            </span>
            <span class="audit-row-chevron" aria-hidden="true">›</span>
          </template>
        </button>
      </section>

      <template v-if="isHealth">
        <section class="audit-col audit-col--2" aria-label="Today's run">
          <h2 class="micro-label audit-col-head">Today's run</h2>
          <button
            v-for="item in sources"
            :key="item.key"
            type="button"
            class="audit-row"
            :class="{ 'audit-row--picked': item.key === source }"
            :data-testid="`audit-source-${item.label}`"
            @click="emit('navigate', { category: HEALTH, source: item.key })"
          >
            <span class="audit-row-main">
              <span>{{ item.label }}</span>
              <span class="audit-row-sub">{{ item.sub }}</span>
            </span>
            <span class="audit-tag" :class="{ 'audit-tag--hot': item.attention, 'audit-tag--empty': item.key === SOURCE_NOT_COVERED, 'audit-tag--running': item.key === SOURCE_RUNNING && !item.attention }">{{ item.tag }}</span>
          </button>
        </section>

        <section class="audit-col audit-col--3 audit-col--detail" aria-label="Detail" data-testid="audit-source-detail">
          <!-- DAR-UI-085. A play in progress: each run, the checks it feeds, where it is and whether it looks right. -->
          <template v-if="source === SOURCE_RUNNING && progress">
            <h2 class="micro-label">Running now</h2>
            <p class="audit-lead" data-testid="audit-running-lead">{{ progress.activeChecks }} of {{ progress.checks }} checks</p>
            <p class="section-note">Findings arrive as each check finishes.</p>
            <article
              v-for="run in progress.active"
              :key="run.run"
              class="audit-check audit-check--running"
              :data-testid="`audit-running-${run.checks[0]}`"
            >
              <div class="audit-detail-head">
                <h3 class="micro-label">{{ run.run }}</h3>
                <StatusBadge :label="runBadge(run).label" :tone="runBadge(run).tone" />
              </div>
              <p class="audit-body">{{ progressLine(run) }}</p>
              <p v-if="run.healthReason" class="section-note">{{ run.healthReason }}</p>
              <p class="audit-row-sub">{{ run.checks.join(' · ') }}</p>
            </article>
          </template>
          <template v-else-if="source === SOURCE_CHECKS">
            <h2 class="micro-label">Checks</h2>
            <p class="audit-lead" data-testid="audit-health">{{ report.health.complete ? 'Complete' : 'Not complete' }}</p>
            <p class="section-note" data-testid="audit-health-summary">{{ report.health.summary }}</p>
            <dl class="audit-facts">
              <dt>Ran</dt><dd data-testid="audit-checks-ran">{{ report.health.checks.ran }}</dd>
              <dt>Partial</dt><dd>{{ report.health.checks.partial }}</dd>
              <dt>Not run</dt><dd>{{ report.health.checks.notRun }}</dd>
            </dl>
          </template>
          <template v-else-if="source === SOURCE_NOT_COVERED">
            <h2 class="micro-label">Not covered</h2>
            <p class="audit-lead">No check reads these</p>
            <dl class="audit-facts">
              <template v-for="id in report.health.notCovered" :key="id">
                <dt>{{ id }}</dt><dd>{{ statementText(id) }}</dd>
              </template>
            </dl>
          </template>
          <template v-else-if="sourceDoc">
            <h2 class="micro-label">{{ systemLabel(source) }}</h2>
            <p class="audit-lead"><StatusBadge :label="sourceReadBadge(sourceDoc.read).label" :tone="sourceReadBadge(sourceDoc.read).tone" /></p>
            <p v-if="sourceDoc.reason" class="section-note">{{ sourceDoc.reason }}</p>
            <dl class="audit-facts">
              <dt>Records</dt><dd>{{ sourceDoc.records == null ? '—' : sourceDoc.records.toLocaleString('en-US') }}</dd>
              <dt>Read</dt><dd>{{ shortDate(sourceDoc.readAt) || '—' }}</dd>
              <template v-if="sourceDoc.affects.length"><dt>Affects</dt><dd>{{ sourceDoc.affects.join(', ') }}</dd></template>
            </dl>
          </template>
        </section>
      </template>

      <template v-else>
        <section class="audit-col audit-col--2" aria-label="Statements">
          <h2 class="micro-label audit-col-head"><span>Statements</span><span>{{ statements.length }}</span></h2>
          <button
            v-for="item in statements"
            :key="item.id"
            type="button"
            class="audit-row audit-row--statement"
            :class="{ 'audit-row--picked': item.id === statement, 'audit-row--quiet': item.tone === 'clean' || item.tone === 'notChecked' }"
            :aria-current="item.id === statement ? 'true' : undefined"
            :data-testid="`audit-statement-row-${category}`"
            @click="emit('navigate', { category, statement: item.id, finding: undefined })"
          >
            <span class="audit-row-code">{{ item.id }}</span>
            <span class="audit-row-text">{{ item.text }}</span>
            <span class="audit-count" :class="`audit-count--${item.tone}`">{{ item.badge }}</span>
          </button>
          <div v-if="!statements.length" class="audit-empty" data-testid="audit-statements-empty">Nothing here for this filter</div>
        </section>

        <section class="audit-col audit-col--3" aria-label="Findings">
          <h2 class="micro-label audit-col-head">
            <span>Findings</span>
            <span class="audit-col-head-end">
              <span data-testid="audit-findings-count">{{ findingsTotal.toLocaleString('en-US') }}</span>
              <button v-if="findings.length" type="button" class="app-icon-action" aria-label="Export findings" title="Export findings" data-testid="audit-export-findings" :disabled="exporting" @click="emit('export', 'statement')">
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path :d="downloadIconPath" fill="currentColor" /></svg>
              </button>
            </span>
          </h2>
          <template v-for="(item, index) in findings" :key="item.id">
            <p v-if="item.kind !== 'order' && groupLabel(index)" class="audit-col-note" data-testid="audit-findings-group">{{ groupLabel(index) }}</p>
            <button
              type="button"
              class="audit-row audit-row--finding"
              :class="{ 'audit-row--picked': item.id === finding }"
              :aria-current="item.id === finding ? 'true' : undefined"
              :title="item.id"
              data-testid="audit-finding-row"
              @click="emit('navigate', { category, statement, finding: item.id })"
            >
              <span class="audit-row-split">
                <span class="audit-finding-subject">{{ splitHeadline(item.headline).subject }}</span>
                <span class="audit-row-sub" :class="{ 'audit-hot': item.state === 'open' }">{{ findingStateBadge(item.state).label }} · {{ ageShort(item.ageDays) }}</span>
              </span>
              <!-- DAR-UI-075. An order: what holds it up, under its name. -->
              <span v-if="item.kind === 'order'" class="audit-row-sub">{{ splitHeadline(item.headline).rest }}</span>
              <span class="sr-only">{{ item.id }}</span>
            </button>
          </template>
          <div v-if="statementDoc && !findings.length" class="audit-empty" :data-testid="`audit-statement-empty-${statement}`">
            {{ narrowed ? 'No match' : statementDoc.status === 'notRun' ? (statementDoc.checks.length ? 'Not run yet' : 'No check yet') : 'Holds' }}
          </div>
          <InlineValidation v-if="more.error" tone="error" :message="more.error" data-testid="audit-findings-more-error" />
          <button v-if="findingsLeftCount" type="button" class="audit-more audit-pad" data-testid="audit-findings-more" :disabled="more.loading" @click="emit('more')">
            {{ more.loading ? 'Loading...' : `${findingsLeftCount} more` }}
          </button>
        </section>

        <section class="audit-col audit-col--4 audit-col--detail" aria-label="Detail">
          <!-- The deepest pick: the finding when one is open, else the statement and what checked it. -->
          <template v-if="finding">
            <p v-if="findingLoading" class="section-note">Loading finding...</p>
            <InlineValidation v-if="findingError" tone="error" :message="findingError" data-testid="audit-finding-error" />
            <template v-if="findingDoc">
              <div class="audit-detail-head">
                <StatusBadge :label="findingStateBadge(findingDoc.finding.status.state).label" :tone="findingStateBadge(findingDoc.finding.status.state).tone" />
                <span class="audit-col-head-end">
                  <span class="audit-row-sub">{{ sinceLine }}</span>
                  <!-- DAR-BE-123. Re-checks this finding's record now; it closes if the problem is gone. -->
                  <button v-if="findingDoc.finding.status.state !== 'fixed'" type="button" class="app-icon-action" aria-label="Resolve finding" title="Resolve finding" data-testid="audit-verify-finding" :disabled="verifying" @click="emit('verify')">
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="resolveIconPath" /></svg>
                  </button>
                  <button type="button" class="app-icon-action" aria-label="Export finding" title="Export finding" data-testid="audit-export-finding" @click="emit('export', 'finding')">
                    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path :d="downloadIconPath" fill="currentColor" /></svg>
                  </button>
                </span>
              </div>

              <!-- DAR-UI-081. Verdict first: the statement and record, what is wrong, then what it is stuck on and what to do. -->
              <p v-if="eyebrow" class="micro-label audit-eyebrow" data-testid="audit-finding-eyebrow">{{ eyebrow }}</p>
              <p class="audit-lead" data-testid="audit-finding-headline">{{ lead }}</p>

              <dl v-if="money.length" class="audit-facts">
                <template v-for="item in money" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></template>
              </dl>

              <p v-if="whyLine && !findingDoc.finding.fix.action" class="audit-body audit-muted">{{ whyLine }}</p>

              <div v-if="stuckOn || findingDoc.finding.fix.action" class="audit-verdict" data-testid="audit-finding-verdict">
                <template v-if="stuckOn">
                  <span class="micro-label">Stuck on</span>
                  <p class="audit-body" data-testid="audit-finding-stuck">{{ stuckOn }}</p>
                </template>
                <template v-if="findingDoc.finding.fix.action">
                  <span class="micro-label">Do this</span>
                  <div class="audit-verdict-do">
                    <p class="audit-body" data-testid="audit-finding-fix">{{ findingDoc.finding.fix.action }}</p>
                    <p v-if="fixOwner" class="audit-row-sub audit-body">Owner · {{ fixOwner }}</p>
                  </div>
                </template>
              </div>

              <!-- DAR-UI-081. A return held behind another: where it stopped, the return holding it outlined. -->
              <ol v-if="chain.length" class="audit-chain" aria-label="Where it stopped">
                <li v-for="step in chain" :key="step.key" class="audit-chain-step" :class="{ 'audit-chain-step--cause': step.cause }" data-testid="audit-chain-step">
                  <span class="audit-chain-mark" aria-hidden="true" />
                  <span class="audit-chain-body">
                    <span>{{ step.label }}<span v-if="step.sub" class="audit-row-sub audit-block">{{ step.sub }}</span></span>
                    <span class="audit-row-sub">{{ step.status }}</span>
                  </span>
                </li>
              </ol>
              <!-- DAR-UI-081. Each system's record and its status: the fix's system outlined, a record with no status dashed. -->
              <ul v-else-if="cards.length" class="audit-systems" aria-label="Each system">
                <li
                  v-for="card in cards"
                  :key="card.key"
                  class="audit-system"
                  :class="{ 'audit-system--attention': card.attention, 'audit-system--unread': !card.status }"
                  data-testid="audit-record-row"
                >
                  <span class="audit-row-sub">{{ card.label }}</span>
                  <!-- DAR-UI-081 (Aditi: "order - status as heading type text", "SKU - status in one line in subheading text"). -->
                  <span>{{ card.id }}<template v-if="card.status"> · {{ card.status }}</template></span>
                  <span v-if="card.sub" class="audit-row-sub">{{ card.sub }}</span>
                  <span v-if="!card.status && !card.items.length" class="audit-row-sub">No status read</span>
                  <span v-for="item in card.items" :key="item.key" class="audit-row-sub audit-nowrap" data-testid="audit-card-item">
                    {{ item.sku || item.id }}<template v-if="item.status"> · {{ item.status }}</template>
                  </span>
                </li>
              </ul>

              <!-- DAR-UI-075. An order's lines: the one holding it up outlined. DAR-UI-081 (Aditi: "all info needed is already
                   available, remove the click"): each line says what it is in place, so it opens nothing. -->
              <template v-if="orderUnit?.lines?.length">
                <h3 class="micro-label">Lines <span class="audit-fold-count">{{ orderUnit.lines.length }}</span></h3>
                <ul class="audit-lines">
                  <li
                    v-for="line in orderUnit.lines"
                    :key="line.id"
                    class="audit-line"
                    :class="{ 'audit-line--stuck': orderUnit.stuck?.includes(line.id) }"
                    data-testid="audit-order-line"
                  >
                    <span>{{ lineLabel(orderUnit.order ?? orderUnit.id, line, orderUnit.lines) }}</span>
                    <span class="audit-row-sub">{{ lineWhy(line) }}</span>
                    <!-- DAR-UI-081. The item fulfillment that shipped it and where it is fulfilled from (HotWax facility). -->
                    <span class="audit-row-sub" data-testid="audit-line-location">{{ [lineFulfillments(line), lineLocation(line)].filter(Boolean).join(' · ') }}</span>
                  </li>
                </ul>
              </template>

              <dl v-if="details.length" class="audit-facts audit-records">
                <div v-for="fact in details" :key="fact.key" data-testid="audit-record-detail">
                  <dt>{{ fact.label }}</dt>
                  <dd>{{ fact.value }}<span v-if="fact.status" class="audit-muted"> · {{ fact.status }}</span></dd>
                </div>
              </dl>

              <!-- DAR-UI-071. A finding its cause explains needs no evidence: the fix and the records already say it. -->
              <details v-if="findingDoc.finding.evidence.checks.length && !findingDoc.finding.diagnosis.conclusion" class="audit-fold" :open="evidenceFailed">
                <summary class="micro-label">Evidence <span class="audit-fold-count">{{ evidenceLine }}</span></summary>
                <ul class="audit-evidence">
                  <li v-for="(item, index) in findingDoc.finding.evidence.checks" :key="index" data-testid="audit-evidence-row">
                    <span :class="item.passed ? 'audit-pass' : 'audit-hot'" aria-hidden="true">{{ item.passed ? '✓' : '✗' }}</span>
                    <span>{{ item.label }}<span class="sr-only">{{ item.passed ? ' passed' : ' failed' }}</span></span>
                    <span class="audit-row-sub">{{ item.value ?? '' }}</span>
                  </li>
                </ul>
              </details>

              <details class="audit-fold">
                <summary class="micro-label">History <span class="audit-fold-count">{{ findingDoc.finding.history.length }}</span></summary>
                <ul class="audit-history">
                  <li v-for="(event, index) in findingDoc.finding.history" :key="index" data-testid="audit-history-row">
                    <span class="audit-row-sub">{{ shortDate(event.at) }}</span>
                    <span>{{ eventLabel(event.event) }}<template v-if="event.by.type !== 'check' && event.by.label"> · {{ event.by.label }}</template></span>
                  </li>
                </ul>
              </details>
            </template>
          </template>

          <template v-else-if="statementDoc">
            <div class="audit-detail-head">
              <span class="audit-detail-code">{{ statementDoc.id }}</span>
              <span class="audit-tag">{{ statementDoc.weight }}</span>
            </div>
            <p class="audit-lead" data-testid="audit-statement-text">{{ statementDoc.text }}</p>
            <div v-if="statementDoc.status === 'notRun' && !statementDoc.checks.length" class="audit-empty audit-empty--attention" data-testid="audit-statement-no-check">
              {{ statementDoc.reason || 'No check yet' }}
            </div>
            <article v-for="check in statementDoc.checks" :key="check.id" class="audit-check" :data-testid="`audit-check-${check.id}`">
              <div class="audit-detail-head">
                <h3 class="micro-label">Check</h3>
                <StatusBadge v-if="runOf(check.id)" :label="runBadge(runOf(check.id)!).label" :tone="runBadge(runOf(check.id)!).tone" />
                <StatusBadge v-else :label="checkStatusBadge(check.status).label" :tone="checkStatusBadge(check.status).tone" />
              </div>
              <p class="audit-body">{{ check.label }}</p>
              <!-- DAR-UI-085. Running now: where it is, in place of this morning's "did not run". -->
              <p v-if="runOf(check.id)" class="section-note" :data-testid="`audit-check-running-${check.id}`">{{ progressLine(runOf(check.id)!) }}</p>
              <p v-else-if="check.reason" class="section-note">{{ check.reason }}</p>
              <!-- DAR-UI-086. A check that did not run this morning runs again from what its run already read. -->
              <button
                v-if="retryable && check.status !== 'ran' && !runOf(check.id)"
                type="button"
                class="audit-more"
                :data-testid="`audit-retry-check-${check.id}`"
                :disabled="retrying === check.id"
                @click="emit('retry', check.id)"
              >
                Retry from last read
              </button>
              <div v-if="comparedBars(check).length" class="audit-bars">
                <div v-for="bar in comparedBars(check)" :key="bar.system" class="audit-bar" data-testid="audit-compared-bar">
                  <span class="audit-row-sub">{{ bar.system }}</span>
                  <span class="audit-bar-track"><span class="audit-bar-fill" :style="{ width: bar.share }" /></span>
                  <span>{{ bar.count }}</span>
                  <button type="button" class="app-icon-action" :aria-label="`Export ${bar.system} extract`" :title="`Export ${bar.system} extract`" :data-testid="`audit-extract-${bar.key}`" :disabled="exporting" @click="emit('extract', check.id, bar.key)">
                    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path :d="downloadIconPath" fill="currentColor" /></svg>
                  </button>
                </div>
              </div>
              <p v-if="comparedGap(check)" class="section-note" data-testid="audit-compared-gap">{{ comparedGap(check) }}</p>
              <dl class="audit-facts">
                <template v-if="check.matchedBy"><dt>Matched by</dt><dd>{{ check.matchedBy }}</dd></template>
                <template v-if="check.graceDays != null"><dt>Grace</dt><dd>{{ check.graceDays === 0 ? 'none' : ageLabel(check.graceDays) }}</dd></template>
                <template v-if="check.window"><dt>Read</dt><dd>{{ shortRange(check.window.from, check.window.thru) }}</dd></template>
              </dl>
            </article>
            <p class="audit-row-sub" data-testid="audit-statement-counts">
              {{ statementDoc.counts.open }} open · {{ statementDoc.counts.pending }} pending · {{ statementDoc.counts.newToday }} new · {{ statementDoc.counts.fixedToday }} fixed today
            </p>
          </template>

          <div v-else class="audit-empty">Pick a statement</div>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '../ui/StatusBadge.vue'
import InlineValidation from '../ui/InlineValidation.vue'
import { downloadIconPath, resolveIconPath } from '../../lib/iconPaths'
import type {
  AuditFindingDocument,
  AuditFindingListItem,
  AuditFindingSummary,
  AuditMoney,
  AuditProgress,
  AuditProgressRun,
  AuditReport,
} from '../../lib/api/auditTypes'
import {
  ageLabel,
  checkStatusBadge,
  eventLabel,
  FIX_WHERE_LABELS,
  findingStateBadge,
  heldChain,
  orderNameOf,
  recordDetails,
  recordRows,
  shortDate,
  shortRange,
  sourceReadBadge,
  splitHeadline,
  systemCards,
  systemLabel,
} from '../../lib/auditReport'
import {
  HEALTH,
  SOURCE_CHECKS,
  SOURCE_NOT_COVERED,
  SOURCE_RUNNING,
  categoryItems,
  comparedBars,
  comparedGap,
  countFor,
  findStatement,
  findingsLeft,
  lineLabel,
  narrowedCounts,
  progressLine,
  sourceItems,
  statementFindings,
  causeGroups,
  causeHeading,
  statementItems,
  type AuditFilter,
  type FindingsMore,
} from '../../lib/auditColumns'

// DAR-UI-065. The audit report as drill-down columns: categories › statements › findings › the deepest pick. The page
// resolves what is picked (from the URL, else the defaults) and owns the URL; this only draws and asks to navigate.

const props = defineProps<{
  report: AuditReport
  category: string
  statement: string
  finding: string
  source: string
  filter: AuditFilter
  /** Which column a phone shows: 1 categories, 2 the list, 3 findings (or a source), 4 the open finding. */
  level: number
  findingDoc: AuditFindingDocument | null
  findingLoading: boolean
  findingError: string
  more: FindingsMore
  exporting: boolean
  /** DAR-UI-073. What the toolbar's filters left of the period's findings; null when none is on. */
  narrowed?: AuditFindingListItem[] | null
  /** DAR-UI-075. The order open in the detail; findingDoc is then its stuck line's (its fix and history). */
  orderUnit?: AuditFindingSummary | null
  verifying: boolean
  /** DAR-UI-085. What the checks are doing right now; null when nothing was read yet. */
  progress?: AuditProgress | null
  /** DAR-UI-086. The morning on show is today's, so a check that did not run can be retried from its last read. */
  retryable?: boolean
  /** The check whose retry is being submitted. */
  retrying?: string
}>()

const emit = defineEmits<{ navigate: [patch: Record<string, string | undefined>]; more: []; export: [what: 'statement' | 'finding']; extract: [check: string, system: string]; verify: []; retry: [check: string] }>()

const isHealth = computed(() => props.category === HEALTH)
const rail = computed(() => !isHealth.value && Boolean(props.finding))
// DAR-UI-073. With the toolbar's filters on, every column counts and lists what they left.
const narrowedBy = computed(() => (props.narrowed ? narrowedCounts(props.narrowed) : null))
const categories = computed(() => {
  const items = categoryItems(props.report, props.filter, props.progress)
  const counted = narrowedBy.value
  if (!counted) return items
  return items.map((item) => item.id === HEALTH ? item : { ...item, count: counted.byCategory.get(item.id) ?? 0,
    sub: `${counted.byCategory.get(item.id) ?? 0} found`, attention: (counted.byCategory.get(item.id) ?? 0) > 0 })
})
const sources = computed(() => sourceItems(props.report, props.progress))
// DAR-UI-085. The run a check rides on, while it is in flight.
const runByCheck = computed(() => new Map((props.progress?.active ?? []).flatMap((run) => run.checks.map((code) => [code, run] as const))))
function runOf(checkId: string): AuditProgressRun | undefined {
  return runByCheck.value.get(checkId)
}
function runBadge(run: AuditProgressRun): { label: string; tone: 'neutral' | 'warning' | 'danger' } {
  if (run.state === 'queued') return { label: 'Queued', tone: 'neutral' }
  if (run.health === 'stuck') return { label: 'Stuck', tone: 'danger' }
  if (run.health === 'slow') return { label: 'Slow', tone: 'warning' }
  return { label: 'Running', tone: 'neutral' }
}
const sourceDoc = computed(() => props.report.health.sources?.[props.source] ?? null)
const categoryDoc = computed(() => props.report.categories?.[props.category] ?? null)
const statements = computed(() => {
  const items = statementItems(categoryDoc.value, props.filter)
  const counted = narrowedBy.value
  return counted ? items.filter((item) => counted.byStatement.has(item.id))
    .map((item) => ({ ...item, badge: String(counted.byStatement.get(item.id)) })) : items
})
const statementDoc = computed(() => categoryDoc.value?.statements?.[props.statement] ?? null)
const findings = computed(() => causeGroups(props.narrowed ? props.narrowed.filter((item) => item.statement === props.statement)
  : statementFindings(statementDoc.value, props.more.findings, props.filter)))
// DAR-UI-075. Why a line is in its order's finding: its own cause, or held by the line holding the order up.
// DAR-UI-081 (Aditi: "removed 'held by' and just put item fulfillment status"): a line held by the order's stuck line reads
// as its own item's status in HotWax (Completed); the stuck line keeps its cause (Backordered).
function lineWhy(line: NonNullable<AuditFindingSummary['lines']>[number]): string {
  const itemStatus = line.records?.OMS?.orderItem?.[0]?.status
  if (line.held && itemStatus) return itemStatus
  return line.cause ?? findingStateBadge(line.state).label
}
// What the picked pill counts for the statement (DAR-UI-073), not the 50 the report lists or the pages loaded so far.
const findingsTotal = computed(() => (statementDoc.value && !props.narrowed ? countFor(statementDoc.value.counts, props.filter) : findings.value.length))
const findingsLeftCount = computed(() => props.narrowed ? 0 : findingsLeft(statementDoc.value, findings.value.length, props.more.hasNextPage, props.filter))
const records = computed(() => recordRows(props.orderUnit?.records ?? props.findingDoc?.finding.records))

const categoryLabel = computed(() => categories.value.find((item) => item.id === props.category)?.label ?? '')
const secondLabel = computed(() =>
  isHealth.value ? (sources.value.find((item) => item.key === props.source)?.label ?? '') : props.statement)

// DAR-UI-066. Fewer words: the record leads, what is said once is not said again, dates short.

function ageShort(days: number | null | undefined): string {
  return days == null ? '' : `${days}d`
}

function sameText(a: string, b: string): boolean {
  const norm = (text: string) => text.trim().replace(/\.$/, '').toLowerCase()
  return norm(a) === norm(b)
}

// Findings under a statement mostly share a conclusion; causeGroups puts them together, so it is said once above them.
const rests = computed(() => findings.value.map(causeHeading))
function groupLabel(index: number): string {
  const rest = rests.value[index] ?? ''
  return rest && (index === 0 || rest !== rests.value[index - 1]) ? rest : ''
}

function moneyLabel(money: AuditMoney | null | undefined): string {
  return money ? `${money.amount} ${money.currency}` : ''
}

const money = computed(() => {
  const evidence = props.findingDoc?.finding.evidence
  if (!evidence) return []
  return [
    { label: evidence.expected?.source ? systemLabel(evidence.expected.source) : 'Expected', value: moneyLabel(evidence.expected) },
    { label: evidence.actual?.source ? systemLabel(evidence.actual.source) : 'Actual', value: moneyLabel(evidence.actual) },
    { label: 'Gap', value: moneyLabel(evidence.difference) },
  ].filter((item) => item.value)
})

const fixWhere = computed(() => {
  const where = props.findingDoc?.finding.fix.where
  return where ? (FIX_WHERE_LABELS[where] ?? where) : ''
})
const fixOwner = computed(() => props.findingDoc?.finding.fix.owner || fixWhere.value)

// DAR-UI-081. Verdict first. The headline's record ("Order M1168800") moves up beside the statement and the order's name,
// so the lead says only what is wrong.
const headline = computed(() => props.orderUnit?.headline ?? props.findingDoc?.finding.headline ?? '')
const eyebrow = computed(() => {
  const split = splitHeadline(headline.value)
  return [props.statement, split.rest ? split.subject : '', orderNameOf(records.value)].filter(Boolean).join(' · ')
})
const lead = computed(() => {
  const rest = splitHeadline(headline.value).rest
  return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : headline.value
})
const cards = computed(() => systemCards(records.value, fixWhere.value))
const chain = computed(() => heldChain(records.value))
const details = computed(() => recordDetails(records.value))
// DAR-UI-081 (Aditi: "add location ID to the line box", "with location ID, show the location name"). An order line's
// location, from its HotWax item: "Chicago · 58".
function lineLocation(line: NonNullable<AuditFindingSummary['lines']>[number]): string {
  const item = line.records?.OMS?.orderItem?.[0]
  if (!item?.location) return ''
  return item.locationName ? `${item.locationName} · ${item.location}` : `Location ${item.location}`
}

// DAR-UI-081 (Aditi: "add the IF id here too"). The NetSuite item fulfillments that shipped the line.
function lineFulfillments(line: NonNullable<AuditFindingSummary['lines']>[number]): string {
  return (line.records?.NetSuite?.salesOrderLine?.[0]?.fulfillments ?? []).join(', ')
}

// What the finding is stuck on, only where it adds to the headline (DAR-UI-071, said once): the return holding it, or the
// order's line holding it up and that line's cause, in the fix's system.
const stuckOn = computed(() => {
  const held = records.value.find((row) => row.heldBy)
  if (held?.heldBy) return `Return ${held.heldBy.id} is still ${(held.heldBy.status || 'open').toLowerCase()} in ${held.system}.`
  const unit = props.orderUnit
  const lines = unit?.lines ?? []
  // A one-line order names no line as holding it up: its line is the one.
  const holding = unit?.stuck?.length ? unit.stuck : lines.length === 1 ? [lines[0]!.id] : []
  return lines.filter((line) => holding.includes(line.id) && line.cause)
    .map((line) => {
      const where = fixWhere.value && !line.cause?.includes(fixWhere.value) ? ` in ${fixWhere.value}` : ''
      return `${lineLabel(unit?.order ?? unit?.id ?? '', line, lines)}: ${line.cause}${where}`
    })
    .join('; ')
})

const sinceLine = computed(() => {
  const status = props.findingDoc?.finding.status
  if (!status) return ''
  const next = props.findingDoc?.finding.fix.verify?.nextCheck
  return [`since ${shortDate(status.firstFound)}`, next ? `next ${shortDate(next)}` : '']
    .filter(Boolean).join(' · ')
})

const evidenceFailed = computed(() => (props.findingDoc?.finding.evidence.checks ?? []).some((item) => !item.passed))
const evidenceLine = computed(() => {
  const checks = props.findingDoc?.finding.evidence.checks ?? []
  return `${checks.filter((item) => item.passed).length}/${checks.length}`
})

// The conclusion's label and its explanation are often the headline again; say only what is new.
const whyLine = computed(() => {
  const diagnosis = props.findingDoc?.finding.diagnosis
  const headline = props.findingDoc?.finding.headline ?? ''
  const said = [headline, splitHeadline(headline).rest]
  const parts = [diagnosis?.conclusion?.label, diagnosis?.explanation]
    .map((part) => (part ?? '').trim().replace(/\.$/, ''))
    .filter((part) => part && !said.some((text) => sameText(text, part)))
  return [...new Set(parts)].map((part) => `${part}.`).join(' ')
})

function statementText(id: string): string {
  return findStatement(props.report, id)?.statement.text ?? ''
}
</script>

<style scoped>
.audit-columns {
  display: grid;
  gap: var(--space-2);
  --audit-col-head-height: 3.6rem;
}

.audit-path {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1);
  color: var(--text-dim);
  font-size: var(--type-meta-size);
}

.audit-path-part {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.audit-path-step {
  padding: 0;
  border: 0;
  background: none;
  color: var(--text-soft);
  font: inherit;
  cursor: pointer;
}

.audit-path-step:hover {
  color: var(--text);
}

.audit-path-step--current {
  color: var(--text);
  cursor: default;
}

.audit-columns-grid {
  display: grid;
  /* The deepest column gets the most room; the lists keep enough for a two-line statement. */
  grid-template-columns: minmax(10rem, 0.8fr) minmax(13rem, 1.1fr) minmax(13rem, 1fr) minmax(18rem, 1.5fr);
  /* DAR-UI-074. Held to the window, less the toolbar and path above it, so each column scrolls on its own and the pills
     stay in view. A phone stacks the columns at their own height (below). */
  height: max(28rem, calc(100dvh - 12rem));
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  overflow: hidden;
  transition: grid-template-columns 160ms ease;
}

.audit-columns--rail .audit-columns-grid {
  grid-template-columns: 5.5rem minmax(12rem, 1fr) minmax(12rem, 1fr) minmax(20rem, 2fr);
}

.audit-columns--health .audit-columns-grid {
  grid-template-columns: minmax(10rem, 0.8fr) minmax(13rem, 1.1fr) minmax(18rem, 2.5fr);
}

.audit-col {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  border-right: 1px solid var(--border-soft);
}

.audit-col:last-child {
  border-right: 0;
}

.audit-col--detail {
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--surface-2);
}

/*
 * Every column's first row starts on one line (Aditi: "the column start is not aligned... looks messy"): the column heads
 * and the categories' Run health row share --audit-col-head-height, the head with an icon action (2rem) included.
 */
.audit-col-head {
  flex: none;
  box-sizing: border-box;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-1);
  height: var(--audit-col-head-height);
  margin: 0;
  padding: 0 var(--space-3);
  border-bottom: 1px solid var(--border-soft);
}

/* Outranks the rail's row padding (.audit-columns--rail .audit-col--1 .audit-row). */
.audit-columns .audit-col--1 .audit-row.audit-row--rule {
  box-sizing: border-box;
  height: var(--audit-col-head-height);
  min-height: 0;
  padding-block: 0;
}

.audit-row {
  /* Rows keep their height in the scrolling column instead of squeezing to fit it. */
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
  min-height: 2.75rem;
  padding: var(--space-2) var(--space-3);
  border: 0;
  border-bottom: 1px solid var(--border-soft);
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: var(--type-label-size);
  text-align: left;
  cursor: pointer;
  transition: background 160ms ease;
}

.audit-row:hover {
  background: color-mix(in oklab, var(--accent) 5%, var(--surface));
}

.audit-row--picked,
.audit-row--picked:hover {
  background: color-mix(in oklab, var(--accent) 12%, var(--surface));
}

.audit-row--rule {
  border-bottom-color: var(--border);
}

.audit-row--quiet {
  color: var(--text-muted);
}

.audit-row--statement {
  align-items: flex-start;
}

.audit-row--finding {
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-1);
}

/* In a column row, flex: 1 would size the headline from zero and clamp it away. */
.audit-row--finding .audit-row-text {
  flex: none;
}

.audit-row-main {
  display: grid;
  gap: var(--space-00);
  min-width: 0;
}

.audit-row-sub {
  color: var(--text-muted);
  font-size: var(--type-meta-size);
}

.audit-more {
  justify-self: start;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: var(--type-meta-size);
  cursor: pointer;
}

.audit-more:hover:not(:disabled) {
  color: var(--text);
}

.audit-row-split {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
}

.audit-finding-subject {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--type-label-size);
}

.audit-col-note {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border-soft);
  color: var(--text-muted);
  font-size: var(--type-meta-size);
}

.audit-col-head-end {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.audit-lines {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

/* DAR-UI-075. One line of an order; the line holding the order up takes the solid border (attention). */
.audit-line {
  box-sizing: border-box;
  width: 100%;
  display: grid;
  grid-template-columns: minmax(4rem, max-content) minmax(0, 1fr) max-content;
  gap: var(--space-2);
  align-items: baseline;
  padding: var(--space-1-5) var(--space-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-size: var(--type-label-size);
}

.audit-line--stuck {
  border-color: var(--text-soft);
  background: var(--surface-3);
}

.audit-muted {
  color: var(--text-muted);
}

.audit-fold summary {
  display: flex;
  gap: var(--space-1);
  cursor: pointer;
}

.audit-fold-count {
  color: var(--text-dim);
}

.audit-fold[open] summary {
  margin-bottom: var(--space-1);
}

.audit-row-code {
  flex: none;
  width: 2.6rem;
  color: var(--text-muted);
}

.audit-row-text {
  flex: 1;
  min-width: 0;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.audit-row-chevron {
  color: var(--text-dim);
}

.audit-rail-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-soft);
  font-size: var(--type-eyebrow-size);
  letter-spacing: var(--type-eyebrow-tracking);
  text-transform: uppercase;
}

.audit-columns--rail .audit-col--1 .audit-row {
  flex-direction: column;
  justify-content: center;
  gap: var(--space-00);
  padding: var(--space-2) var(--space-0);
}

.audit-rail-count {
  color: var(--text-dim);
}

.audit-rail-count--hot,
.audit-hot {
  color: var(--text);
}

.audit-pass {
  color: var(--text-dim);
}

/* Open = a filled count, pending = a ring, clean = a quiet number, not checked = dashed: the same marks as the canvas. */
.audit-count {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 var(--space-1);
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  font-size: var(--type-badge-size);
}

.audit-count--open {
  background: var(--accent);
  color: var(--accent-ink);
}

.audit-count--pending {
  border-color: var(--warning);
  color: var(--text-soft);
}

.audit-count--clean {
  color: var(--text-dim);
}

.audit-count--notChecked {
  border-style: dashed;
  border-color: var(--text-dim);
  color: var(--text-dim);
}

.audit-tag {
  flex: none;
  padding: 0 var(--space-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  color: var(--text-soft);
  font-size: var(--type-badge-size);
}

.audit-tag--hot {
  border-color: var(--accent);
  color: var(--text);
}

.audit-tag--empty {
  border-style: dashed;
  border-color: var(--text-dim);
}

.audit-empty {
  margin: var(--space-3);
  padding: var(--space-3);
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  font-size: var(--type-note-size);
}

.audit-col--detail .audit-empty {
  margin: 0;
}

.audit-empty--attention {
  border-color: var(--text-dim);
}

.audit-pad {
  padding: var(--space-2) var(--space-3);
}

.audit-detail-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
}

.audit-detail-head .micro-label {
  margin: 0;
}

.audit-detail-code {
  font-size: var(--type-heading-size);
}

.audit-lead {
  margin: 0;
  font-size: var(--type-tile-size);
  line-height: 1.5;
}

.audit-body {
  margin: 0;
  font-size: var(--type-label-size);
  line-height: 1.5;
}

.audit-col--detail h3.micro-label,
.audit-col--detail h2.micro-label {
  margin: var(--space-2) 0 0;
}

/* DAR-UI-081. Verdict first: what it is stuck on and what to do, in the panel's one solid border (attention). */
.audit-eyebrow {
  margin: 0;
}

.audit-verdict {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: var(--space-1-5) var(--space-3);
  align-items: baseline;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--text-soft);
  border-radius: var(--radius-md);
}

.audit-col--detail .audit-verdict .micro-label {
  margin: 0;
}

.audit-verdict-do {
  display: grid;
  gap: var(--space-00);
}

/* Each system's record: the fix's system solid (attention), a record with no status read dashed (empty). */
/* Each card as wide as its lines, so an item reads on one line (Aditi: the box must not grow with its items). */
.audit-systems {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--space-1-5);
  margin: 0;
  padding: 0;
  list-style: none;
}

.audit-system {
  flex: 1 1 auto;
  min-width: 9rem;
  display: grid;
  align-content: start;
  gap: var(--space-00);
  padding: var(--space-1-5) var(--space-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  font-size: var(--type-label-size);
  overflow-wrap: anywhere;
}

.audit-system--attention {
  border-color: var(--text-soft);
  background: var(--surface-3);
}

.audit-system--unread {
  border-style: dashed;
  border-color: var(--border);
}

/* A return held behind another: one step per record, joined by a rule; the step holding the rest outlined. */
.audit-chain {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.audit-chain-step {
  position: relative;
  display: grid;
  grid-template-columns: var(--space-2) minmax(0, 1fr);
  gap: var(--space-2);
  padding-bottom: var(--space-2);
  font-size: var(--type-label-size);
}

.audit-chain-step:not(:last-child)::before {
  content: '';
  position: absolute;
  top: var(--space-4);
  bottom: 0;
  left: calc(var(--space-2) / 2);
  border-left: 1px solid var(--border);
}

.audit-chain-mark {
  width: var(--space-1-5);
  height: var(--space-1-5);
  margin-top: var(--space-1);
  border: 1px dashed var(--text-dim);
  border-radius: var(--radius-pill);
}

.audit-chain-body {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  overflow-wrap: anywhere;
}

.audit-chain-step--cause .audit-chain-body {
  padding: var(--space-1-5) var(--space-2);
  border: 1px solid var(--text-soft);
  border-radius: var(--radius-sm);
  background: var(--surface-3);
}

.audit-chain-step--cause .audit-chain-mark {
  border-style: solid;
  border-color: var(--text-soft);
}

.audit-block {
  display: block;
}

.audit-nowrap {
  white-space: nowrap;
}

.audit-records {
  padding-top: var(--space-2);
  border-top: 1px solid var(--border-soft);
}

/* A record's dt and dd sit in the list's grid; the wrapper only groups them for the test and a reader. */
.audit-records > div {
  display: contents;
}

.audit-facts {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: var(--space-1) var(--space-3);
  margin: 0;
  font-size: var(--type-label-size);
}

.audit-facts dt {
  color: var(--text-muted);
}

.audit-facts dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.audit-check {
  display: grid;
  gap: var(--space-1-5);
  padding-top: var(--space-2);
  border-top: 1px solid var(--border-soft);
}

.audit-bars {
  display: grid;
  gap: var(--space-1);
}

.audit-bar {
  display: grid;
  grid-template-columns: 6rem minmax(0, 1fr) 4rem auto;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--type-meta-size);
}

.audit-bar > span:last-child {
  text-align: right;
}

.audit-bar-track {
  height: 0.5rem;
  border-radius: var(--radius-sm);
  background: var(--surface-3);
  overflow: hidden;
}

.audit-bar-fill {
  display: block;
  height: 100%;
  background: var(--text-muted);
}

.audit-evidence,
.audit-history {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--type-label-size);
}

.audit-evidence li {
  display: grid;
  grid-template-columns: 1.25rem minmax(0, 1fr) auto;
  gap: var(--space-2);
  padding: var(--space-1) 0;
  border-bottom: 1px solid var(--border-soft);
}

.audit-history {
  gap: var(--space-1);
}

.audit-history li {
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1fr);
  gap: var(--space-2);
}

/* A phone shows one column at a time: the deepest the URL names. The path above steps back up. */
@media (max-width: 760px) {
  .audit-columns-grid,
  .audit-columns--rail .audit-columns-grid,
  .audit-columns--health .audit-columns-grid {
    grid-template-columns: minmax(0, 1fr);
    height: auto;
  }

  .audit-col {
    display: none;
    border-right: 0;
  }

  .audit-columns[data-level='1'] .audit-col--1,
  .audit-columns[data-level='2'] .audit-col--2,
  .audit-columns[data-level='3'] .audit-col--3,
  .audit-columns[data-level='3'] .audit-col--4,
  .audit-columns[data-level='4'] .audit-col--4 {
    display: flex;
  }

  .audit-columns[data-level='3'] .audit-col--4 {
    border-top: 1px solid var(--border);
  }

  /* The path names only the columns the phone has walked through, not the defaults a desktop would show. */
  .audit-columns[data-level='1'] .audit-path-part--2,
  .audit-columns[data-level='1'] .audit-path-part--3,
  .audit-columns[data-level='2'] .audit-path-part--3 {
    display: none;
  }
}

/* DAR-UI-085. A play in progress: the house "running" look (dashed, muted, as connection diagnostics), plus one small
   dot on Run health that breathes so the page reads as live at a glance. */
.audit-live-dot {
  display: inline-block;
  width: var(--space-1);
  height: var(--space-1);
  margin-left: var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--text-muted);
  vertical-align: middle;
  animation: audit-live-breathe 1.6s ease-in-out infinite;
}

@keyframes audit-live-breathe {
  0%, 100% { opacity: 0.35; }
  50% { opacity: 1; }
}

.audit-tag--running {
  border-style: dashed;
  color: var(--text-muted);
}

.audit-check--running {
  border-style: dashed;
}

@media (prefers-reduced-motion: reduce) {
  .audit-columns-grid,
  .audit-row {
    transition: none;
  }

  .audit-live-dot {
    animation: none;
  }
}
</style>
