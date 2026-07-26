import mongoose, {
  Schema,
  model,
  type Model,
  type HydratedDocument,
  type InferSchemaType,
} from 'mongoose';

// Destructure `models` off the default export rather than importing it as a
// named binding: under `"type":"module"` the bare-`tsx` ESM loader (used by
// `pnpm seed`) cannot resolve a `models` named export from mongoose. This is the
// same default-import interop pattern connect.ts already uses.
const { models } = mongoose;
import { SITE_SETTINGS_KEY, type ISiteSettings } from './types';

/**
 * SiteSettings — a SINGLETON document holding site-wide config the admin edits
 * at runtime (site name/description, social + contact, default OG image). These
 * were previously hardcoded module constants; every field defaults to that
 * former hardcoded value so an EMPTY database renders an identical site.
 *
 * Singleton pattern: a fixed discriminator `key` pinned to the single legal
 * value `'site'` via `enum` + a `unique` index. All writes go through
 * `findOneAndUpdate({ key: 'site' }, …, { upsert: true, setDefaultsOnInsert })`,
 * so the unique index makes concurrent upserts race-safe (the DB rejects a
 * second `'site'` doc) and there can only ever be exactly one row. `key` is
 * not part of the public `ISiteSettings` contract — it is an internal anchor.
 *
 * DATA LAYER ONLY: no business logic, no HTTP. The read/write service helper
 * and the env-vs-DB precedence rules live in the service layer (backend-dev).
 *
 * NOTE: `siteUrl` is intentionally EXCLUDED — it stays the `NEXT_PUBLIC_SITE_URL`
 * env var because Next's `metadataBase` needs it at BUILD time, before any DB
 * read is possible.
 */

const siteSettingsSchema = new Schema(
  {
    // Singleton anchor: exactly one legal value, uniquely indexed. Never
    // exposed in the public contract — internal identity only.
    key: {
      type: String,
      default: SITE_SETTINGS_KEY,
      enum: [SITE_SETTINGS_KEY],
      unique: true,
      immutable: true,
    },
    siteName: {
      type: String,
      default: 'Abdullah Zakariyya',
      trim: true,
    },
    siteDescription: {
      type: String,
      default:
        'A body of engineering work as a star map — Web3, Security, Commerce and Tools, with a companion write-up per project.',
      trim: true,
    },
    githubUrl: {
      type: String,
      default: 'https://github.com',
      trim: true,
    },
    contactEmail: {
      type: String,
      default: 'hello@example.com',
      trim: true,
    },
    // Optional OG image asset URL. Empty string means "derive/none"; the
    // service layer decides the fallback.
    defaultOgImage: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
    // Normalize JSON output: expose `_id` as a string, drop the version key.
    // `key` remains on the object (harmless internal field) but is absent from
    // the public ISiteSettings contract.
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(_doc, ret: Record<string, unknown>) {
        ret._id = String(ret._id);
        delete ret.id;
        return ret;
      },
    },
  },
);

// --- Indexes ---------------------------------------------------------------
// `key` uniqueness is declared inline above (unique:true). That single unique
// index IS the singleton guard: it is exercised by the only access path —
// `findOneAndUpdate({ key: 'site' }, …, { upsert: true })` — for both the read
// (upsert-on-first-read) and every admin write, and it forces the DB to reject
// any second document. No other index is warranted: the collection holds one
// row, so there is no query that a secondary index could accelerate; adding one
// would be pure write cost with no return.

/** Inferred document type kept structurally aligned with the ISiteSettings contract. */
export type SiteSettingsDocProps = InferSchemaType<typeof siteSettingsSchema>;
export type SiteSettingsDocument = HydratedDocument<SiteSettingsDocProps>;

export const SiteSettings: Model<SiteSettingsDocProps> =
  (models.SiteSettings as Model<SiteSettingsDocProps>) ||
  model<SiteSettingsDocProps>('SiteSettings', siteSettingsSchema);

// Compile-time assurance the schema still satisfies the public contract shape.
// (Structural check only; erased at build.)
export type __SiteSettingsContractCheck = ISiteSettings;

export default SiteSettings;
