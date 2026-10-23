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
            <span class="audit-rail-count" :class="{ 'audit-rail-count--hot': item.attention }">{{ item.id === HEALTH ? (item.attention ? '!' : '✓') : item.open || item.pending }}</span>
          </template>
          <template v-else>
            <span class="audit-row-main">
              <span>{{ item.label }}</span>
              <span class="audit-row-sub">{{ item.sub }}</span>
            </span>
            <span class="audit-row-chevron" aria-hidden="true">›</span>
          </template>
        </button>
      </section>

      <template v-if="isHealth">
        <section class="audit-col audit-col--2" aria-label="This morning's run">
          <h2 class="micro-label audit-col-head">This morning's run</h2>
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
            <span class="audit-tag" :class="{ 'audit-tag--hot': item.attention, 'audit-tag--empty': item.key === SOURCE_NOT_COVERED }">{{ item.tag }}</span>
          </button>
        </section>

        <section class="audit-col audit-col--3 audit-col--detail" aria-label="Detail" data-testid="audit-source-detail">
          <template v-if="source === SOURCE_CHECKS">
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
            <p class="audit-lead">No check reads these statements, so nothing they break can show up here.</p>
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
              <dt>Read at</dt><dd>{{ instantLabel(sourceDoc.readAt) || '—' }}</dd>
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
          <h2 class="micro-label audit-col-head"><span>Findings</span><span>{{ statement }}</span></h2>
          <button
            v-for="item in findings"
            :key="item.id"
            type="button"
            class="audit-row audit-row--finding"
            :class="{ 'audit-row--picked': item.id === finding }"
            :aria-current="item.id === finding ? 'true' : undefined"
            data-testid="audit-finding-row"
            @click="emit('navigate', { category, statement, finding: item.id })"
          >
            <span class="audit-row-sub audit-row-split">
              <span>{{ item.id }}</span>
              <span :class="{ 'audit-hot': item.state === 'open' }">{{ findingStateBadge(item.state).label }} · {{ ageLabel(item.ageDays) }}</span>
            </span>
            <span class="audit-row-text">{{ item.headline }}</span>
          </button>
          <div v-if="statementDoc && !findings.length" class="audit-empty" :data-testid="`audit-statement-empty-${statement}`">
            {{ statementDoc.status === 'notRun' ? 'No check yet, so nothing can be found here' : 'Holds. Nothing found this period' }}
          </div>
          <p v-if="statementDoc?.findingsOmitted" class="section-note audit-pad">{{ statementDoc.findingsOmitted }} more</p>
        </section>

        <section class="audit-col audit-col--4 audit-col--detail" aria-label="Detail">
          <!-- The deepest pick: the finding when one is open, else the statement and what checked it. -->
          <template v-if="finding">
            <p v-if="findingLoading" class="section-note">Loading finding...</p>
            <InlineValidation v-if="findingError" tone="error" :message="findingError" data-testid="audit-finding-error" />
            <template v-if="findingDoc">
              <div class="audit-detail-head">
                <span class="audit-row-sub">{{ findingDoc.finding.id }} · {{ findingDoc.finding.statement.id }}</span>
                <StatusBadge :label="findingStateBadge(findingDoc.finding.status.state).label" :tone="findingStateBadge(findingDoc.finding.status.state).tone" />
              </div>
              <p class="audit-lead" data-testid="audit-finding-headline">{{ findingDoc.finding.headline }}</p>
              <p class="audit-row-sub audit-meta">
                <span>first found {{ findingDoc.finding.status.firstFound }}</span>
                <span>{{ seenLabel }}</span>
                <span v-if="findingDoc.finding.fix.verify?.nextCheck">next check {{ instantLabel(findingDoc.finding.fix.verify.nextCheck) }}</span>
              </p>

              <h3 class="micro-label">Records</h3>
              <div class="audit-records">
                <article v-for="row in records" :key="row.key" class="audit-record" data-testid="audit-record-row">
                  <span class="audit-row-sub audit-row-split"><span>{{ row.system }}</span><span>{{ row.recordType }}</span></span>
                  <span class="audit-record-id">{{ row.id }}</span>
                  <span class="audit-row-sub audit-row-split"><span>{{ row.status }}</span><span>{{ row.internalId }}</span></span>
                </article>
              </div>

              <template v-if="money.length">
                <h3 class="micro-label">Amounts</h3>
                <dl class="audit-facts">
                  <template v-for="item in money" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></template>
                </dl>
              </template>

              <template v-if="findingDoc.finding.evidence.checks.length">
                <h3 class="micro-label">Evidence</h3>
                <ul class="audit-evidence">
                  <li v-for="(item, index) in findingDoc.finding.evidence.checks" :key="index" data-testid="audit-evidence-row">
                    <span :class="item.passed ? 'audit-pass' : 'audit-hot'" aria-hidden="true">{{ item.passed ? '✓' : '✗' }}</span>
                    <span>{{ item.label }}<span class="visually-hidden">{{ item.passed ? ' passed' : ' failed' }}</span></span>
                    <span>{{ item.value ?? '' }}</span>
                  </li>
                </ul>
              </template>

              <template v-if="findingDoc.finding.diagnosis.conclusion || findingDoc.finding.diagnosis.explanation">
                <h3 class="micro-label">Why</h3>
                <p class="audit-body">{{ whyLine }}</p>
              </template>

              <template v-if="findingDoc.finding.fix.action">
                <h3 class="micro-label">Fix</h3>
                <p class="audit-body" data-testid="audit-finding-fix">{{ findingDoc.finding.fix.action }}</p>
                <p v-if="fixLine" class="section-note">{{ fixLine }}</p>
              </template>

              <h3 class="micro-label">History</h3>
              <ul class="audit-history">
                <li v-for="(event, index) in findingDoc.finding.history" :key="index" data-testid="audit-history-row">
                  <span class="audit-row-sub">{{ instantLabel(event.at) }}</span>
                  <span>{{ event.event }} · {{ instantLabel(event.by.label || event.by.type) }}</span>
                </li>
              </ul>
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
                <StatusBadge :label="checkStatusBadge(check.status).label" :tone="checkStatusBadge(check.status).tone" />
              </div>
              <p class="audit-body">{{ check.label }}</p>
              <p v-if="check.reason" class="section-note">{{ check.reason }}</p>
              <div v-if="comparedBars(check).length" class="audit-bars">
                <div v-for="bar in comparedBars(check)" :key="bar.system" class="audit-bar" data-testid="audit-compared-bar">
                  <span class="audit-row-sub">{{ bar.system }}</span>
                  <span class="audit-bar-track"><span class="audit-bar-fill" :style="{ width: bar.share }" /></span>
                  <span>{{ bar.count }}</span>
                </div>
              </div>
              <p v-if="comparedGap(check)" class="section-note" data-testid="audit-compared-gap">{{ comparedGap(check) }}</p>
              <dl class="audit-facts">
                <template v-if="check.matchedBy"><dt>Matched by</dt><dd>{{ check.matchedBy }}</dd></template>
                <template v-if="check.graceDays != null"><dt>Grace</dt><dd>{{ check.graceDays === 0 ? 'none' : ageLabel(check.graceDays) }}</dd></template>
                <template v-if="check.window"><dt>Read</dt><dd>{{ check.window.from }} to {{ check.window.thru }}</dd></template>
              </dl>
            </article>
            <dl class="audit-facts">
              <dt>Open</dt><dd>{{ statementDoc.counts.open }}</dd>
              <dt>Pending</dt><dd>{{ statementDoc.counts.pending }}</dd>
              <dt>New today</dt><dd>{{ statementDoc.counts.newToday }}</dd>
              <dt>Fixed today</dt><dd>{{ statementDoc.counts.fixedToday }}</dd>
            </dl>
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
import type { AuditFindingDocument, AuditMoney, AuditReport } from '../../lib/api/auditTypes'
import {
  ageLabel,
  checkStatusBadge,
  findingStateBadge,
  instantLabel,
  recordRows,
  sourceReadBadge,
  systemLabel,
} from '../../lib/auditReport'
import {
  HEALTH,
  SOURCE_CHECKS,
  SOURCE_NOT_COVERED,
  categoryItems,
  comparedBars,
  comparedGap,
  findStatement,
  sourceItems,
  statementItems,
  type AuditFilter,
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
}>()

