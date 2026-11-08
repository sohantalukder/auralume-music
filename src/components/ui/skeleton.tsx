import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <span className={cn("skeleton", className)} aria-hidden="true" />;
}

export function TrackListSkeleton({ rows = 6, label = "Loading tracks" }: { rows?: number; label?: string }) {
  return <div className="skeleton-track-list" role="status" aria-label={label} aria-busy="true">{Array.from({ length: rows }, (_, index) => <div className="skeleton-track-row" key={index}><Skeleton className="skeleton-index" /><Skeleton className="skeleton-art" /><span><Skeleton className="skeleton-title" /><Skeleton className="skeleton-copy" /></span><Skeleton className="skeleton-album" /></div>)}</div>;
}

export function DashboardSkeleton() {
  return <div className="dashboard-skeleton" role="status" aria-label="Loading your home" aria-busy="true"><Skeleton className="skeleton-hero" /><div className="skeleton-section-heading"><span><Skeleton className="skeleton-kicker" /><Skeleton className="skeleton-heading" /></span></div><div className="skeleton-card-grid">{Array.from({ length: 6 }, (_, index) => <div className="skeleton-card" key={index}><Skeleton className="skeleton-card-art" /><Skeleton className="skeleton-title" /><Skeleton className="skeleton-copy" /></div>)}</div></div>;
}

export function SearchMenuSkeleton() {
  return <div className="search-menu-skeleton" role="status" aria-label="Searching music" aria-busy="true">{Array.from({ length: 4 }, (_, index) => <div key={index}><Skeleton className="skeleton-menu-icon" /><span><Skeleton className="skeleton-title" /><Skeleton className="skeleton-copy" /></span><Skeleton className="skeleton-menu-art" /></div>)}</div>;
}

export function PageSkeleton() {
  return <div className="page-skeleton" role="status" aria-label="Loading page" aria-busy="true"><Skeleton className="skeleton-kicker" /><Skeleton className="skeleton-page-title" /><Skeleton className="skeleton-page-copy" /><TrackListSkeleton rows={5} /></div>;
}

export function LyricsSkeleton() {
  return <div className="lyrics-skeleton" role="status" aria-label="Finding lyrics" aria-busy="true">{[74, 92, 63, 86, 56].map((width, index) => <Skeleton key={index} className="skeleton-lyric" />)}</div>;
}
