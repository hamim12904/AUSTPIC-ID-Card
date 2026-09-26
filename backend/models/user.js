import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { BLOOD_GROUPS, DEPARTMENTS } from '../utils/constants.js';

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
