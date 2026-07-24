'use client';

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  scale: number;
  min?: number;
  max?: number;
}

/**
 * On-screen zoom controls — three real, keyboard-focusable <button>s so zoom is
 * never mouse-wheel-only (docs/02 §5). Disabled at the clamp bounds.
 */
export function ZoomControls({
  onZoomIn,
  onZoomOut,
  onFit,
  scale,
  min = 0.6,
  max = 2.5,
}: ZoomControlsProps) {
  const atMax = scale >= max - 0.001;
  const atMin = scale <= min + 0.001;

  const btn: React.CSSProperties = {
    width: 40,
    height: 40,
    border: 'none',
    background: 'transparent',
    color: 'var(--text)',
    borderRadius: 8,
    fontSize: 17,
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 600,
  };

  return (
    <div
      role="group"
      aria-label="Zoom controls"
      style={{
        position: 'absolute',
        right: 12,
        bottom: 12,
        display: 'flex',
        gap: 4,
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-md)',
        padding: 4,
        boxShadow: 'var(--elev-2)',
      }}
    >
      <button
        type="button"
        aria-label="Zoom in"
        onClick={onZoomIn}
        disabled={atMax}
        aria-disabled={atMax}
        style={{ ...btn, opacity: atMax ? 0.4 : 1 }}
      >
        +
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        onClick={onZoomOut}
        disabled={atMin}
        aria-disabled={atMin}
        style={{ ...btn, opacity: atMin ? 0.4 : 1 }}
      >
        −
      </button>
      <button
        type="button"
        aria-label="Fit constellation to screen"
        onClick={onFit}
        style={{ ...btn, width: 'auto', padding: '0 12px', fontSize: 13 }}
      >
        Fit
      </button>
    </div>
  );
}

export default ZoomControls;
