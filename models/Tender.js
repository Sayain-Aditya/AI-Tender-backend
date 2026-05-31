import mongoose from "mongoose";

const tenderSchema = new mongoose.Schema({
  uploadedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  source:       { type: String, enum: ["upload", "gem", "discovered"], default: "upload" },
  externalId:   { type: String },
  title:        { type: String, required: true },
  department:   { type: String },
  tenderValue:  { type: String },
  emdAmount:    { type: String },
  deadline:     { type: Date },
  category:     { type: String },  // free text — no enum restriction
  status: {
    type: String,
    enum: ["Draft", "Under Review", "Submitted", "Won", "Lost"],
    default: "Draft",
  },
  eligibility:  { type: Number, min: 0, max: 100, default: 0 },
  summary:      { type: String },
  requirements: [String],
  risks:        [String],
  fileUrl:      { type: String },
  fileName:     { type: String },
  rawText:      { type: String },           // extracted PDF text
  aiAnalyzed:   { type: Boolean, default: false },
  tags:         [String],
  notes:        { type: String },
}, { timestamps: true });

tenderSchema.index({ uploadedBy: 1, status: 1 });
tenderSchema.index({ uploadedBy: 1, deadline: 1 });
tenderSchema.index({ uploadedBy: 1, notes: 1 });
tenderSchema.index({ externalId: 1 }, { unique: true, sparse: true });
tenderSchema.index({ deadline: 1 });
tenderSchema.index({ title: "text", department: "text" });

export const Tender = mongoose.model("Tender", tenderSchema);
