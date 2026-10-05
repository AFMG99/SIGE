'use client'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded dark:bg-slate-800 ${className}`}
      aria-hidden="true"
      role="status"
      aria-label="Cargando"
    />
  )
}

export function UserTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="ui-table-shell">
      <div className="overflow-x-auto">
        <table className="ui-table">
          <thead>
            <tr>
              <th className="w-12"><Skeleton className="h-4 w-4 rounded" /></th>
              <th><Skeleton className="h-4 w-24" /></th>
              <th className="hidden md:table-cell"><Skeleton className="h-4 w-32" /></th>
              <th><Skeleton className="h-4 w-20" /></th>
              <th><Skeleton className="h-4 w-16" /></th>
              <th><Skeleton className="h-4 w-24" /></th>
              <th className="text-right"><Skeleton className="h-4 w-12" /></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i}>
                <td className="whitespace-nowrap"><Skeleton className="h-4 w-4 rounded mx-auto" /></td>
                <td className="whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-24 rounded" />
                      <Skeleton className="h-3 w-32 rounded mt-1" />
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap hidden md:table-cell"><Skeleton className="h-3 w-32 rounded" /></td>
                <td className="whitespace-nowrap"><Skeleton className="h-5 w-20 rounded-full mx-auto" /></td>
                <td className="whitespace-nowrap"><Skeleton className="h-5 w-16 rounded-full mx-auto" /></td>
                <td className="whitespace-nowrap"><Skeleton className="h-3 w-24 rounded" /></td>
                <td className="whitespace-nowrap text-right"><Skeleton className="h-4 w-12 rounded mx-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function UserCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="md:hidden space-y-3 px-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="ui-card">
          <div className="flex items-start gap-3">
            <Skeleton className="mt-1 h-4 w-4 rounded" />
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1 min-w-0">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-3 w-32 rounded mt-1" />
              <div className="mt-2 flex items-center gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-24 rounded mt-1" />
            </div>
            <Skeleton className="w-8 h-8 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}