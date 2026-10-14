'use client'

import { Skeleton } from '@/shared/views/ui/Skeleton'

/**
 * Placeholder rendered while a lazily code-split data section downloads
 * (T7 — Phase 4b).
 *
 * The heavy sections (XLSX import wizards, LBEn calculator, adjustments) only
 * mount behind an explicit section/mode switch, so their chunk has to arrive
 * after the first paint. This skeleton keeps a stable height (`min-h-96` plus
 * fixed blocks) so the swap to the real content does not shift the layout
 * above it, and uses the shared `Skeleton` primitive so the design system
 * (tokens, dark mode, pulse) stays consistent.
 */
export function SectionSkeleton() {
  return (
    <div className="ui-panel min-h-96 space-y-4" aria-busy="true">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-48 max-w-full" />
          <Skeleton className="h-3 w-72 max-w-full" />
        </div>
        <Skeleton className="hidden h-7 w-28 rounded-full sm:block" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  )
}
