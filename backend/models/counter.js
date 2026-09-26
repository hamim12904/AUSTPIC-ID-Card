import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. "member-2026-02"
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model('Counter', counterSchema);

export { Counter };
export default Counter;
