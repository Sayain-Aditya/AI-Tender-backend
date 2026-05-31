import mongoose from "mongoose";

const syncLogSchema = new mongoose.Schema(
  {
    source:   { type: String, enum: ["gem", "cppp", "govdata", "all"], required: true },
    tier:     { type: Number, enum: [1, 2, 3] },
    scraped:  { type: Number, default: 0 },
    saved:    { type: Number, default: 0 },
    cleaned:  { type: Number, default: 0 },
    error:    { type: String },
    duration: { type: Number },
  },
  { timestamps: true }
);

syncLogSchema.post("save", async function () {
  const count = await this.constructor.countDocuments();
  if (count <= 500) return;

  const oldest = await this.constructor
    .find()
    .sort({ createdAt: 1 })
    .limit(count - 500)
    .select("_id")
    .lean();

  await this.constructor.deleteMany({ _id: { $in: oldest.map((log) => log._id) } });
});

syncLogSchema.index({ source: 1, createdAt: -1 });

export const SyncLog = mongoose.model("SyncLog", syncLogSchema);
