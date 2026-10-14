import { cn } from '@/lib/utils';

/** Eight muggu dots around a centre point — the SachiSeva mark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-10', className)} aria-hidden>
      <rect width="64" height="64" rx="16" fill="#1C2566" />
      <g fill="#F2B632">
        {[20, 32, 44].flatMap((y) => [20, 32, 44].map((x) => (x === 32 && y === 32 ? null : <circle key={`${x}${y}`} cx={x} cy={y} r="4" />)))}
      </g>
      <circle cx="32" cy="32" r="6" fill="#fff" />
    </svg>
  );
}

export function Wordmark({ invert, className }: { invert?: boolean; className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark className="size-9" />
      <span className="leading-none">
        <span className={cn('display block text-[19px]', invert ? 'text-white' : 'text-ink')}>SachiSeva</span>
        <span className={cn('block text-[13px] font-medium', invert ? 'text-turmeric' : 'text-turmeric-deep')}>సచిసేవ</span>
      </span>
    </span>
  );
}
