import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '@/server/db/connect';
import { SiteSettings, User } from '@/server/models';
import {
  getSiteSettings,
  updateSiteSettings,
  updateProfile,
  NotFoundError,
} from '@/server/services';
import {
  changePassword,
  hashPassword,
  verifyLogin,
} from '@/server/auth/password';
import { UnauthorizedError, ValidationError } from '@/server/services/errors';

/**
 * Settings + account/password services against a THROWAWAY Mongo db
 * (portfolio_vitest_<pid>) on the shared Docker instance — NEVER the app db
 * (asserted before any write; whole db dropped in afterAll even on failure).
 *
 * CACHING CAVEAT (getSiteSettings): the public read is wrapped in
 * `unstable_cache` + React `cache`. Outside a Next render/request there is no
 * request store, so it executes through (fallback-to-defaults on any error). To
 * keep assertions deterministic we (a) exercise the defaults path via
 * getSiteSettings ONCE, and (b) assert every WRITE by reading the persisted doc
 * back through the model directly — bypassing any memoization entirely.
 */

const ADMIN_EMAIL = 'settings-admin@local.test';

beforeAll(async () => {
  await connectToDatabase();
  const dbName = mongoose.connection.name;
  if (dbName === 'portfolio' || !/^portfolio_vitest_/.test(dbName)) {
    throw new Error(
      `Refusing to run: connected to "${dbName}", not a portfolio_vitest_* throwaway db.`,
    );
  }
  await Promise.all([SiteSettings.deleteMany({}), User.deleteMany({})]);
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    const dbName = mongoose.connection.name;
    if (/^portfolio_vitest_/.test(dbName)) {
      await mongoose.connection.dropDatabase();
    }
  }
  await disconnectFromDatabase();
});

describe('DB safety', () => {
  it('is connected to a portfolio_vitest_* throwaway db, not the app db', () => {
    expect(mongoose.connection.name).not.toBe('portfolio');
    expect(mongoose.connection.name).toMatch(/^portfolio_vitest_/);
  });
});

describe('getSiteSettings — defaults on an empty collection', () => {
  it('returns the hardcoded singleton defaults when nothing is stored', async () => {
    const settings = await getSiteSettings();
    expect(settings.siteName).toBe('Abdullah Zakariyya');
    expect(settings.githubUrl).toBe('https://github.com');
    expect(settings.contactEmail).toBe('hello@example.com');
    expect(settings.defaultOgImage).toBe('');
    expect(typeof settings.siteDescription).toBe('string');
    expect(settings.siteDescription.length).toBeGreaterThan(0);
  });
});

describe('updateSiteSettings — partial $set upsert (only provided fields change)', () => {
  it('upserts the singleton and changes ONLY the provided field', async () => {
    const first = await updateSiteSettings({ siteName: 'Custom Site' });
    expect(first.siteName).toBe('Custom Site');
    // Untouched fields fall back to model defaults (proves it was a $set, not a replace).
    expect(first.githubUrl).toBe('https://github.com');
    expect(first.contactEmail).toBe('hello@example.com');

    // Read the persisted doc back through the model (bypasses any read cache).
    const doc = await SiteSettings.findOne({ key: 'site' }).lean();
    expect(doc?.siteName).toBe('Custom Site');
  });

  it('a second partial patch leaves previously-set fields intact', async () => {
    await updateSiteSettings({ siteName: 'Persisted Name' });
    const second = await updateSiteSettings({ contactEmail: 'new@example.com' });
    // siteName from the earlier write survives; only contactEmail changed.
    expect(second.siteName).toBe('Persisted Name');
    expect(second.contactEmail).toBe('new@example.com');

    const doc = await SiteSettings.findOne({ key: 'site' }).lean();
    expect(doc?.siteName).toBe('Persisted Name');
    expect(doc?.contactEmail).toBe('new@example.com');
  });

  it('never creates a second singleton row (one document, always)', async () => {
    await updateSiteSettings({ siteName: 'A' });
    await updateSiteSettings({ siteDescription: 'B' });
    expect(await SiteSettings.countDocuments({})).toBe(1);
  });
});

describe('updateProfile — updates User.name, returns hash-free PublicUser', () => {
  it('updates the display name and returns a PublicUser with no passwordHash', async () => {
    const user = await User.create({
      email: 'profile-user@local.test',
      passwordHash: await hashPassword('SomePassw0rd'),
      role: 'admin',
      name: 'Old Name',
    });

    const updated = await updateProfile(String(user._id), '  New Display Name  ');
    expect(updated.name).toBe('New Display Name'); // trimmed
    expect('passwordHash' in (updated as object)).toBe(false);
    expect(JSON.stringify(updated)).not.toContain('$2'); // no bcrypt hash leaked

    // Persisted.
    const reread = await User.findById(user._id).lean();
    expect(reread?.name).toBe('New Display Name');
  });

  it('throws NotFoundError for a well-formed but absent user id', async () => {
    await expect(
      updateProfile(new mongoose.Types.ObjectId().toString(), 'Whoever'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('changePassword — verify current, enforce length, rotate the hash', () => {
  const CURRENT = 'CurrentPass!1';
  const NEXT = 'BrandNewPass!2';
  let userId: string;

  beforeAll(async () => {
    const user = await User.create({
      email: ADMIN_EMAIL,
      passwordHash: await hashPassword(CURRENT),
      role: 'admin',
      name: 'PW Admin',
    });
    userId = String(user._id);
  });

  it('throws ValidationError when the new password is shorter than 8 chars (and does NOT rotate)', async () => {
    const before = (await User.findById(userId).select('+passwordHash'))!.passwordHash;
    await expect(changePassword(userId, CURRENT, 'short')).rejects.toBeInstanceOf(ValidationError);
    const after = (await User.findById(userId).select('+passwordHash'))!.passwordHash;
    expect(after).toBe(before); // hash untouched
  });

  it('throws UnauthorizedError on a wrong current password (and does NOT rotate)', async () => {
    const before = (await User.findById(userId).select('+passwordHash'))!.passwordHash;
    await expect(
      changePassword(userId, 'wrong-current-password', NEXT),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    const after = (await User.findById(userId).select('+passwordHash'))!.passwordHash;
    expect(after).toBe(before);
    // The OLD password still logs in — the change genuinely did not happen.
    expect(await verifyLogin(ADMIN_EMAIL, CURRENT)).not.toBeNull();
  });

  it('throws UnauthorizedError for an absent user id', async () => {
    await expect(
      changePassword(new mongoose.Types.ObjectId().toString(), CURRENT, NEXT),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rotates the stored bcrypt hash on success: old password stops working, new one logs in', async () => {
    const before = (await User.findById(userId).select('+passwordHash'))!.passwordHash;

    await changePassword(userId, CURRENT, NEXT);

    const after = (await User.findById(userId).select('+passwordHash'))!.passwordHash;
    // The stored value is a NEW bcrypt hash — never the plaintext, and changed.
    expect(after).not.toBe(before);
    expect(after!.startsWith('$2')).toBe(true);
    expect(after).not.toContain(NEXT);

    // Observable login behaviour flipped.
    expect(await verifyLogin(ADMIN_EMAIL, CURRENT)).toBeNull(); // old no longer works
    const ok = await verifyLogin(ADMIN_EMAIL, NEXT);
    expect(ok).not.toBeNull(); // new one does
    expect(ok!.email).toBe(ADMIN_EMAIL);
  });
});