const emit = defineEmits<{ navigate: [patch: Record<string, string | undefined>] }>()

const isHealth = computed(() => props.category === HEALTH)
const rail = computed(() => !isHealth.value && Boolean(props.finding))
const categories = computed(() => categoryItems(props.report))
const sources = computed(() => sourceItems(props.report))
const sourceDoc = computed(() => props.report.health.sources?.[props.source] ?? null)
const categoryDoc = computed(() => props.report.categories?.[props.category] ?? null)
const statements = computed(() => statementItems(categoryDoc.value, props.filter))
const statementDoc = computed(() => categoryDoc.value?.statements?.[props.statement] ?? null)
const findings = computed(() => statementDoc.value?.findings ?? [])
const records = computed(() => recordRows(props.findingDoc?.finding.records))

const categoryLabel = computed(() => categories.value.find((item) => item.id === props.category)?.label ?? '')
const secondLabel = computed(() =>
  isHealth.value ? (sources.value.find((item) => item.key === props.source)?.label ?? '') : props.statement)

// fix.where is a system code; the page names systems the way every other page does.
const WHERE_LABELS: Record<string, string> = { NETSUITE: 'NetSuite', OMS: 'HotWax', SHOPIFY: 'Shopify' }

function moneyLabel(money: AuditMoney | null | undefined): string {
  return money ? `${money.amount} ${money.currency}` : ''
}

