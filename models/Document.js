import mongoose from "mongoose";

const documentSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name:      { type: String, required: true },
  type: {
    type: String,
    enum: ["GST", "PAN", "Experience", "Company", "Financial", "Affidavit", "DSC", "Other"],
    required: true,
  },
  fileUrl:   { type: String, required: true },
  fileName:  { type: String },
  fileSize:  { type: Number },
  expiryDate: { type: Date },
  tags:      [String],
  status: {
    type: String,
    enum: ["valid", "expiring", "expired"],
    default: "valid",
  },
}, { timestamps: true });

// Auto-update status based on expiry
documentSchema.pre("save", function (next) {
  if (this.expiryDate) {
    const now = new Date();
    const diff = (this.expiryDate - now) / (1000 * 60 * 60 * 24);
    if (diff < 0)  this.status = "expired";
    else if (diff <= 30) this.status = "expiring";
    else this.status = "valid";
  }
  next();
});

export const Document = mongoose.model("Document", documentSchema);