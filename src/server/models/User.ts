import {
  Schema,
  model,
  models,
  type Model,
  type HydratedDocument,
  type InferSchemaType,
} from 'mongoose';
import { USER_ROLES, type IUser } from './types';

/**
 * User — an admin/author account backing CMS auth (ACCEPTANCE #4).
 *
 * DATA LAYER ONLY. The backend auth layer hashes passwords and writes
 * `passwordHash`; this model NEVER sees or stores a plaintext password.
 * `passwordHash` is `select:false`, so it is excluded from queries unless a
 * caller explicitly asks for it (`.select('+passwordHash')` during login).
 */

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true, // one account per email
      lowercase: true,
      trim: true,
    },
    // Server-written hash (bcrypt/argon2). Never a plaintext password.
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      required: true,
      enum: USER_ROLES as unknown as string[],
      default: 'admin',
    },
    name: { type: String, trim: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(_doc, ret: Record<string, unknown>) {
        ret._id = String(ret._id);
        delete ret.id;
        // Defense in depth: never leak the hash through JSON serialization.
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

// `email` uniqueness is declared inline above (unique:true) — serves login
// lookups (`findOne({ email })`) and enforces one-account-per-email.

export type UserDocProps = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserDocProps>;

export const User: Model<UserDocProps> =
  (models.User as Model<UserDocProps>) ||
  model<UserDocProps>('User', userSchema);

// Compile-time assurance the schema still satisfies the public contract shape.
export type __UserContractCheck = IUser;

export default User;
