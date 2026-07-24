/**
 * PostCSS config for Tailwind CSS v4.
 *
 * v4 is configured the CSS-first way: the token layer and `@import "tailwindcss"`
 * live in `globals.css` (owned by frontend-dev (public), NOT devops). This file
 * only wires the single Tailwind v4 PostCSS plugin so that `@import "tailwindcss"`
 * resolves at build time. No `tailwind.config.js` is required.
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
