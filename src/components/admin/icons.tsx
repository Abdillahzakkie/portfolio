import type { SVGProps } from 'react';
import type { Domain } from '@/server/models';

/**
 * Small, dependency-free inline icons for the admin UI. Each is `aria-hidden`
 * by default — icons are decorative and always paired with a visible/SR text
 * label on the control that renders them.
 */
function Icon({ children, size = 17, ...rest }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const PostsIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </Icon>
);
export const ProjectsIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7" />
  </Icon>
);
export const MediaIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="M21 15l-5-5L5 21" />
  </Icon>
);
export const SettingsIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 6.6 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4 13.6H4a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 5 6.6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10.4 4V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
  </Icon>
);
export const SearchIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon size={15} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4-4" />
  </Icon>
);
export const PlusIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon size={16} {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const ChevronLeftIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon size={15} {...p}>
    <path d="M15 18l-6-6 6-6" />
  </Icon>
);
export const MenuIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon size={20} {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Icon>
);
export const CloseIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon size={18} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);
export const ImageIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon size={15} {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="M21 15l-5-5L5 21" />
  </Icon>
);
export const LinkIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon size={15} {...p}>
    <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
  </Icon>
);
export const ExternalIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon size={14} {...p}>
    <path d="M7 17L17 7M9 7h8v8" />
  </Icon>
);
export const ListIcon = (p: SVGProps<SVGSVGElement>) => (
  <Icon size={15} {...p}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </Icon>
);

/** Per-domain glyph (paired with the domain label — never color-only). */
export const DOMAIN_GLYPH: Record<Domain, string> = {
  web3: '◆',
  security: '▲',
  commerce: '●',
  'tools-labs': '✦',
};

/**
 * Per-domain accent CSS variable. Reuses the guaranteed status tokens
 * (tokens.md §2.4: web3→info, security→danger, commerce→success,
 * tools-labs→warning) so admin never depends on the exact `--cluster-*`
 * variable names that frontend-public owns.
 */
export const DOMAIN_ACCENT_VAR: Record<Domain, string> = {
  web3: 'var(--info)',
  security: 'var(--danger)',
  commerce: 'var(--success)',
  'tools-labs': 'var(--warning)',
};
