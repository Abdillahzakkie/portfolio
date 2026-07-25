import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface BaseProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  className?: string;
  children: ReactNode;
}

interface ButtonAsButton extends BaseProps {
  as?: 'button';
  href?: never;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
  disabled?: boolean;
  'aria-label'?: string;
}

interface ButtonAsLink extends BaseProps {
  as: 'a';
  href: string;
  external?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
}

type ButtonProps = ButtonAsButton | ButtonAsLink;

const SIZE: Record<Size, { minHeight: number; padding: string; font: number }> = {
  sm: { minHeight: 44, padding: '0 14px', font: 14 },
  md: { minHeight: 44, padding: '0 16px', font: 14 },
  lg: { minHeight: 48, padding: '0 18px', font: 15 },
};

function variantStyle(variant: Variant): CSSProperties {
  switch (variant) {
    case 'primary':
      return { background: 'var(--info)', color: 'var(--text-on-accent)', borderColor: 'transparent' };
    case 'danger':
      return { background: 'var(--danger)', color: '#fff', borderColor: 'transparent' };
    case 'ghost':
      return { background: 'transparent', color: 'var(--text)', borderColor: 'transparent' };
    case 'secondary':
    default:
      return {
        background: 'var(--surface)',
        color: 'var(--text)',
        borderColor: 'var(--border-strong)',
      };
  }
}

function baseStyle(size: Size, variant: Variant, disabled: boolean): CSSProperties {
  const s = SIZE[size];
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: s.minHeight,
    padding: s.padding,
    borderRadius: 'var(--radius-md)',
    border: '1px solid transparent',
    fontFamily: 'var(--font-body, sans-serif)',
    fontWeight: 600,
    fontSize: s.font,
    lineHeight: 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'background var(--dur-fast) var(--ease-standard), transform var(--dur-fast)',
    ...variantStyle(variant),
  };
}

function Spinner() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ animation: 'az-spin 0.7s linear infinite' }}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <style>{`@keyframes az-spin{to{transform:rotate(360deg)}}`}</style>
    </svg>
  );
}

/**
 * Shared Button. Renders a real `<button>` or an `<a>` (internal → next/link,
 * external → plain anchor with rel="noopener"). Icon-only usages must pass an
 * aria-label. Meets the 44px touch minimum for every size.
 */
export function Button(props: ButtonProps) {
  const {
    variant = 'primary',
    size = 'md',
    loading = false,
    iconLeft,
    iconRight,
    className,
    children,
  } = props;
  const disabled = Boolean(props.disabled) || loading;
  const style = baseStyle(size, variant, disabled);

  const inner = (
    <>
      {loading ? <Spinner /> : iconLeft}
      <span>{children}</span>
      {!loading && iconRight}
    </>
  );

  if (props.as === 'a') {
    const { href, external, 'aria-label': ariaLabel } = props;
    if (external) {
      return (
        <a
          href={href}
          className={className}
          style={style}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={ariaLabel}
          aria-disabled={disabled || undefined}
        >
          {inner}
        </a>
      );
    }
    return (
      <Link href={href} className={className} style={style} aria-label={ariaLabel}>
        {inner}
      </Link>
    );
  }

  return (
    <button
      type={props.type ?? 'button'}
      className={className}
      style={style}
      onClick={props.onClick}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-label={props['aria-label']}
    >
      {inner}
    </button>
  );
}

export default Button;
