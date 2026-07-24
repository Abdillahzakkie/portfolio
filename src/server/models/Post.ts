import {
  Schema,
  model,
  models,
  type Model,
  type HydratedDocument,
  type InferSchemaType,
} from 'mongoose';
import {
  POST_STATUSES,
  SLUG_REGEX,
  SLUG_MIN,
  SLUG_MAX,
  type IPost,
} from './types';

/**
 * Post — a blog article. One flat document (per blog-system-builder). A binary
 * `draft ⇄ published` lifecycle drives public visibility and the sitemap.
 *
 * DATA LAYER ONLY: no business logic, no HTTP. Publishing (flipping status +
 * stamping publishedAt), slug validation, and reading-time computation are the
 * service layer's job (backend-dev). The schema only enforces shape + integrity.
 *
 * BODY STORAGE: Markdown/MDX string. See DATA-MODEL.md — content is
 * developer-authored, grounded in each repo's real docs, diffable, and lives in
 * git under `content/**`, which is exactly the case the blog-system-builder
 * decisions doc says to prefer Markdown over its HTML default.
 */

const postSeoSchema = new Schema(
  {
    metaTitle: { type: String, trim: true },
    metaDescription: { type: String, trim: true },
    ogImage: { type: String, trim: true },
  },
  { _id: false },
);

const postSchema = new Schema(
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
    status: {
      type: String,
      required: true,
      enum: POST_STATUSES as unknown as string[],
      default: 'draft',
    },
    // Null while draft; set to the first-publish instant. Nullable + defaulted
    // so a draft never carries a misleading date.
    publishedAt: { type: Date, default: null },
    excerpt: { type: String, default: '', trim: true },
    // Markdown/MDX source string (see header note).
    body: { type: String, default: '' },
    coverImage: { type: String, default: '', trim: true },
    // FK → Project.slug. Nullable: a standalone essay need not back a project.
    // Not a hard DB ref (Mongo has no cross-collection FK); integrity is by the
    // slug value and validated in the service layer.
    projectSlug: { type: String, default: null, lowercase: true, trim: true },
    tags: { type: [String], default: [] },
    seo: { type: postSeoSchema, default: () => ({}) },
    readingTime: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
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
// `slug` uniqueness is declared inline above (unique:true).
//
// Public published-list + sitemap query: "published posts, newest first".
//   find({ status: 'published' }).sort({ publishedAt: -1 })
// The compound (status, publishedAt desc) lets Mongo satisfy both the equality
// filter and the sort from the index — no in-memory sort, no collection scan.
postSchema.index({ status: 1, publishedAt: -1 });
// "Posts backing project X" (case-study page cross-links, ACCEPTANCE #3):
//   find({ projectSlug, status: 'published' })
postSchema.index({ projectSlug: 1, status: 1 });
// Tag landing pages / related-by-tag (multikey index over the tags array).
postSchema.index({ tags: 1 });

export type PostDocProps = InferSchemaType<typeof postSchema>;
export type PostDocument = HydratedDocument<PostDocProps>;

export const Post: Model<PostDocProps> =
  (models.Post as Model<PostDocProps>) ||
  model<PostDocProps>('Post', postSchema);

// Compile-time assurance the schema still satisfies the public contract shape.
export type __PostContractCheck = IPost;

export default Post;
