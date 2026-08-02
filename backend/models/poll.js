import mongoose from "mongoose";

const optionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  votes: { type: Number, default: 0 }
});

const userVoteSchema = new mongoose.Schema({
  ip: { type: String, required: true },
  optionId: { type: mongoose.Schema.Types.ObjectId, required: true }
});

const pollSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    options: [optionSchema],
    totalVotes: { type: Number, default: 0 },
    votedUsers: [userVoteSchema],
    expiresAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export default mongoose.model("Poll", pollSchema);