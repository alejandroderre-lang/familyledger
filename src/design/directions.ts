/**
 * Design directions for the Ramp-style rework.
 *
 * Ramp's interface language is dense, near-monochrome, card-less: hairline
 * rules instead of shadows, tabular figures, small uppercase micro-labels, and
 * one sharp accent used sparingly. All three directions share that vocabulary
 * and differ in how they structure the dashboard, not merely in colour.
 *
 * Active direction comes from ?design=ledger|statement|grid and is written to
 * data-design on <html>, where index.css swaps the token values.
 */

export const DESIGN_DIRECTIONS = ['ledger', 'statement', 'grid'] as const
export type DesignDirection = (typeof DESIGN_DIRECTIONS)[number]

export const DEFAULT_DIRECTION: DesignDirection = 'ledger'

export interface DirectionMeta {
  id: DesignDirection
  name: string
  tagline: string
  /** What structurally differs, not just what colour it is. */
  structure: string
}

export const DIRECTION_META: Record<DesignDirection, DirectionMeta> = {
  ledger: {
    id: 'ledger',
    name: 'Ledger',
    tagline: 'Closest to Ramp’s own app',
    structure:
      'Metrics sit in one bordered strip divided by hairlines — no gaps, no shadows. Categories become horizontal bars rather than a donut. Transactions are a dense table with right-aligned tabular figures.',
  },
  statement: {
    id: 'statement',
    name: 'Statement',
    tagline: 'One number, stated plainly',
    structure:
      'Opens with a near-black block and the month total reversed out at display size, the way Ramp presents a balance. Everything below is quiet white rows so the hero carries the hierarchy.',
  },
  grid: {
    id: 'grid',
    name: 'Grid',
    tagline: 'Analytics-dense',
    structure:
      'A four-cell metric grid including month-over-month change, then categories with inline share bars. Tightest radius and smallest type — the most information per screen.',
  },
}

export function isDesignDirection(value: unknown): value is DesignDirection {
  return (
    typeof value === 'string' &&
    (DESIGN_DIRECTIONS as readonly string[]).includes(value)
  )
}
