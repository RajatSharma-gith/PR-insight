import mongoose, { Schema, Document, Model } from "mongoose";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/pr_insight";

let isConnected = false;

export async function connectDB(): Promise<void> {
  if (isConnected) return;

  await mongoose.connect(MONGO_URI);
  isConnected = true;
  console.log("✅ MongoDB connected:", MONGO_URI.split("@").pop()); // hide credentials if any
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string | null;
  googleId?: string | null;
  avatarUrl?: string | null;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name:      { type: String, required: true, trim: true },
    email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
    password:  { type: String, default: null },
    googleId:  { type: String, default: null, index: { sparse: true } },
    avatarUrl: { type: String, default: null },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

// ─── Review Session ───────────────────────────────────────────────────────────

export interface IReviewSession extends Document {
  userId: mongoose.Types.ObjectId;
  prUrl: string;
  summary: string;
  findingsCount: number;
  criticalCount: number;
  suggestionsCount: number;
  nitpicksCount: number;
  createdAt: Date;
}

const ReviewSessionSchema = new Schema<IReviewSession>(
  {
    userId:           { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    prUrl:            { type: String, required: true },
    summary:          { type: String, required: true },
    findingsCount:    { type: Number, default: 0 },
    criticalCount:    { type: Number, default: 0 },
    suggestionsCount: { type: Number, default: 0 },
    nitpicksCount:    { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const ReviewSession: Model<IReviewSession> =
  mongoose.models.ReviewSession ||
  mongoose.model<IReviewSession>("ReviewSession", ReviewSessionSchema);

// ─── Chat Message ─────────────────────────────────────────────────────────────

export interface IChatMessage extends Document {
  sessionId: mongoose.Types.ObjectId;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "ReviewSession", required: true, index: true },
    role:      { type: String, enum: ["user", "assistant"], required: true },
    content:   { type: String, required: true },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const ChatMessage: Model<IChatMessage> =
  mongoose.models.ChatMessage ||
  mongoose.model<IChatMessage>("ChatMessage", ChatMessageSchema);
