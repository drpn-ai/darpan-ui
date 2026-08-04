<template>
  <main class="page-root roadmap-page">
    <section class="card roadmap-hero-card">
      <div class="stack-md">
        <p class="eyebrow roadmap-kicker">customer_access // linear_portal</p>
        <div class="roadmap-hero-copy">
          <h1>Roadmap &amp; Requests</h1>
          <p class="muted-copy">
            Choose a customer-safe roadmap view or open a request without leaving the Darpan workspace.
          </p>
        </div>
      </div>
    </section>

    <section class="card-grid two portal-choice-grid">
      <article v-for="target in targets" :key="target.key" class="card portal-choice-card">
        <div class="stack-sm portal-choice-copy">
          <p class="eyebrow">{{ target.eyebrow }}</p>
          <h2>{{ target.title }}</h2>
          <p>{{ target.description }}</p>
        </div>

        <div v-if="!target.url" class="portal-choice-status-shell">
          <InlineValidation tone="info" :message="target.emptyMessage" />
        </div>

        <div v-else class="stack-sm portal-choice-actions-shell">
          <div class="portal-action-row">
            <a class="primary-link" :href="target.url" target="_blank" rel="noreferrer">
              {{ target.linkLabel }}
            </a>
            <button
              v-if="config.embedEnabled"
              type="button"
              class="ghost-link portal-preview-button"
              @click="togglePreview(target.key)"
            >
              {{ expandedPreview === target.key ? 'Hide Preview' : 'Preview in Darpan' }}
            </button>
          </div>

          <p v-if="!config.embedEnabled" class="muted-copy portal-note">Opens in a new tab.</p>

          <div v-if="config.embedEnabled && expandedPreview === target.key" class="embed-shell">
            <div class="embed-banner">
              <p>If the preview stays blank, use the direct link above instead.</p>
            </div>
            <iframe
              class="linear-frame"
              :src="target.url"
              :title="`${target.title} via Linear`"
              loading="lazy"
              referrerpolicy="no-referrer"
            />
          </div>
        </div>
      </article>
    </section>

    <article class="card portal-guardrail-card">
      <div class="stack-sm portal-guardrail-copy">
        <p class="eyebrow">customer-safe links only</p>
        <p class="muted-copy">
          Show only public or customer-safe Linear pages here. Internal workspace views should stay out of this route.
        </p>
      </div>
    </article>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import InlineValidation from '../components/ui/InlineValidation.vue'
import { getLinearPortalConfig, type LinearPortalConfig } from '../lib/linearAccess'

type LinearPortalTarget = {
  key: 'roadmap' | 'request'
  eyebrow: string
  title: string
  description: string
  linkLabel: string
  url: string | null
  emptyMessage: string
}

const config: LinearPortalConfig = getLinearPortalConfig(import.meta.env)

const targets: LinearPortalTarget[] = [
  {
    key: 'roadmap',
    eyebrow: 'Roadmap',
    title: 'Review roadmap',
    description: 'Open the customer-facing roadmap in a clean new-tab view when you need delivery context.',
    linkLabel: 'Open Roadmap',
    url: config.roadmapUrl,
    emptyMessage: 'Roadmap access is not available yet.',
  },
  {
    key: 'request',
    eyebrow: 'Requests',
    title: 'Open request',
    description: 'Launch the customer request form without exposing internal triage or admin surfaces.',
    linkLabel: 'Open Request Form',
    url: config.requestUrl,
    emptyMessage: 'Request intake is not available yet.',
  },
]

const expandedPreview = ref<LinearPortalTarget['key'] | null>(null)

function togglePreview(targetKey: LinearPortalTarget['key']): void {
  expandedPreview.value = expandedPreview.value === targetKey ? null : targetKey
}
</script>

<style scoped>
.roadmap-page {
  gap: var(--space-4);
}

.roadmap-hero-card,
.portal-choice-grid {
  align-items: stretch;
}

.roadmap-hero-card,
.portal-choice-card,
.portal-guardrail-card {
  display: grid;
  gap: var(--space-3);
}

.roadmap-kicker {
  display: inline-flex;
  width: fit-content;
  padding: 0.35rem 0.55rem;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}

.roadmap-hero-copy,
.portal-choice-copy,
.portal-choice-actions-shell,
.portal-choice-status-shell,
.portal-guardrail-copy {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: color-mix(in oklab, var(--surface) 78%, var(--surface-2));
}

.roadmap-hero-copy h1,
.portal-choice-card h2 {
  margin: 0;
  letter-spacing: -0.01em;
}

.roadmap-hero-copy {
  gap: var(--space-3);
}

.portal-action-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.portal-preview-button {
  min-height: 0;
  padding: 0.62rem 0.96rem;
}

.portal-note {
  margin: 0;
}

.portal-choice-status-shell :deep(.inline-validation) {
  margin: 0;
}

.embed-shell {
  display: grid;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--surface-2);
}

.embed-banner {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border-soft);
}

.embed-banner p {
  margin: 0;
  font-size: var(--type-label-size);
  color: var(--text-soft);
}

.linear-frame {
  width: 100%;
  min-height: 480px;
  border: 0;
  background: #ffffff;
}

@media (max-width: 768px) {
  .portal-action-row {
    align-items: stretch;
  }

  .portal-action-row > * {
    width: 100%;
  }

  .linear-frame {
    min-height: 360px;
  }
}
</style>
