import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Link, type LinkProps } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ApplicationStatus } from '@/types';

/* ── Buttons ─────────────────────────────────────────────────────────── */

type Variant = 'primary' | 'ink' | 'outline' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

const variantCls: Record<Variant, string> = {
  primary: 'bg-turmeric text-ink hover:bg-[#e9a91c] active:bg-turmeric-deep active:text-white shadow-[inset_0_-2px_0_rgb(0_0_0/0.12)]',
  ink: 'bg-ink text-white hover:bg-ink-soft',
  outline: 'border border-ink/20 bg-paper text-ink hover:border-ink/40 hover:bg-ink-50',
  ghost: 'text-ink hover:bg-ink-50',
  danger: 'bg-kumkum text-white hover:bg-[#9a1f18]',
  success: 'bg-leaf text-white hover:bg-[#186540]',
};
const sizeCls: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-[10px]',
  md: 'h-11 px-5 text-[15px] gap-2 rounded-[12px]',
  lg: 'h-13 px-6 text-base gap-2 rounded-[14px]',
};

export function buttonCls(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(
    'inline-flex select-none items-center justify-center font-semibold whitespace-nowrap transition-[background,color,border,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
    variantCls[variant],
    sizeCls[size],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button ref={ref} className={buttonCls(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
});

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={buttonCls(variant, size, className)} {...rest} />;
}

/* ── Surfaces ────────────────────────────────────────────────────────── */

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-[var(--radius-card)] border border-line bg-paper', className)} {...rest}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-5 flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h1 className="display text-[26px] text-ink sm:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-[60ch] text-[15px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-lg font-semibold text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="muggu-faint flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-ink/15 bg-paper px-6 py-10 text-center">
      {icon && <div className="mb-3 grid size-12 place-items-center rounded-full bg-turmeric-50 text-turmeric-deep">{icon}</div>}
      <p className="text-base font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-[42ch] text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-[72px] w-full" />
      ))}
    </div>
  );
}

export function Notice({
  tone = 'info',
  children,
  className,
}: {
  tone?: 'info' | 'warn' | 'error' | 'success';
  children: ReactNode;
  className?: string;
}) {
  const cls = {
    info: 'bg-ink-50 text-ink border-ink/10',
    warn: 'bg-amber-50 text-amber border-amber/20',
    error: 'bg-kumkum-50 text-kumkum border-kumkum/20',
    success: 'bg-leaf-50 text-leaf border-leaf/20',
  }[tone];
  return <div className={cn('rounded-[14px] border px-4 py-3 text-sm', cls, className)}>{children}</div>;
}

/* ── Form fields ─────────────────────────────────────────────────────── */

const fieldBase =
  'w-full rounded-[var(--radius-field)] border border-line bg-paper px-3.5 text-[15px] text-ink placeholder:text-muted/70 transition-colors focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/10 disabled:bg-mist';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(fieldBase, 'h-12', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        fieldBase,
        'h-12 appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27none%27 stroke=%27%231c2566%27 stroke-width=%272%27><path d=%27M4 6l4 4 4-4%27/></svg>")] bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(fieldBase, 'py-3 leading-relaxed', className)} {...rest} />;
  },
);

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-kumkum">{error}</p>}
    </div>
  );
}

/** Two or more mutually exclusive choices as big tap targets. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T | '';
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)} role="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-11 min-w-[84px] flex-1 rounded-[12px] border px-3 text-[15px] font-medium transition-colors',
              on ? 'border-ink bg-ink text-white' : 'border-line bg-paper text-ink hover:border-ink/40',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { value: T; label: ReactNode; count?: number }[];
}) {
  return (
    <div className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto px-1" role="tablist">
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.value)}
            className={cn(
              'flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors',
              on ? 'bg-ink text-white' : 'bg-paper text-ink ring-1 ring-line hover:ring-ink/30',
            )}
          >
            {t.label}
            {t.count != null && (
              <span className={cn('rounded-full px-1.5 text-xs', on ? 'bg-white/20' : 'bg-ink-50')}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Status ──────────────────────────────────────────────────────────── */

export const STATUS_META: Record<ApplicationStatus, { en: string; te: string; cls: string; dot: string }> = {
  submitted: { en: 'Submitted', te: 'సమర్పించబడింది', cls: 'bg-ink-50 text-ink', dot: 'bg-ink' },
  under_review: { en: 'Under review', te: 'సమీక్షలో ఉంది', cls: 'bg-[#e7effd] text-[#1d4fb8]', dot: 'bg-[#2a63d6]' },
  documents_requested: { en: 'Documents needed', te: 'పత్రాలు కావాలి', cls: 'bg-amber-50 text-amber', dot: 'bg-turmeric-deep' },
  approved: { en: 'Approved', te: 'ఆమోదించబడింది', cls: 'bg-leaf-50 text-leaf', dot: 'bg-leaf' },
  rejected: { en: 'Rejected', te: 'తిరస్కరించబడింది', cls: 'bg-kumkum-50 text-kumkum', dot: 'bg-kumkum' },
};

export function StatusBadge({ status, lang }: { status: ApplicationStatus; lang: 'en' | 'te' }) {
  const m = STATUS_META[status] ?? STATUS_META.submitted;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', m.cls)}>
      <span className={cn('size-1.5 rounded-full', m.dot)} />
      {lang === 'te' ? m.te : m.en}
    </span>
  );
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-full bg-ink-50 px-2.5 py-0.5 text-xs font-medium text-ink', className)}>{children}</span>;
}

/* ── Overlays ────────────────────────────────────────────────────────── */

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  // Portal to <body> so page animations / stacking contexts can't trap the overlay.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal>
      <div className="absolute inset-0 animate-fade bg-ink/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-lg animate-sheet rounded-t-[24px] bg-paper shadow-[var(--shadow-pop)] sm:animate-rise sm:rounded-[24px]">
        <div className="flex items-center justify-between gap-3 px-5 pt-5">
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-ink-50" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="pb-safe flex justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-ink-50', className)}>
      <div
        className="h-full rounded-full bg-turmeric transition-[width] duration-500 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function FullPageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="flex flex-col items-center gap-3 text-muted">
        <span className="grid size-12 place-items-center rounded-full bg-paper shadow-[var(--shadow-lift)]">
          <Loader2 className="size-5 animate-spin text-ink" />
        </span>
        <span className="text-sm">{label}</span>
      </div>
    </div>
  );
}
