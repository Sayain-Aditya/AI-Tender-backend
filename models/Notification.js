import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type:    { type: String, enum: ["deadline", "document_expiry", "bid_update", "system"], required: true },
  title:   { type: String, required: true },
  message: { type: String, required: true },
  read:    { type: Boolean, default: false },
  refId:   { type: mongoose.Schema.Types.ObjectId },   // tenderId or documentId
  refType: { type: String },
}, { timestamps: true });

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ refId: 1, refType: 1 });

export const Notification = mongoose.model("Notification", notificationSchema);
