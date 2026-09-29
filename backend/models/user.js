import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { BLOOD_GROUPS, DEPARTMENTS } from '../utils/constants.js';
import { signedPhotoUrl } from '../utils/cloudinary.js';

const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required.'], trim: true, maxlength: 80 },
    email: {
      type: String,
      required: [true, 'Email is required.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address.'],
    },
    // Always a bcrypt hash, never plaintext. The pre-save hook below is the
    // only supported way to set it, so a plain `User.create({ password })`
    // is still safe.
    password: { type: String, required: [true, 'Password is required.'], select: false },
    // Allocated once per user by memberController. No default: combined with
    // sparse:true, unallocated users are simply absent from the unique index
    // (a default of null would be indexed and collide across users).
    memberId: { type: String, unique: true, sparse: true },

    // ID card details captured at registration so the card can be pre-filled
    // instead of retyped. All optional — signup stays short, and the card runs
    // its own required checks on Generate. maxlength mirrors the card field
    // widths in frontend/src/config/template.js so a pre-filled value can't
    // come back rejected by the client-side validator.
    studentId: { type: String, trim: true, maxlength: 20 },
    department: { type: String, trim: true, maxlength: 20, uppercase: true, enum: DEPARTMENTS },
    bloodGroup: { type: String, trim: true, enum: BLOOD_GROUPS },
    contact: { type: String, trim: true, maxlength: 20 },
    address: { type: String, trim: true, maxlength: 140 },

    // The member's card photo, as a pointer to the image stored in Cloudinary
    // (utils/cloudinary.js) — never the bytes, which would put a megabyte into
    // every document that reads this one and into every auth response that
    // serialises it. publicId is the only reliable handle on the asset: a
    // transformed URL changes with every width or format, so it cannot be used
    // to find or destroy the original, and uploads are keyed on it so that
    // replacing a photo overwrites rather than orphans.
    //
    // version is stored alongside it for the same reason: it pins delivery to
    // the exact bytes that were uploaded, so a replaced photo is not served
    // from a stale cache entry.
    //
    // There is deliberately NO url field. Delivery is authenticated
    // (PHOTO_TYPE), so the URL is signed per member and may expire; persisting
    // one would hand out a frozen link. toJSON below mints a fresh one.
    //
    // No default: a member with no photo simply has no field here, and it rides
    // back inside the user payload for free, so the card re-hydrates on reload
    // without a second request.
    photo: {
      publicId: { type: String, trim: true },
      version: { type: Number },
      width: { type: Number },
      height: { type: Number },
      bytes: { type: Number },
      uploadedAt: { type: Date },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id?.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        // The one place a member's photo is turned into a fetchable URL, for
        // every response that carries a user. Doing it here rather than in each
        // controller is what guarantees there is no route that can accidentally
        // ship a member's picture over an unauthenticated link.
        if (ret.photo?.publicId) {
          ret.photo = { ...ret.photo, url: signedPhotoUrl(ret.photo.publicId, ret.photo.version) };
        }
        return ret;
      },
    },
  }
);

// Hash on create and on any password change, but skip re-hashing an already
// hashed value so unrelated saves (e.g. memberId allocation) stay cheap.
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
});

userSchema.methods.verifyPassword = function verifyPassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model('User', userSchema);
export default User;
