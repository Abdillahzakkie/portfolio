'use client';

import { useState } from 'react';
import { Button } from './Button';
import { ToastRegion, useToast } from './Toast';
import {
  updateAccount,
  changePassword,
  saveSiteSettings,
  type ApiError,
  type SiteSettingsInput,
} from './api';

export interface SettingsInitial {
  displayName: string;
  siteName: string;
  siteDescription: string;
  githubUrl: string;
  contactEmail: string;
  defaultOgImage: string;
}

const inputStyle = {
  background: 'var(--surface)',
  borderColor: 'var(--border-strong)',
  color: 'var(--text)',
} as const;

// Client-side password validation messages. Named so the render layer can map
// each message back to the field(s) it concerns for aria-invalid/-describedby.
const PW_ERR = {
  missing: 'Fill in all three password fields.',
  tooShort: 'New password must be at least 8 characters.',
  mismatch: "Passwords don't match.",
} as const;

const labelClass = 'mb-1.5 block text-[12.5px] font-semibold';
const textInputClass =
  'w-full rounded-[var(--radius-sm)] border px-3 py-2.5 text-[13.5px] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]';
const monoInputClass =
  'w-full rounded-[var(--radius-sm)] border px-3 py-2.5 text-[12.5px] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-[var(--radius-lg)] border p-5 shadow-[var(--elev-1)] sm:p-6"
      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
    >
      <h2
        className="m-0 mb-4 text-[17px] font-bold"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export function SettingsForm({ initial }: { initial: SettingsInitial }) {
  const { toast, show, clear } = useToast();

  // --- Card A: Account ----------------------------------------------------
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [savingAccount, setSavingAccount] = useState(false);

  async function onSaveAccount() {
    if (savingAccount) return;
    setSavingAccount(true);
    try {
      await updateAccount(displayName.trim());
      show('success', 'Account updated.');
    } catch (err) {
      const status = (err as ApiError).status;
      show('error', status === 401 ? 'Session expired — please sign in again.' : "Couldn't save. Try again.");
    } finally {
      setSavingAccount(false);
    }
  }

  // --- Card B: Password ---------------------------------------------------
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  async function onSavePassword() {
    if (savingPassword) return;
    setPwError(null);
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPwError(PW_ERR.missing);
      return;
    }
    if (newPassword.length < 8) {
      setPwError(PW_ERR.tooShort);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPwError(PW_ERR.mismatch);
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      // Success: clear all three fields.
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      show('success', 'Password updated.');
    } catch (err) {
      const status = (err as ApiError).status;
      // Keep entered values on error; never reveal which field was wrong.
      if (status === 401) {
        show('error', 'Session expired — please sign in again.');
      } else {
        show('error', "Couldn't update password. Check your current password and try again.");
      }
    } finally {
      setSavingPassword(false);
    }
  }

  // --- Card C: Site -------------------------------------------------------
  const [site, setSite] = useState<SiteSettingsInput>({
    siteName: initial.siteName,
    siteDescription: initial.siteDescription,
    githubUrl: initial.githubUrl,
    contactEmail: initial.contactEmail,
    defaultOgImage: initial.defaultOgImage,
  });
  const [savingSite, setSavingSite] = useState(false);

  function patchSite(p: Partial<SiteSettingsInput>) {
    setSite((prev) => ({ ...prev, ...p }));
  }

  async function onSaveSite() {
    if (savingSite) return;
    setSavingSite(true);
    try {
      await saveSiteSettings(site);
      show('success', 'Site settings saved.');
    } catch (err) {
      const status = (err as ApiError).status;
      show('error', status === 401 ? 'Session expired — please sign in again.' : "Couldn't save. Try again.");
    } finally {
      setSavingSite(false);
    }
  }

  // Which field(s) does the current password error concern? Drives per-field
  // aria-invalid / aria-describedby so a screen reader on the relevant input
  // hears the message (the live region below also announces it on change).
  const pwErrCurrent = pwError === PW_ERR.missing;
  const pwErrNew = pwError === PW_ERR.missing || pwError === PW_ERR.tooShort;
  const pwErrConfirm = pwError === PW_ERR.missing || pwError === PW_ERR.mismatch;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      {/* Card A — Account */}
      <Card title="Account">
        <div className="mb-4">
          <label htmlFor="settings-display-name" className={labelClass} style={{ color: 'var(--text)' }}>
            Display name
          </label>
          <input
            id="settings-display-name"
            data-testid="settings-display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={textInputClass}
            style={inputStyle}
          />
        </div>
        <div className="flex justify-end">
          <Button
            data-testid="settings-account-save"
            variant="primary"
            loading={savingAccount}
            onClick={() => void onSaveAccount()}
          >
            Save changes
          </Button>
        </div>
      </Card>

      {/* Card B — Change password */}
      <Card title="Change password">
        <div className="mb-4">
          <label htmlFor="settings-current-password" className={labelClass} style={{ color: 'var(--text)' }}>
            Current password
          </label>
          <input
            id="settings-current-password"
            data-testid="settings-current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            aria-invalid={pwErrCurrent || undefined}
            aria-describedby={pwErrCurrent ? 'password-error' : undefined}
            className={textInputClass}
            style={inputStyle}
          />
        </div>
        <div className="mb-4">
          <label htmlFor="settings-new-password" className={labelClass} style={{ color: 'var(--text)' }}>
            New password
          </label>
          <input
            id="settings-new-password"
            data-testid="settings-new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            aria-invalid={pwErrNew || undefined}
            aria-describedby={pwErrNew ? 'new-password-hint password-error' : 'new-password-hint'}
            className={textInputClass}
            style={inputStyle}
          />
          <p id="new-password-hint" className="mt-1 text-[11.5px]" style={{ color: 'var(--text-faint)' }}>
            At least 8 characters.
          </p>
        </div>
        <div className="mb-4">
          <label htmlFor="settings-confirm-password" className={labelClass} style={{ color: 'var(--text)' }}>
            Confirm new password
          </label>
          <input
            id="settings-confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            aria-invalid={pwErrConfirm || undefined}
            aria-describedby={pwErrConfirm ? 'password-error' : undefined}
            className={textInputClass}
            style={inputStyle}
          />
          {pwError && (
            <p
              id="password-error"
              role="alert"
              className="mt-1 text-[11.5px]"
              style={{ color: 'var(--danger)' }}
            >
              {pwError}
            </p>
          )}
        </div>
        <div className="flex justify-end">
          <Button
            data-testid="settings-password-save"
            variant="primary"
            loading={savingPassword}
            onClick={() => void onSavePassword()}
          >
            Update password
          </Button>
        </div>
      </Card>

      {/* Card C — Site */}
      <Card title="Site">
        <div className="mb-4">
          <label htmlFor="settings-site-name" className={labelClass} style={{ color: 'var(--text)' }}>
            Site name
          </label>
          <input
            id="settings-site-name"
            data-testid="settings-site-name"
            value={site.siteName}
            onChange={(e) => patchSite({ siteName: e.target.value })}
            className={textInputClass}
            style={inputStyle}
          />
        </div>
        <div className="mb-4">
          <label htmlFor="settings-site-description" className={labelClass} style={{ color: 'var(--text)' }}>
            Site description
          </label>
          <textarea
            id="settings-site-description"
            rows={3}
            value={site.siteDescription}
            onChange={(e) => patchSite({ siteDescription: e.target.value })}
            className={`${textInputClass} resize-y`}
            style={inputStyle}
          />
        </div>
        <div className="mb-4">
          <label htmlFor="settings-github-url" className={labelClass} style={{ color: 'var(--text)' }}>
            GitHub URL
          </label>
          <input
            id="settings-github-url"
            type="url"
            inputMode="url"
            value={site.githubUrl}
            onChange={(e) => patchSite({ githubUrl: e.target.value })}
            placeholder="https://github.com/…"
            className={monoInputClass}
            style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
          />
        </div>
        <div className="mb-4">
          <label htmlFor="settings-contact-email" className={labelClass} style={{ color: 'var(--text)' }}>
            Contact email
          </label>
          <input
            id="settings-contact-email"
            type="email"
            inputMode="email"
            value={site.contactEmail}
            onChange={(e) => patchSite({ contactEmail: e.target.value })}
            placeholder="you@example.com"
            className={textInputClass}
            style={inputStyle}
          />
        </div>
        <div className="mb-4">
          <label htmlFor="settings-og-image" className={labelClass} style={{ color: 'var(--text)' }}>
            Default OG image
          </label>
          <input
            id="settings-og-image"
            type="url"
            inputMode="url"
            value={site.defaultOgImage}
            onChange={(e) => patchSite({ defaultOgImage: e.target.value })}
            placeholder="https://… (1200×630)"
            className={monoInputClass}
            style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
          />
        </div>
        <div className="flex justify-end">
          <Button
            data-testid="settings-site-save"
            variant="primary"
            loading={savingSite}
            onClick={() => void onSaveSite()}
          >
            Save changes
          </Button>
        </div>
      </Card>

      <ToastRegion toast={toast} onClose={clear} />
    </div>
  );
}
