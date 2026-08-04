/**
 * Design-system adherence gate.
 *
 * The point of this file is one rule: values that the design system owns must come from the design
 * system. ESLint cannot do this job — it does not parse CSS inside Vue SFC <style> blocks, so the
 * intent encoded in the design system's own _adherence.oxlintrc.json (no raw hex, no raw px) never
 * fires on 61% of this codebase's CSS.
 *
 * Enforcement is deliberately partial and the gaps are listed below rather than left implicit. A
 * gate that is green today and blocks new debt is worth more than a gate that fails on 96 existing
 * violations and gets skipped.
 */
module.exports = {
  extends: ['stylelint-config-recommended'],
  plugins: ['stylelint-declaration-strict-value'],

  // postcss-html only for SFCs; .css files use the default syntax.
  overrides: [{ files: ['**/*.vue'], customSyntax: 'postcss-html' }],

  rules: {
    /**
     * Currently enforced: colour and radius. Both are clean across the codebase as of 2026-08-04,
     * so this locks in discipline that already exists rather than demanding a migration.
     *
     * NOT yet enforced, and each is a phase-02 task rather than an oversight:
     *   font-size      79 violations — several de-facto roles (0.82rem x7, 0.9rem x5) have no token
     *                  at all. Blocked on deciding whether to add tokens or reduce the type palette.
     *   letter-spacing 14 violations — same cluster, same decision.
     * Add each to the property list below as its phase-02 slice lands.
     */
    'scale-unlimited/declaration-strict-value': [
      ['/color$/', 'fill', 'stroke', 'border-radius'],
      {
        ignoreValues: ['currentColor', 'inherit', 'initial', 'transparent', 'none', 'unset', 'normal', '0'],
        // color-mix(in oklab, var(--accent) 42%, var(--border)) is token-driven and legitimate;
        // without this the rule flags every derived colour in the product.
        ignoreFunctions: true,
        disableFix: true,
      },
    ],

    /**
     * One weight axis. Darpan uses 400 everywhere and takes emphasis from size, never from bold —
     * the design system says the same thing in tokens/typography.css ("Headings are 400 — emphasis
     * comes from size, never bold"). Ten declarations had drifted to 500/600/700 before this rule
     * existed. The @font-face block in style.css is exempted inline: it describes what the font
     * files carry, which is not the same as using a weight.
     */
    'declaration-property-value-allowed-list': {
      'font-weight': ['400', 'normal', 'inherit'],
    },

    // Vue's SFC-scoped selectors. Not unknown, just not CSS.
    'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['deep', 'slotted', 'global'] }],
    'selector-pseudo-element-no-unknown': [true, { ignorePseudoElements: ['v-deep', 'v-slotted', 'v-global'] }],

    // Source-order rule, 20 hits, none of them correctness. Reordering a mature stylesheet to
    // satisfy it risks cascade changes for no user-visible gain.
    'no-descending-specificity': null,

    // The --surface-* container/consumer token contract deliberately splits container rules
    // (.static-page-hero appears once for tokens and once for layout). Merging them would reorder
    // the cascade to satisfy a stylistic rule.
    'no-duplicate-selectors': null,
  },

  ignoreFiles: ['dist/**', 'coverage/**', 'node_modules/**'],
}
