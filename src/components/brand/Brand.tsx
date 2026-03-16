import { useId } from 'react';
import { BRAND_LABEL, BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';
import { cn } from '@/lib/utils';

interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  const id = useId().replace(/:/g, '');
  const bgId = `${id}-bg`;
  const panelId = `${id}-panel`;

  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn('h-10 w-10', className)}>
      <defs>
        <linearGradient id={bgId} x1="12" y1="10" x2="52" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F4B544" />
          <stop offset="1" stopColor="#C7681B" />
        </linearGradient>
        <linearGradient id={panelId} x1="20" y1="18" x2="46" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFF8EE" stopOpacity="0.98" />
          <stop offset="1" stopColor="#F4E3C5" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="52" height="52" rx="18" fill={`url(#${bgId})`} />
      <rect x="7" y="7" width="50" height="50" rx="17" fill="none" stroke="rgba(255,255,255,0.28)" />
      <rect x="16" y="16" width="32" height="32" rx="11" fill={`url(#${panelId})`} />
      <path d="M23 25h11" stroke="#8B4A14" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M23 32h9" stroke="#8B4A14" strokeWidth="3.2" strokeLinecap="round" opacity="0.9" />
      <path d="M23 39h7" stroke="#8B4A14" strokeWidth="3.2" strokeLinecap="round" opacity="0.7" />
      <path
        d="M35 33.5l4.4 4.4L47 28.8"
        fill="none"
        stroke="#C7681B"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface BrandProps {
  className?: string;
  compact?: boolean;
  showTagline?: boolean;
}

export function Brand({ className, compact = false, showTagline = false }: BrandProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <BrandMark className={compact ? 'h-9 w-9' : 'h-11 w-11'} />
      <div className="min-w-0">
        <div className="truncate text-[10px] font-semibold uppercase tracking-[0.28em] text-primary/80">
          {BRAND_LABEL}
        </div>
        <div className={cn('truncate font-semibold tracking-[-0.02em]', compact ? 'text-sm' : 'text-lg')}>
          {BRAND_NAME}
        </div>
        {showTagline && (
          <div className="max-w-[28rem] text-sm text-muted-foreground">
            {BRAND_TAGLINE}
          </div>
        )}
      </div>
    </div>
  );
}