const money = computed(() => {
  const evidence = props.findingDoc?.finding.evidence
  if (!evidence) return []
  return [
    { label: evidence.expected?.source ? `Expected (${systemLabel(evidence.expected.source)})` : 'Expected', value: moneyLabel(evidence.expected) },
    { label: evidence.actual?.source ? `Actual (${systemLabel(evidence.actual.source)})` : 'Actual', value: moneyLabel(evidence.actual) },
    { label: 'Difference', value: moneyLabel(evidence.difference) },
  ].filter((item) => item.value)
})

const fixLine = computed(() => {
  const fix = props.findingDoc?.finding.fix
  if (!fix) return ''
  return [fix.owner, fix.where ? (WHERE_LABELS[fix.where] ?? fix.where) : '', fix.verify?.passesWhen ? `passes when ${fix.verify.passesWhen}` : '']
    .filter(Boolean).join(' · ')
})

const seenLabel = computed(() => {
  const times = props.findingDoc?.finding.status.timesSeen ?? 0
  return times === 1 ? 'seen once' : `seen ${times} times`
})

// The conclusion's label and its explanation are often the same sentence; say it once.
const whyLine = computed(() => {
  const diagnosis = props.findingDoc?.finding.diagnosis
  const parts = [diagnosis?.conclusion?.label, diagnosis?.explanation]
    .map((part) => (part ?? '').trim().replace(/\.$/, ''))
    .filter(Boolean)
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
  height: min(72vh, 46rem);
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

.audit-col-head {
  display: flex;
  justify-content: space-between;
  gap: var(--space-1);
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border-soft);
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

.audit-row-split {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
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

.audit-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
  margin: 0;
}

.audit-records {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: var(--space-1-5);
}

.audit-record {
  display: grid;
  gap: var(--space-0);
  padding: var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.audit-record-id {
  font-size: var(--type-tile-size);
  overflow-wrap: anywhere;
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
  grid-template-columns: 6rem minmax(0, 1fr) 4rem;
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
  grid-template-columns: 11rem minmax(0, 1fr);
  gap: var(--space-2);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
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

@media (prefers-reduced-motion: reduce) {
  .audit-columns-grid,
  .audit-row {
    transition: none;
  }
}
</style>
