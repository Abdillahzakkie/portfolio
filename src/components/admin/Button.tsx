import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] ' +
  'font-semibold whitespace-nowrap select-none cursor-pointer ' +
  'transition-[filter,background-color,transform] duration-[120ms] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] ' +
  'active:scale-[.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100';

// All sizes keep a >=44px touch target on the primary axis for coarse pointers.
const sizes: Record<Size, string> = {
  sm: 'h-11 px-3 text-[13px] sm:h-9',
  md: 'h-11 px-4 text-sm sm:h-10',
  lg: 'h-12 px-5 text-[15px]',
};

const variants: Record<Variant, string> = {
  primary: 'bg-[var(--info)] text-white hover:brightness-110',
  secondary:
    'bg-[var(--surface)] text-[var(--text)] border border-[var(--border-strong)] hover:bg-[var(--surface-2)]',
  ghost: 'bg-transparent text-[var(--text)] hover:bg-[var(--surface-2)]',
  danger: 'bg-[var(--danger)] text-white hover:brightness-110',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

/** Accessible button primitive: real `<button>`, focus ring, loading spinner. */
export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  iconLeft,
  iconRight,
  disabled,
  className = '',
  children,
  type = 'button',
  ref,
  ...rest
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent opacity-80 motion-reduce:animate-none"
        />
      ) : (
        iconLeft
      )}
      {children}
      {!loading && iconRight}
    </button>
  );
}
