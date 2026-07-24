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
import {
  DOMAINS,
  SLUG_REGEX,
  SLUG_MIN,
  SLUG_MAX,
  type IProject,
} from './types';

/**
 * Project — a portfolio entry. One flat document; the domain-graph home and the
 * per-project case-study page both read from this collection.
 *
 * DATA LAYER ONLY: no business logic, no HTTP. Slug generation, publish rules,
 * and access control live in the service layer (owned by backend-dev).
 */

const projectLinkSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const projectLinksSchema = new Schema(
  {
    repo: { type: String, trim: true },
    live: { type: String, trim: true },
    docs: { type: String, trim: true },
    extra: { type: [projectLinkSchema], default: undefined },
  },
  { _id: false },
);

const projectGraphSchema = new Schema(
  {
    // Visual cluster key for the graph home. Defaults are applied at the
    // document level (see pre-validate) so it mirrors `domain` when unset.
    cluster: { type: String, trim: true },
    x: { type: Number, min: 0, max: 1 },
    y: { type: Number, min: 0, max: 1 },
    weight: { type: Number, min: 0, default: 1 },
  },
  { _id: false },
);

const projectSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true, // canonical URL key; DB is the final race guard
      lowercase: true,
      trim: true,
      minlength: SLUG_MIN,
      maxlength: SLUG_MAX,
      match: SLUG_REGEX,
    },
    domain: {
      type: String,
      required: true,
      enum: DOMAINS as unknown as string[],
    },
    summary: { type: String, default: '', trim: true },
    role: { type: String, default: '', trim: true },
    stack: { type: [String], default: [] },
    links: { type: projectLinksSchema, default: () => ({}) },
    heroText: { type: String, default: '', trim: true },
    longDescription: { type: String, default: '' },
    graph: { type: projectGraphSchema, default: () => ({}) },
    relatedPostSlugs: { type: [String], default: [] },
    order: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    // Normalize JSON output: expose `_id` as a string, drop the version key.
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

// Default the graph cluster to the domain when the author didn't set one, so
// the layout always has a grouping key. Pure data normalization, not logic.
projectSchema.pre('validate', function normalizeGraphCluster(next) {
  if (this.graph && !this.graph.cluster) {
    this.graph.cluster = this.domain;
  }
  next();
});

// --- Indexes ---------------------------------------------------------------
// `slug` uniqueness is declared inline above (unique:true).
// Serves the graph home + domain-filtered listings: "featured projects in
// domain X, in author-defined order". Covers the ORDER BY so no in-memory sort.
projectSchema.index({ domain: 1, order: 1 });
// Serves the global "all featured projects" fetch that builds the graph.
projectSchema.index({ featured: 1, order: 1 });

/** Inferred document type kept structurally aligned with the IProject contract. */
export type ProjectDocProps = InferSchemaType<typeof projectSchema>;
export type ProjectDocument = HydratedDocument<ProjectDocProps>;

export const Project: Model<ProjectDocProps> =
  (models.Project as Model<ProjectDocProps>) ||
  model<ProjectDocProps>('Project', projectSchema);

// Compile-time assurance the schema still satisfies the public contract shape.
// (Structural check only; erased at build.)
export type __ProjectContractCheck = IProject;

export default Project;
