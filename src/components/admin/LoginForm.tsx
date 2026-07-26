'use client';

import { useState } from 'react';
import { Button } from './Button';
import { login, type ApiError } from './api';

const GENERIC_ERROR = 'Invalid email or password.';
const LOCKED_ERROR = 'Too many attempts. Please wait a moment and try again.';

/**
 * Centered sign-in form. Never reveals which field was wrong (generic message
 * in a `role="alert"` region). On success redirects to `next` (default
 * `/admin`). Inputs disable while submitting.
 */
export function LoginForm({ next = '/admin' }: { next?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      // Full-document navigation (not a soft router.replace): the browser makes
      // a fresh request through middleware with the newly-set session cookie,
      // bypassing the client Router Cache that still holds the pre-login
      // "/admin -> /admin/login" redirect. `replace` keeps the login page out of
      // history. Do NOT reset `submitting` here — the page is unloading and the
      // button should stay in its "Signing in…" state until it does.
      window.location.replace(next);
    } catch (err) {
      const status = (err as ApiError).status;
      setError(status === 429 ? LOCKED_ERROR : GENERIC_ERROR);
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      aria-label="Sign in"
      data-testid="admin-login-form"
      className="w-full max-w-[380px] rounded-[var(--radius-lg)] border p-7 shadow-[var(--elev-3)]"
      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
    >
      <h1
        className="m-0 mb-1.5 text-2xl font-bold"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}
      >
        Sign in
      </h1>
      <p className="m-0 mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
        Authoring access for the portfolio &amp; blog.
      </p>

      <div role="alert" aria-live="assertive" className="min-h-0">
        {error && (
          <p
            className="mb-4 rounded-[var(--radius-sm)] border px-3 py-2.5 text-sm font-medium"
            style={{
              borderColor: 'var(--danger)',
              color: 'var(--danger)',
              background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
            }}
          >
            {error}
          </p>
        )}
      </div>

      <div className="mb-4">
        <label
          htmlFor="login-email"
          className="mb-1.5 block text-[13px] font-semibold"
          style={{ color: 'var(--text)' }}
        >
          Email
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          required
          autoComplete="username"
          disabled={submitting}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-11 w-full rounded-[var(--radius-md)] border px-3.5 text-[15px] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border-strong)',
            color: 'var(--text)',
            boxShadow: 'inset 0 1px 2px rgba(20,20,30,.04)',
          }}
        />
      </div>

      <div className="mb-5">
        <label
          htmlFor="login-password"
          className="mb-1.5 block text-[13px] font-semibold"
          style={{ color: 'var(--text)' }}
        >
          Password
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          disabled={submitting}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••••"
          className="h-11 w-full rounded-[var(--radius-md)] border px-3.5 text-[15px] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border-strong)',
            color: 'var(--text)',
            boxShadow: 'inset 0 1px 2px rgba(20,20,30,.04)',
          }}
        />
      </div>

      <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full">
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>

      <p className="mt-4 text-center text-[12.5px]" style={{ color: 'var(--text-faint)' }}>
        Protected area · unauthorized visits are redirected here.
      </p>
    </form>
  );
}
