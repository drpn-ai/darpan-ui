// DAR-UI-083. What a page says while its first read is in flight. Silly, like errorVariants, and every line keeps the
// noun so the operator still knows what is coming.
export const loadingLines = (noun: string): string[] => [
  `polishing the mirror for your ${noun}`,
  `lining up your ${noun}, one row at a time`,
  `asking the servers nicely for your ${noun}`,
  `your ${noun} is putting its shoes on`,
  `counting your ${noun} twice, to be sure`,
  `your ${noun} was right here a second ago`,
]

/** Long enough to read a line, short enough that a 2-second load shows a second one. */
export const LOADING_LINE_MS = 1400
