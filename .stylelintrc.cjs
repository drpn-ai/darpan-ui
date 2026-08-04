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
     * Colour, radius, and — since the type scale landed — size and tracking. Every value these
     * properties take must name a role.
     *
     * The eight remaining literals carry an inline disable WITH the reason, rather than being
     * exempted by file or by turning a property off. Two kinds: sizes that set an icon glyph or a
     * display figure (not type in the sense the scale describes), and values whose nearest role is
     * far enough away that folding would be visible rather than sub-pixel. Marked exceptions can be
     * counted and argued with; silent ones spread.
     */
    'scale-unlimited/declaration-strict-value': [
      ['/color$/', 'fill', 'stroke', 'border-radius', 'font-size', 'letter-spacing', 'margin'],
      {
        ignoreValues: ['currentColor', 'inherit', 'initial', 'transparent', 'none', 'unset', 'normal', 'auto', '0'],
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
